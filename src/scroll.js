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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ScrollEngine };
}
