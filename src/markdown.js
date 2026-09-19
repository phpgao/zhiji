/**
 * 知集 (ZhiJi) — MarkdownEngine 富文本 → Markdown 转换引擎
 */

const MarkdownEngine = (() => {
  function cleanUrl(raw) {
    if (!raw) return '';
    try {
      if (raw.startsWith('/')) return `https://www.zhihu.com${raw}`;
      const origin = typeof location !== "undefined" ? location.origin : "https://www.zhihu.com";
      const u = new URL(raw, origin);
      if (u.hostname === 'link.zhihu.com') {
        const t = u.searchParams.get('target');
        if (t) return decodeURIComponent(t);
      }
      return raw;
    } catch { return raw; }
  }

  function resolveImageSrc(img) {
    if (!img) return '';
    const src = img.getAttribute('data-actualsrc')
      || img.getAttribute('data-original')
      || img.getAttribute('data-default-watermark-src')
      || img.getAttribute('src') || '';
    if (src.startsWith('data:image/svg+xml') || src.startsWith('data:image/gif;base64,R0lGOD')) {
      return img.getAttribute('data-actualsrc') || img.getAttribute('data-original') || '';
    }
    return src;
  }

  function wrapInline(text, marker) {
    if (!text) return '';
    const lead = text.match(/^\s*/)[0];
    const trail = text.match(/\s*$/)[0];
    const core = text.trim();
    if (!core) return text;
    return `${lead}${marker}${core}${marker}${trail}`;
  }

  function convert(el) {
    const images = [];

    function walk(node, ctx = {}) {
      if (!node) return '';

      // Text node
      if (node.nodeType === 3) {
        let t = node.textContent;
        if (!ctx.inPre) {
          t = t.replace(/[\u200B-\u200D\uFEFF]/g, '');
        }
        return t;
      }
      if (node.nodeType !== 1) return '';

      const tag = node.tagName.toLowerCase();
      const children = () => Array.from(node.childNodes).map(c => walk(c, ctx)).join('');

      // Math
      if (node.classList.contains('ztext-math')) {
        const formula = node.getAttribute('data-formula') || node.textContent;
        if (!formula) return '';
        const isBlock = node.parentElement?.childNodes.length === 1 &&
          ['p', 'div'].includes(node.parentElement.tagName.toLowerCase());
        return isBlock ? `\n\n$$\n${formula}\n$$\n\n` : `$${formula}$`;
      }

      // Link Card
      if (node.classList.contains('LinkCard')) {
        const a = node.querySelector('a') || node;
        const href = cleanUrl(a.getAttribute('href'));
        const title = node.querySelector('.LinkCard-title')?.textContent?.trim()
          || node.querySelector('.LinkCard-content')?.textContent?.trim()
          || href;
        return `\n\n> 🔗 [${title}](${href})\n\n`;
      }

      switch (tag) {
        case 'h1': return `\n\n# ${children().trim()}\n\n`;
        case 'h2': return `\n\n## ${children().trim()}\n\n`;
        case 'h3': return `\n\n### ${children().trim()}\n\n`;
        case 'h4': return `\n\n#### ${children().trim()}\n\n`;
        case 'h5': return `\n\n##### ${children().trim()}\n\n`;
        case 'h6': return `\n\n###### ${children().trim()}\n\n`;

        case 'p': return `\n\n${children().trim()}\n\n`;
        case 'br': return '\n';
        case 'hr': return '\n\n---\n\n';

        case 'strong':
        case 'b': return wrapInline(children(), '**');

        case 'em':
        case 'i': return wrapInline(children(), '*');

        case 'del':
        case 's': return wrapInline(children(), '~~');

        case 'code':
          if (ctx.inPre) return node.textContent;
          return wrapInline(node.textContent, '`');

        case 'pre': {
          const codeEl = node.querySelector('code');
          let lang = '';
          const langMatch = (codeEl || node).className.match(/(?:language-|lang-)(\w+)/);
          if (langMatch) lang = langMatch[1];
          if (!lang) {
            const dataLang = node.getAttribute('data-lang');
            if (dataLang) lang = dataLang;
          }
          const codeText = (codeEl ? codeEl.textContent : node.textContent).replace(/\n$/, '');
          return `\n\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`;
        }

        case 'blockquote': {
          const inner = children().trim().split('\n').map(l => `> ${l}`).join('\n');
          return `\n\n${inner}\n\n`;
        }

        case 'ul': {
          const items = Array.from(node.children)
            .filter(c => c.tagName.toLowerCase() === 'li')
            .map(c => `- ${walk(c, ctx).trim()}`)
            .join('\n');
          return `\n\n${items}\n\n`;
        }

        case 'ol': {
          let idx = 1;
          const items = Array.from(node.children)
            .filter(c => c.tagName.toLowerCase() === 'li')
            .map(c => `${idx++}. ${walk(c, ctx).trim()}`)
            .join('\n');
          return `\n\n${items}\n\n`;
        }

        case 'li': return children().trim();

        case 'a': {
          const href = cleanUrl(node.getAttribute('href'));
          const text = children().trim();
          if (!href) return text;
          if (!text) return href;
          return `[${text}](${href})`;
        }

        case 'figure': {
          const img = node.querySelector('img');
          const cap = node.querySelector('figcaption')?.textContent?.trim() || '';
          if (!img) return children();
          const src = resolveImageSrc(img);
          if (!src) return '';
          images.push(src);
          return `\n\n![${cap}](${src})\n\n`;
        }

        case 'img': {
          if (node.closest('figure')) return '';
          if (node.classList?.contains('comment_emoji') || node.classList?.contains('ztext-emoji') || node.classList?.contains('Emoji') || (node.classList?.contains('sticker') && node.getAttribute('alt')?.startsWith('['))) {
            return node.getAttribute('alt') || '';
          }
          const src = resolveImageSrc(node);
          if (!src) return '';
          const alt = node.getAttribute('alt') || '';
          images.push(src);
          return `![${alt}](${src})`;
        }

        case 'table': {
          const rows = Array.from(node.querySelectorAll('tr'));
          if (!rows.length) return '';
          const matrix = rows.map(r =>
            Array.from(r.querySelectorAll('th, td')).map(c =>
              walk(c, ctx).replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|').trim()
            )
          ).filter(r => r.length);
          if (!matrix.length) return '';
          const cols = Math.max(...matrix.map(r => r.length));
          const widths = Array(cols).fill(3);
          matrix.forEach(r => r.forEach((c, i) => { widths[i] = Math.max(widths[i], c.length); }));
          const lines = [];
          lines.push(`| ${Array.from({ length: cols }, (_, i) => (matrix[0][i] || '').padEnd(widths[i])).join(' | ')} |`);
          lines.push(`| ${widths.map(w => '-'.repeat(Math.max(w, 3))).join(' | ')} |`);
          for (let r = 1; r < matrix.length; r++) {
            lines.push(`| ${Array.from({ length: cols }, (_, i) => (matrix[r]?.[i] || '').padEnd(widths[i])).join(' | ')} |`);
          }
          return `\n\n${lines.join('\n')}\n\n`;
        }

        case 'div':
          if (node.classList.contains('highlight')) {
            const pre = node.querySelector('pre');
            if (pre) return walk(pre, ctx);
          }
          return `\n\n${children()}\n\n`;

        default: return children();
      }
    }

    const raw = walk(el);
    const markdown = raw.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    return { markdown, images };
  }

  return { convert, cleanUrl, resolveImageSrc };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MarkdownEngine };
}
