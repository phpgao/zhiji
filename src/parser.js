/**
 * 知集 (ZhiJi) — PageParser 知乎 DOM 数据解析提取
 */

const PageParser = (() => {
  function detectMode(pathname = (typeof location !== 'undefined' ? location.pathname : '')) {
    const p = pathname || '';
    const articleMatch = p.match(/^\/p\/(\d+)/);
    if (articleMatch) {
      return {
        mode: 'article',
        articleId: articleMatch[1],
      };
    }
    const m = p.match(/^\/question\/(\d+)(?:\/answer\/(\d+))?/);
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
    const modeInfo = detectMode(typeof location !== 'undefined' ? location.pathname : '');
    if (modeInfo.mode === 'article') {
      const art = parseArticle(doc);
      return {
        type: 'article',
        title: art.title,
        url: art.url,
        detail: '',
        tags: art.tags,
        answerCount: null,
        followerCount: null,
        viewCount: null,
      };
    }

    const titleEl = doc.querySelector('.QuestionHeader-title') || doc.querySelector('h1');
    const title = titleEl?.textContent?.trim() || '未命名问题';
    const url = (typeof location !== 'undefined' ? location.href : '').split('?')[0].replace(/\/answer\/\d+$/, '');
    const { questionId } = modeInfo;

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

  function parseArticle(doc = document) {
    const curMode = detectMode(typeof location !== 'undefined' ? location.pathname : '');
    const articleId = curMode.articleId || '';
    const articleEl = doc.querySelector('article.Post-Main, article.PostItem, article') || doc;

    // Title: strictly scoped to articleEl first
    const titleEl = articleEl.querySelector('h1.Post-Title, .Post-Header h1, h1') || doc.querySelector('h1.Post-Title, .Post-Header h1');
    const title = titleEl?.textContent?.trim() || '未命名文章';

    // Author: scoped strictly inside articleEl
    const authorLink = articleEl.querySelector('.Post-Author a, .AuthorInfo-name .UserLink-link, .AuthorInfo-name a, a.UserLink-link')
      || doc.querySelector('.Post-Author a, .AuthorInfo-name .UserLink-link');
    const author = authorLink?.textContent?.trim() || articleEl.querySelector('.AuthorInfo-name')?.textContent?.trim() || '匿名用户';
    let authorUrl = authorLink ? (authorLink.getAttribute('href') || '') : '';
    if (authorUrl && authorUrl.startsWith('//')) authorUrl = `https:${authorUrl}`;
    else if (authorUrl && authorUrl.startsWith('/')) authorUrl = `https://www.zhihu.com${authorUrl}`;
    const authorBio = articleEl.querySelector('.AuthorInfo-badgeText, .AuthorInfo-badge, .AuthorInfo-detail')?.textContent?.trim() || '';

    // Tags
    const tagEls = articleEl.querySelectorAll('.Post-Topics .Topic, .Post-topics .Topic, .TopicList .Tag, .Post-Topics a, .TopicLink');
    const tags = [...new Set(Array.from(tagEls).map(e => e.textContent.trim()).filter(Boolean))];

    // Date
    const dateEl = articleEl.querySelector('.ContentItem-time, .Post-Header .ContentItem-time, .Post-time, .Post-meta time') || doc.querySelector('.ContentItem-time');
    const publishedAt = dateEl?.textContent?.replace(/^(发布于|编辑于)\s*/, '')?.trim() || '';

    // Metrics (upvote, comments, fav, like)
    const metrics = extractActionMetrics(articleEl);
    let upvoteCount = metrics.upvoteCount;
    let commentCount = metrics.commentCount;
    let favCount = metrics.favCount;
    let likeCount = metrics.likeCount;
    let noComments = metrics.noComments;
    if (!upvoteCount || !commentCount || !favCount || !likeCount) {
      const docMetrics = extractActionMetrics(doc.body || doc);
      if (!upvoteCount) upvoteCount = docMetrics.upvoteCount;
      if (!commentCount) {
        commentCount = docMetrics.commentCount;
        noComments = docMetrics.noComments;
      }
      if (!favCount) favCount = docMetrics.favCount;
      if (!likeCount) likeCount = docMetrics.likeCount;
    }

    // Content: strictly scoped to article body, NEVER matching outer page wrappers
    const contentEl = articleEl.querySelector(
      '.Post-RichTextContainer .RichText.ztext, ' +
      '.Post-RichTextContainer .RichText, ' +
      '.RichText.ztext.Post-RichText, ' +
      '.Post-RichText, ' +
      '.RichText.ztext, ' +
      '.RichText'
    );
    let content = '';
    let images = [];
    if (contentEl && typeof MarkdownEngine !== 'undefined') {
      const res = MarkdownEngine.convert(contentEl);
      content = res.markdown;
      images = res.images || [];
    } else if (contentEl) {
      content = contentEl.textContent.trim();
    }

    const snippet = content.replace(/[#*`~>]/g, '').replace(/\s+/g, ' ').substring(0, 100);
    const originUrl = (typeof location !== 'undefined' ? location.href : '').split('?')[0];

    return {
      type: 'article',
      articleId,
      answerId: articleId,
      title,
      author,
      authorUrl,
      authorBio,
      tags,
      publishedAt,
      upvoteCount,
      commentCount,
      favCount,
      likeCount,
      noComments,
      content,
      images,
      snippet,
      url: originUrl || `https://zhuanlan.zhihu.com/p/${articleId}`,
      answerUrl: originUrl || `https://zhuanlan.zhihu.com/p/${articleId}`,
      comments: [],
    };
  }

  function findCommentButton(item) {
    if (!item) return null;
    const actions = item.querySelector('.ContentItem-actions, .BottomNavBar, [class*="BottomNavBar"]') || item;
    const btns = actions.querySelectorAll('button');
    for (const btn of btns) {
      const aria = btn.getAttribute('aria-label') || '';
      const text = (btn.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (aria.includes('评论') || text.includes('评论') || btn.querySelector('.ZDI--ChatBubbleFill24, .Zi--Comment, [class*="ChatBubble"]')) {
        return btn;
      }
    }
    return null;
  }

  function extractActionMetrics(container) {
    let upvoteCount = '';
    let commentCount = '';
    let favCount = '';
    let likeCount = '';
    let noComments = false;

    if (!container) return { upvoteCount, commentCount, favCount, likeCount, noComments };

    const actionEl = container.querySelector('.ContentItem-actions, .BottomNavBar, [class*="BottomNavBar"], .Post-actions, .Post-topicsAndActions, .ActionBar');
    const btns = (actionEl && actionEl.querySelectorAll('button').length > 0)
      ? actionEl.querySelectorAll('button')
      : container.querySelectorAll('button');

    for (const btn of btns) {
      const aria = (btn.getAttribute('aria-label') || '').trim();
      const text = (btn.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      const isDownvote = btn.classList.contains('VoteButton--down') || aria.includes('反对');
      if (isDownvote) continue;

      // 1. 赞同 (获赞数)
      const isUpvote = btn.classList.contains('VoteButton')
        || aria.includes('赞同')
        || text.includes('赞同')
        || !!btn.querySelector('.VoteButton-TriangleUp, .Zi--TriangleUp, [class*="TriangleUp"]');
      if (isUpvote && !upvoteCount) {
        const raw = aria || text;
        const m = raw.match(/赞同\s*([\d.]+\s*[万wW]?|\d+)/) || raw.match(/([\d.]+\s*[万wW]?|\d+)/);
        if (m) upvoteCount = m[1].trim();
        continue;
      }

      // 2. 评论数
      const isComment = aria.includes('评论')
        || text.includes('评论')
        || !!btn.querySelector('.ZDI--ChatBubbleFill24, .Zi--Comment, [class*="ChatBubble"]');
      if (isComment && !commentCount) {
        const raw = text || aria;
        const m = raw.match(/([\d.]+\s*[万wW]?|\d+)\s*(?:条)?评论/) || raw.match(/([\d.]+\s*[万wW]?|\d+)/);
        if (m) {
          commentCount = m[1].trim();
        } else if (raw.includes('添加评论') || aria.includes('添加评论')) {
          commentCount = '0';
          noComments = true;
        }
        continue;
      }

      // 3. 收藏数
      const isFav = aria.includes('收藏')
        || text.includes('收藏')
        || !!btn.querySelector('.Zi--Star, [class*="Star"]');
      if (isFav && !favCount) {
        const raw = text || aria;
        const m = raw.match(/收藏\s*([\d.]+\s*[万wW]?|\d+)/) || raw.match(/([\d.]+\s*[万wW]?|\d+)/);
        if (m) favCount = m[1].trim();
        continue;
      }

      // 4. 喜欢数 (like)
      const isLike = aria.includes('喜欢')
        || text.includes('喜欢')
        || !!btn.querySelector('.Zi--Heart, [class*="Heart"]');
      if (isLike && !likeCount) {
        const raw = text || aria;
        const m = raw.match(/喜欢\s*([\d.]+\s*[万wW]?|\d+)/) || raw.match(/([\d.]+\s*[万wW]?|\d+)/);
        if (m) likeCount = m[1].trim();
        continue;
      }
    }

    // 兜底策略: 如果未能通过 actions 按钮获取获赞数，尝试直接选择器
    if (!upvoteCount) {
      const upBtn = container.querySelector('.VoteButton:not(.VoteButton--down), .VoteButton--up, button[aria-label*="赞同"], .LikeButton');
      if (upBtn) {
        const raw = (upBtn.getAttribute('aria-label') || upBtn.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        const m = raw.match(/赞同\s*([\d.]+\s*[万wW]?|\d+)/) || raw.match(/([\d.]+\s*[万wW]?|\d+)/);
        if (m) upvoteCount = m[1].trim();
      }
    }

    return { upvoteCount, commentCount, favCount, likeCount, noComments };
  }

  function parseSingleComment(el, isRoot = true) {
    const peopleLinks = Array.from(el.querySelectorAll('a[href*="/people/"], .UserLink-link, .UserLink a')).filter(a => {
      const parentItem = a.closest('[data-id], .CommentItemV2, .CommentItem');
      return !parentItem || parentItem === el;
    });
    const authorLink = peopleLinks.find(a => !a.querySelector('img') && a.textContent.trim()) || peopleLinks[0];
    const author = authorLink?.textContent?.replace(/[\u200B-\u200D\uFEFF]/g, '')?.trim()
      || el.querySelector('img.Avatar')?.getAttribute('alt')
      || el.querySelector('.UserLink')?.textContent?.trim()
      || '匿名用户';
    let authorUrl = authorLink?.getAttribute('href') || '';
    if (authorUrl && authorUrl.startsWith('//')) authorUrl = `https:${authorUrl}`;
    else if (authorUrl && authorUrl.startsWith('/')) authorUrl = `https://www.zhihu.com${authorUrl}`;

    let roleTag = '';
    const directRoleEl = el.querySelector('.CommentItemV2-roleTag, [class*="roleTag"], [class*="RoleTag"], .AuthorInfo-badge');
    if (directRoleEl && (!directRoleEl.closest('[data-id], .CommentItemV2, .CommentItem') || directRoleEl.closest('[data-id], .CommentItemV2, .CommentItem') === el)) {
      roleTag = directRoleEl.textContent.trim();
    } else {
      const authorSpans = Array.from(el.querySelectorAll('span')).filter(s => {
        const parentItem = s.closest('[data-id], .CommentItemV2, .CommentItem');
        return (!parentItem || parentItem === el) && s.textContent.trim() === '作者';
      });
      if (authorSpans.length) roleTag = '作者';
    }

    let replyTo = '';
    if (!isRoot) {
      const arrowIcon = el.querySelector('.ZDI--ArrowRightAlt16, [class*="ArrowRightAlt"]');
      if (arrowIcon && arrowIcon.parentElement) {
        const users = Array.from(arrowIcon.parentElement.querySelectorAll('a[href*="/people/"], .UserLink-link, a'));
        if (users.length >= 2) {
          replyTo = users[users.length - 1].textContent.trim();
        }
      }
      if (!replyTo) {
        const replyEl = el.querySelector('.CommentItemV2-reply, [class*="reply"], [class*="Reply"]');
        if (replyEl) {
          const target = replyEl.querySelector('a[href*="/people/"], .UserLink-link, a');
          if (target) replyTo = target.textContent.trim();
        }
      }
      if (!replyTo) {
        const headerEl = el.querySelector('[class*="userName"], [class*="author"], [class*="1tww9qq"], .CommentItemV2-meta, [class*="meta"]');
        const headerText = (headerEl ? headerEl.textContent : el.textContent) || '';
        const m = headerText.match(/回复\s+([^\s:：]+)/);
        if (m) replyTo = m[1];
      }
    }

    const timeEls = Array.from(el.querySelectorAll('.CommentItemV2-time, .CommentItem-time, [class*="CommentItemV2-time"], [class*="time"], time, span')).filter(s => {
      const parentItem = s.closest('[data-id], .CommentItemV2, .CommentItem');
      return (!parentItem || parentItem === el) && /(?:\d+\s*(?:秒|分钟|小时|天)前|昨天|\d{4}-\d{2}-\d{2}|\d{2}-\d{2})/.test(s.textContent);
    });
    const publishedAt = timeEls[0]?.textContent?.trim() || '';

    const likeBtns = Array.from(el.querySelectorAll('.CommentItemV2-likeBtn, button[aria-label*="赞"], [class*="LikeButton"], [class*="likeBtn"], button')).filter(b => {
      const parentItem = b.closest('[data-id], .CommentItemV2, .CommentItem');
      if (parentItem && parentItem !== el) return false;
      return b.classList?.contains('CommentItemV2-likeBtn')
        || (typeof b.className === 'string' && /likeBtn|LikeButton/i.test(b.className))
        || b.getAttribute('aria-label')?.includes('赞')
        || b.querySelector?.('.ZDI--Heart, [class*="Heart" i]')
        || b.textContent.includes('赞');
    });
    let likes = '';
    if (likeBtns[0]) {
      const digits = likeBtns[0].textContent?.replace(/[^\d]/g, '') || '';
      if (digits) likes = digits;
    }

    const contentEls = Array.from(el.querySelectorAll('.CommentContent, .CommentItemV2-content, .RichText, [class*="CommentContent"], [class*="commentContent"]')).filter(c => {
      const parentItem = c.closest('[data-id], .CommentItemV2, .CommentItem');
      return !parentItem || parentItem === el;
    });
    let content = '';
    let images = [];
    const contentEl = contentEls[0];
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
      const childEls = Array.from(el.querySelectorAll('[data-id], .CommentItemV2, .CommentItem')).filter(c => c !== el);
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

  function scanAnswers(knownIds, targetId, doc = (typeof document !== 'undefined' ? document : null), limit = 0) {
    if (!doc) return [];
    const results = [];
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : { autoExpand: true, includeComments: true };
    const curMode = detectMode(typeof location !== 'undefined' ? location.pathname : '');
    const isSingleMode = curMode.mode === 'single' || !!targetId;

    for (const item of doc.querySelectorAll('.AnswerItem')) {
      if (limit > 0 && results.length >= limit) break;
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

      const metrics = extractActionMetrics(item);
      const { upvoteCount, commentCount, favCount, likeCount, noComments } = metrics;

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
        favCount,
        likeCount,
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
    parseArticle,
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
    extractActionMetrics,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PageParser };
}
