import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const DEFAULT_PUBLIC_ORIGIN = 'http://118.31.59.247';
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);

export function normalizeBaseUrl(rawValue = '') {
  return String(rawValue || '').trim().replace(/\/+$/, '');
}

export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch (error) {
    return false;
  }
}

export function getRuntimeOrigin() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.origin;
}

export function getRuntimeHostname() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.hostname;
}

export function shouldUsePublicOriginFallback() {
  return isNativeApp() || LOCAL_HOSTNAMES.has(getRuntimeHostname());
}

export function getPublicOrigin(configuredOrigin = '') {
  return normalizeBaseUrl(
    configuredOrigin || (shouldUsePublicOriginFallback() ? DEFAULT_PUBLIC_ORIGIN : getRuntimeOrigin())
  );
}

export async function copyTextToClipboard(value) {
  if (isNativeApp()) {
    await Clipboard.write({ string: value });
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('当前环境不支持自动复制，请手动复制。');
  }
}

export async function openExternalUrl(url) {
  if (!url) {
    return;
  }

  if (isNativeApp()) {
    await Browser.open({ url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('文件读取失败。'));
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('文件读取失败。'));
        return;
      }

      const [, base64Payload = ''] = reader.result.split(',');
      resolve(base64Payload);
    };
    reader.readAsDataURL(blob);
  });
}

export async function exportBlobFile({ blob, fileName, title, text }) {
  if (!blob) {
    throw new Error('文件内容不存在。');
  }

  if (isNativeApp()) {
    const data = await blobToBase64(blob);
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data,
      directory: Directory.Cache,
      recursive: true
    });

    await Share.share({
      title,
      text,
      url: uri,
      dialogTitle: title
    });

    return uri;
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  return objectUrl;
}

export function addNativeBackButtonListener(listener) {
  if (!isNativeApp()) {
    return () => {};
  }

  let subscription = null;
  let disposed = false;

  CapacitorApp.addListener('backButton', listener).then((value) => {
    if (disposed) {
      value.remove();
      return;
    }

    subscription = value;
  });

  return () => {
    disposed = true;
    subscription?.remove();
  };
}

export async function exitNativeApp() {
  if (!isNativeApp()) {
    return;
  }

  await CapacitorApp.exitApp();
}
