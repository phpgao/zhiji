/**
 * 知集 (ZhiJi) — PageParser 单元测试
 * 运行: node test/parser.test.js
 */

const { JSDOM } = require('jsdom');
const assert = require('assert');
const { MarkdownEngine } = require('../src/markdown.js');
global.MarkdownEngine = MarkdownEngine;
const { PageParser } = require('../src/parser.js');

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

console.log('\n═══ 知集 PageParser 测试 ═══\n');

// 1. Mode detection
console.log('1. 页面模式检测');

test('多回答模式: /question/123', () => {
  const result = PageParser.detectMode('/question/7840631633');
  assert.strictEqual(result.mode, 'multi');
  assert.strictEqual(result.questionId, '7840631633');
  assert.strictEqual(result.answerId, undefined);
});

test('单回答模式: /question/123/answer/456', () => {
  const result = PageParser.detectMode('/question/7840631633/answer/2084594015824093782');
  assert.strictEqual(result.mode, 'single');
  assert.strictEqual(result.questionId, '7840631633');
  assert.strictEqual(result.answerId, '2084594015824093782');
});

test('专栏文章模式: /p/123456', () => {
  const result = PageParser.detectMode('/p/718293849');
  assert.strictEqual(result.mode, 'article');
  assert.strictEqual(result.articleId, '718293849');
});

test('无效路径降级为 multi', () => {
  const result = PageParser.detectMode('/topic/12345');
  assert.strictEqual(result.mode, 'multi');
  assert.strictEqual(result.questionId, '0');
});

// 2. Answer count strategies
console.log('\n2. 总回答数获取策略');

test('策略1: meta[itemprop=answerCount]', () => {
  const dom = new JSDOM('<html><head><meta itemprop="answerCount" content="42" /></head></html>');
  assert.strictEqual(PageParser.getTotalAnswerCount(dom.window.document), 42);
});

test('策略2: #js-initialData JSON', () => {
  const state = { initialState: { entities: { questions: { '7840631633': { answerCount: 156 } } } } };
  const dom = new JSDOM(`<html><body><script id="js-initialData" type="text/json">${JSON.stringify(state)}</script></body></html>`);
  assert.strictEqual(PageParser.getTotalAnswerCount(dom.window.document), 156);
});

test('策略3: .List-headerText 文本', () => {
  const dom = new JSDOM('<html><body><div class="List-headerText">4,231 个回答</div></body></html>');
  assert.strictEqual(PageParser.getTotalAnswerCount(dom.window.document), 4231);
});

test('策略4: div 文本扫描', () => {
  const dom = new JSDOM('<html><body><div class="QuestionMainAction">查看全部 88 个回答</div></body></html>');
  assert.strictEqual(PageParser.getTotalAnswerCount(dom.window.document), 88);
});

test('无回答数信息返回 null', () => {
  const dom = new JSDOM('<html><body><div>没有任何回答信息</div></body></html>');
  assert.strictEqual(PageParser.getTotalAnswerCount(dom.window.document), null);
});

// 3. Question Info extraction
console.log('\n3. 问题信息提取');

test('标题 + 标签 + 详情提取', () => {
  const dom = new JSDOM(`
    <html><body>
      <h1 class="QuestionHeader-title">如何评价全新架构？</h1>
      <div class="QuestionHeader-tags">
        <span class="Tag">软件架构</span>
        <span class="Tag">开源</span>
      </div>
      <div class="NumberBoard-item">
        <div class="NumberBoard-itemInner">
          <div class="NumberBoard-itemName">关注者</div>
          <strong class="NumberBoard-itemValue" title="1234">1,234</strong>
        </div>
      </div>
    </body></html>
  `);
  const q = PageParser.extractQuestion(dom.window.document);
  assert.strictEqual(q.title, '如何评价全新架构？');
  assert.deepStrictEqual(q.tags, ['软件架构', '开源']);
  assert.strictEqual(q.followerCount, 1234);
});

// 4. Answer parsing
console.log('\n4. 回答项解析');

