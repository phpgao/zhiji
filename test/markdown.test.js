/**
 * 知集 (ZhiJi) — MarkdownEngine & Frontmatter 单元测试
 * 运行: node test/markdown.test.js
 */

const { JSDOM } = require('jsdom');
const assert = require('assert');
const { MarkdownEngine } = require('../src/markdown.js');
const { Exporter } = require('../src/exporter.js');

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

function parseHTML(html) {
  const dom = new JSDOM(`<!DOCTYPE html><div>${html}</div>`);
  return dom.window.document.querySelector('div');
}

console.log('\n═══ 知集 MarkdownEngine & Frontmatter 测试 ═══\n');

// 1. External link cleaning
console.log('1. 外链清洗');

test('知乎重定向链接解码', () => {
  const raw = 'https://link.zhihu.com/?target=https%3A%2F%2Fgithub.com%2Fobsidianmd';
  assert.strictEqual(MarkdownEngine.cleanUrl(raw), 'https://github.com/obsidianmd');
});

test('相对路径补全', () => {
  assert.strictEqual(MarkdownEngine.cleanUrl('/question/123'), 'https://www.zhihu.com/question/123');
});

test('普通链接保持不变', () => {
  assert.strictEqual(MarkdownEngine.cleanUrl('https://example.com'), 'https://example.com');
});

test('空值处理', () => {
  assert.strictEqual(MarkdownEngine.cleanUrl(''), '');
});

// 2. Images
console.log('\n2. 图片提取');

test('高清图 figure + figcaption', () => {
  const el = parseHTML(`
    <figure>
      <img src="data:image/svg+xml;base64,..." data-actualsrc="https://picx.zhimg.com/v2-abc_r.jpg" />
      <figcaption>架构示意图</figcaption>
    </figure>
  `);
  const { markdown, images } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '![架构示意图](https://picx.zhimg.com/v2-abc_r.jpg)');
  assert.deepStrictEqual(images, ['https://picx.zhimg.com/v2-abc_r.jpg']);
});

test('独立 img 标签', () => {
  const el = parseHTML('<img src="https://picx.zhimg.com/test.png" alt="测试图" />');
  const { markdown, images } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '![测试图](https://picx.zhimg.com/test.png)');
  assert.deepStrictEqual(images, ['https://picx.zhimg.com/test.png']);
});

// 3. Math formulas
console.log('\n3. 数学公式');

test('行内公式', () => {
  const el = parseHTML('<p>根据 <span class="ztext-math" data-formula="E = mc^2">E = mc^2</span> 计算</p>');
  const { markdown } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '根据 $E = mc^2$ 计算');
});

test('块级公式', () => {
  const el = parseHTML('<div><span class="ztext-math" data-formula="\\sum_{i=1}^n i = \\frac{n(n+1)}{2}">...</span></div>');
  const { markdown } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '$$\n\\sum_{i=1}^n i = \\frac{n(n+1)}{2}\n$$');
});

// 4. Code blocks
console.log('\n4. 代码块');

test('带语言标识的代码块', () => {
  const el = parseHTML('<pre><code class="language-python">def hello():\n    print("world")</code></pre>');
  const { markdown } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '```python\ndef hello():\n    print("world")\n```');
});

test('行内代码', () => {
  const el = parseHTML('<p>使用 <code>const</code> 声明常量</p>');
  const { markdown } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '使用 `const` 声明常量');
});

// 5. Typography
console.log('\n5. 排版格式');

test('标题层级', () => {
  const el = parseHTML('<h2>二级标题</h2>');
  const { markdown } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '## 二级标题');
});

test('粗体 + 斜体 + 删除线', () => {
  const el = parseHTML('<p><b>粗体</b> <i>斜体</i> <del>删除线</del></p>');
  const { markdown } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '**粗体** *斜体* ~~删除线~~');
});

test('引用块', () => {
  const el = parseHTML('<blockquote>这是第一行\n这是第二行</blockquote>');
  const { markdown } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '> 这是第一行\n> 这是第二行');
});

test('无序列表', () => {
  const el = parseHTML('<ul><li>项目 A</li><li>项目 B</li></ul>');
  const { markdown } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '- 项目 A\n- 项目 B');
});

test('有序列表', () => {
  const el = parseHTML('<ol><li>步骤一</li><li>步骤二</li></ol>');
  const { markdown } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '1. 步骤一\n2. 步骤二');
});

