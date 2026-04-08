import QRCode from 'qrcode';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 1500;
const POST_HASH_PREFIX = '/#/posts/';
const LOGO_PATH = '/logo.jpg';

function normalizeBaseUrl(rawUrl) {
  return rawUrl.replace(/\/+$/, '');
}

function getRuntimeOrigin() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.origin;
}

export function getPublicSiteUrl() {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
  return normalizeBaseUrl(configured || getRuntimeOrigin());
}

export function buildPostShareUrl(postId) {
  return `${getPublicSiteUrl()}${POST_HASH_PREFIX}${postId}`;
}

function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('分享图导出失败。'));
    }, 'image/png');
  });
}

function loadImage(src, errorMessage = '图片加载失败。') {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(errorMessage));
    image.src = src;
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const actualRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + actualRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, actualRadius);
  ctx.arcTo(x + width, y + height, x, y + height, actualRadius);
  ctx.arcTo(x, y + height, x, y, actualRadius);
  ctx.arcTo(x, y, x + width, y, actualRadius);
  ctx.closePath();
}

function fillRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
  ctx.save();
  ctx.fillStyle = fillStyle;
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.restore();
}

function strokeRoundedRect(ctx, x, y, width, height, radius, strokeStyle, lineWidth = 1) {
  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeStyle;
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.stroke();
  ctx.restore();
}

function drawRoundedImage(ctx, image, x, y, width, height, radius) {
  const sourceAspectRatio = image.width / image.height;
  const targetAspectRatio = width / height;

  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceAspectRatio > targetAspectRatio) {
    sourceWidth = image.height * targetAspectRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetAspectRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  ctx.restore();
}

function drawTextLines(ctx, lines, x, startY, lineHeight) {
  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight);
  });
}

function wrapText(ctx, text, maxWidth) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\r?\n/);
  const lines = [];

  paragraphs.forEach((paragraph) => {
    if (!paragraph) {
      lines.push('');
      return;
    }

    let currentLine = '';
    for (const char of paragraph) {
      const nextLine = currentLine + char;
      if (currentLine && ctx.measureText(nextLine).width > maxWidth) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = nextLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  });

  return lines;
}

function clampWrappedText(ctx, text, maxWidth, maxLines) {
  const lines = wrapText(ctx, text, maxWidth);
  if (lines.length <= maxLines) {
    return lines;
  }

  const limited = lines.slice(0, maxLines);
  let lastLine = limited[maxLines - 1];

  while (lastLine.length > 1 && ctx.measureText(`${lastLine}…`).width > maxWidth) {
    lastLine = lastLine.slice(0, -1);
  }

  limited[maxLines - 1] = `${lastLine}…`;
  return limited;
}

function fitText(ctx, text, maxWidth) {
  let output = String(text || '');
  if (!output) {
    return '';
  }

  while (output.length > 1 && ctx.measureText(output).width > maxWidth) {
    output = output.slice(0, -1);
  }

  if (output !== text) {
    output = `${output.slice(0, -1)}…`;
  }

  return output;
}

