/**
 * 知集 (ZhiJi) — 跨端极速构建脚本
 * 同时生成 Chrome MV3 扩展、Tampermonkey 油猴脚本
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const EXT = path.join(ROOT, 'extension');
const DIST = path.join(ROOT, 'dist');
const CHROME_DIST = path.join(DIST, 'chrome');

// Core module files in order of dependency
const MODULES = [
  'config.js',
  'markdown.js',
  'parser.js',
  'scroll.js',
  'zip.js',
  'exporter.js',
  'ui.js',
  'app.js',
];

function cleanAndEnsureDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function assembleCore() {
  const contents = [];
  contents.push(';(function () {');
  contents.push("  'use strict';\n");

  for (const file of MODULES) {
    const p = path.join(SRC, file);
    let code = fs.readFileSync(p, 'utf8');
    // Strip CommonJS export cleanly
    code = code.replace(/\n*if\s*\(typeof module[\s\S]*?\n\}\s*$/g, '');
    contents.push(`  /* ── ${file} ── */`);
    contents.push(code.trim());
    contents.push('');
  }

  contents.push('})();\n');
  return contents.join('\n');
}

console.log('🚀 开始构建知集 (ZhiJi) 多端产物...\n');

const coreBundle = assembleCore();

// 1. Chrome Extension
console.log('📦 构建 Chrome 扩展 (Manifest V3)...');
cleanAndEnsureDir(CHROME_DIST);
fs.writeFileSync(path.join(CHROME_DIST, 'content.js'), coreBundle, 'utf8');
fs.copyFileSync(path.join(EXT, 'manifest.chrome.json'), path.join(CHROME_DIST, 'manifest.json'));
fs.copyFileSync(path.join(EXT, 'background.js'), path.join(CHROME_DIST, 'background.js'));
copyDir(path.join(EXT, 'popup'), path.join(CHROME_DIST, 'popup'));
copyDir(path.join(EXT, 'icons'), path.join(CHROME_DIST, 'icons'));
console.log('  ✅ Chrome 扩展构建至 dist/chrome/');

// 2. Userscript (Tampermonkey)
console.log('📦 构建 Tampermonkey 油猴脚本...');
const header = fs.readFileSync(path.join(ROOT, 'userscript', 'header.js'), 'utf8').trim();
const userscript = `${header}\n\n${coreBundle}`;
fs.writeFileSync(path.join(DIST, 'zhiji.user.js'), userscript, 'utf8');
fs.writeFileSync(path.join(ROOT, 'zhiji.user.js'), userscript, 'utf8');
console.log('  ✅ 油猴脚本构建至 dist/zhiji.user.js 并同步到项目根目录 zhiji.user.js');

console.log('\n🎉 所有目标构建完成！\n');