test('回答项扫描与元数据提取', () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="98765">
        <div class="AuthorInfo-name"><a class="UserLink-link" href="//www.zhihu.com/people/test">工程师小张</a></div>
        <div class="AuthorInfo-badgeText">架构师</div>
        <button class="VoteButton--up">赞同 256</button>
        <div class="ContentItem-time"><span class="ContentItem-time">发布于 2026-09-01</span></div>
        <div class="RichContent-inner">
          <div class="RichText ztext"><p>这是一个详细的回答内容。</p></div>
        </div>
      </div>
    </body></html>
  `);
  const known = new Set();
  const answers = PageParser.scanAnswers(known, undefined, dom.window.document);
  assert.strictEqual(answers.length, 1);
  assert.strictEqual(answers[0].author, '工程师小张');
  assert.strictEqual(answers[0].authorBio, '架构师');
  assert.strictEqual(answers[0].upvoteCount, '256');
  assert.strictEqual(answers[0].publishedAt, '2026-09-01');
  assert.ok(known.has('98765'));
});

test('回答项扫描支持数量上限 (limit 截断)', () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="1"><div class="AuthorInfo-name">作者1</div><div class="RichContent-inner"><div class="RichText">内容1</div></div></div>
      <div class="AnswerItem" name="2"><div class="AuthorInfo-name">作者2</div><div class="RichContent-inner"><div class="RichText">内容2</div></div></div>
      <div class="AnswerItem" name="3"><div class="AuthorInfo-name">作者3</div><div class="RichContent-inner"><div class="RichText">内容3</div></div></div>
    </body></html>
  `);
  const known = new Set();
  const answers = PageParser.scanAnswers(known, undefined, dom.window.document, 2);
  assert.strictEqual(answers.length, 2);
  assert.strictEqual(answers[0].answerId, '1');
  assert.strictEqual(answers[1].answerId, '2');
  assert.ok(known.has('1'));
  assert.ok(known.has('2'));
  assert.ok(!known.has('3'));
});

