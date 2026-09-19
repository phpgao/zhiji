# 知集 (ZhiJi) 📡

<p align="center">
  <img src="assets/logo.png" width="96" height="96" alt="知集 Logo">
</p>

<p align="center">
  <b>知乎高保真内容采集器</b><br>
  单回答 / 多回答采集 · 高保真 Markdown · Obsidian 直存 · 本地 ZIP 打包 · 动态可视化配置
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue.svg" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4.svg" alt="Chrome">
  <img src="https://img.shields.io/badge/Tampermonkey-Userscript-00485B.svg" alt="Tampermonkey">
  <img src="https://img.shields.io/badge/Tests-50%20passed-10b981.svg" alt="Tests">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT">
</p>

---

## ✨ 核心特性

| 特性 | 说明 |
|---|---|
| 🌐 **双端同构架构** | 唯一事实来源代码，同时编译为 **Chrome 扩展**、**Tampermonkey 油猴脚本** |
| 🎯 **单回答 / 多回答自适应** | 根据 URL 自动识别模式：单回答页面精准剪藏当前回答与评论浮窗，问题页面批量滚动采集全部回答 |
| 💬 **评论高保真采集** | 适配现代知乎浮窗 Modal，支持默认排序切换、自动平滑滚动加载更多（可自定义上限 10~1000 条） |
| 📝 **高保真 Markdown** | 完美转换数学公式（行内 `$..$` / 块级 `$$..$$`）、代码高亮、GFM 表格、引用、列表、知乎链接卡片 |
| 🏷️ **结构化 Frontmatter** | 输出规范的 YAML 元数据（`tags`、`status: ready`、`source`、`type`、`related: []`、关注数/浏览量） |
| 📥 **Obsidian 一键直存** | 通过 `obsidian://new` 协议一键导入指定 Vault 和目录，自动保留远程高清图 |
| 📦 **本地离线 ZIP 打包** | 内置纯 JS STORE 级 ZIP 引擎，自动并发下载图片至 `assets/` 目录并重写 Markdown 引用路径 |
| ⚙️ **双入口动态可视化配置** | 彻底告别脚本硬编码！支持在**扩展工具栏弹窗**或**网页内嵌设置面板**随时修改 Vault 名称、存储路径与评论上限 |
| 🎨 **暗色毛玻璃 UI** | 现代极简设计（`backdrop-filter: blur(24px)`）、状态自愈、优雅进度条与极简单例通知 |

---

## 🚀 快速安装

### 方式一：Chrome 浏览器扩展 (推荐)

1. 下载或克隆本项目仓库：
   ```bash
   git clone https://github.com/phpgao/zhiji.git
   cd zhiji && npm run build
   ```
2. 打开 Chrome，地址栏输入 `chrome://extensions/`；
3. 打开右上角的 **「开发者模式」** 开关；
4. 点击左上角 **「加载已解压的扩展程序」**，选择项目的 `dist/chrome` 目录即可。

### 方式二：Tampermonkey 油猴脚本

1. 安装浏览器扩展 [Tampermonkey](https://www.tampermonkey.net/)；
2. 直接安装根目录下的单文件脚本 [`zhiji.user.js`](zhiji.user.js) 即可使用。

---

## ⚙️ 动态配置说明

知集支持通过图形界面随时修改偏好配置，**设置后即时生效**：

- **扩展用户**：点击浏览器右上角知集插件图标，在弹窗中修改并保存；
- **油猴脚本用户**：点击网页右下角知集面板顶部的 **⚙️ 设置** 按钮，直接在页面内修改并保存。

| 配置项 | 默认值 | 作用 |
|---|---|---|
| `Vault (仓库名)` | `""` (默认留空) | Obsidian 知识库名称（**必填项**，未配置时阻止存入并引导配置） |
| `保存目录 (Folder)` | `""` (默认留空) | Obsidian 笔记归档路径（选填，留空时保存至仓库根目录） |
| `自动展开折叠回答` | `true` | 采集时自动点击「展开全部」 |
| `包含问题描述` | `true` | 是否在导出内容头部加入问题描述正文 |
| `提取话题标签` | `true` | 提取知乎话题为 kebab-case 标签并写入 frontmatter |
| `包含回答元数据` | `true` | 保留回答发布时间、获赞数、评论数、原文直链 |
| `包含回答评论` | `true` | 保留回答下的评论（仅单回答模式下抓取当前页评论，包含子评论与点赞） |
| `生成 YAML Frontmatter` | `true` | 生成兼容 Dataview / Obsidian 标准元数据块 |

---

## 📋 导出 YAML Frontmatter 示例

```yaml
---
title: "如何评价 Linux 内核架构？"
tags:
  - zhihu
  - software-architecture
  - operating-systems
  - linux-kernel
status: ready
source: "https://www.zhihu.com/question/2057489186660390852"
type: zhihu-question
created: "2026-09-19 14:30"
answer_count: 42
follower_count: 120
view_count: 53000
clipped_answers: 42
related: []
---
```

---

## 🛠️ 本地开发与测试

项目代码模块化设计，无重度打包工具依赖，极速构建：

```bash
# 运行单元测试 (50 个测试用例)
npm test

# 重新生成多尺寸扩展图标
npm run build:icons

# 构建所有产物 (dist/chrome, zhiji.user.js)
npm run build

# 打包发布安装包 (dist/zhiji-chrome-v1.0.0.zip)
npm run pack
```

---

## 📄 开源许可

[MIT License](LICENSE) © 2026 ZhiJi
