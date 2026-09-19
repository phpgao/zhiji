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
    .zj-mode-article {
      background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);
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

    .zj-limit-bar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px; font-size: 11.5px; color: #b0b0c8;
      background: rgba(255,255,255,0.03); padding: 5px 10px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .zj-limit-left { display: flex; align-items: center; gap: 5px; }
    .zj-limit-input {
      width: 48px; padding: 2px 5px; border-radius: 5px;
      border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3);
      color: #5ceba0; font-size: 12px; font-weight: 600; text-align: center;
      outline: none; transition: border-color 0.2s;
    }
    .zj-limit-input:focus { border-color: #6c9fff; }
    .zj-limit-chips { display: flex; gap: 4px; }
    .zj-chip {
      padding: 2px 7px; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px;
      background: rgba(255,255,255,0.05); color: #8888aa; font-size: 10.5px;
      cursor: pointer; transition: all 0.15s;
    }
    .zj-chip:hover { background: rgba(255,255,255,0.1); color: #e8e8f0; }
    .zj-chip.zj-chip-active {
      background: rgba(92, 235, 160, 0.18); border-color: rgba(92, 235, 160, 0.4);
      color: #5ceba0; font-weight: 600;
    }

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
    if (mode === 'article') {
      switch (state) {
        case 'idle':
          trigger.textContent = '📡 知集 · 剪藏当前文章';
          break;
        case 'active':
          trigger.classList.add('zj-active');
          trigger.textContent = '⏳ 正在剪藏当前文章...';
          break;
        case 'done':
          trigger.classList.add('zj-done');
          trigger.textContent = '✅ 已剪藏当前文章';
          break;
      }
    } else if (mode === 'single') {
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
      const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : {};
      const maxAnswers = cfg.maxAnswers > 0 ? cfg.maxAnswers : null;
      const target = maxAnswers && total != null ? Math.min(total, maxAnswers) : (maxAnswers || total);
      const totalStr = total != null ? ` · 共${total}条` : '';
      const limitStr = maxAnswers ? ` (上限${maxAnswers}条)` : '';
      switch (state) {
        case 'idle':
          trigger.textContent = `📡 知集 · 采集回答${totalStr}${limitStr}`;
          break;
        case 'active':
          trigger.classList.add('zj-active');
          trigger.textContent = `⏹ 停止采集 (${count}${target != null ? `/${target}` : ''}条)`;
          break;
        case 'done':
          trigger.classList.add('zj-done');
          trigger.textContent = (maxAnswers && count >= maxAnswers)
            ? `✅ 已达到采集上限 ${count} 条回答`
            : ((total != null && count >= total)
              ? `✅ 已采集全部 ${count} 条回答`
              : `✅ 已采集 ${count} 条回答${totalStr}`);
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
      <div class="zj-field" style="margin-top: 8px;">
        <label class="zj-label">最大采集回答数 (多回答列表页，0 为不限制)</label>
        <input type="number" class="zj-input" id="zj-cfg-maxAnswers" min="0" max="5000" step="5" value="${cfg.maxAnswers || 0}">
        <div class="zj-field-hint">🛡️ 限制单次采集的最大回答数量（0 为不限制），防止过多采集触发知乎反爬风控</div>
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
        maxAnswers: Math.max(0, parseInt(view.querySelector('#zj-cfg-maxAnswers')?.value, 10) || 0),
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
    const tagClass = mode === 'article' ? 'zj-mode-article' : (mode === 'single' ? 'zj-mode-single' : 'zj-mode-multi');
    tag.className = `zj-mode-tag ${tagClass}`;
    tag.textContent = mode === 'article' ? '专栏文章' : (mode === 'single' ? '单回答' : '多回答');

    const counter = document.createElement('span');
    counter.className = 'zj-counter';
    if (isSettingsOpen) {
      counter.textContent = '偏好配置';
    } else if (mode === 'article') {
      const cCount = (answers[0]?.comments && typeof PageParser !== 'undefined')
        ? PageParser.countAllComments(answers[0].comments)
        : (answers[0]?.comments?.length || 0);
      counter.innerHTML = answers.length
        ? `当前文章 <b style="color:#5ceba0">已就绪</b>${cCount > 0 ? ` · 💬 <b>${cCount}</b>` : ''}`
        : `等待加载...`;
    } else if (mode === 'single') {
      const cCount = (answers[0]?.comments && typeof PageParser !== 'undefined')
        ? PageParser.countAllComments(answers[0].comments)
        : (answers[0]?.comments?.length || 0);
      counter.innerHTML = answers.length
        ? `当前回答 <b style="color:#5ceba0">已就绪</b>${cCount > 0 ? ` · 💬 <b>${cCount}</b>` : ''}`
        : `等待加载...`;
    } else {
      const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : {};
      const maxAnswers = cfg.maxAnswers > 0 ? cfg.maxAnswers : null;
      const target = maxAnswers && total != null ? Math.min(total, maxAnswers) : (maxAnswers || total);
      const capStr = maxAnswers ? ` <span style="font-size:11px;color:#8888aa;">(上限 ${maxAnswers})</span>` : '';
      counter.innerHTML = `已采集 <b>${answers.length}</b>${target != null ? ` / ${target}` : ''} 条${capStr}`;
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
      const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : {};
      const maxAnswers = cfg.maxAnswers > 0 ? cfg.maxAnswers : null;
      const target = maxAnswers && total != null ? Math.min(total, maxAnswers) : (maxAnswers || total);

      // Progress bar
      if (target != null && target > 0) {
        const bar = document.createElement('div');
        bar.className = 'zj-progress-bar';
        const fill = document.createElement('div');
        fill.className = 'zj-progress-fill';
        fill.style.width = `${Math.min(100, (answers.length / target) * 100)}%`;
        bar.appendChild(fill);
        panel.appendChild(bar);
      }

      // Scroll control & Quick limit bar
      const section = document.createElement('div');
      section.className = 'zj-section';

      const limitBar = document.createElement('div');
      limitBar.className = 'zj-limit-bar';
      const curMax = cfg.maxAnswers || 0;
      limitBar.innerHTML = `
        <div class="zj-limit-left">
          <span>🛡️ 采集上限:</span>
          <input type="number" class="zj-limit-input" id="zj-quick-max-answers" min="0" max="5000" step="10" value="${curMax}" placeholder="0不限" title="采集最大回答数，0为不限制">
          <span>条</span>
        </div>
        <div class="zj-limit-chips">
          <button class="zj-chip ${curMax === 0 ? 'zj-chip-active' : ''}" data-val="0" title="不限制回答数">不限</button>
          <button class="zj-chip ${curMax === 20 ? 'zj-chip-active' : ''}" data-val="20">20</button>
          <button class="zj-chip ${curMax === 50 ? 'zj-chip-active' : ''}" data-val="50">50</button>
          <button class="zj-chip ${curMax === 100 ? 'zj-chip-active' : ''}" data-val="100">100</button>
        </div>
      `;

      limitBar.querySelectorAll('.zj-chip').forEach(btn => {
        btn.onclick = () => {
          const val = parseInt(btn.getAttribute('data-val'), 10) || 0;
          if (typeof ConfigManager !== 'undefined') {
            ConfigManager.set({ maxAnswers: val });
          }
          if (typeof App !== 'undefined') App.refresh();
        };
      });

      const quickInput = limitBar.querySelector('#zj-quick-max-answers');
      if (quickInput) {
        quickInput.onchange = () => {
          const val = Math.max(0, parseInt(quickInput.value, 10) || 0);
          if (typeof ConfigManager !== 'undefined') {
            ConfigManager.set({ maxAnswers: val });
          }
          if (typeof App !== 'undefined') App.refresh();
        };
        quickInput.onkeydown = e => {
          if (e.key === 'Enter') quickInput.blur();
        };
      }
      section.appendChild(limitBar);

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
      } else if (target != null && answers.length >= target && target > 0) {
        scrollBtn.className = 'zj-scroll-btn zj-done';
        scrollBtn.textContent = (maxAnswers && answers.length >= maxAnswers)
          ? `✅ 已达到采集上限 (共 ${answers.length} 条)`
          : `✅ 已采集全部回答 (共 ${answers.length} 条)`;
        scrollBtn.onclick = () => {
          toast(maxAnswers && answers.length >= maxAnswers
            ? `✅ 已达到采集上限 (${answers.length}/${maxAnswers})，可直接导出`
            : `✅ 所有回答已采集完毕 (${answers.length}/${total})，可直接导出`);
        };
      } else {
        scrollBtn.className = 'zj-scroll-btn';
        const limitText = maxAnswers ? ` (最多 ${maxAnswers} 条)` : '';
        scrollBtn.textContent = answers.length > 0
          ? `⚡ 继续自动滚动采集 (当前 ${answers.length}${target != null ? `/${target}` : ''})`
          : `⚡ 自动滚动采集回答${limitText}`;
        scrollBtn.onclick = () => {
          if (typeof App !== 'undefined' && !App.isGrabbing()) App.startGrab();
          if (typeof ScrollEngine !== 'undefined') ScrollEngine.start(() => App.refresh());
          if (typeof App !== 'undefined') App.refresh();
        };
      }
      section.appendChild(scrollBtn);
      panel.appendChild(section);
    } else {
      // Single answer or article mode: Showcase Card
      if (answers.length > 0) {
        const a = answers[0];
        const singleCard = document.createElement('div');
        singleCard.className = 'zj-single-card';
        const switchLinkHtml = mode === 'article'
          ? ''
          : `<a class="zj-switch-link" href="/question/${questionId}">⚡ 查看该问题全部回答 &raquo;</a>`;
        singleCard.innerHTML = `
          <div class="zj-single-head">
            <span class="zj-single-author">${a.author}</span>
            <span class="zj-single-meta">
              ${a.upvoteCount ? `<span style="color:#5ceba0;">👍 ${a.upvoteCount}</span> · ` : ''}
              ${a.comments?.length ? `<span style="color:#60a5fa;">💬 ${a.comments.length}条评论</span> · ` : (a.commentCount ? `💬 ${a.commentCount}条 · ` : '')}
              ${a.favCount ? `<span style="color:#fbbf24;">⭐ ${a.favCount}</span> · ` : ''}
              ${a.likeCount ? `<span style="color:#f87171;">❤️ ${a.likeCount}</span> · ` : ''}
              ${a.publishedAt || ''}
            </span>
          </div>
          <div class="zj-single-snippet">${a.snippet || a.content.substring(0, 120)}</div>
          ${switchLinkHtml}
        `;
        panel.appendChild(singleCard);
      } else {
        const empty = document.createElement('div');
        empty.className = 'zj-empty';
        const emptySwitch = mode === 'article'
          ? ''
          : `<div style="margin-top:8px;"><a class="zj-switch-link" href="/question/${questionId}">⚡ 查看该问题全部回答 &raquo;</a></div>`;
        empty.innerHTML = `
          <div class="zj-empty-icon">⏳</div>
          <div>正在加载当前${mode === 'article' ? '文章' : '回答'}...</div>
          ${emptySwitch}
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
      { icon: '📋', label: (mode === 'single' || mode === 'article') ? '复制 Markdown' : '复制全部', action: () => App.exportAs('clipboard') },
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
                ${a.upvoteCount ? `<span class="zj-upvote">👍 ${a.upvoteCount}</span>` : ''}
                ${a.commentCount ? `<span style="margin-left:4px">💬 ${a.commentCount}</span>` : ''}
                ${a.favCount ? `<span style="margin-left:4px;color:#fbbf24;">⭐ ${a.favCount}</span>` : ''}
                ${a.likeCount ? `<span style="margin-left:4px;color:#f87171;">❤️ ${a.likeCount}</span>` : ''}
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
            const metaParts = [];
            if (a.publishedAt) metaParts.push(`🕒 ${a.publishedAt}`);
            if (a.upvoteCount) metaParts.push(`👍 ${a.upvoteCount}`);
            if (a.commentCount) metaParts.push(`💬 ${a.commentCount}条评论`);
            if (a.favCount) metaParts.push(`⭐ ${a.favCount}收藏`);
            if (a.likeCount) metaParts.push(`❤️ ${a.likeCount}喜欢`);
            const metaStr = metaParts.length ? `\n> ${metaParts.join(' · ')}` : '';
            const singleMd = `### ${authorShow}\n${metaStr}\n> 🔗 [原文](${a.answerUrl})\n\n${a.content}`;
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

    if (mode === 'single' || mode === 'article') {
      footer.innerHTML = `<span>${mode === 'article' ? '知乎专栏' : '单回答模式'} · 高保真剪藏</span>`;
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UI };
}
