// ==UserScript==
// @name         知集 (ZhiJi)
// @namespace    https://github.com/phpgao/zhiji
// @version      1.0.0
// @description  知乎内容采集器 — 支持单回答/多回答导出、YAML frontmatter、Obsidian 一键存入、本地 ZIP 打包（含图片）、动态可视化配置
// @author       ZhiJi
// @icon         https://raw.githubusercontent.com/phpgao/zhiji/main/assets/logo.png
// @match        https://www.zhihu.com/question/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_notification
// @license      MIT
// ==/UserScript==

;(function () {
  'use strict';

  /* ── config.js ── */
/**
 * 知集 (ZhiJi) — ConfigManager 配置管理器
 * 统一抽象 chrome.storage.sync、GM_getValue/GM_setValue、localStorage
 */

const ConfigManager = (() => {
  const STORAGE_KEY = 'zhiji_config';

  const DEFAULTS = {
    vault: '',
    folder: '',
    autoExpand: true,
    includeDetail: true,
    includeTags: true,
    includeAnswerMeta: true,
    includeComments: true,
    maxComments: 100,
    includeFrontmatter: true,
  };

  let current = { ...DEFAULTS };
  const listeners = new Set();

  function loadLocal() {
    try {
      if (typeof GM_getValue === 'function') {
        const raw = GM_getValue(STORAGE_KEY, null);
        if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  function saveLocal(data) {
    try {
      const json = JSON.stringify(data);
      if (typeof GM_setValue === 'function') {
        GM_setValue(STORAGE_KEY, json);
      }
      localStorage.setItem(STORAGE_KEY, json);
    } catch {}
  }

  function notify() {
    for (const fn of listeners) {
      try { fn(current); } catch {}
    }
  }

  function init() {
    const local = loadLocal();
    if (local) current = { ...DEFAULTS, ...local };

    // Chrome Extension Storage Sync
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.get(STORAGE_KEY, res => {
        if (res?.[STORAGE_KEY]) {
          current = { ...DEFAULTS, ...res[STORAGE_KEY] };
          saveLocal(current);
          notify();
        }
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes[STORAGE_KEY]?.newValue) {
          current = { ...DEFAULTS, ...changes[STORAGE_KEY].newValue };
          saveLocal(current);
          notify();
        }
      });
    }

    // Window storage event (multi-tab sync)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', e => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            current = { ...DEFAULTS, ...JSON.parse(e.newValue) };
            notify();
          } catch {}
        }
      });
    }

    return current;
  }

  function get() {
    return { ...current };
  }

  function set(partial) {
    current = { ...current, ...partial };
    saveLocal(current);

    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.set({ [STORAGE_KEY]: current }).catch(() => {});
    }

    notify();
    return current;
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function reset() {
    return set(DEFAULTS);
  }

  init();

  return { get, set, reset, onChange, DEFAULTS };
})();

  /* ── markdown.js ── */
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

  /* ── parser.js ── */
/**
 * 知集 (ZhiJi) — PageParser 知乎 DOM 数据解析提取
 */

