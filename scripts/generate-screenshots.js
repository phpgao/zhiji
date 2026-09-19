/**
 * 知集 (ZhiJi) — Chrome Web Store 1280x800 官方标准宣传截图生成器
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const screenshots = [
  {
    filename: 'screenshot-1-clipping.png',
    badge: '单/多回答精准采集 · 核心功能',
    title: '知乎高保真内容采集器',
    subtitle: '完美提取正文、数学公式 LaTeX、代码高亮与表格，输出纯净结构化 Markdown',
    contentHtml: `
      <div class="mock-browser">
        <div class="mock-header">
          <div class="mock-dots"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div>
          <div class="mock-url-bar">zhihu.com/question/58291048/answer/281940192</div>
        </div>
        <div class="mock-body">
          <div class="zhihu-content">
            <h1 class="mock-q-title">如何评价深度学习在编译器优化中的应用？</h1>
            <div class="author-row">
              <div class="avatar-ph"></div>
              <div>
                <div class="author-name">系统架构师小王 <span class="role-tag">已认证答主</span></div>
                <div class="author-sub">发布于 2026-09-01 · 2,840 赞同</div>
              </div>
            </div>
            <div class="mock-text">
              <p>在编译流水线中，传统 Pass 启发式规则往往难以平衡代码膨胀与运行效率：</p>
              <div class="code-block">
                <span class="kw">auto</span> optPass = Registry::<span class="fn">createPass</span>(<span class="str">"ml-loop-vectorize"</span>);<br>
                optPass-><span class="fn">runOnFunction</span>(F, AnalysisManager);
              </div>
              <p>其损失函数可形式化表述为：$$\\mathcal{L}(\\theta) = \\mathbb{E}_{\\tau \\sim \\pi_\\theta} [R(\\tau) - \\beta \\cdot \\text{CodeSize}(\\tau)]$$</p>
            </div>
          </div>
          <!-- ZhiJi floating panel overlay -->
          <div class="zj-overlay">
            <div class="zj-card-header">
              <div class="zj-logo-title"><span class="zj-icon">📡</span> 知集 · 高保真剪藏</div>
              <span class="zj-tag">已捕获回答</span>
            </div>
            <div class="zj-stats">
              <div class="stat-box"><span class="num">1</span><span class="lbl">目标回答</span></div>
              <div class="stat-box"><span class="num">2,840</span><span class="lbl">获赞同</span></div>
              <div class="stat-box"><span class="num">48</span><span class="lbl">精选评论</span></div>
            </div>
            <div class="zj-actions">
              <button class="btn btn-obsidian">📥 一键存入 Obsidian</button>
              <button class="btn btn-zip">📦 打包 ZIP (含图片)</button>
              <button class="btn btn-copy">📋 复制 Markdown</button>
            </div>
            <div class="zj-toast-sim">✅ YAML Frontmatter + LaTeX 公式转换就绪</div>
          </div>
        </div>
      </div>
    `
  },
  {
    filename: 'screenshot-2-comments.png',
    badge: '现代知乎浮窗适配 · 深度提取',
    title: '评论浮窗自动滚动与子评论解析',
    subtitle: '自动切换默认排序，平滑滚动加载更多，支持设置 10~1000 条抓取上限',
    contentHtml: `
      <div class="mock-browser">
        <div class="mock-header">
          <div class="mock-dots"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div>
          <div class="mock-url-bar">zhihu.com/question/205748918/answer/9928172</div>
        </div>
        <div class="mock-body modal-view">
          <div class="zhihu-bg-dim">
            <h1 class="mock-q-title dim">如何评价 Linux 内核 eBPF 技术的演进？</h1>
            <p class="dim-p">在传统网络可观测性方案中，内核态到用户态的数据拷贝构成了主要的性能开销...</p>
          </div>
          <!-- Zhihu Modern Comment Modal -->
          <div class="comment-modal">
            <div class="modal-top">
              <div class="cm-count">56 条评论</div>
              <div class="cm-tabs">
                <span class="cm-tab active">默认</span>
                <span class="cm-tab">最新</span>
              </div>
            </div>
            <div class="cm-scroll-area">
              <div class="cm-item">
                <div class="cm-avatar red-av"></div>
                <div class="cm-main">
                  <div class="cm-user">极客开发者 <span class="badge-author">作者</span></div>
                  <div class="cm-text">补充一下，XDP 层对包过滤的处理可以在网卡驱动层直接 drop，零拷贝优势巨大！ <span class="sticker">[赞同]</span></div>
                  <div class="cm-meta"><span>昨天 21:40</span> · <span>128 赞同</span></div>
                  <div class="cm-sub-item">
                    <div class="cm-user">网络工程师B:</div>
                    <div class="cm-text">确实，目前 Cilium 的方案已经把内核协议栈旁路做得非常成熟了。</div>
                  </div>
                </div>
              </div>
              <div class="cm-item">
                <div class="cm-avatar blue-av"></div>
                <div class="cm-main">
                  <div class="cm-user">架构小李</div>
                  <div class="cm-text">这篇文章写得通透，读下来非常舒服！</div>
                  <div class="cm-meta"><span>18 小时前</span> · <span>34 赞同</span></div>
                </div>
              </div>
            </div>
            <div class="cm-footer">
              <span class="cm-tip">⚡ 知集自动滚动采集中: 已拉取 56/100 条评论...</span>
            </div>
          </div>
        </div>
      </div>
    `
  },
  {
    filename: 'screenshot-3-obsidian-export.png',
    badge: '知识管理生态 · 离线永固',
    title: '结构化 YAML Frontmatter 与 Obsidian 直存',
    subtitle: '生成规范的 Dataview 元数据，支持本地并发下载图片生成离线归档 ZIP',
    contentHtml: `
      <div class="mock-dual-view">
        <div class="side-card obsidian-card">
          <div class="card-tag">💎 Obsidian 知识库实时同步</div>
          <pre class="frontmatter-code"><code><span class="c-yaml">---</span>
<span class="c-key">title</span>: <span class="c-val">"如何评价深度学习在编译器优化中的应用？"</span>
<span class="c-key">tags</span>:
  - <span class="c-tag">zhihu</span>
  - <span class="c-tag">compiler-optimization</span>
  - <span class="c-tag">deep-learning</span>
<span class="c-key">status</span>: <span class="c-val">ready</span>
<span class="c-key">source</span>: <span class="c-val">"https://www.zhihu.com/question/..."</span>
<span class="c-key">author</span>: <span class="c-val">"系统架构师小王"</span>
<span class="c-key">created</span>: <span class="c-val">"2026-09-19 22:30"</span>
<span class="c-key">upvote_count</span>: <span class="c-val">2840</span>
<span class="c-key">comment_count</span>: <span class="c-val">48</span>
<span class="c-yaml">---</span>

<span class="c-h2">## 回答正文</span>
在编译流水线中，传统 Pass 启发式规则往往难以平衡...</code></pre>
        </div>
        <div class="side-card settings-card">
          <div class="card-tag">⚙️ 双入口动态可视化设置</div>
          <div class="setting-row">
            <label>Obsidian Vault 仓库名</label>
            <input type="text" value="Personal-Knowledge" readonly />
          </div>
          <div class="setting-row">
            <label>笔记保存文件夹 (Folder)</label>
            <input type="text" value="Clippings/Zhihu" readonly />
          </div>
          <div class="setting-row">
            <label>单回答最大评论拉取条数</label>
            <input type="text" value="100 条 (默认排序)" readonly />
          </div>
          <div class="setting-checkboxes">
            <div class="chk active">☑️ 自动展开折叠回答</div>
            <div class="chk active">☑️ 提取话题标签 (Kebab-case)</div>
            <div class="chk active">☑️ 包含问题描述与元数据</div>
          </div>
        </div>
      </div>
    `
  }
];

function buildPage(item) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1280px;
      height: 800px;
      background: radial-gradient(circle at 50% 15%, #1e293b 0%, #0f172a 60%, #020617 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: #f8fafc;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 36px 48px 24px;
      position: relative;
    }
    /* Ambient glow */
    body::before {
      content: "";
      position: absolute;
      top: -100px;
      left: 50%;
      transform: translateX(-50%);
      width: 650px;
      height: 350px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, rgba(59, 130, 246, 0.08) 50%, transparent 80%);
      filter: blur(50px);
      z-index: 0;
      pointer-events: none;
    }
    .top-header {
      text-align: center;
      z-index: 1;
      margin-bottom: 20px;
    }
    .badge {
      display: inline-block;
      padding: 4px 14px;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 9999px;
      color: #38bdf8;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 15px;
      color: #94a3b8;
    }
    .main-view {
      width: 100%;
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: stretch;
      z-index: 1;
    }
    /* Mock Browser Window */
    .mock-browser {
      width: 100%;
      max-width: 1140px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .mock-header {
      height: 40px;
      background: rgba(255, 255, 255, 0.04);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 16px;
    }
    .mock-dots {
      display: flex;
      gap: 7px;
    }
    .dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
    }
    .dot.red { background: #ff5f56; }
    .dot.yellow { background: #ffbd2e; }
    .dot.green { background: #27c93f; }
    .mock-url-bar {
      flex: 1;
      max-width: 500px;
      height: 24px;
      background: rgba(0, 0, 0, 0.35);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #64748b;
      margin: 0 auto;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .mock-body {
      flex: 1;
      padding: 24px 32px;
      display: flex;
      position: relative;
      background: #0f172a;
    }
    .zhihu-content {
      flex: 1;
      padding-right: 320px;
    }
    .mock-q-title {
      font-size: 21px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 14px;
      line-height: 1.4;
    }
    .author-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .avatar-ph {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0284c7, #38bdf8);
    }
    .author-name {
      font-size: 14px;
      font-weight: 600;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .role-tag {
      font-size: 11px;
      padding: 1px 6px;
      background: rgba(14, 165, 233, 0.2);
      color: #38bdf8;
      border-radius: 4px;
    }
    .author-sub {
      font-size: 12px;
      color: #64748b;
    }
    .mock-text {
      font-size: 14px;
      line-height: 1.7;
      color: #cbd5e1;
    }
    .code-block {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 12px 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12.5px;
      color: #93c5fd;
      margin: 12px 0;
      line-height: 1.6;
    }
    .kw { color: #f43f5e; font-weight: 600; }
    .fn { color: #38bdf8; }
    .str { color: #a7f3d0; }

    /* ZhiJi floating panel simulation */
    .zj-overlay {
      position: absolute;
      right: 32px;
      top: 24px;
      width: 290px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(56, 189, 248, 0.3);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15);
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .zj-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .zj-logo-title {
      font-size: 14px;
      font-weight: 700;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .zj-tag {
      font-size: 11px;
      color: #22c55e;
      background: rgba(34, 197, 94, 0.15);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .zj-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      background: rgba(0, 0, 0, 0.3);
      padding: 10px;
      border-radius: 8px;
    }
    .stat-box {
      text-align: center;
    }
    .stat-box .num {
      display: block;
      font-size: 16px;
      font-weight: 700;
      color: #38bdf8;
    }
    .stat-box .lbl {
      font-size: 10.5px;
      color: #64748b;
    }
    .zj-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .btn {
      width: 100%;
      height: 34px;
      border-radius: 6px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      transition: all 0.2s;
    }
    .btn-obsidian {
      background: linear-gradient(135deg, #7c3aed, #9333ea);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
    }
    .btn-zip {
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .btn-copy {
      background: rgba(255, 255, 255, 0.05);
      color: #94a3b8;
    }
    .zj-toast-sim {
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 8px;
    }

    /* Modal view styles for screenshot 2 */
    .modal-view {
      justify-content: center;
      align-items: center;
    }
    .zhihu-bg-dim {
      opacity: 0.2;
      filter: blur(2px);
      width: 100%;
    }
    .dim { color: #64748b; }
    .dim-p { color: #475569; font-size: 13px; line-height: 1.6; }
    .comment-modal {
      position: absolute;
      width: 620px;
      max-height: 480px;
      background: #182234;
      border: 1px solid rgba(56, 189, 248, 0.25);
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.15);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .modal-top {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cm-count {
      font-size: 15px;
      font-weight: 700;
      color: #f1f5f9;
    }
    .cm-tabs {
      display: flex;
      gap: 12px;
    }
    .cm-tab {
      font-size: 13px;
      color: #64748b;
      cursor: pointer;
    }
    .cm-tab.active {
      color: #38bdf8;
      font-weight: 700;
      border-bottom: 2px solid #38bdf8;
      padding-bottom: 2px;
    }
    .cm-scroll-area {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .cm-item {
      display: flex;
      gap: 12px;
    }
    .cm-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .red-av { background: linear-gradient(135deg, #f43f5e, #fb7185); }
    .blue-av { background: linear-gradient(135deg, #0ea5e9, #38bdf8); }
    .cm-main { flex: 1; }
    .cm-user {
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .badge-author {
      font-size: 10px;
      padding: 1px 4px;
      background: rgba(56, 189, 248, 0.2);
      color: #38bdf8;
      border-radius: 3px;
    }
    .cm-text {
      font-size: 13px;
      line-height: 1.5;
      color: #cbd5e1;
      margin-bottom: 6px;
    }
    .sticker {
      color: #38bdf8;
      font-weight: 600;
    }
    .cm-meta {
      font-size: 11px;
      color: #64748b;
    }
    .cm-sub-item {
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 6px;
      font-size: 12px;
    }
    .cm-sub-item .cm-user { font-size: 12px; color: #94a3b8; margin-bottom: 2px; }
    .cm-sub-item .cm-text { font-size: 12px; color: #cbd5e1; margin-bottom: 0; }
    .cm-footer {
      padding: 12px 20px;
      background: rgba(0, 0, 0, 0.4);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      justify-content: center;
    }
    .cm-tip {
      font-size: 12px;
      color: #38bdf8;
      font-weight: 600;
    }

    /* Dual view for screenshot 3 */
    .mock-dual-view {
      width: 100%;
      max-width: 1140px;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 20px;
    }
    .side-card {
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7);
      padding: 24px;
      display: flex;
      flex-direction: column;
    }
    .card-tag {
      font-size: 13.5px;
      font-weight: 700;
      color: #38bdf8;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .frontmatter-code {
      flex: 1;
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12.5px;
      line-height: 1.6;
      color: #cbd5e1;
      overflow: hidden;
    }
    .c-yaml { color: #64748b; }
    .c-key { color: #38bdf8; font-weight: 600; }
    .c-val { color: #a7f3d0; }
    .c-tag { color: #f472b6; }
    .c-h2 { color: #fbbf24; font-weight: 700; margin-top: 8px; display: block; }

    .setting-row {
      margin-bottom: 14px;
    }
    .setting-row label {
      display: block;
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .setting-row input {
      width: 100%;
      height: 36px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 0 12px;
      font-size: 13px;
      color: #f1f5f9;
      outline: none;
    }
    .setting-checkboxes {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .chk {
      font-size: 12.5px;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  </style>
</head>
<body>
  <div class="top-header">
    <div class="badge">${item.badge}</div>
    <h1>${item.title}</h1>
    <div class="subtitle">${item.subtitle}</div>
  </div>
  <div class="main-view">
    ${item.contentHtml}
  </div>
</body>
</html>`;
}

function buildSmallPromo(logoBase64) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 440px;
      height: 280px;
      background: radial-gradient(circle at 50% 25%, #1e293b 0%, #0f172a 65%, #020617 100%);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: #fff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 24px;
      text-align: center;
    }
    body::before {
      content: "";
      position: absolute;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
      width: 260px;
      height: 180px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, transparent 75%);
      filter: blur(30px);
      pointer-events: none;
    }
    .logo-box {
      width: 68px;
      height: 68px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.2);
      margin-bottom: 14px;
      position: relative;
      z-index: 1;
    }
    .logo-box img {
      width: 48px;
      height: 48px;
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(180deg, #ffffff 0%, #e2e8f0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
      z-index: 1;
    }
    .tagline {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 14px;
      z-index: 1;
    }
    .chips {
      display: flex;
      gap: 6px;
      z-index: 1;
    }
    .chip {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 9999px;
      color: #38bdf8;
    }
  </style>
</head>
<body>
  <div class="logo-box">
    <img src="data:image/png;base64,${logoBase64}" alt="Logo" />
  </div>
  <h1>知集 (ZhiJi)</h1>
  <div class="tagline">知乎高保真内容采集器</div>
  <div class="chips">
    <span class="chip">Markdown</span>
    <span class="chip">Obsidian 直存</span>
    <span class="chip">评论浮窗</span>
  </div>
</body>
</html>`;
}

function buildMarqueePromo(logoBase64) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1400px;
      height: 560px;
      background: radial-gradient(circle at 25% 30%, #1e293b 0%, #0f172a 55%, #020617 100%);
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: #fff;
      overflow: hidden;
      display: flex;
      position: relative;
      padding: 56px 80px;
      align-items: center;
    }
    body::before {
      content: "";
      position: absolute;
      top: -80px;
      left: 120px;
      width: 550px;
      height: 380px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, transparent 70%);
      filter: blur(50px);
      pointer-events: none;
    }
    .left-col {
      width: 53%;
      z-index: 1;
      padding-right: 48px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 9999px;
      color: #38bdf8;
      font-size: 13.5px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 46px;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: -1px;
      background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 18px;
      color: #94a3b8;
      margin-bottom: 24px;
      line-height: 1.4;
    }
    .feature-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14.5px;
      color: #e2e8f0;
    }
    .icon-box {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }
    .right-col {
      width: 47%;
      z-index: 1;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .preview-card {
      width: 480px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      box-shadow: 0 30px 70px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(56, 189, 248, 0.15);
      overflow: hidden;
    }
    .card-head {
      height: 38px;
      background: rgba(255, 255, 255, 0.04);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 8px;
    }
    .dots { display: flex; gap: 6px; }
    .d { width: 10px; height: 10px; border-radius: 50%; }
    .dr { background: #ff5f56; } .dy { background: #ffbd2e; } .dg { background: #27c93f; }
    .card-body {
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .q-row {
      font-size: 15.5px;
      font-weight: 700;
      color: #f1f5f9;
      line-height: 1.4;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      background: rgba(0, 0, 0, 0.35);
      padding: 12px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .s-box { text-align: center; }
    .s-num { font-size: 18px; font-weight: 700; color: #38bdf8; display: block; }
    .s-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
    .btn-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .p-btn {
      height: 38px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
    }
    .btn-obs {
      background: linear-gradient(135deg, #7c3aed, #9333ea);
      color: #fff;
      box-shadow: 0 4px 15px rgba(124, 58, 237, 0.35);
    }
    .btn-z {
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
  </style>
</head>
<body>
  <div class="left-col">
    <div class="badge">📡 知乎高保真内容采集与长效归档</div>
    <h1>知集 (ZhiJi)</h1>
    <div class="subtitle">单回答剪藏 · 评论浮窗深度提取 · 一键直存 Obsidian</div>
    <div class="feature-list">
      <div class="feature-item">
        <div class="icon-box">📐</div>
        <span>数学公式 LaTeX 无损转换、代码高亮与 GFM 表格</span>
      </div>
      <div class="feature-item">
        <div class="icon-box">💬</div>
        <span>深度适配知乎现代评论浮窗，平滑滚动与上限控制</span>
      </div>
      <div class="feature-item">
        <div class="icon-box">💎</div>
        <span>生成规范 YAML Frontmatter，支持本地离线 ZIP 打包</span>
      </div>
    </div>
  </div>
  <div class="right-col">
    <div class="preview-card">
      <div class="card-head">
        <div class="dots"><span class="d dr"></span><span class="d dy"></span><span class="d dg"></span></div>
        <span style="font-size:12px; color:#64748b; margin-left:8px;">zhihu.com/question/.../answer/...</span>
      </div>
      <div class="card-body">
        <div class="q-row">如何评价深度学习在编译器优化中的应用？</div>
        <div class="stat-grid">
          <div class="s-box"><span class="s-num">1</span><span class="s-lbl">目标回答</span></div>
          <div class="s-box"><span class="s-num">2,840</span><span class="s-lbl">获赞同</span></div>
          <div class="s-box"><span class="s-num">48</span><span class="s-lbl">精选评论</span></div>
        </div>
        <div class="btn-row">
          <button class="p-btn btn-obs">📥 存入 Obsidian</button>
          <button class="p-btn btn-z">📦 离线 ZIP 打包</button>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function run() {
  console.log('📸 启动 Headless Chrome 渲染官方标准宣传物料...\n');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const logoPath = path.join(ROOT, 'assets', 'logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

  // 1. Render 1280x800 screenshots
  const page800 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  for (const item of screenshots) {
    const html = buildPage(item);
    await page800.setContent(html, { waitUntil: 'networkidle' });
    const outPath = path.join(OUT_DIR, item.filename);
    await page800.screenshot({ path: outPath, type: 'png' });
    console.log(`  ✅ 截图: assets/screenshots/${item.filename} (1280x800 PNG)`);
  }
  await page800.close();

  // 2. Render Small Promo Tile (440x280)
  const pageSmall = await browser.newPage({ viewport: { width: 440, height: 280 } });
  const smallHtml = buildSmallPromo(logoBase64);
  await pageSmall.setContent(smallHtml, { waitUntil: 'networkidle' });
  const smallOutPath = path.join(OUT_DIR, 'promo-small-440x280.png');
  await pageSmall.screenshot({ path: smallOutPath, type: 'png' });
  console.log(`  ✅ 小型宣传图块: assets/screenshots/promo-small-440x280.png (440x280 PNG)`);
  await pageSmall.close();

  // 3. Render Marquee Promo Tile (1400x560)
  const pageMarquee = await browser.newPage({ viewport: { width: 1400, height: 560 } });
  const marqueeHtml = buildMarqueePromo(logoBase64);
  await pageMarquee.setContent(marqueeHtml, { waitUntil: 'networkidle' });
  const marqueeOutPath = path.join(OUT_DIR, 'promo-marquee-1400x560.png');
  await pageMarquee.screenshot({ path: marqueeOutPath, type: 'png' });
  console.log(`  ✅ 顶部宣传图块: assets/screenshots/promo-marquee-1400x560.png (1400x560 PNG)`);
  await pageMarquee.close();

  await browser.close();
  console.log('\n🎉 所有宣传图块与截图生成完毕！\n');
}

run().catch(err => {
  console.error('❌ 生成失败:', err);
  process.exit(1);
});
