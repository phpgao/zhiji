/**
 * 知集 (ZhiJi) — 自动化扩展打包脚本
 * 生成 Chrome 扩展 Zip 以及开源 Review 源码包
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version || '1.0.0';

console.log(`📦 开始为知集 v${version} 打包发布产物...\n`);

if (!fs.existsSync(DIST)) {
  fs.mkdirSync(DIST, { recursive: true });
}

function runZip(sourceDir, zipName) {
  const zipPath = path.join(DIST, zipName);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  // Run zip from within sourceDir so entries are at the archive root
  execSync(`cd "${sourceDir}" && zip -r -q "${zipPath}" .`, { stdio: 'inherit' });
  const stat = fs.statSync(zipPath);
  const kb = (stat.size / 1024).toFixed(1);
  console.log(`  ✅ 已生成: dist/${zipName} (${kb} KB)`);
  return zipPath;
}

// 1. Package Chrome Extension
console.log('🌐 打包 Chrome 扩展 (用于 Chrome Web Store 或本地分发)...');
const chromeDir = path.join(DIST, 'chrome');
if (fs.existsSync(chromeDir)) {
  runZip(chromeDir, `zhiji-chrome-v${version}.zip`);
  runZip(chromeDir, 'zhiji-chrome.zip');
} else {
  console.error('  ❌ 未找到 dist/chrome 目录，请先运行 npm run build');
}

// 2. Package Source Code for Review (optional)
console.log('\n📄 打包发布源码包 (供 GitHub Release 备用)...');
const sourceZipPath = path.join(DIST, `zhiji-source-v${version}.zip`);
if (fs.existsSync(sourceZipPath)) {
  fs.unlinkSync(sourceZipPath);
}
try {
  execSync(
    `cd "${ROOT}" && zip -r -q "${sourceZipPath}" . -x "node_modules/*" ".git/*" "dist/*" "*.log" ".DS_Store"`,
    { stdio: 'inherit' }
  );
  const stat = fs.statSync(sourceZipPath);
  const kb = (stat.size / 1024).toFixed(1);
  console.log(`  ✅ 已生成: dist/zhiji-source-v${version}.zip (${kb} KB)`);
} catch (e) {
  console.warn('  ⚠️ 生成源码包跳过:', e.message);
}

console.log('\n🎉 所有发布包已就绪！可以直接用于发布。');