const PageParser = (() => {
  function detectMode(pathname = (typeof location !== 'undefined' ? location.pathname : '')) {
    const m = (pathname || '').match(/^\/question\/(\d+)(?:\/answer\/(\d+))?/);
    if (!m) return { mode: 'multi', questionId: '0' };
    return {
      mode: m[2] ? 'single' : 'multi',
      questionId: m[1],
      answerId: m[2] || undefined,
    };
  }

  function getTotalAnswerCount(doc = document) {
    // Strategy 1: meta tag
    const meta = doc.querySelector('meta[itemprop="answerCount"]');
    if (meta) {
      const v = parseInt(meta.getAttribute('content'), 10);
      if (!isNaN(v)) return v;
    }

    // Strategy 2: js-initialData JSON
    try {
      const script = doc.getElementById('js-initialData');
      if (script?.textContent) {
        const data = JSON.parse(script.textContent);
        const qs = data?.initialState?.entities?.questions;
        if (qs) {
          const qid = Object.keys(qs)[0];
          if (qid && qs[qid]?.answerCount != null) return parseInt(qs[qid].answerCount, 10);
        }
      }
    } catch {}

    // Strategy 3: List header
    const header = doc.querySelector('.List-headerText, .QuestionMainAction, .List-header');
    if (header) {
      const m = header.textContent.replace(/,/g, '').match(/(\d+)\s*个回答/);
      if (m) return parseInt(m[1], 10);
    }

    // Strategy 4: text scan
    for (const el of doc.querySelectorAll('h4, h3, div')) {
      if (el.childNodes.length <= 3 && el.textContent?.includes('个回答')) {
        const m = el.textContent.replace(/,/g, '').match(/(\d+)\s*个回答/);
        if (m) return parseInt(m[1], 10);
      }
    }
    return null;
  }

  function getStatNumber(pattern, doc = document) {
    const els = doc.querySelectorAll('.NumberBoard-itemValue, .QuestionFollowStatus-counts .NumberBoard-itemValue');
    for (const el of els) {
      const parent = el.closest('.NumberBoard-item');
      if (parent && pattern.test(parent.textContent)) {
        const text = el.textContent.trim().replace(/,/g, '');
        const v = parseInt(text, 10);
        if (!isNaN(v)) return v;
      }
    }
    for (const el of doc.querySelectorAll('.QuestionHeaderActions, .NumberBoard, .QuestionHeader-side')) {
      if (pattern.test(el.textContent)) {
        const m = el.textContent.replace(/,/g, '').match(/\d+/);
        if (m) {
          const v = parseInt(m[0], 10);
          if (!isNaN(v)) return v;
        }
      }
    }
    return null;
  }

  function extractQuestion(doc = document) {
    const titleEl = doc.querySelector('.QuestionHeader-title') || doc.querySelector('h1');
    const title = titleEl?.textContent?.trim() || '未命名问题';
    const url = (typeof location !== 'undefined' ? location.href : '').split('?')[0].replace(/\/answer\/\d+$/, '');
    const { questionId } = detectMode(typeof location !== 'undefined' ? location.pathname : '');

    // Tags
    const tagEls = doc.querySelectorAll('.QuestionHeader-tags .Tag, .QuestionTopic .Popover div, .QuestionHeader-tags .Tag-content');
    const tags = [...new Set(Array.from(tagEls).map(e => e.textContent.trim()).filter(Boolean))];

    // Detail
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : { includeDetail: true };
    let detail = '';
    if (cfg.includeDetail) {
      const detailEl = doc.querySelector('.QuestionHeader-detail .RichText.ztext, .QuestionRichText .RichText.ztext, .QuestionHeader-detail');
      if (detailEl && typeof MarkdownEngine !== 'undefined') {
        detail = MarkdownEngine.convert(detailEl).markdown;
      }
    }

    return {
      title,
      questionId,
      url,
      detail,
      tags,
      answerCount: getTotalAnswerCount(doc),
      followerCount: getStatNumber(/(?:关注者|人关注|关注)/, doc),
      viewCount: getStatNumber(/(?:被浏览|次浏览|浏览)/, doc),
    };
  }

  function findCommentButton(item) {
    if (!item) return null;
    const actions = item.querySelector('.ContentItem-actions') || item;
    const btns = actions.querySelectorAll('button');
    for (const btn of btns) {
      const aria = btn.getAttribute('aria-label') || '';
      const text = (btn.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (aria.includes('评论') || text.includes('评论')) {
        return btn;
      }
    }
    return null;
  }

  function parseSingleComment(el, isRoot = true) {
    const peopleLinks = Array.from(el.querySelectorAll('a[href*="/people/"], .UserLink-link, .UserLink a'));
    const authorLink = peopleLinks.find(a => !a.querySelector('img') && a.textContent.trim()) || peopleLinks[0];
    const author = authorLink?.textContent?.replace(/[\u200B-\u200D\uFEFF]/g, '')?.trim()
      || el.querySelector('img.Avatar')?.getAttribute('alt')
      || el.querySelector('.UserLink')?.textContent?.trim()
      || '匿名用户';
    let authorUrl = authorLink?.getAttribute('href') || '';
    if (authorUrl && authorUrl.startsWith('//')) authorUrl = `https:${authorUrl}`;
    else if (authorUrl && authorUrl.startsWith('/')) authorUrl = `https://www.zhihu.com${authorUrl}`;

    const roleEl = el.querySelector('.CommentItemV2-roleTag, [class*="roleTag"], [class*="RoleTag"], .AuthorInfo-badge')
      || Array.from(el.querySelectorAll('span')).find(s => s.textContent.trim() === '作者');
    const roleTag = roleEl?.textContent?.trim() || '';

    let replyTo = '';
    if (!isRoot) {
      const replyEl = el.querySelector('.CommentItemV2-reply, [class*="reply"], [class*="Reply"]');
      if (replyEl) {
        const target = replyEl.querySelector('a[href*="/people/"], .UserLink-link, a');
        if (target) replyTo = target.textContent.trim();
      }
      if (!replyTo) {
        const headerEl = el.querySelector('[class*="userName"], [class*="author"], [class*="1tww9qq"], .CommentItemV2-meta, [class*="meta"]');
        const headerText = (headerEl ? headerEl.textContent : el.textContent) || '';
        const m = headerText.match(/回复\s+([^\s:：]+)/);
        if (m) replyTo = m[1];
      }
    }

    const timeEl = el.querySelector('.CommentItemV2-time, .CommentItem-time, [class*="CommentItemV2-time"], [class*="time"], time')
      || Array.from(el.querySelectorAll('span')).find(s => /(?:\d+\s*(?:秒|分钟|小时|天)前|昨天|\d{4}-\d{2}-\d{2}|\d{2}-\d{2})/.test(s.textContent));
    const publishedAt = timeEl?.textContent?.trim() || '';

    const likeBtn = el.querySelector('.CommentItemV2-likeBtn, button[aria-label*="赞"], [class*="LikeButton"], [class*="likeBtn"]')
      || Array.from(el.querySelectorAll('button')).find(b => b.querySelector('.ZDI--Heart, [class*="Heart" i]') || b.textContent.includes('赞'));
    let likes = '';
    if (likeBtn) {
      const digits = likeBtn.textContent?.replace(/[^\d]/g, '') || '';
      if (digits) likes = digits;
    }

    const contentEl = el.querySelector('.CommentContent, .CommentItemV2-content, .RichText, [class*="CommentContent"], [class*="commentContent"], [class*="content"]');
    let content = '';
    let images = [];
    if (contentEl) {
      const clone = contentEl.cloneNode(true);
      clone.querySelectorAll('[data-id], .CommentItemV2, .CommentItem, [class*="subList"], [class*="childList"]').forEach(s => s.remove());
      if (typeof MarkdownEngine !== 'undefined') {
        const res = MarkdownEngine.convert(clone);
        content = res.markdown;
        images = res.images || [];
      } else {
        clone.querySelectorAll('img[alt]').forEach(img => {
          img.replaceWith(img.getAttribute('alt') || '');
        });
        content = clone.textContent.trim();
      }
    }

    const comment = {
      author,
      authorUrl,
      roleTag,
      content,
      publishedAt,
      likes,
      images,
    };

    if (replyTo) comment.replyTo = replyTo;

    if (isRoot) {
      const replies = [];
      const childEls = Array.from(el.querySelectorAll('[data-id], .CommentItemV2, .CommentItem'));
      for (const childEl of childEls) {
        replies.push(parseSingleComment(childEl, false));
      }
      comment.replies = replies;
    }

    return comment;
  }

  function findCommentContainer(item, doc = (typeof document !== 'undefined' ? document : null)) {
    // 1. If item itself is a comment container (e.g. Modal-content or element with comments)
    if (item) {
      if (item.matches?.('.Comments-container, .Modal-content, [class*="Comments-container"], [class*="Modal-content"], [role="dialog"]')
        || (item.querySelector?.('[data-id]') && !item.matches?.('.AnswerItem'))) {
        return item;
      }
      const inner = item.querySelector?.('.Comments-container, [class*="Comments-container"], .Modal-content, [class*="Modal-content"], .CommentListV2, [class*="CommentList"]');
      if (inner) return inner;

      if (item.nextElementSibling) {
        if (item.nextElementSibling.matches?.('.Comments-container, [class*="Comments-container"], .Modal-content') || item.nextElementSibling.querySelector?.('.Comments-container, [class*="Comments-container"], .Modal-content')) {
          return item.nextElementSibling.matches?.('.Comments-container, [class*="Comments-container"], .Modal-content')
            ? item.nextElementSibling
            : item.nextElementSibling.querySelector('.Comments-container, [class*="Comments-container"], .Modal-content');
        }
      }
    }

    // 2. Check doc for modal/dialog or floating container containing comments
    if (doc) {
      const modals = Array.from(doc.querySelectorAll('.Modal-content, [class*="Modal-content"], [role="dialog"], .Modal, .css-1aq8hf9'));
      for (const m of modals) {
        if (m.querySelector?.('[data-id], .CommentContent, [class*="CommentContent"]')) {
          return m;
        }
      }
      const c = doc.querySelector('.Comments-container, [class*="Comments-container"], .CommentListV2, [class*="CommentList"]');
      if (c) return c;
    }

    return null;
  }

  function parseComments(item, doc = (typeof document !== 'undefined' ? document : null)) {
    const container = findCommentContainer(item, doc);
    if (!container) return [];

    // All comment items (both modern [data-id] and legacy .CommentItemV2 / .CommentItem)
    const allItems = Array.from(container.querySelectorAll('[data-id], .CommentItemV2, .CommentItem'));

    const rootEls = allItems.filter(el => {
      let p = el.parentElement;
      while (p && p !== container) {
        if (
          p.hasAttribute?.('data-id') ||
          p.classList?.contains('CommentItemV2') ||
          p.classList?.contains('CommentItem') ||
          p.classList?.contains('CommentItemV2-subList') ||
          p.classList?.contains('CommentItem-subList') ||
          (typeof p.className === 'string' && (p.className.includes('subList') || p.className.includes('childList')))
        ) {
          return false;
        }
        p = p.parentElement;
      }
      return true;
    });

    return rootEls.map(rootEl => parseSingleComment(rootEl, true));
  }

  function openComments(item, doc = (typeof document !== 'undefined' ? document : null)) {
    if (!item) return;
    const hasContainer = findCommentContainer(item, doc);
    if (hasContainer) return;

    const commentBtn = findCommentButton(item);
    if (commentBtn) {
      const text = (commentBtn.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (!text.includes('收起') && !text.includes('添加评论')) {
        try { commentBtn.click(); } catch {}
      }
    }
  }

  function ensureDefaultSort(container) {
    if (!container) return;
    const tabs = Array.from(container.querySelectorAll('div, button, span')).filter(el =>
      el.children.length === 0 && (el.textContent.trim() === '默认' || el.textContent.trim() === '最新')
    );
    const defaultTab = tabs.find(t => t.textContent.trim() === '默认');
    if (defaultTab) {
      try { defaultTab.click(); } catch {}
    }
  }

  function expandSubComments(container) {
    if (!container) return 0;
    let clicked = 0;
    const btns = Array.from(container.querySelectorAll('button'));
    for (const b of btns) {
      if (b.textContent && (b.textContent.includes('展开其他') || b.textContent.includes('查看更多回复') || b.textContent.includes('更多回复'))) {
        try { b.click(); clicked++; } catch {}
      }
    }
    return clicked;
  }

  function findCommentScrollContainer(commentContainer) {
    if (!commentContainer) return null;
    const win = (commentContainer.ownerDocument && commentContainer.ownerDocument.defaultView) || (typeof window !== 'undefined' ? window : null);

    // Check descendants first
    const elements = [commentContainer, ...Array.from(commentContainer.querySelectorAll('*'))];
    for (const el of elements) {
      const style = win ? win.getComputedStyle(el) : null;
      if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        return el;
      }
    }

    // Check Zhihu specific scroll wrapper classes (such as .css-34podr)
    const specific = commentContainer.querySelector?.('.css-34podr, [class*="34podr"], .Modal-content, [class*="Modal-content"]');
    if (specific) return specific;

    // Check ancestors (e.g. if Comments-container is wrapped in a scrollable modal/dialog/drawer)
    let p = commentContainer.parentElement;
    while (p && p !== (typeof document !== 'undefined' ? document.body : null)) {
      const style = win ? win.getComputedStyle(p) : null;
      if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
        return p;
      }
      p = p.parentElement;
    }
    return commentContainer;
  }

  function countAllComments(comments) {
    if (!Array.isArray(comments)) return 0;
    return comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);
  }

  function limitComments(comments, max = 100) {
    if (!Array.isArray(comments)) return [];
    let count = 0;
    const result = [];
    for (const root of comments) {
      if (count >= max) break;
      const rootCopy = { ...root };
      count++;
      if (rootCopy.replies && rootCopy.replies.length > 0) {
        const remaining = max - count;
        if (remaining > 0) {
          rootCopy.replies = rootCopy.replies.slice(0, remaining);
          count += rootCopy.replies.length;
        } else {
          rootCopy.replies = [];
        }
      }
      result.push(rootCopy);
    }
    return result;
  }

  async function scrollAndCollectComments(item, maxComments = 100, onProgress = null, answerObj = null, doc = (typeof document !== 'undefined' ? document : null)) {
    if (!item) return [];
    openComments(item, doc);

    // 1. Wait for comment container to appear
    let container = null;
    for (let i = 0; i < 20; i++) {
      container = findCommentContainer(item, doc);
      if (container) break;
      await new Promise(r => setTimeout(r, 150));
    }

    if (!container) return [];

    // 2. Ensure default sort (默认排序)
    ensureDefaultSort(container);
    await new Promise(r => setTimeout(r, 200));

    // 3. Find scrollable element in comment floating window/container
    const scrollEl = findCommentScrollContainer(container);

    let lastCount = 0;
    let stagnantCount = 0;
    const maxScrollRounds = 35; // max 35 scrolls

    for (let round = 0; round < maxScrollRounds; round++) {
      expandSubComments(container);

      const parsed = parseComments(item, doc);
      const currentTotal = countAllComments(parsed);

      if (typeof onProgress === 'function') {
        onProgress(Math.min(currentTotal, maxComments));
      }

      if (currentTotal >= maxComments) {
        const capped = limitComments(parsed, maxComments);
        if (answerObj) answerObj.comments = capped;
        return capped;
      }

      if (currentTotal > lastCount) {
        lastCount = currentTotal;
        stagnantCount = 0;
      } else {
        stagnantCount++;
        if (stagnantCount >= 3) {
          // No more comments loaded after 3 consecutive scrolls
          const capped = limitComments(parsed, maxComments);
          if (answerObj) answerObj.comments = capped;
          return capped;
        }
      }

      // Scroll the comment floating window
      if (scrollEl && scrollEl !== (doc ? doc.body : null)) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
        try { scrollEl.dispatchEvent(new Event('scroll', { bubbles: true })); } catch {}
      }
      try {
        container.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
      } catch {}

      await new Promise(r => setTimeout(r, 500));
    }

    const finalComments = limitComments(parseComments(item, doc), maxComments);
    if (answerObj) answerObj.comments = finalComments;
    return finalComments;
  }

  function scanAnswers(knownIds, targetId, doc = document) {
    const results = [];
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : { autoExpand: true, includeComments: true };
    const curMode = detectMode(typeof location !== 'undefined' ? location.pathname : '');
    const isSingleMode = curMode.mode === 'single' || !!targetId;

    for (const item of doc.querySelectorAll('.AnswerItem')) {
      const aid = item.getAttribute('name');
      if (!aid || knownIds.has(aid)) continue;
      if (targetId && aid !== targetId) continue;

      if (cfg.autoExpand) {
        const btn = item.querySelector('.ContentItem-expandButton');
        if (btn) btn.click();
      }

      // 仅单回答模式展开并抓取评论，列表页专注回答内容
      if (isSingleMode && cfg.includeComments) {
        openComments(item, doc);
      }

      const authorLink = item.querySelector('.AuthorInfo-name .UserLink-link');
      const author = authorLink?.textContent?.trim() || item.querySelector('.AuthorInfo-name')?.textContent?.trim() || '匿名用户';
      const authorUrl = authorLink ? (authorLink.getAttribute('href') ? `https:${authorLink.getAttribute('href')}` : '') : '';
      const authorBio = item.querySelector('.AuthorInfo-badgeText')?.textContent?.trim() || '';

      const upvoteBtn = item.querySelector('.VoteButton--up');
      const upvoteCount = upvoteBtn?.textContent?.replace(/[^\d]/g, '') || '';

      const commentBtn = findCommentButton(item);
      let commentCount = '';
      let noComments = false;
      if (commentBtn) {
        const rawText = (commentBtn.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        const digits = rawText.replace(/[^\d]/g, '');
        if (digits) {
          commentCount = digits;
        } else if (rawText.includes('添加评论')) {
          commentCount = '0';
          noComments = true;
        }
      }

      const comments = (isSingleMode && cfg.includeComments) ? parseComments(item, doc) : [];

      const dateEl = item.querySelector('.ContentItem-time, .AnswerItem-time');
      const publishedAt = dateEl?.textContent?.replace(/^(发布于|编辑于)\s*/, '')?.trim() || '';

      const contentEl = item.querySelector('.RichContent-inner .RichText.ztext, .RichContent-inner, .RichText');
      if (!contentEl) continue;

      let md = '';
      let images = [];
      if (typeof MarkdownEngine !== 'undefined') {
        const res = MarkdownEngine.convert(contentEl);
        md = res.markdown;
        images = res.images;
      } else {
        md = contentEl.textContent.trim();
      }

      const snippet = md.replace(/[#*`~>]/g, '').replace(/\s+/g, ' ').substring(0, 100);

      results.push({
        answerId: aid,
        author,
        authorUrl,
        authorBio,
        upvoteCount,
        commentCount,
        noComments,
        comments,
        publishedAt,
        content: md,
        images,
        snippet,
        answerUrl: `https://www.zhihu.com/question/${curMode.questionId}/answer/${aid}`,
      });

      knownIds.add(aid);
    }

    return results;
  }

  function expandCollapsed(doc = document) {
    for (const btn of doc.querySelectorAll('.ContentItem-expandButton')) {
      try { btn.click(); } catch {}
    }
  }

  function clickLoadMore(doc = document) {
    for (const btn of doc.querySelectorAll('.Question-main .List-item button, .QuestionAnswers-loadMoreButton, button.Button--plain')) {
      if (btn.textContent?.includes('查看更多回答') || btn.textContent?.includes('加载更多')) {
        try { btn.click(); } catch {}
      }
    }
  }

  function dismissModals(doc = document) {
    const modal = doc.querySelector('.Modal-closeButton');
    if (modal) { try { modal.click(); } catch {} }
  }

  return {
    detectMode,
    getTotalAnswerCount,
    getStatNumber,
    extractQuestion,
    scanAnswers,
    parseComments,
    findCommentContainer,
    openComments,
    findCommentButton,
    ensureDefaultSort,
    expandSubComments,
    findCommentScrollContainer,
    countAllComments,
    limitComments,
    scrollAndCollectComments,
    expandCollapsed,
    clickLoadMore,
    dismissModals,
  };
})();

  /* ── scroll.js ── */
/**
 * 知集 (ZhiJi) — ScrollEngine 智能滚动与反弹重试引擎
 */

const ScrollEngine = (() => {
  const SCROLL_WAIT = 1200;
  const BOUNCE_UP = 600;
  const BOUNCE_WAIT = 800;
  const BOUNCE_DOWN_WAIT = 1200;
  const MAX_RETRIES = 4;

  let running = false;
  let retries = 0;
  let onProgress = null;

  const delay = ms => new Promise(r => setTimeout(r, ms));

  function reachedTarget() {
    const q = typeof App !== 'undefined' ? App.getQuestion() : null;
    const total = (typeof PageParser !== 'undefined' ? PageParser.getTotalAnswerCount() : null) ?? q?.answerCount;
    if (total != null && total > 0 && typeof App !== 'undefined' && App.answerCount() >= total) {
      if (typeof UI !== 'undefined') UI.toast(`✅ 已采集全部 ${total} 条回答，自动停止`);
      stop();
      if (typeof App !== 'undefined') App.onCollectionComplete();
      return true;
    }
    return false;
  }

  async function start(cb) {
    if (running) return;
    running = true;
    retries = 0;
    onProgress = cb;

    while (running) {
      const before = typeof App !== 'undefined' ? App.answerCount() : 0;

      if (typeof PageParser !== 'undefined') {
        PageParser.dismissModals();
        const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : { autoExpand: true };
        if (cfg.autoExpand) PageParser.expandCollapsed();
        PageParser.clickLoadMore();
      }

      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      await delay(SCROLL_WAIT);
      if (!running) break;

      if (typeof App !== 'undefined') App.collect();
      if (reachedTarget()) break;
      const after = typeof App !== 'undefined' ? App.answerCount() : 0;

      if (after > before) {
        retries = 0;
        onProgress?.(after);
      } else {
        retries++;
        if (retries >= MAX_RETRIES) {
          if (typeof UI !== 'undefined') {
            UI.toast(`🏁 连续 ${MAX_RETRIES} 次无新回答，已到达终点 (共采集 ${after} 条)`);
          }
          stop();
          if (typeof App !== 'undefined') App.onCollectionComplete();
          break;
        }
        // Bounce
        window.scrollBy({ top: -BOUNCE_UP, behavior: 'smooth' });
        await delay(BOUNCE_WAIT);
        if (!running) break;
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        await delay(BOUNCE_DOWN_WAIT);
        if (!running) break;
        if (typeof App !== 'undefined') App.collect();
        if (reachedTarget()) break;
        if (typeof App !== 'undefined' && App.answerCount() > before) {
          retries = 0;
        }
      }
      onProgress?.(typeof App !== 'undefined' ? App.answerCount() : 0);
    }
    running = false;
    onProgress?.(typeof App !== 'undefined' ? App.answerCount() : 0);
  }

  function stop() {
    running = false;
    retries = 0;
    onProgress?.(typeof App !== 'undefined' ? App.answerCount() : 0);
  }

  function toggle(cb) {
    if (running) stop(); else start(cb);
  }

  return {
    start,
    stop,
    toggle,
    get isRunning() { return running; },
    get retryCount() { return retries; },
  };
})();

  /* ── zip.js ── */
/**
 * 知集 (ZhiJi) — ZipBuilder 内联 ZIP 生成器 (STORE 模式，纯 JS 无外部依赖)
 */

const ZipBuilder = (() => {
  function crc32(buf) {
    let table = crc32.table;
    if (!table) {
      table = crc32.table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c;
      }
    }
    let val = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) val = (val >>> 8) ^ table[(val ^ buf[i]) & 0xFF];
    return (val ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(d = new Date()) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  class Builder {
    constructor() {
      this.files = [];
    }

    add(filename, content) {
      let data;
      if (typeof content === 'string') {
        data = new TextEncoder().encode(content);
      } else if (content instanceof ArrayBuffer) {
        data = new Uint8Array(content);
      } else if (content instanceof Uint8Array) {
        data = content;
      } else {
        throw new Error('Unsupported content type');
      }
      this.files.push({ name: filename, data, crc: crc32(data) });
      return this;
    }

    generate() {
      const parts = [];
      const central = [];
      let offset = 0;
      const dt = dosDateTime();

      for (const f of this.files) {
        const nameBytes = new TextEncoder().encode(f.name);
        const headerSize = 30 + nameBytes.length;

        // Local header
        const lh = new ArrayBuffer(headerSize);
        const lv = new DataView(lh);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0x0800, true);          // UTF-8
        lv.setUint16(8, 0, true);               // STORE
        lv.setUint16(10, dt.time, true);
        lv.setUint16(12, dt.date, true);
        lv.setUint32(14, f.crc, true);
        lv.setUint32(18, f.data.length, true);  // compressed
        lv.setUint32(22, f.data.length, true);  // uncompressed
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);
        new Uint8Array(lh).set(nameBytes, 30);

        parts.push(new Uint8Array(lh));
        parts.push(f.data);

        // Central directory header
        const cb = 46 + nameBytes.length;
        const ch = new ArrayBuffer(cb);
        const cv = new DataView(ch);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, dt.time, true);
        cv.setUint16(14, dt.date, true);
        cv.setUint32(16, f.crc, true);
        cv.setUint32(20, f.data.length, true);
        cv.setUint32(24, f.data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0x20, true);           // external attr
        cv.setUint32(42, offset, true);          // local header offset
        new Uint8Array(ch).set(nameBytes, 46);
        central.push(new Uint8Array(ch));

        offset += headerSize + f.data.length;
      }

      const centralOffset = offset;
      let centralSize = 0;
      for (const c of central) centralSize += c.length;

      // End of central directory
      const end = new ArrayBuffer(22);
      const ev = new DataView(end);
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(4, 0, true);
      ev.setUint16(6, 0, true);
      ev.setUint16(8, this.files.length, true);
      ev.setUint16(10, this.files.length, true);
      ev.setUint32(12, centralSize, true);
      ev.setUint32(16, centralOffset, true);
      ev.setUint16(20, 0, true);

      return new Blob([...parts, ...central, new Uint8Array(end)], { type: 'application/zip' });
    }
  }

  return { create: () => new Builder() };
})();

  /* ── exporter.js ── */
