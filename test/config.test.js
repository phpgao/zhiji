/**
 * 知集 (ZhiJi) — ConfigManager 单元测试
 * 运行: node test/config.test.js
 */

const assert = require('assert');

// Mock localStorage for node test
const storageMock = {};
global.localStorage = {
  getItem: k => storageMock[k] || null,
  setItem: (k, v) => { storageMock[k] = String(v); },
  removeItem: k => { delete storageMock[k]; },
};

const { ConfigManager } = require('../src/config.js');
global.ConfigManager = ConfigManager;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

console.log('\n═══ 知集 ConfigManager 测试 ═══\n');

test('默认配置加载', () => {
  const cfg = ConfigManager.get();
  assert.strictEqual(cfg.vault, '');
  assert.strictEqual(cfg.folder, '');
  assert.strictEqual(cfg.autoExpand, true);
  assert.strictEqual(cfg.includeDetail, true);
  assert.strictEqual(cfg.includeTags, true);
  assert.strictEqual(cfg.includeComments, true);
  assert.strictEqual(cfg.maxComments, 100);
  assert.strictEqual(cfg.includeFrontmatter, true);
});

test('动态修改配置并持久化', () => {
  ConfigManager.set({ vault: 'my-vault', folder: 'clips/zhihu' });
  const cfg = ConfigManager.get();
  assert.strictEqual(cfg.vault, 'my-vault');
  assert.strictEqual(cfg.folder, 'clips/zhihu');

  // Verify storageMock
  const saved = JSON.parse(storageMock['zhiji_config']);
  assert.strictEqual(saved.vault, 'my-vault');
  assert.strictEqual(saved.folder, 'clips/zhihu');
});

test('配置变更事件订阅通知', () => {
  let notified = false;
  let receivedVault = '';
  const unsub = ConfigManager.onChange(newCfg => {
    notified = true;
    receivedVault = newCfg.vault;
  });

  ConfigManager.set({ vault: 'work-vault' });
  assert.strictEqual(notified, true);
  assert.strictEqual(receivedVault, 'work-vault');

  unsub();
  notified = false;
  ConfigManager.set({ vault: 'home-vault' });
  assert.strictEqual(notified, false);
});

test('重置回默认配置', () => {
  ConfigManager.reset();
  const cfg = ConfigManager.get();
  assert.strictEqual(cfg.vault, '');
  assert.strictEqual(cfg.folder, '');
});

const { Exporter } = require('../src/exporter.js');

test('Obsidian 配置为空时阻止导出并返回 false', () => {
  ConfigManager.set({ vault: '' });
  let alerted = false;
  global.alert = () => { alerted = true; };
  const res = Exporter.toObsidian('# Test', 'Title');
  assert.strictEqual(res, false);
});

test('Obsidian 配置非空时允许导出', () => {
  ConfigManager.set({ vault: 'my-notes' });
  global.window = { location: { href: '' } };
  const res = Exporter.toObsidian('# Test', 'Title');
  assert.strictEqual(res, true);
  assert.ok(global.window.location.href.startsWith('obsidian://new?vault=my-notes'));
});

// Results
console.log(`\n═══ 结果: ${passed} 通过, ${failed} 失败 ═══\n`);
process.exit(failed > 0 ? 1 : 0);