test('现代知乎回答交互区解析: 获赞数、评论数、收藏数、喜欢数', () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="777888">
        <div class="AuthorInfo-name"><a class="UserLink-link" href="//www.zhihu.com/people/expert">知乎专家</a></div>
        <div class="RichContent-inner">
          <div class="RichText ztext"><p>核心回答正文</p></div>
        </div>
        <div class="ContentItem-actions">
          <span>
            <span>
              <button aria-label="赞同 58 " aria-live="polite" type="button" class="Button VoteButton FEfUrdfMIKpQDJDqkjte">
                <span style="display: inline-flex; align-items: center;">&ZeroWidthSpace;<svg width="10" height="10" viewBox="0 0 24 24" class="Zi Zi--TriangleUp VoteButton-TriangleUp" fill="currentColor"></svg></span>赞同 58
              </button>
            </span>
            <button aria-label="反对" aria-live="polite" type="button" class="Button VoteButton VoteButton--down FEfUrdfMIKpQDJDqkjte"></button>
          </span>
          <button type="button" class="Button ContentItem-action FEfUrdfMIKpQDJDqkjte Button--plain Button--withIcon Button--withLabel fEPKGkUK5jyc4fUuT0QP B46v1Ak6Gj5sL2JTS4PY RuuQ6TOh2cRzJr6WlyQp">
            <span style="display: inline-flex; align-items: center;">&ZeroWidthSpace;<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" class="ZDI ZDI--ChatBubbleFill24 Button-zi t2ntD6J1DemdOdvh5FB4" fill="currentColor"></svg></span>10 条评论
          </button>
          <button aria-label="收藏" type="button" class="Button ContentItem-action css-0 FEfUrdfMIKpQDJDqkjte Button--plain Button--withIcon Button--withLabel fEPKGkUK5jyc4fUuT0QP B46v1Ak6Gj5sL2JTS4PY RuuQ6TOh2cRzJr6WlyQp">
            <span style="display: inline-flex; align-items: center;">&ZeroWidthSpace;<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" class="Zi Zi--Star Button-zi t2ntD6J1DemdOdvh5FB4" fill="currentColor"></svg></span>3 
          </button>
          <button aria-live="polite" aria-label="喜欢" type="button" class="Button ContentItem-action css-0 FEfUrdfMIKpQDJDqkjte Button--plain Button--withIcon Button--withLabel fEPKGkUK5jyc4fUuT0QP B46v1Ak6Gj5sL2JTS4PY RuuQ6TOh2cRzJr6WlyQp">
            <span style="display: inline-flex; align-items: center;">&ZeroWidthSpace;<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" class="Zi Zi--Heart Button-zi t2ntD6J1DemdOdvh5FB4" fill="currentColor"></svg></span>1 
          </button>
        </div>
      </div>
    </body></html>
  `);
  const known = new Set();
  const answers = PageParser.scanAnswers(known, undefined, dom.window.document);
  assert.strictEqual(answers.length, 1);
  assert.strictEqual(answers[0].upvoteCount, '58');
  assert.strictEqual(answers[0].commentCount, '10');
  assert.strictEqual(answers[0].favCount, '3');
  assert.strictEqual(answers[0].likeCount, '1');
});

// 5. Comment parsing
console.log('\n5. 评论解析能力 (仅当前页)');

test('解析当前页根评论与元数据', () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="111">
        <div class="Comments-container">
          <div class="CommentListV2">
            <div class="CommentItemV2">
              <div class="CommentItemV2-meta">
                <span class="UserLink"><a class="UserLink-link" href="//www.zhihu.com/people/coder">极客开发者</a></span>
                <span class="CommentItemV2-roleTag">作者</span>
              </div>
              <div class="CommentItemV2-content">
                <div class="RichText">这篇文章写得非常深刻，赞同！</div>
              </div>
              <div class="CommentItemV2-footer">
                <span class="CommentItemV2-time">2026-09-10</span>
                <button class="CommentItemV2-likeBtn">👍 42</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body></html>
  `);
  const item = dom.window.document.querySelector('.AnswerItem');
  const comments = PageParser.parseComments(item, dom.window.document);
  assert.strictEqual(comments.length, 1);
  assert.strictEqual(comments[0].author, '极客开发者');
  assert.strictEqual(comments[0].authorUrl, 'https://www.zhihu.com/people/coder');
  assert.strictEqual(comments[0].roleTag, '作者');
  assert.strictEqual(comments[0].content, '这篇文章写得非常深刻，赞同！');
  assert.strictEqual(comments[0].publishedAt, '2026-09-10');
  assert.strictEqual(comments[0].likes, '42');
  assert.strictEqual(comments[0].replies.length, 0);
});

test('解析嵌套子评论与回复关系', () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="222">
        <div class="Comments-container">
          <div class="CommentListV2">
            <div class="CommentItemV2">
              <div class="CommentItemV2-meta">
                <span class="UserLink"><a class="UserLink-link" href="/people/root-user">根评论用户</a></span>
              </div>
              <div class="CommentItemV2-content">
                <div class="RichText">想问下源码仓库在哪里？</div>
              </div>
              <div class="CommentItemV2-footer">
                <span class="CommentItemV2-time">1天前</span>
                <button class="CommentItemV2-likeBtn">赞 3</button>
              </div>
              <div class="CommentItemV2-subList">
                <div class="CommentItemV2">
                  <div class="CommentItemV2-meta">
                    <span class="UserLink"><a class="UserLink-link" href="/people/sub-user">回复者小李</a></span>
                    <span class="CommentItemV2-reply">回复 <a class="UserLink-link" href="/people/root-user">根评论用户</a>:</span>
                  </div>
                  <div class="CommentItemV2-content">
                    <div class="RichText">在 GitHub 搜 zhiji 就可以找到</div>
                  </div>
                  <div class="CommentItemV2-footer">
                    <span class="CommentItemV2-time">10小时前</span>
                    <button class="CommentItemV2-likeBtn">赞</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body></html>
  `);
  const item = dom.window.document.querySelector('.AnswerItem');
  const comments = PageParser.parseComments(item, dom.window.document);
  assert.strictEqual(comments.length, 1);
  assert.strictEqual(comments[0].author, '根评论用户');
  assert.strictEqual(comments[0].replies.length, 1);
  const reply = comments[0].replies[0];
  assert.strictEqual(reply.author, '回复者小李');
  assert.strictEqual(reply.replyTo, '根评论用户');
  assert.strictEqual(reply.content, '在 GitHub 搜 zhiji 就可以找到');
  assert.strictEqual(reply.publishedAt, '10小时前');
});

test('自动点击展开评论', () => {
  let clicked = false;
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="333">
        <div class="ContentItem-actions">
          <button class="Button ContentItem-action" aria-label="15 条评论">15 条评论</button>
        </div>
      </div>
    </body></html>
  `);
  const btn = dom.window.document.querySelector('button');
  btn.click = () => { clicked = true; };
  const item = dom.window.document.querySelector('.AnswerItem');
  PageParser.openComments(item);
  assert.strictEqual(clicked, true);
});