/**
 * 知集 (ZhiJi) — Exporter 多模式内容导出器 (Obsidian / 剪贴板 / .md / ZIP+图片)
 */

const Exporter = (() => {
  function formatDate(d = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function safeName(s) {
    return s.replace(/[\\/:*?"<>|]/g, '_').trim();
  }

  function formatNumber(n) {
    if (n == null) return null;
    return n.toLocaleString('zh-CN');
  }

  function normalizeTag(tag) {
    return tag
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5-_]/g, '')
      .toLowerCase();
  }

  function buildFrontmatter(q, answers) {
    const isSingle = (answers.length === 1 && typeof PageParser !== 'undefined' && PageParser.detectMode().mode === 'single') || answers.length === 1;
    const singleAnswer = isSingle ? answers[0] : null;
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : { includeTags: true };

    const rawTags = (cfg.includeTags && q.tags?.length)
      ? q.tags.map(normalizeTag).filter(Boolean)
      : [];
    const tags = ['zhihu', ...new Set(rawTags.filter(t => t !== 'zhihu'))];

    const lines = ['---'];
    lines.push(`title: "${q.title.replace(/"/g, '\\"')}"`);
    lines.push('tags:');
    tags.forEach(t => lines.push(`  - ${t}`));
    lines.push('status: ready');
    lines.push(`source: "${isSingle && singleAnswer?.answerUrl ? singleAnswer.answerUrl : q.url}"`);
    lines.push(`type: ${isSingle ? 'zhihu-answer' : 'zhihu-question'}`);
    if (isSingle && singleAnswer?.author) {
      lines.push(`author: "${singleAnswer.author.replace(/"/g, '\\"')}"`);
    }
    lines.push(`created: "${formatDate()}"`);
    if (q.answerCount != null) lines.push(`answer_count: ${q.answerCount}`);
    if (q.followerCount != null) lines.push(`follower_count: ${q.followerCount}`);
    if (q.viewCount != null) lines.push(`view_count: ${q.viewCount}`);
    lines.push(`clipped_answers: ${answers.length}`);
    lines.push('related: []');
    lines.push('---');
    return lines.join('\n');
  }

  function buildMarkdown(question, answers) {
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : {
      includeFrontmatter: true,
      includeDetail: true,
      includeTags: true,
      includeAnswerMeta: true,
      includeComments: true,
    };
    let md = '';

    if (cfg.includeFrontmatter) {
      md += buildFrontmatter(question, answers) + '\n\n';
    }

    md += `# ${question.title}\n\n`;

    // Meta block
    const metaParts = [];
    metaParts.push(`**来源**: [知乎原文](${question.url})`);
    if (question.answerCount != null) metaParts.push(`**回答数**: ${formatNumber(question.answerCount)}`);
    if (question.followerCount != null) metaParts.push(`**关注者**: ${formatNumber(question.followerCount)}`);
    if (question.viewCount != null) metaParts.push(`**浏览量**: ${formatNumber(question.viewCount)}`);
    md += `> ${metaParts.join(' · ')}\n`;
    if (cfg.includeTags && question.tags?.length) {
      md += `> **话题**: ${question.tags.map(t => `#${t}`).join(' ')}\n`;
    }
    md += `> **剪藏时间**: ${formatDate()}\n\n`;

    // Question detail
    if (cfg.includeDetail && question.detail) {
      md += `## 问题描述\n\n${question.detail}\n\n---\n\n`;
    } else {
      md += '---\n\n';
    }

    // Answers
    const isSingle = (answers.length === 1 && typeof PageParser !== 'undefined' && PageParser.detectMode().mode === 'single') || answers.length === 1;
    if (isSingle) {
      const a = answers[0];
      const authorShow = a.authorUrl ? `[${a.author}](${a.authorUrl})` : a.author;
      md += `## ${authorShow} 的回答\n\n`;

      if (cfg.includeAnswerMeta) {
        const parts = [];
        if (a.publishedAt) parts.push(`🕒 ${a.publishedAt}`);
        if (a.upvoteCount) parts.push(`👍 ${a.upvoteCount}`);
        if (a.commentCount) parts.push(`💬 ${a.commentCount}条评论`);
        if (parts.length) md += `> ${parts.join(' · ')}\n`;
        if (a.authorBio) md += `> 📎 ${a.authorBio}\n`;
        if (a.answerUrl) md += `> 🔗 [原文直链](${a.answerUrl})\n`;
        md += '\n';
      }

      md += `${a.content}\n\n`;

      if (cfg.includeComments && a.comments?.length) {
        md += formatCommentsMarkdown(a.comments, 3);
      }

      md += '---\n\n';
    } else {
      md += `## 回答 (${answers.length})\n\n`;

      answers.forEach((a, i) => {
        const authorShow = a.authorUrl ? `[${a.author}](${a.authorUrl})` : a.author;
        md += `### 回答 ${i + 1} · ${authorShow}\n\n`;

        if (cfg.includeAnswerMeta) {
          const parts = [];
          if (a.publishedAt) parts.push(`🕒 ${a.publishedAt}`);
          if (a.upvoteCount) parts.push(`👍 ${a.upvoteCount}`);
          if (a.commentCount) parts.push(`💬 ${a.commentCount}条评论`);
          if (parts.length) md += `> ${parts.join(' · ')}\n`;
          if (a.authorBio) md += `> 📎 ${a.authorBio}\n`;
          if (a.answerUrl) md += `> 🔗 [原文直链](${a.answerUrl})\n`;
          md += '\n';
        }

        md += `${a.content}\n\n`;

        if (cfg.includeComments && a.comments?.length) {
          md += formatCommentsMarkdown(a.comments, 4);
        }

        md += '---\n\n';
      });
    }

    return md;
  }

  function formatCommentsMarkdown(comments, headingLevel = 3) {
    if (!comments || !comments.length) return '';
    const h = '#'.repeat(headingLevel);
    const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);
    let md = `${h} 💬 评论 (${totalCount} 条)\n\n`;

    comments.forEach(c => {
      const authorShow = c.authorUrl ? `[${c.author}](${c.authorUrl})` : c.author;
      const tagShow = c.roleTag ? ` (${c.roleTag})` : '';
      const meta = [];
      if (c.publishedAt) meta.push(`🕒 ${c.publishedAt}`);
      if (c.likes) meta.push(`👍 ${c.likes}`);
      const metaStr = meta.length ? ` · ${meta.join(' · ')}` : '';

      md += `- **${authorShow}**${tagShow}${metaStr}\n`;
      if (c.content) {
        const indented = c.content.split('\n').map(l => `  ${l}`).join('\n');
        md += `${indented}\n`;
      }

      if (c.replies?.length) {
        c.replies.forEach(r => {
          const rAuthor = r.authorUrl ? `[${r.author}](${r.authorUrl})` : r.author;
          const rTag = r.roleTag ? ` (${r.roleTag})` : '';
          const rMeta = [];
          if (r.publishedAt) rMeta.push(`🕒 ${r.publishedAt}`);
          if (r.likes) rMeta.push(`👍 ${r.likes}`);
          const rMetaStr = rMeta.length ? ` · ${rMeta.join(' · ')}` : '';
          const replyToText = r.replyTo ? ` 回复 **${r.replyTo}**` : '';

          md += `  - **${rAuthor}**${rTag}${replyToText}${rMetaStr}\n`;
          if (r.content) {
            const rIndented = r.content.split('\n').map(l => `    ${l}`).join('\n');
            md += `${rIndented}\n`;
          }
        });
      }
    });

    return md + '\n';
  }

  function toObsidian(md, title) {
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : { vault: '', folder: '' };
    if (!cfg.vault?.trim()) {
      if (typeof UI !== 'undefined') {
        UI.toast('⚠️ 未配置 Obsidian 仓库名，请先设置 Vault');
        if (typeof UI.openSettings === 'function') UI.openSettings(true);
      } else if (typeof alert === 'function') {
        alert('⚠️ 未配置 Obsidian 仓库名，请先设置 Vault');
      }
      return false;
    }

    const folder = (cfg.folder || '').replace(/^\/+|\/+$/g, '');
    const file = folder ? `${folder}/${safeName(title)}` : safeName(title);
    const uri = `obsidian://new?vault=${encodeURIComponent(cfg.vault.trim())}&file=${encodeURIComponent(file)}&content=${encodeURIComponent(md)}&overwrite=true`;

    if (uri.length > 15000) {
      const ok = confirm(`⚠️ 内容较大（约 ${(uri.length / 1000).toFixed(1)}k 字符），通过 URL 协议可能被浏览器截断。\n\n【确定】尝试直接调起 Obsidian\n【取消】降级为下载 .md 文件`);
      if (!ok) {
        toFile(md, title);
        toClipboard(md);
        return;
      }
    }
    window.location.href = uri;
    return true;
  }

  function toClipboard(md) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(md)
        .then(() => { if (typeof UI !== 'undefined') UI.toast('📋 已复制到剪贴板'); })
        .catch(() => clipboardFallback(md));
    } else if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(md);
      if (typeof UI !== 'undefined') UI.toast('📋 已复制到剪贴板');
    } else {
      clipboardFallback(md);
    }
  }

  function clipboardFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    Object.assign(ta.style, { position: 'fixed', opacity: '0' });
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (typeof UI !== 'undefined') UI.toast('📋 已复制到剪贴板');
    } catch {
      alert('复制失败，请手动复制');
    }
    document.body.removeChild(ta);
  }

  function toFile(md, title) {
    const name = safeName(title) + '.md';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, name);
    if (typeof UI !== 'undefined') UI.toast(`📄 已下载: ${name}`);
  }

  async function toZipWithAssets(md, title, imageUrls) {
    if (typeof UI !== 'undefined') UI.toast('📦 正在打包 ZIP 并下载图片资源...');

    const uniqueUrls = [...new Set(imageUrls.filter(Boolean))];
    const zip = ZipBuilder.create();
    const urlMap = new Map();
    let index = 0;

    for (const url of uniqueUrls) {
      try {
        index++;
        const ext = url.split('?')[0].split('.').pop().toLowerCase() || 'jpg';
        const cleanExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) ? ext : 'jpg';
        const filename = `assets/img_${String(index).padStart(3, '0')}.${cleanExt}`;

        const resp = await fetch(url, { mode: 'cors' });
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          zip.add(filename, buf);
          urlMap.set(url, filename);
        }
      } catch {
        // Continue on failure
      }
    }

    // Rewrite markdown image URLs
    let finalMd = md;
    for (const [remote, local] of urlMap.entries()) {
      finalMd = finalMd.split(remote).join(local);
    }

    const mdName = `${safeName(title)}.md`;
    zip.add(mdName, finalMd);

    const zipBlob = zip.generate();
    downloadBlob(zipBlob, `${safeName(title)}.zip`);
    if (typeof UI !== 'undefined') {
      UI.toast(`📦 ZIP 打包完成，共保存 ${urlMap.size} 张图片`);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return {
    buildFrontmatter,
    buildMarkdown,
    formatCommentsMarkdown,
    toObsidian,
    toClipboard,
    toFile,
    toZipWithAssets,
  };
})();

  /* ── ui.js ── */