test('知乎链接卡片', () => {
  const el = parseHTML(`
    <div class="LinkCard">
      <a href="https://link.zhihu.com/?target=https%3A%2F%2Fgithub.com">
        <span class="LinkCard-title">GitHub 官网</span>
      </a>
    </div>
  `);
  const { markdown } = MarkdownEngine.convert(el);
  assert.ok(markdown.includes('[GitHub 官网](https://github.com)'));
});

test('GFM 表格', () => {
  const el = parseHTML(`
    <table>
      <thead><tr><th>参数</th><th>类型</th><th>说明</th></tr></thead>
      <tbody>
        <tr><td>name</td><td>string</td><td>用户名</td></tr>
        <tr><td>age</td><td>number</td><td>年龄</td></tr>
      </tbody>
    </table>
  `);
  const { markdown } = MarkdownEngine.convert(el);
  assert.ok(markdown.includes('| 参数'));
  assert.ok(markdown.includes('| name'));
  assert.ok(markdown.includes('---'));
});

// 6. YAML Frontmatter
console.log('\n6. YAML Frontmatter');

test('多回答 YAML Frontmatter 格式验证', () => {
  const q = {
    title: '如何评价 Linux 内核架构？',
    url: 'https://www.zhihu.com/question/2057489186660390852',
    tags: ['software architecture', 'Operating Systems', 'linux-kernel', 'windows nt'],
    answerCount: 42,
    followerCount: 120,
    viewCount: 53000
  };
  const fm = Exporter.buildFrontmatter(q, [{}, {}]);
  assert.ok(fm.includes('tags:\n  - zhihu\n  - software-architecture\n  - operating-systems\n  - linux-kernel\n  - windows-nt'));
  assert.ok(fm.includes('status: ready'));
  assert.ok(fm.includes('source: "https://www.zhihu.com/question/2057489186660390852"'));
  assert.ok(fm.includes('type: zhihu-question'));
  assert.ok(fm.includes('answer_count: 42'));
  assert.ok(fm.includes('related: []'));
});

test('单回答 YAML Frontmatter 包含 author 与单回答直链', () => {
  const q = {
    title: '什么是微内核？',
    url: 'https://www.zhihu.com/question/123',
    tags: ['操作系统'],
    answerCount: 5
  };
  const answers = [{
    author: 'Linus',
    answerUrl: 'https://www.zhihu.com/question/123/answer/456'
  }];
  global.PageParser = { detectMode: () => ({ mode: 'single' }) };
  const fm = Exporter.buildFrontmatter(q, answers);
  assert.ok(fm.includes('type: zhihu-answer'));
  assert.ok(fm.includes('author: "Linus"'));
  assert.ok(fm.includes('source: "https://www.zhihu.com/question/123/answer/456"'));
  assert.ok(fm.includes('clipped_answers: 1'));
  assert.ok(fm.includes('tags:\n  - zhihu\n  - 操作系统'));
});

// 7. Comments Markdown & Emojis
console.log('\n7. 评论 Markdown 导出与表情清洗');

test('评论表情转换为 alt 文本', () => {
  const el = parseHTML('<p>很有道理！<img class="comment_emoji" src="https://pic.zhihu.com/emoji.png" alt="[赞同]"></p>');
  const { markdown } = MarkdownEngine.convert(el);
  assert.strictEqual(markdown, '很有道理！[赞同]');
});

test('Exporter 评论 Markdown 生成', () => {
  const comments = [
    {
      author: '张三',
      authorUrl: 'https://www.zhihu.com/people/zhangsan',
      roleTag: '作者',
      publishedAt: '2026-09-10',
      likes: '18',
      content: '谢谢大家的认可！',
      replies: [
        {
          author: '李四',
          replyTo: '张三',
          publishedAt: '2026-09-11',
          likes: '2',
          content: '期待下一篇文章。',
        },
      ],
    },
  ];
  const md = Exporter.formatCommentsMarkdown(comments, 3);
  assert.ok(md.includes('### 💬 评论 (2 条)'));
  assert.ok(md.includes('- **[张三](https://www.zhihu.com/people/zhangsan)** (作者) · 🕒 2026-09-10 · 👍 18'));
  assert.ok(md.includes('  谢谢大家的认可！'));
  assert.ok(md.includes('  - **李四** 回复 **张三** · 🕒 2026-09-11 · 👍 2'));
  assert.ok(md.includes('    期待下一篇文章。'));
});

// Results
console.log(`\n═══ 结果: ${passed} 通过, ${failed} 失败 ═══\n`);
process.exit(failed > 0 ? 1 : 0);