test('多回答列表页不触发评论采集', () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="444">
        <div class="AuthorInfo-name"><a class="UserLink-link">测试作者</a></div>
        <div class="RichContent-inner"><div class="RichText">内容</div></div>
        <div class="Comments-container">
          <div class="CommentListV2">
            <div class="CommentItemV2">
              <div class="CommentItemV2-content"><div class="RichText">列表页评论</div></div>
            </div>
          </div>
        </div>
      </div>
    </body></html>
  `, { url: 'https://www.zhihu.com/question/123456' });
  const known = new Set();
  const answers = PageParser.scanAnswers(known, undefined, dom.window.document);
  assert.strictEqual(answers.length, 1);
  // 多回答列表模式下不抓取评论
  assert.strictEqual(answers[0].comments.length, 0);
});

test('单回答模式下正常抓取评论', () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="555">
        <div class="AuthorInfo-name"><a class="UserLink-link">测试作者</a></div>
        <div class="RichContent-inner"><div class="RichText">内容</div></div>
        <div class="Comments-container">
          <div class="CommentListV2">
            <div class="CommentItemV2">
              <div class="CommentItemV2-meta"><span class="UserLink"><a class="UserLink-link">评论者A</a></span></div>
              <div class="CommentItemV2-content"><div class="RichText">单回答评论内容</div></div>
            </div>
          </div>
        </div>
      </div>
    </body></html>
  `, { url: 'https://www.zhihu.com/question/123456/answer/555' });
  const known = new Set();
  const answers = PageParser.scanAnswers(known, '555', dom.window.document);
  assert.strictEqual(answers.length, 1);
  // 单回答模式下成功抓取评论
  assert.strictEqual(answers[0].comments.length, 1);
  assert.strictEqual(answers[0].comments[0].author, '评论者A');
});

