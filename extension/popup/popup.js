/**
 * 知集 (ZhiJi) — 扩展弹窗交互逻辑
 */

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
  maxAnswers: 0,
  includeFrontmatter: true,
};

let currentTabId = null;

async function init() {
  // Load configuration
  chrome.storage.sync.get(STORAGE_KEY, res => {
    const cfg = { ...DEFAULTS, ...(res?.[STORAGE_KEY] || {}) };
    document.getElementById('cfg-vault').value = cfg.vault || '';
    document.getElementById('cfg-folder').value = cfg.folder || '';
    document.getElementById('cfg-autoExpand').checked = !!cfg.autoExpand;
    document.getElementById('cfg-includeDetail').checked = !!cfg.includeDetail;
    document.getElementById('cfg-includeTags').checked = !!cfg.includeTags;
    document.getElementById('cfg-includeAnswerMeta').checked = !!cfg.includeAnswerMeta;
    document.getElementById('cfg-includeComments').checked = !!cfg.includeComments;
    document.getElementById('cfg-maxComments').value = cfg.maxComments || 100;
    document.getElementById('cfg-maxAnswers').value = cfg.maxAnswers || 0;
    document.getElementById('cfg-includeFrontmatter').checked = !!cfg.includeFrontmatter;
  });

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  currentTabId = tab.id;

  const isZhihuQuestion = /^https:\/\/www\.zhihu\.com\/question\/\d+/.test(tab.url);
  const isZhihuArticle = /^https:\/\/(?:zhuanlan|www)\.zhihu\.com\/p\/\d+/.test(tab.url);

  const dot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const zhihuInfo = document.getElementById('zhihu-info');
  const nonZhihuInfo = document.getElementById('non-zhihu-info');

  if (isZhihuQuestion || isZhihuArticle) {
    dot.classList.add('active');
    statusText.textContent = isZhihuArticle ? '已连接到知乎专栏文章' : '已连接到知乎问答页面';
    zhihuInfo.style.display = 'flex';
    nonZhihuInfo.style.display = 'none';

    // Query status from content script
    try {
      chrome.tabs.sendMessage(currentTabId, { action: 'getStatus' }, resp => {
        if (chrome.runtime.lastError || !resp) {
          document.getElementById('question-title').textContent = tab.title.replace(/ - 知乎$/, '');
          return;
        }
        document.getElementById('question-title').textContent = resp.title || tab.title.replace(/ - 知乎$/, '');
        const modeEl = document.getElementById('q-mode');
        if (resp.mode === 'article' || isZhihuArticle) {
          modeEl.textContent = '专栏文章';
          modeEl.classList.add('single');
        } else {
          modeEl.textContent = resp.mode === 'single' ? '单回答' : '多回答';
          if (resp.mode === 'single') modeEl.classList.add('single');
        }

        const maxStr = resp.maxAnswers > 0 ? ` (上限 ${resp.maxAnswers})` : '';
        const totalStr = resp.total ? ` / ${resp.total}` : '';
        document.getElementById('q-count').textContent = (resp.mode === 'article' || isZhihuArticle)
          ? '文章模式'
          : `已采集 ${resp.count}${totalStr} 条${maxStr}`;
      });
    } catch {}
  } else {
    dot.classList.remove('active');
    statusText.textContent = '未检测到知乎问答或文章';
    zhihuInfo.style.display = 'none';
    nonZhihuInfo.style.display = 'block';
  }

  // Bind Actions
  document.getElementById('btn-toggle-panel')?.addEventListener('click', () => {
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { action: 'togglePanel' });
      window.close();
    }
  });

  document.getElementById('btn-quick-grab')?.addEventListener('click', () => {
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { action: 'startGrab' });
      window.close();
    }
  });

  document.getElementById('btn-open-zhihu')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.zhihu.com/hot' });
    window.close();
  });

  document.getElementById('btn-save-cfg')?.addEventListener('click', () => {
    const updated = {
      vault: document.getElementById('cfg-vault').value.trim(),
      folder: document.getElementById('cfg-folder').value.trim(),
      autoExpand: document.getElementById('cfg-autoExpand').checked,
      includeDetail: document.getElementById('cfg-includeDetail').checked,
      includeTags: document.getElementById('cfg-includeTags').checked,
      includeAnswerMeta: document.getElementById('cfg-includeAnswerMeta').checked,
      includeComments: document.getElementById('cfg-includeComments').checked,
      maxComments: Math.max(10, parseInt(document.getElementById('cfg-maxComments').value, 10) || 100),
      maxAnswers: Math.max(0, parseInt(document.getElementById('cfg-maxAnswers').value, 10) || 0),
      includeFrontmatter: document.getElementById('cfg-includeFrontmatter').checked,
    };

    chrome.storage.sync.set({ [STORAGE_KEY]: updated }, () => {
      const msg = document.getElementById('save-msg');
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 2000);
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
