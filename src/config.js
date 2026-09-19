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
    maxAnswers: 0,
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
    if (partial && 'maxAnswers' in partial) {
      partial.maxAnswers = Math.max(0, parseInt(partial.maxAnswers, 10) || 0);
    }
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConfigManager };
}