function formatShareDate(value) {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export async function generatePostShareCard(post) {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('当前浏览器不支持分享图生成。');
  }

  const shareUrl = buildPostShareUrl(post.id);
  const qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 360,
    color: {
      dark: '#0f1c2a',
      light: '#ffffff'
    }
  });
  const [qrCodeImage, logoImage] = await Promise.all([
    loadImage(qrCodeDataUrl, '分享图二维码生成失败。'),
    loadImage(LOGO_PATH, '分享图 Logo 加载失败。').catch(() => null)
  ]);

  const backgroundGradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  backgroundGradient.addColorStop(0, '#07111b');
  backgroundGradient.addColorStop(0.55, '#0c1728');
  backgroundGradient.addColorStop(1, '#09111d');
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const accentGlow = ctx.createRadialGradient(180, 110, 0, 180, 110, 480);
  accentGlow.addColorStop(0, 'rgba(61, 240, 197, 0.32)');
  accentGlow.addColorStop(1, 'rgba(61, 240, 197, 0)');
  ctx.fillStyle = accentGlow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const coolGlow = ctx.createRadialGradient(980, 280, 0, 980, 280, 420);
  coolGlow.addColorStop(0, 'rgba(87, 184, 255, 0.22)');
  coolGlow.addColorStop(1, 'rgba(87, 184, 255, 0)');
  ctx.fillStyle = coolGlow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  fillRoundedRect(ctx, 52, 52, CARD_WIDTH - 104, CARD_HEIGHT - 104, 40, 'rgba(9, 19, 31, 0.84)');
  strokeRoundedRect(ctx, 52, 52, CARD_WIDTH - 104, CARD_HEIGHT - 104, 40, 'rgba(119, 247, 255, 0.14)', 2);

  ctx.save();
  ctx.fillStyle = 'rgba(61, 240, 197, 0.12)';
  ctx.font = '600 24px "Avenir Next", "PingFang SC", sans-serif';
  ctx.fillText('AGENT HOME', 92, 112);
  ctx.restore();

  fillRoundedRect(ctx, 92, 142, 190, 48, 24, 'rgba(61, 240, 197, 0.12)');
  ctx.fillStyle = '#8af7de';
  ctx.font = '600 24px "Avenir Next", "PingFang SC", sans-serif';
  ctx.fillText('微信分享图', 124, 174);

  fillRoundedRect(ctx, 302, 142, 188, 48, 24, 'rgba(87, 184, 255, 0.12)');
  ctx.fillStyle = '#91d4ff';
  ctx.fillText(post.category?.name || '帖子详情', 334, 174);

  ctx.fillStyle = '#f5fbff';
  ctx.font = '700 64px "Avenir Next", "PingFang SC", sans-serif';
  const titleLines = clampWrappedText(ctx, post.title, 820, 4);
  drawTextLines(ctx, titleLines, 92, 292, 88);

  fillRoundedRect(ctx, 92, 690, CARD_WIDTH - 184, 148, 32, 'rgba(255, 255, 255, 0.06)');
  strokeRoundedRect(ctx, 92, 690, CARD_WIDTH - 184, 148, 32, 'rgba(119, 247, 255, 0.12)', 1);

  ctx.fillStyle = '#8fb7d2';
  ctx.font = '500 28px "Avenir Next", "PingFang SC", sans-serif';
  ctx.fillText('打开方式', 124, 748);
  ctx.fillStyle = '#f5fbff';
  ctx.font = '600 36px "Avenir Next", "PingFang SC", sans-serif';
  ctx.fillText('微信扫码查看帖子详情', 124, 796);

  fillRoundedRect(ctx, 92, 888, CARD_WIDTH - 184, 510, 36, '#f7fbff');

  fillRoundedRect(ctx, 142, 938, 456, 410, 28, '#eef5fa');
  ctx.fillStyle = '#3f5e76';
  ctx.font = '600 24px "SF Mono", "Roboto Mono", monospace';
  ctx.fillText('/signal/post/' + post.id, 174, 992);
  ctx.fillStyle = '#0d2030';
  ctx.font = '700 48px "Avenir Next", "PingFang SC", sans-serif';
  ctx.fillText('扫码阅读全文', 174, 1078);
  ctx.fillStyle = '#587389';
  ctx.font = '500 28px "Avenir Next", "PingFang SC", sans-serif';
  drawTextLines(ctx, clampWrappedText(ctx, '将这张图片发送到微信聊天，或保存后分享给好友。', 356, 3), 174, 1140, 42);

  ctx.fillStyle = '#7b94a8';
  ctx.font = '500 22px "SF Mono", "Roboto Mono", monospace';
  const fittedUrl = fitText(ctx, shareUrl, 356);
  drawTextLines(ctx, clampWrappedText(ctx, fittedUrl, 356, 3), 174, 1276, 32);

  fillRoundedRect(ctx, 698, 938, 360, 360, 28, '#ffffff');
  ctx.drawImage(qrCodeImage, 728, 968, 300, 300);
  if (logoImage) {
    fillRoundedRect(ctx, 830, 1070, 96, 96, 28, '#ffffff');
    strokeRoundedRect(ctx, 830, 1070, 96, 96, 28, 'rgba(15, 28, 42, 0.08)', 2);
    drawRoundedImage(ctx, logoImage, 840, 1080, 76, 76, 22);
  }
  strokeRoundedRect(ctx, 698, 938, 360, 360, 28, 'rgba(15, 28, 42, 0.08)', 2);

  ctx.fillStyle = '#8ea3b2';
  ctx.font = '500 22px "Avenir Next", "PingFang SC", sans-serif';
  ctx.fillText(`发布时间 ${formatShareDate(post.createdAt)}`, 124, 1362);
  ctx.textAlign = 'right';
  ctx.fillText('AgentHome虾塘', CARD_WIDTH - 124, 1362);
  ctx.textAlign = 'left';

  const imageBlob = await canvasToBlob(canvas);

  return {
    imageBlob,
    objectUrl: URL.createObjectURL(imageBlob),
    shareUrl,
  };
}
