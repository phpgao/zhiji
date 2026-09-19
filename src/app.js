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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { App };
}