test('现代知乎 DOM 结构解析 ([data-id] + 零宽字符按钮 + 作者徽章 + 心形赞)', () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="666">
        <div class="AuthorInfo-name"><a class="UserLink-link" href="//www.zhihu.com/people/author">回答原作者</a></div>
        <div class="RichContent-inner"><div class="RichText">回答正文</div></div>
        <div class="ContentItem-actions">
          <button type="button" class="Button ContentItem-action" aria-label="">​2 条评论</button>
        </div>
        <div class="Comments-container css-plbgu">
          <div data-id="1001" class="root-comment">
            <a href="https://www.zhihu.com/people/user1"><img class="Avatar" src="avatar.jpg" alt="用户一"></a>
            <div class="comment-body">
              <a href="https://www.zhihu.com/people/user1">用户一</a>
              <span class="css-8v0dsd">作者</span>
              <div class="CommentContent">这是带有<img class="sticker" alt="[思考]">表情的根评论</div>
              <span class="css-12cl38p">20 小时前</span>
              <button><svg class="ZDI--HeartFill24"></svg>31</button>
            </div>
            <div class="reply-container">
              <div data-id="1002" class="reply-comment">
                <a href="https://www.zhihu.com/people/user2"><img class="Avatar" src="avatar2.jpg" alt="用户二"></a>
                <div class="comment-body">
                  <a href="https://www.zhihu.com/people/user2">用户二</a>
                  <div class="CommentContent">这是一条子回复</div>
                  <span class="css-12cl38p">昨天 19:46</span>
                  <button><svg class="ZDI--HeartFill24"></svg>5</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body></html>
  `, { url: 'https://www.zhihu.com/question/123456/answer/666' });
  const known = new Set();
  const answers = PageParser.scanAnswers(known, '666', dom.window.document);
  assert.strictEqual(answers.length, 1);
  assert.strictEqual(answers[0].commentCount, '2');
  assert.strictEqual(answers[0].comments.length, 1);
  const root = answers[0].comments[0];
  assert.strictEqual(root.author, '用户一');
  assert.strictEqual(root.authorUrl, 'https://www.zhihu.com/people/user1');
  assert.strictEqual(root.roleTag, '作者');
  assert.strictEqual(root.content, '这是带有[思考]表情的根评论');
  assert.strictEqual(root.publishedAt, '20 小时前');
  assert.strictEqual(root.likes, '31');
  assert.strictEqual(root.replies.length, 1);
  const reply = root.replies[0];
  assert.strictEqual(reply.author, '用户二');
  assert.strictEqual(reply.content, '这是一条子回复');
  assert.strictEqual(reply.publishedAt, '昨天 19:46');
  assert.strictEqual(reply.likes, '5');
});

test('现代知乎 "添加评论" (0评论) 按钮识别', () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="777">
        <div class="AuthorInfo-name"><a class="UserLink-link">测试作者</a></div>
        <div class="RichContent-inner"><div class="RichText">回答正文</div></div>
        <div class="ContentItem-actions">
          <button type="button" class="Button ContentItem-action" aria-label="">​添加评论</button>
        </div>
      </div>
    </body></html>
  `, { url: 'https://www.zhihu.com/question/123456/answer/777' });
  const known = new Set();
  const answers = PageParser.scanAnswers(known, '777', dom.window.document);
  assert.strictEqual(answers.length, 1);
  assert.strictEqual(answers[0].commentCount, '0');
  assert.strictEqual(answers[0].noComments, true);
  assert.strictEqual(answers[0].comments.length, 0);
});

const fs = require('fs');
const liveDomPath = '/Users/jimmygao/.gemini/antigravity-cli/brain/e7dfcb51-7733-4cd0-ad9b-eb03341fa89a/scratch/comment_dom.html';
if (fs.existsSync(liveDomPath)) {
  test('真实知乎页面快照解析 (Playwright 抓取的 17 条真实 DOM 数据)', () => {
    const html = fs.readFileSync(liveDomPath, 'utf8');
    const dom = new JSDOM(`<html><body>${html}</body></html>`);
    const container = dom.window.document.querySelector('.Comments-container');
    const comments = PageParser.parseComments(container, dom.window.document);
    assert.strictEqual(comments.length, 10, '应提取 10 条根评论');
    const totalReplies = comments.reduce((acc, c) => acc + (c.replies ? c.replies.length : 0), 0);
    assert.strictEqual(totalReplies, 7, '应提取 7 条嵌套子评论');
    assert.strictEqual(comments[0].author, '灵剑');
    assert.strictEqual(comments[0].likes, '31');
    assert.strictEqual(comments[0].publishedAt, '20 小时前');
    assert.ok(comments[0].content.includes('弟子不必不如师了'));
  });
}

test('评论总数统计 (countAllComments)', () => {
  const comments = [
    { author: 'A', replies: [{ author: 'A1' }, { author: 'A2' }] },
    { author: 'B', replies: [] },
    { author: 'C', replies: [{ author: 'C1' }] },
  ];
  assert.strictEqual(PageParser.countAllComments(comments), 6);
});

test('限制评论最多抽取数量 (limitComments)', () => {
  const comments = [
    { author: 'A', replies: [{ author: 'A1' }, { author: 'A2' }] },
    { author: 'B', replies: [{ author: 'B1' }] },
    { author: 'C', replies: [] },
  ];
  const limited3 = PageParser.limitComments(comments, 3);
  assert.strictEqual(PageParser.countAllComments(limited3), 3);
  assert.strictEqual(limited3.length, 1);
  assert.strictEqual(limited3[0].replies.length, 2);

  const limited4 = PageParser.limitComments(comments, 4);
  assert.strictEqual(PageParser.countAllComments(limited4), 4);
  assert.strictEqual(limited4.length, 2);
  assert.strictEqual(limited4[0].replies.length, 2);
  assert.strictEqual(limited4[1].replies.length, 0);
});

