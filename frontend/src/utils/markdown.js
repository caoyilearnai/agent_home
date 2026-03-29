function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderInline(value) {
  let html = escapeHtml(value);

  html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
  html = html.replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^\*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return html;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableDivider(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function getTableAlignments(line) {
  return splitTableRow(line).map((cell) => {
    if (/^:-{3,}:$/.test(cell)) {
      return 'center';
    }
    if (/^-{3,}:$/.test(cell)) {
      return 'right';
    }
    if (/^:-{3,}$/.test(cell)) {
      return 'left';
    }
    return null;
  });
}

export function renderMarkdownToHtml(markdown) {
  const source = String(markdown || '').replace(/\r\n/g, '\n').trim();

  if (!source) {
    return '';
  }

  const lines = source.split('\n');
  const html = [];
  let codeFence = null;
  let codeLines = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let quoteLines = [];
  let tableHeaders = [];
  let tableAlignments = [];
  let tableRows = [];

  function flushParagraph() {
    if (!paragraph.length) {
      return;
    }

    html.push(`<p>${paragraph.map(renderInline).join('<br />')}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!listType || !listItems.length) {
      return;
    }

    const tag = listType === 'ol' ? 'ol' : 'ul';
    const listClass = listItems.some((item) => item.checked !== null) ? ' class="task-list"' : '';
    const listHtml = listItems.map((item) => {
      if (item.checked === null) {
        return `<li>${renderInline(item.text)}</li>`;
      }

      const checkedAttribute = item.checked ? ' checked' : '';
      return `<li class="task-list-item"><input type="checkbox" disabled${checkedAttribute} /><span>${renderInline(item.text)}</span></li>`;
    }).join('');

    html.push(`<${tag}${listClass}>${listHtml}</${tag}>`);
    listType = null;
    listItems = [];
  }

  function flushQuote() {
    if (!quoteLines.length) {
      return;
    }

    html.push(`<blockquote>${quoteLines.map(renderInline).join('<br />')}</blockquote>`);
    quoteLines = [];
  }

  function flushTable() {
    if (!tableHeaders.length) {
      return;
    }

    const buildAlignedCell = (tag, cell, index) => {
      const alignment = tableAlignments[index];
      const alignAttribute = alignment ? ` style="text-align:${alignment}"` : '';
      return `<${tag}${alignAttribute}>${renderInline(cell)}</${tag}>`;
    };

    const headHtml = `<thead><tr>${tableHeaders.map((cell, index) => buildAlignedCell('th', cell, index)).join('')}</tr></thead>`;
    const bodyHtml = tableRows.length
      ? `<tbody>${tableRows.map((row) => `<tr>${row.map((cell, index) => buildAlignedCell('td', cell, index)).join('')}</tr>`).join('')}</tbody>`
      : '';

    html.push(`<div class="table-shell"><table>${headHtml}${bodyHtml}</table></div>`);
    tableHeaders = [];
    tableAlignments = [];
    tableRows = [];
  }

  function flushCodeFence() {
    if (!codeFence) {
      return;
    }

    const language = codeFence === true ? '' : escapeHtml(codeFence);
    const languageClass = language ? ` class="language-${language}"` : '';
    const label = language ? language.toUpperCase() : '代码块';
    html.push(
      `<div class="code-block-shell">` +
        `<div class="code-block-head"><span class="code-block-label">${label}</span></div>` +
        `<pre><code${languageClass}>${escapeHtml(codeLines.join('\n'))}</code></pre>` +
      `</div>`
    );
    codeFence = null;
    codeLines = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^(```|~~~)([\w#+.-]+)?\s*$/);

    if (fenceMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      flushTable();

      if (codeFence) {
        flushCodeFence();
      } else {
        codeFence = fenceMatch[2] || true;
      }

      continue;
    }

    if (codeFence) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      flushTable();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      flushTable();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2].trim())}</h${level}>`);
      continue;
    }

    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      flushTable();
      html.push('<hr />');
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      flushTable();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      flushTable();
      if (listType && listType !== 'ol') {
        flushList();
      }
      listType = 'ol';
      listItems.push({
        text: orderedMatch[1],
        checked: null
      });
      continue;
    }

    const unorderedMatch = line.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushQuote();
      flushTable();
      if (listType && listType !== 'ul') {
        flushList();
      }
      listType = 'ul';
      const taskMatch = unorderedMatch[1].match(/^\[( |x|X)\]\s+(.+)$/);
      listItems.push({
        text: taskMatch ? taskMatch[2] : unorderedMatch[1],
        checked: taskMatch ? /[xX]/.test(taskMatch[1]) : null
      });
      continue;
    }

    const nextLine = lines[index + 1];
    if (line.includes('|') && nextLine && isTableDivider(nextLine)) {
      flushParagraph();
      flushList();
      flushQuote();
      flushTable();

      tableHeaders = splitTableRow(line);
      tableAlignments = getTableAlignments(nextLine);
      tableRows = [];
      index += 1;

      while (index + 1 < lines.length) {
        const candidateLine = lines[index + 1];
        if (!candidateLine.trim() || !candidateLine.includes('|')) {
          break;
        }

        const cells = splitTableRow(candidateLine);
        if (!cells.length) {
          break;
        }

        tableRows.push(cells);
        index += 1;
      }

      flushTable();
      continue;
    }

    flushList();
    flushQuote();
    flushTable();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushQuote();
  flushTable();
  flushCodeFence();

  return html.join('');
}

export function markdownToExcerpt(markdown, limit = 180) {
  const source = String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<(https?:\/\/[^>\s]+)>/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/[*_~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (source.length <= limit) {
    return source;
  }

  return `${source.slice(0, limit).trim()}…`;
}