/**
 * 知集 (ZhiJi) — UI 界面渲染与交互 (暗色毛玻璃设计 + 动态内嵌设置视图)
 */

const UI = (() => {
  let isSettingsOpen = false;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes zj-fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes zj-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
    @keyframes zj-slideIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }

    #zj-trigger {
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      padding: 10px 18px; border-radius: 50px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #fff; font-size: 13px; font-weight: 600;
      box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(255,255,255,0.1);
      cursor: pointer; border: none; outline: none;
      display: flex; align-items: center; gap: 8px;
      font-family: -apple-system, 'SF Pro Display', 'PingFang SC', system-ui, sans-serif;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(12px);
    }
    #zj-trigger:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(37, 99, 235, 0.55);
    }
    #zj-trigger.zj-active {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      box-shadow: 0 4px 20px rgba(239, 68, 68, 0.45);
      animation: zj-pulse 2s ease-in-out infinite;
    }
    #zj-trigger.zj-done {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 4px 20px rgba(16, 185, 129, 0.45);
    }

    #zj-panel {
      position: fixed; bottom: 80px; right: 24px; width: 420px; max-height: 580px;
      z-index: 999999;
      background: rgba(15, 15, 20, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      display: none; flex-direction: column;
      font-family: -apple-system, 'SF Pro Display', 'PingFang SC', system-ui, sans-serif;
      font-size: 13px; color: #e8e8f0;
      overflow: hidden;
      animation: zj-fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .zj-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .zj-logo {
      font-size: 15px; font-weight: 700; letter-spacing: 0.5px;
      background: linear-gradient(135deg, #6c9fff, #b08cff);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .zj-mode-tag {
      font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 5px;
      letter-spacing: 0.3px; vertical-align: middle; display: inline-block;
    }
    .zj-mode-single {
      background: rgba(108, 159, 255, 0.15); color: #6c9fff; border: 1px solid rgba(108, 159, 255, 0.3);
    }
    .zj-mode-multi {
      background: rgba(92, 235, 160, 0.15); color: #5ceba0; border: 1px solid rgba(92, 235, 160, 0.3);
    }
    .zj-counter { font-size: 12px; color: #9898b0; margin-left: 6px; }
    .zj-counter b { color: #5ceba0; }

    .zj-head-btns { display: flex; align-items: center; gap: 6px; }
    .zj-icon-btn {
      width: 28px; height: 28px; border: none; border-radius: 8px;
      background: rgba(255,255,255,0.06); color: #8888aa; cursor: pointer;
      font-size: 13px; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .zj-icon-btn:hover { background: rgba(255,255,255,0.12); color: #e8e8f0; }
    .zj-close:hover { background: rgba(255,107,122,0.15); color: #ff6b7a; }

    .zj-progress-bar {
      height: 3px; margin: 0 18px;
      background: rgba(255,255,255,0.04); border-radius: 2px; overflow: hidden;
    }
    .zj-progress-fill {
      height: 100%; border-radius: 2px;
      background: linear-gradient(90deg, #4a7cff, #6c9fff, #b08cff);
      transition: width 0.4s ease-in-out;
      min-width: 0%;
    }

    .zj-section { padding: 12px 18px; }

    .zj-scroll-btn {
      width: 100%; padding: 10px; border: none; border-radius: 10px;
      font-size: 13px; font-weight: 600; color: #fff; cursor: pointer;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 2px 12px rgba(245, 158, 11, 0.3);
      transition: all 0.2s;
    }
    .zj-scroll-btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
    .zj-scroll-btn.zj-running {
      background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
      box-shadow: 0 2px 12px rgba(239, 68, 68, 0.4);
      animation: zj-pulse 2s ease-in-out infinite;
    }
    .zj-scroll-btn.zj-done {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 2px 12px rgba(16, 185, 129, 0.35);
      cursor: default;
    }
    .zj-scroll-btn.zj-done:hover { transform: none; filter: none; }

    .zj-single-card {
      margin: 0 18px 12px; padding: 14px 16px;
      background: rgba(40, 40, 58, 0.65); border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .zj-single-head {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
    }
    .zj-single-author { font-weight: 600; font-size: 13.5px; color: #e8e8f0; }
    .zj-single-meta { font-size: 11px; color: #68688a; }
    .zj-single-snippet {
      font-size: 12px; color: #8888aa; line-height: 1.55;
      max-height: 58px; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 10px;
    }
    .zj-switch-link {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11.5px; color: #6c9fff; text-decoration: none;
      cursor: pointer; transition: color 0.15s;
    }
    .zj-switch-link:hover { color: #b08cff; }

    .zj-export-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      padding: 0 18px 12px;
    }
    .zj-export-btn {
      padding: 9px 10px; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 600;
      color: #e8e8f0; transition: all 0.2s;
      background: rgba(255,255,255,0.04);
      text-align: center;
    }
    .zj-export-btn:hover {
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.15);
      transform: translateY(-1px);
    }
    .zj-export-btn.zj-btn-unconfigured {
      border-color: rgba(245, 158, 11, 0.4);
      background: rgba(245, 158, 11, 0.08);
      color: #fbbf24;
    }
    .zj-export-btn.zj-btn-unconfigured:hover {
      border-color: rgba(245, 158, 11, 0.7);
      background: rgba(245, 158, 11, 0.16);
    }
    .zj-export-btn .zj-btn-icon { margin-right: 4px; }

    .zj-list {
      flex: 1; overflow-y: auto; padding: 0 18px 12px;
      max-height: 260px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .zj-list::-webkit-scrollbar { width: 4px; }
    .zj-list::-webkit-scrollbar-track { background: transparent; }
    .zj-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

    .zj-card {
      padding: 10px 12px; margin-bottom: 8px;
      background: rgba(40, 40, 55, 0.6); border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.05);
      position: relative; transition: all 0.2s;
      animation: zj-slideIn 0.25s ease-out backwards;
    }
    .zj-card:hover {
      background: rgba(55, 55, 75, 0.7);
      border-color: rgba(255,255,255,0.1);
    }
    .zj-card-head {
      display: flex; align-items: center; gap: 6px; margin-bottom: 5px;
    }
    .zj-card-idx {
      font-size: 10px; font-weight: 700; color: #4a7cff;
      background: rgba(74, 124, 255, 0.12); padding: 2px 6px; border-radius: 4px;
    }
    .zj-card-author { font-weight: 600; color: #c8c8e0; font-size: 12.5px; }
    .zj-card-meta { font-size: 11px; color: #68688a; margin-left: auto; white-space: nowrap; }
    .zj-card-meta .zj-upvote { color: #5ceba0; }
    .zj-card-snippet {
      font-size: 11.5px; color: #78789a; line-height: 1.5;
      max-height: 36px; overflow: hidden; text-overflow: ellipsis;
    }
    .zj-card-actions {
      position: absolute; top: 8px; right: 8px;
      display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s;
    }
    .zj-card:hover .zj-card-actions { opacity: 1; }
    .zj-card-action {
      font-size: 10px; padding: 3px 7px; border: none; border-radius: 5px;
      background: rgba(255,255,255,0.08); color: #9898b0; cursor: pointer;
      transition: all 0.15s;
    }
    .zj-card-action:hover { background: rgba(108, 159, 255, 0.2); color: #6c9fff; }
    .zj-card-action.zj-del:hover { background: rgba(255,107,122,0.2); color: #ff6b7a; }

    /* Settings View */
    .zj-settings-view {
      padding: 16px 18px; flex: 1; overflow-y: auto; max-height: 460px;
    }
    .zj-field { margin-bottom: 14px; }
    .zj-label { display: block; font-size: 12px; color: #c8c8e0; margin-bottom: 5px; font-weight: 500; }
    .zj-required { color: #f87171; margin-left: 2px; }
    .zj-field-hint { font-size: 11px; color: #8888aa; margin-top: 4px; line-height: 1.4; }
    .zj-input {
      width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05);
      color: #fff; font-size: 12.5px; outline: none; transition: all 0.2s;
    }
    .zj-input:focus { border-color: #6c9fff; }
    .zj-input.zj-highlight {
      border-color: #f59e0b !important;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.25) !important;
      animation: zj-shake 0.4s ease-in-out;
    }
    @keyframes zj-shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-4px); }
      40%, 80% { transform: translateX(4px); }
    }
    .zj-toggle-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .zj-toggle-label { font-size: 12px; color: #b0b0c8; }
    .zj-toggle {
      position: relative; width: 36px; height: 20px;
      background: rgba(255,255,255,0.15); border-radius: 10px;
      cursor: pointer; transition: background 0.2s;
    }
    .zj-toggle.zj-on { background: #10b981; }
    .zj-toggle-thumb {
      position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
      background: #fff; border-radius: 50%; transition: transform 0.2s;
    }
    .zj-toggle.zj-on .zj-toggle-thumb { transform: translateX(16px); }

    .zj-settings-actions {
      display: flex; gap: 8px; margin-top: 16px;
    }
    .zj-save-btn {
      flex: 1; padding: 9px; border: none; border-radius: 8px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff; font-weight: 600; font-size: 12.5px; cursor: pointer;
    }
    .zj-cancel-btn {
      padding: 9px 14px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
      background: rgba(255,255,255,0.05); color: #a0a0b8; font-size: 12px; cursor: pointer;
    }

    .zj-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 18px; border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 11px; color: #585870;
    }
    .zj-footer a { color: #6c9fff; text-decoration: none; cursor: pointer; transition: color 0.15s; }
    .zj-footer a:hover { color: #b08cff; }

    .zj-empty {
      text-align: center; color: #585870; padding: 32px 20px;
      font-size: 13px; line-height: 1.8;
    }
    .zj-empty-icon { font-size: 28px; margin-bottom: 8px; }

    .zj-toast {
      position: fixed; top: 28px; left: 50%; transform: translateX(-50%);
      z-index: 10000000;
      background: rgba(15, 15, 20, 0.94);
      color: #e8e8f0; padding: 10px 24px;
      border-radius: 50px; font-size: 13.5px; font-weight: 500;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      pointer-events: none;
      font-family: -apple-system, 'SF Pro Display', 'PingFang SC', system-ui, sans-serif;
      animation: zj-fadeIn 0.3s ease-out;
      transition: all 0.25s ease-in;
    }
  `;
  document.head.appendChild(style);

  // Trigger button
  const trigger = document.createElement('button');
  trigger.id = 'zj-trigger';
  trigger.textContent = '📡 知集 · 开始采集';
  document.body.appendChild(trigger);

  // Main panel
  const panel = document.createElement('div');
  panel.id = 'zj-panel';
  document.body.appendChild(panel);

  let activeToast = null;
  let toastTimer = null;

  function toast(msg, duration = 1800) {
    if (activeToast) {
      clearTimeout(toastTimer);
      activeToast.remove();
      activeToast = null;
    }
    const t = document.createElement('div');
    t.className = 'zj-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    activeToast = t;

    toastTimer = setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(-8px)';
      setTimeout(() => {
        if (activeToast === t) activeToast = null;
        t.remove();
      }, 200);
    }, duration);
  }

  function updateTrigger(state, count, total, mode) {
    trigger.className = '';
    trigger.id = 'zj-trigger';
    if (mode === 'single') {
      switch (state) {
        case 'idle':
          trigger.textContent = '📡 知集 · 剪藏当前回答';
          break;
        case 'active':
          trigger.classList.add('zj-active');
          trigger.textContent = '⏳ 正在剪藏当前回答...';
          break;
        case 'done':
          trigger.classList.add('zj-done');
          trigger.textContent = '✅ 已剪藏当前回答';
          break;
      }
    } else {
      const totalStr = total != null ? ` · 共${total}条` : '';
      switch (state) {
        case 'idle':
          trigger.textContent = `📡 知集 · 采集全部回答${totalStr}`;
          break;
        case 'active':
          trigger.classList.add('zj-active');
          trigger.textContent = `⏹ 停止采集 (${count}${total != null ? `/${total}` : ''}条)`;
          break;
        case 'done':
          trigger.classList.add('zj-done');
          trigger.textContent = (total != null && count >= total)
            ? `✅ 已采集全部 ${count} 条回答`
            : `✅ 已采集 ${count} 条回答${totalStr}`;
          break;
      }
    }
  }

  function renderSettingsView() {
    const cfg = ConfigManager.get();
    const view = document.createElement('div');
    view.className = 'zj-settings-view';

    view.innerHTML = `
      <div class="zj-field">
        <label class="zj-label">Obsidian Vault (仓库名称) <span class="zj-required">*</span></label>
        <input class="zj-input" id="zj-cfg-vault" value="${cfg.vault || ''}" placeholder="必填，例如: MyVault 或 Notes">
        <div class="zj-field-hint">💡 存入 Obsidian 需指定知识库名称，未配置将无法导出</div>
      </div>
      <div class="zj-field">
        <label class="zj-label">保存目录 (Folder)</label>
        <input class="zj-input" id="zj-cfg-folder" value="${cfg.folder || ''}" placeholder="可选，留空存入根目录，例如: 60-External/zhihu">
      </div>
      <div class="zj-toggle-row">
        <span class="zj-toggle-label">自动展开折叠回答</span>
        <div class="zj-toggle ${cfg.autoExpand ? 'zj-on' : ''}" data-key="autoExpand"><div class="zj-toggle-thumb"></div></div>
      </div>
      <div class="zj-toggle-row">
        <span class="zj-toggle-label">包含问题描述</span>
        <div class="zj-toggle ${cfg.includeDetail ? 'zj-on' : ''}" data-key="includeDetail"><div class="zj-toggle-thumb"></div></div>
      </div>
      <div class="zj-toggle-row">
        <span class="zj-toggle-label">提取话题标签</span>
        <div class="zj-toggle ${cfg.includeTags ? 'zj-on' : ''}" data-key="includeTags"><div class="zj-toggle-thumb"></div></div>
      </div>
      <div class="zj-toggle-row">
        <span class="zj-toggle-label">包含回答元数据 (时间/获赞/直链)</span>
        <div class="zj-toggle ${cfg.includeAnswerMeta ? 'zj-on' : ''}" data-key="includeAnswerMeta"><div class="zj-toggle-thumb"></div></div>
      </div>
      <div class="zj-toggle-row">
        <span class="zj-toggle-label">包含回答评论 (仅单回答)</span>
        <div class="zj-toggle ${cfg.includeComments ? 'zj-on' : ''}" data-key="includeComments"><div class="zj-toggle-thumb"></div></div>
      </div>
      <div class="zj-field" style="margin-top: 8px;">
        <label class="zj-label">最大评论条数 (默认 100)</label>
        <input type="number" class="zj-input" id="zj-cfg-maxComments" min="10" max="1000" step="10" value="${cfg.maxComments || 100}">
        <div class="zj-field-hint">开启评论抓取后，将自动滚动评论浮窗拉取默认排序评论</div>
      </div>
      <div class="zj-toggle-row">
        <span class="zj-toggle-label">包含 YAML Frontmatter</span>
        <div class="zj-toggle ${cfg.includeFrontmatter ? 'zj-on' : ''}" data-key="includeFrontmatter"><div class="zj-toggle-thumb"></div></div>
      </div>
      <div class="zj-settings-actions">
        <button class="zj-save-btn" id="zj-save-settings">保存配置</button>
        <button class="zj-cancel-btn" id="zj-cancel-settings">返回</button>
      </div>
    `;

    // Toggle logic
    view.querySelectorAll('.zj-toggle').forEach(t => {
      t.onclick = () => t.classList.toggle('zj-on');
    });

    view.querySelector('#zj-save-settings').onclick = () => {
      const updated = {
        vault: view.querySelector('#zj-cfg-vault').value.trim(),
        folder: view.querySelector('#zj-cfg-folder').value.trim(),
        autoExpand: view.querySelector('[data-key="autoExpand"]').classList.contains('zj-on'),
        includeDetail: view.querySelector('[data-key="includeDetail"]').classList.contains('zj-on'),
        includeTags: view.querySelector('[data-key="includeTags"]').classList.contains('zj-on'),
        includeAnswerMeta: view.querySelector('[data-key="includeAnswerMeta"]').classList.contains('zj-on'),
        includeComments: view.querySelector('[data-key="includeComments"]').classList.contains('zj-on'),
        maxComments: Math.max(10, parseInt(view.querySelector('#zj-cfg-maxComments')?.value, 10) || 100),
        includeFrontmatter: view.querySelector('[data-key="includeFrontmatter"]').classList.contains('zj-on'),
      };
      ConfigManager.set(updated);
      toast('⚙️ 配置已保存并实时生效');
      isSettingsOpen = false;
      if (typeof App !== 'undefined') App.refresh();
    };

    view.querySelector('#zj-cancel-settings').onclick = () => {
      isSettingsOpen = false;
      if (typeof App !== 'undefined') App.refresh();
    };

    panel.appendChild(view);
  }

  function render(answers, question, scrolling) {
    panel.innerHTML = '';
    const { mode, questionId } = typeof PageParser !== 'undefined' ? PageParser.detectMode() : { mode: 'multi', questionId: '0' };
    const total = question?.answerCount;

    // Header
    const header = document.createElement('div');
    header.className = 'zj-header';

    const titleArea = document.createElement('div');
    titleArea.style.cssText = 'display:flex; align-items:center; flex-wrap:wrap; gap:6px;';

    const logo = document.createElement('span');
    logo.className = 'zj-logo';
    logo.textContent = '知集';

    const tag = document.createElement('span');
    tag.className = `zj-mode-tag ${mode === 'single' ? 'zj-mode-single' : 'zj-mode-multi'}`;
    tag.textContent = mode === 'single' ? '单回答' : '多回答';

    const counter = document.createElement('span');
    counter.className = 'zj-counter';
    if (isSettingsOpen) {
      counter.textContent = '偏好配置';
    } else if (mode === 'single') {
      const cCount = (answers[0]?.comments && typeof PageParser !== 'undefined')
        ? PageParser.countAllComments(answers[0].comments)
        : (answers[0]?.comments?.length || 0);
      counter.innerHTML = answers.length
        ? `当前回答 <b style="color:#5ceba0">已就绪</b>${cCount > 0 ? ` · 💬 <b>${cCount}</b>` : ''}`
        : `等待加载...`;
    } else {
      counter.innerHTML = `已采集 <b>${answers.length}</b>${total != null ? ` / ${total}` : ''} 条`;
    }

    titleArea.appendChild(logo);
    titleArea.appendChild(tag);
    titleArea.appendChild(counter);

    const headBtns = document.createElement('div');
    headBtns.className = 'zj-head-btns';

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'zj-icon-btn';
    settingsBtn.textContent = '⚙️';
    settingsBtn.title = isSettingsOpen ? '返回采集面板' : '打开配置';
    settingsBtn.onclick = () => {
      isSettingsOpen = !isSettingsOpen;
      render(answers, question, scrolling);
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'zj-icon-btn zj-close';
    closeBtn.textContent = '✕';
    closeBtn.title = '收起面板';
    closeBtn.onclick = () => { panel.style.display = 'none'; };

    headBtns.appendChild(settingsBtn);
    headBtns.appendChild(closeBtn);

    header.appendChild(titleArea);
    header.appendChild(headBtns);
    panel.appendChild(header);

    // If settings view is open, render it and return
    if (isSettingsOpen) {
      renderSettingsView();
      return;
    }

    if (mode === 'multi') {
      // Progress bar
      if (total != null && total > 0) {
        const bar = document.createElement('div');
        bar.className = 'zj-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'zj-progress-fill';
        fill.style.width = `${Math.min(100, (answers.length / total) * 100)}%`;
        bar.appendChild(fill);
        panel.appendChild(bar);
      }

      // Scroll control
      const section = document.createElement('div');
      section.className = 'zj-section';
      const scrollBtn = document.createElement('button');

      if (scrolling) {
        const retries = typeof ScrollEngine !== 'undefined' ? ScrollEngine.retryCount : 0;
        scrollBtn.className = 'zj-scroll-btn zj-running';
        scrollBtn.textContent = retries > 0
          ? `⏹ 停止滚动 (反弹重试 ${retries}/4)`
          : '⏹ 停止自动滚动';
        scrollBtn.onclick = () => {
          if (typeof ScrollEngine !== 'undefined') ScrollEngine.stop();
          if (typeof App !== 'undefined') App.refresh();
        };
      } else if (total != null && answers.length >= total && total > 0) {
        scrollBtn.className = 'zj-scroll-btn zj-done';
        scrollBtn.textContent = `✅ 已采集全部回答 (共 ${answers.length} 条)`;
        scrollBtn.onclick = () => {
          toast(`✅ 所有回答已采集完毕 (${answers.length}/${total})，可直接导出`);
        };
      } else {
        scrollBtn.className = 'zj-scroll-btn';
        scrollBtn.textContent = answers.length > 0
          ? `⚡ 继续自动滚动采集 (当前 ${answers.length}${total != null ? `/${total}` : ''})`
          : '⚡ 自动滚动采集全部回答';
        scrollBtn.onclick = () => {
          if (typeof App !== 'undefined' && !App.isGrabbing()) App.startGrab();
          if (typeof ScrollEngine !== 'undefined') ScrollEngine.start(() => App.refresh());
          if (typeof App !== 'undefined') App.refresh();
        };
      }
      section.appendChild(scrollBtn);
      panel.appendChild(section);
    } else {
      // Single answer mode: Showcase Card
      if (answers.length > 0) {
        const a = answers[0];
        const singleCard = document.createElement('div');
        singleCard.className = 'zj-single-card';
        singleCard.innerHTML = `
          <div class="zj-single-head">
            <span class="zj-single-author">${a.author}</span>
            <span class="zj-single-meta">
              ${a.upvoteCount ? `<span style="color:#5ceba0;">👍 ${a.upvoteCount}</span> · ` : ''}
              ${a.comments?.length ? `<span style="color:#60a5fa;">💬 ${a.comments.length}条评论</span> · ` : (a.commentCount ? `💬 ${a.commentCount}条 · ` : '')}
              ${a.publishedAt || ''}
            </span>
          </div>
          <div class="zj-single-snippet">${a.snippet || a.content.substring(0, 120)}</div>
          <a class="zj-switch-link" href="/question/${questionId}">⚡ 查看该问题全部回答 &raquo;</a>
        `;
        panel.appendChild(singleCard);
      } else {
        const empty = document.createElement('div');
        empty.className = 'zj-empty';
        empty.innerHTML = `
          <div class="zj-empty-icon">⏳</div>
          <div>正在加载当前回答...</div>
          <div style="margin-top:8px;"><a class="zj-switch-link" href="/question/${questionId}">⚡ 查看该问题全部回答 &raquo;</a></div>
        `;
        panel.appendChild(empty);
      }
    }

    // Export buttons
    const grid = document.createElement('div');
    grid.className = 'zj-export-grid';

    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : {};
    const hasVault = !!cfg.vault?.trim();

    const btns = [
      {
        icon: '📥',
        label: hasVault ? 'Obsidian' : 'Obsidian ⚠️',
        action: () => App.exportAs('obsidian'),
        unconfigured: !hasVault,
        title: hasVault ? '一键存入 Obsidian' : '⚠️ 未配置 Obsidian 仓库名，点击前往设置',
      },
      { icon: '📋', label: mode === 'single' ? '复制 Markdown' : '复制全部', action: () => App.exportAs('clipboard') },
      { icon: '📄', label: '下载 .md', action: () => App.exportAs('download') },
      { icon: '📦', label: 'ZIP+图片', action: () => App.exportAs('zip') },
    ];
    btns.forEach(b => {
      const el = document.createElement('button');
      el.className = 'zj-export-btn' + (b.unconfigured ? ' zj-btn-unconfigured' : '');
      if (b.title) el.title = b.title;
      el.innerHTML = `<span class="zj-btn-icon">${b.icon}</span>${b.label}`;
      el.onclick = b.action;
      grid.appendChild(el);
    });
    panel.appendChild(grid);

    // Answer list (multi mode only)
    if (mode === 'multi') {
      const list = document.createElement('div');
      list.className = 'zj-list';

      if (answers.length === 0) {
        list.innerHTML = `<div class="zj-empty"><div class="zj-empty-icon">📭</div>暂无回答，点击自动滚动或手动下滑页面</div>`;
      } else {
        answers.forEach((a, i) => {
          const card = document.createElement('div');
          card.className = 'zj-card';
          card.style.animationDelay = `${Math.min(i, 10) * 30}ms`;

          card.innerHTML = `
            <div class="zj-card-head">
              <span class="zj-card-idx">#${i + 1}</span>
              <span class="zj-card-author">${a.author}</span>
              <span class="zj-card-meta">
                ${a.upvoteCount ? `<span class="zj-upvote">${a.upvoteCount}</span>` : ''}
                ${a.commentCount ? `<span style="margin-left:4px">💬 ${a.commentCount}</span>` : ''}
                <span style="margin-left:4px">${a.publishedAt}</span>
              </span>
            </div>
            <div class="zj-card-snippet">${a.snippet || a.content.substring(0, 80)}</div>
          `;

          const actions = document.createElement('div');
          actions.className = 'zj-card-actions';

          const copyOne = document.createElement('button');
          copyOne.className = 'zj-card-action';
          copyOne.textContent = '复制';
          copyOne.onclick = e => {
            e.stopPropagation();
            const authorShow = a.authorUrl ? `[${a.author}](${a.authorUrl})` : a.author;
            const singleMd = `### ${authorShow}\n\n> 🕒 ${a.publishedAt}${a.upvoteCount ? ` · 👍 ${a.upvoteCount}` : ''}\n> 🔗 [原文](${a.answerUrl})\n\n${a.content}`;
            if (typeof Exporter !== 'undefined') Exporter.toClipboard(singleMd);
          };

          const delOne = document.createElement('button');
          delOne.className = 'zj-card-action zj-del';
          delOne.textContent = '移除';
          delOne.onclick = e => {
            e.stopPropagation();
            if (typeof App !== 'undefined') App.removeAnswer(i);
          };

          actions.appendChild(copyOne);
          actions.appendChild(delOne);
          card.appendChild(actions);
          list.appendChild(card);
        });
      }
      panel.appendChild(list);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'zj-footer';

    if (mode === 'single') {
      footer.innerHTML = `<span>单回答模式 · 高保真剪藏</span>`;
      const reGrab = document.createElement('a');
      reGrab.textContent = '重新剪藏';
      reGrab.onclick = () => {
        if (typeof App !== 'undefined') {
          App.clearAnswers();
          App.startGrab();
        }
      };
      footer.appendChild(reGrab);
    } else {
      footer.innerHTML = `<span>反弹重试机制 · 自动绕过知乎卡顿</span>`;

      const footerRight = document.createElement('div');
      footerRight.style.cssText = 'display:flex; gap:12px;';

      const expandLink = document.createElement('a');
      expandLink.textContent = '展开全部';
      expandLink.onclick = () => {
        if (typeof PageParser !== 'undefined') PageParser.expandCollapsed();
        setTimeout(() => { if (typeof App !== 'undefined') App.collect(); }, 300);
      };

      const clearLink = document.createElement('a');
      clearLink.textContent = '清空';
      clearLink.onclick = () => {
        if (typeof ScrollEngine !== 'undefined' && ScrollEngine.isRunning) ScrollEngine.stop();
        if (typeof App !== 'undefined') App.clearAnswers();
      };

      footerRight.appendChild(expandLink);
      footerRight.appendChild(clearLink);
      footer.appendChild(footerRight);
    }
    panel.appendChild(footer);
  }

  function showPanel() { panel.style.display = 'flex'; }
  function hidePanel() { panel.style.display = 'none'; }
  function togglePanel() {
    if (panel.style.display === 'flex') hidePanel();
    else showPanel();
  }
  function isPanelVisible() { return panel.style.display === 'flex'; }

  function openSettings(highlightVault = false) {
    showPanel();
    isSettingsOpen = true;
    if (typeof App !== 'undefined') App.refresh();
    if (highlightVault) {
      setTimeout(() => {
        const input = panel.querySelector('#zj-cfg-vault');
        if (input) {
          input.focus();
          input.classList.add('zj-highlight');
          setTimeout(() => input.classList.remove('zj-highlight'), 2500);
        }
      }, 60);
    }
  }

  return {
    trigger,
    panel,
    toast,
    updateTrigger,
    render,
    openSettings,
    showPanel,
    hidePanel,
    togglePanel,
    isPanelVisible,
  };
})();

  /* ── app.js ── */
/**
 * 知集 (ZhiJi) — App 主控核心状态机与扩展消息通信
 */

const App = (() => {
  let answers = [];
  const knownIds = new Set();
  let grabbing = false;
  let observer = null;
  let expandTimer = null;
  let questionCache = null;
  let lastUrl = typeof location !== 'undefined' ? location.href : '';

  function currentMode() {
    return typeof PageParser !== 'undefined' ? PageParser.detectMode() : { mode: 'multi', questionId: '0' };
  }

  function getQuestion() {
    if (!questionCache && typeof PageParser !== 'undefined') {
      questionCache = PageParser.extractQuestion();
    }
    return questionCache;
  }

  function answerCount() { return answers.length; }
  function isGrabbing() { return grabbing; }

  function updateExistingComments(doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc) return;
    const { mode } = currentMode();
    if (mode !== 'single') return;
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : { includeComments: true };
    if (!cfg.includeComments) return;
    let updated = false;

    for (const a of answers) {
      const item = doc.querySelector(`.AnswerItem[name="${a.answerId}"]`) || doc.querySelector('.AnswerItem');
      if (item && typeof PageParser !== 'undefined') {
        const curComments = PageParser.parseComments(item, doc);
        if (curComments.length > 0 && (!a.comments || curComments.length > a.comments.length)) {
          a.comments = curComments;
          updated = true;
        }
      }
    }
    if (updated) refresh();
  }

  function collect() {
    const { mode, answerId } = currentMode();
    const targetId = mode === 'single' ? answerId : undefined;
    if (typeof PageParser !== 'undefined') {
      const newOnes = PageParser.scanAnswers(knownIds, targetId);
      if (newOnes.length) {
        answers.push(...newOnes);
        refresh();
      }
      updateExistingComments();
    }
  }

  function refresh() {
    const q = getQuestion();
    const { mode } = currentMode();
    if (typeof UI !== 'undefined') {
      const scrolling = typeof ScrollEngine !== 'undefined' ? ScrollEngine.isRunning : false;
      UI.render(answers, q, scrolling);
      const state = grabbing ? 'active' : (answers.length > 0 ? 'done' : 'idle');
      UI.updateTrigger(state, answers.length, q?.answerCount, mode);
    }
  }

  function onCollectionComplete() {
    grabbing = false;
    if (observer) { observer.disconnect(); observer = null; }
    if (expandTimer) { clearInterval(expandTimer); expandTimer = null; }
    refresh();
  }

  async function startGrab() {
    answers = [];
    knownIds.clear();
    questionCache = null;
    grabbing = true;
    if (typeof UI !== 'undefined') UI.showPanel();

    const { mode } = currentMode();
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : { autoExpand: true, includeComments: true, maxComments: 100 };

    if (cfg.autoExpand && typeof PageParser !== 'undefined') {
      PageParser.expandCollapsed();
    }
    collect();

    if (mode === 'single') {
      if (answers.length === 0) {
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 200));
          collect();
          if (answers.length > 0) break;
        }
      }

      if (answers.length === 0) {
        grabbing = false;
        refresh();
        if (typeof UI !== 'undefined') UI.toast('⚠️ 未能找到当前回答内容');
        return;
      }

      const a = answers[0];
      const maxComments = Math.max(10, parseInt(cfg.maxComments, 10) || 100);

      if (cfg.includeComments && !a.noComments && a.commentCount !== '0' && typeof PageParser !== 'undefined') {
        const item = document.querySelector(`.AnswerItem[name="${a.answerId}"]`) || document.querySelector('.AnswerItem');
        if (item) {
          await PageParser.scrollAndCollectComments(item, maxComments, (count) => {
            if (typeof UI !== 'undefined' && UI.trigger) {
              UI.trigger.textContent = `⏳ 加载评论 (${count}/${maxComments})...`;
            }
          }, a);
        }
      }

      grabbing = false;
      refresh();
      const finalCommentCount = (a.comments && typeof PageParser !== 'undefined') ? PageParser.countAllComments(a.comments) : (a.comments?.length || 0);
      if (typeof UI !== 'undefined') {
        UI.toast(finalCommentCount > 0 ? `✅ 已剪藏当前回答与 ${finalCommentCount} 条评论` : '✅ 已剪藏当前回答');
      }
    } else {
      refresh();
      observer = new MutationObserver(() => collect());
      observer.observe(document.body, { childList: true, subtree: true });

      if (cfg.autoExpand && typeof PageParser !== 'undefined') {
        expandTimer = setInterval(() => PageParser.expandCollapsed(), 1500);
      }
    }
  }

  function stopGrab() {
    grabbing = false;
    if (typeof ScrollEngine !== 'undefined' && ScrollEngine.isRunning) ScrollEngine.stop();
    if (observer) { observer.disconnect(); observer = null; }
    if (expandTimer) { clearInterval(expandTimer); expandTimer = null; }
    refresh();
  }

  function removeAnswer(idx) {
    if (idx >= 0 && idx < answers.length) {
      const removed = answers.splice(idx, 1)[0];
      knownIds.delete(removed.answerId);
      refresh();
    }
  }

  function clearAnswers() {
    answers = [];
    knownIds.clear();
    refresh();
  }

  function exportAs(target) {
    if (target === 'obsidian') {
      const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : {};
      if (!cfg.vault?.trim()) {
        if (typeof UI !== 'undefined') {
          UI.toast('⚠️ 未配置 Obsidian 仓库名，请先设置 Vault');
          if (typeof UI.openSettings === 'function') UI.openSettings(true);
        } else if (typeof alert === 'function') {
          alert('⚠️ 未配置 Obsidian 仓库名，请先设置 Vault');
        }
        return;
      }
    }

    if (answers.length === 0) {
      if (typeof UI !== 'undefined') UI.toast('⚠️ 暂无可导出的内容');
      return;
    }
    const q = getQuestion();
    const { mode } = currentMode();
    const exportTitle = (mode === 'single' && answers[0]?.author)
      ? `${q.title} - ${answers[0].author}的回答`
      : q.title;
    const md = Exporter.buildMarkdown(q, answers);

    switch (target) {
      case 'obsidian':
        Exporter.toObsidian(md, exportTitle);
        break;
      case 'clipboard':
        Exporter.toClipboard(md);
        break;
      case 'download':
        Exporter.toFile(md, exportTitle);
        break;
      case 'zip': {
        const allImages = answers.flatMap(a => [
          ...(a.images || []),
          ...(a.comments || []).flatMap(c => [
            ...(c.images || []),
            ...(c.replies || []).flatMap(r => r.images || []),
          ]),
        ]);
        Exporter.toZipWithAssets(md, exportTitle, allImages);
        break;
      }
    }
  }

  function handleUrlChange() {
    if (typeof location === 'undefined') return;
    if (location.href === lastUrl) return;
    lastUrl = location.href;

    if (typeof ScrollEngine !== 'undefined' && ScrollEngine.isRunning) ScrollEngine.stop();
    if (grabbing) stopGrab();

    answers = [];
    knownIds.clear();
    questionCache = null;

    const { mode } = currentMode();
    if (typeof UI !== 'undefined') UI.updateTrigger('idle', 0, null, mode);

    setTimeout(() => {
      const q = getQuestion();
      if (typeof UI !== 'undefined') {
        UI.updateTrigger('idle', 0, q?.answerCount, mode);
        if (UI.isPanelVisible()) {
          UI.render(answers, q, false);
        }
      }
    }, 500);
  }

  function init() {
    if (typeof window === 'undefined') return;

    const { mode } = currentMode();

    setTimeout(() => {
      const q = getQuestion();
      if (typeof UI !== 'undefined') {
        UI.updateTrigger('idle', 0, q?.answerCount, mode);
      }
    }, 800);

    if (typeof UI !== 'undefined') {
      UI.trigger.addEventListener('click', () => {
        if (!grabbing && answers.length === 0) {
          startGrab();
        } else if (grabbing) {
          stopGrab();
        } else {
          UI.togglePanel();
        }
      });

      UI.panel.addEventListener('dblclick', e => {
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A' && e.target.tagName !== 'INPUT') {
          UI.hidePanel();
        }
      });
    }

    // SPA URL observation
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function(...args) {
      const r = origPush.apply(this, args);
      handleUrlChange();
      return r;
    };
    history.replaceState = function(...args) {
      const r = origReplace.apply(this, args);
      handleUrlChange();
      return r;
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    setInterval(() => {
      if (location.href !== lastUrl) handleUrlChange();
    }, 300);

    // Browser Extension Message Communication
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        switch (msg.action) {
          case 'togglePanel':
            if (typeof UI !== 'undefined') UI.togglePanel();
            sendResponse({ status: 'ok', visible: UI.isPanelVisible() });
            break;
          case 'startGrab':
            startGrab();
            sendResponse({ status: 'ok' });
            break;
          case 'stopGrab':
            stopGrab();
            sendResponse({ status: 'ok' });
            break;
          case 'getStatus': {
            const q = getQuestion();
            const { mode } = currentMode();
            sendResponse({
              title: q?.title || '',
              mode,
              count: answers.length,
              total: q?.answerCount || null,
              grabbing,
            });
            break;
          }
        }
        return true;
      });
    }
  }

  // Auto boot when not in testing environment
  if (typeof window !== 'undefined' && !window.__ZHIJI_TEST__) {
    init();
  }

  return {
    collect,
    refresh,
    answerCount,
    isGrabbing,
    startGrab,
    stopGrab,
    onCollectionComplete,
    removeAnswer,
    clearAnswers,
    exportAs,
    getQuestion,
    init,
  };
})();

})();