test('确保默认排序切换 (ensureDefaultSort)', () => {
  const dom = new JSDOM(`
    <div class="Comments-container">
      <div class="css-u3vsx3">
        <div class="css-m0zh86">默认</div>
        <div class="css-1fjr6cy">最新</div>
      </div>
    </div>
  `);
  let clicked = false;
  const defTab = dom.window.document.querySelector('.css-m0zh86');
  defTab.click = () => { clicked = true; };
  PageParser.ensureDefaultSort(dom.window.document.querySelector('.Comments-container'));
  assert.strictEqual(clicked, true);
});

test('自动滚动并抓取评论 (scrollAndCollectComments)', async () => {
  const dom = new JSDOM(`
    <html><body>
      <div class="AnswerItem" name="888">
        <div class="ContentItem-actions">
          <button type="button" class="Button">10 条评论</button>
        </div>
        <div class="Comments-container" style="overflow-y: auto; height: 300px;">
          <div data-id="c1"><div class="CommentContent">评论1</div></div>
          <div data-id="c2"><div class="CommentContent">评论2</div></div>
        </div>
      </div>
    </body></html>
  `);
  const item = dom.window.document.querySelector('.AnswerItem');
  const comments = await PageParser.scrollAndCollectComments(item, 100, null, null, dom.window.document);
  assert.strictEqual(comments.length, 2);
  assert.strictEqual(comments[0].content, '评论1');
});

test('知乎评论浮窗 Modal 弹窗解析与交互 (真实 DOM 结构)', () => {
  const modalHtml = `
    <html><body>
      <div class="AnswerItem" name="999">
        <div class="AuthorInfo-name"><a class="UserLink-link">答主</a></div>
        <div class="RichContent-inner"><div class="RichText">正文内容</div></div>
      </div>
      <div class="css-zbtg51">
        <div class="css-1aq8hf9">
          <div class="css-23cudx">
            <div class="Modal-content css-1svde17">
              <div class="css-tpyajk">
                <div class="css-14eeh9e">
                  <div class="css-3zfbs6"><div class="css-1k10w8f">29 条评论</div></div>
                  <div class="css-1onytrz"><div class="css-12blkb4">默认</div><div class="css-1cmz1sb">最新</div></div>
                </div>
                <div class="css-34podr">
                  <div class="css-18ld3w0">
                    <div data-id="11579645136">
                      <div class="css-jp43l4">
                        <div class="css-1gomreu"><a href="https://www.zhihu.com/people/user-lingjian"><img class="Avatar css-tbn8el" alt="灵剑"></a></div>
                        <div class="css-14nvvry">
                          <div class="css-swj9d4"><a href="https://www.zhihu.com/people/user-lingjian">灵剑</a></div>
                          <div class="CommentContent css-1xf92x8"><p>弟子不必不如师了<img src="sticker.png" class="sticker" alt="[思考]"></p></div>
                          <div class="css-140jo2">
                            <span class="css-12cl38p">21 小时前</span>
                            <button><svg class="ZDI--HeartFill24"></svg>33</button>
                          </div>
                        </div>
                      </div>
                      <button type="button" class="Button css-1vkwf3p">展开其他 3 条回复</button>
                    </div>
                    <div data-id="11579437557">
                      <div class="css-jp43l4">
                        <div class="css-1gomreu"><a href="https://www.zhihu.com/people/user-ahuang"><img class="Avatar css-tbn8el" alt="阿黄"></a></div>
                        <div class="css-14nvvry">
                          <div class="css-swj9d4"><a href="https://www.zhihu.com/people/user-ahuang">阿黄</a></div>
                          <div class="CommentContent css-1xf92x8">写的真好，读下来那叫一个舒服啊</div>
                          <div class="css-140jo2">
                            <span class="css-12cl38p">昨天 19:46</span>
                            <button><svg class="ZDI--HeartFill24"></svg>21</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body></html>
  `;
  const dom = new JSDOM(modalHtml);
  const doc = dom.window.document;
  const answerItem = doc.querySelector('.AnswerItem');

  // 1. 浮窗容器探测
  const container = PageParser.findCommentContainer(answerItem, doc);
  assert.ok(container, '应能探测到评论浮窗容器');
  assert.ok(container.classList.contains('Modal-content') || container.querySelector('.Modal-content'));

  // 2. 评论解析
  const comments = PageParser.parseComments(answerItem, doc);
  assert.strictEqual(comments.length, 2, '应解析出 2 条根评论');
  assert.strictEqual(comments[0].author, '灵剑');
  assert.strictEqual(comments[0].content, '弟子不必不如师了[思考]');
  assert.strictEqual(comments[0].likes, '33');
  assert.strictEqual(comments[0].publishedAt, '21 小时前');
  assert.strictEqual(comments[1].author, '阿黄');
  assert.strictEqual(comments[1].content, '写的真好，读下来那叫一个舒服啊');
  assert.strictEqual(comments[1].likes, '21');

  // 3. 默认排序按钮点击
  let sortClicked = false;
  const defTab = container.querySelector('.css-12blkb4');
  defTab.click = () => { sortClicked = true; };
  PageParser.ensureDefaultSort(container);
  assert.strictEqual(sortClicked, true, '应自动触发点击"默认"排序');

  // 4. 展开回复按钮点击
  let expandClicked = false;
  const expandBtn = container.querySelector('.css-1vkwf3p');
  expandBtn.click = () => { expandClicked = true; };
  PageParser.expandSubComments(container);
  assert.strictEqual(expandClicked, true, '应自动触发点击"展开其他 3 条回复"');
});

// 6. Article parsing
console.log('\n6. 专栏文章解析能力');

test('专栏文章解析: 标题/作者/标签/正文/点赞/评论数', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>深入理解现代前端工程化 - 知乎</title></head>
      <body>
        <h1 class="Post-Title">深入理解现代前端工程化</h1>
        <div class="Post-Author">
          <a class="UserLink-link" href="/people/jimmy-dev">Jimmy</a>
        </div>
        <div class="AuthorInfo-badgeText">全栈工程师 / 开源爱好者</div>
        <div class="Post-topics">
          <span class="Topic">前端工程</span>
          <span class="Topic">JavaScript</span>
        </div>
        <div class="ContentItem-time">发布于 2026-09-18 10:00</div>
        <button class="VoteButton--up">赞同 520</button>
        <div class="BottomNavBar">
          <button aria-label="42 条评论">42 条评论</button>
        </div>
        <div class="Post-RichTextContainer">
          <div class="RichText ztext">
            <p>前端工程化不仅是构建工具的组合，更是一套完备的研发流程。</p>
          </div>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://zhuanlan.zhihu.com/p/718293849' });
  const art = PageParser.parseArticle(dom.window.document);
  assert.strictEqual(art.type, 'article');
  assert.strictEqual(art.title, '深入理解现代前端工程化');
  assert.strictEqual(art.author, 'Jimmy');
  assert.strictEqual(art.authorUrl, 'https://www.zhihu.com/people/jimmy-dev');
  assert.strictEqual(art.authorBio, '全栈工程师 / 开源爱好者');
  assert.deepStrictEqual(art.tags, ['前端工程', 'JavaScript']);
  assert.strictEqual(art.publishedAt, '2026-09-18 10:00');
  assert.strictEqual(art.upvoteCount, '520');
  assert.strictEqual(art.commentCount, '42');
  assert.ok(art.content.includes('前端工程化不仅是构建工具的组合'));
});

test('真实专栏文章快照解析: 严格隔离外层 Post-content / 侧边栏 / 推荐阅读 / 热搜', () => {
  const html = `
    <html>
      <body>
        <div class="Post-content">
          <header class="AppHeader">导航与热搜：华为突破架构</header>
          <div class="zh-clean-zhuanlan-content">
            <article class="Post-Main Post-NormalMain">
              <header class="Post-Header">
                <h1 class="Post-Title">海外跨境电商卖货效率与前景</h1>
                <div class="Post-Author">
                  <span class="UserLink AuthorInfo-name"><a href="//www.zhihu.com/people/author-1" class="UserLink-link">跨境老手</a></span>
                  <div class="AuthorInfo-badge"><div class="ztext AuthorInfo-badgeText">电商从业者</div></div>
                </div>
                <div class="ContentItem-time">编辑于 2026-09-11 14:22・广东</div>
                <button class="Button VoteButton" aria-label="赞同 2.3 万">赞同 2.3 万</button>
              </header>
              <div class="Post-RichTextContainer">
                <div class="RichText ztext Post-RichText">
                  <p>现在这一行的市场前景相当不错，国内供应链成熟。</p>
                  <figure><img src="https://pic4.zhimg.com/test.jpg"><figcaption>数据图</figcaption></figure>
                </div>
              </div>
              <div class="Post-topicsAndReviewer">
                <div class="TopicList Post-Topics">
                  <div class="Tag Topic"><span class="Tag-content"><a class="TopicLink">副业</a></span></div>
                  <div class="Tag Topic"><span class="Tag-content"><a class="TopicLink">跨境</a></span></div>
                </div>
              </div>
              <div class="ContentItem-actions">
                <button class="BottomActions-CommentBtn">204 条评论</button>
              </div>
            </article>
            <div class="Comments-container">
              <div data-id="101">
                <div class="AuthorInfo-name"><a href="/people/user-a">买家A</a></div>
                <div class="CommentContent">有赚钱方法藏都来不及藏</div>
                <div data-id="102">
                  <div class="css-swj9d4">
                    <div class="css-1tww9qq"><a href="/people/author-1">跨境老手</a><span class="css-8v0dsd">作者</span></div>
                    <svg class="ZDI--ArrowRightAlt16"></svg>
                    <div class="css-1tww9qq"><a href="/people/user-a">买家A</a></div>
                  </div>
                  <div class="CommentContent">有福同享啦</div>
                </div>
              </div>
            </div>
          </div>
          <div class="Recommendations-Main">
            <h1 class="PostItem-Title">推荐无关文章：月赚十万亚马逊</h1>
          </div>
          <div class="HotSearchCard">
            <div class="HotSearchCard-title">大家都在搜：华为芯片</div>
          </div>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://zhuanlan.zhihu.com/p/639580298' });
  const doc = dom.window.document;
  const art = PageParser.parseArticle(doc);

  assert.strictEqual(art.title, '海外跨境电商卖货效率与前景');
  assert.strictEqual(art.author, '跨境老手');
  assert.strictEqual(art.authorBio, '电商从业者');
  assert.deepStrictEqual(art.tags, ['副业', '跨境']);
  assert.strictEqual(art.publishedAt, '2026-09-11 14:22・广东');
  assert.strictEqual(art.upvoteCount, '2.3 万');
  assert.strictEqual(art.commentCount, '204');
  assert.ok(art.content.includes('现在这一行的市场前景相当不错'));
  assert.ok(!art.content.includes('推荐无关文章'), '不应包含推荐阅读内容');
  assert.ok(!art.content.includes('大家都在搜'), '不应包含热搜内容');
  assert.ok(!art.content.includes('导航与热搜'), '不应包含顶部导航内容');

  const comments = PageParser.parseComments(doc.querySelector('article.Post-Main'), doc);
  assert.strictEqual(comments.length, 1);
  assert.strictEqual(comments[0].author, '买家A');
  assert.strictEqual(comments[0].roleTag, '', '买家A 不应被赋予 (作者) 角色标签');
  assert.strictEqual(comments[0].replies.length, 1);
  assert.strictEqual(comments[0].replies[0].author, '跨境老手');
  assert.strictEqual(comments[0].replies[0].roleTag, '作者');
  assert.strictEqual(comments[0].replies[0].replyTo, '买家A');
});


// Results
console.log(`\n═══ 结果: ${passed} 通过, ${failed} 失败 ═══\n`);
process.exit(failed > 0 ? 1 : 0);
