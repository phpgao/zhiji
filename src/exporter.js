/**
 * 知集 (ZhiJi) — Exporter 多模式内容导出器 (Obsidian / 剪贴板 / .md / ZIP+图片)
 */

const Exporter = (() => {
  function formatDate(d = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function safeName(s) {
    return s.replace(/[\\/:*?"<>|]/g, '_').trim();
  }

  function formatNumber(n) {
    if (n == null) return null;
    return n.toLocaleString('zh-CN');
  }

  function normalizeTag(tag) {
    return tag
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5-_]/g, '')
      .toLowerCase();
  }

  function buildFrontmatter(q, answers) {
    const isSingle = (answers.length === 1 && typeof PageParser !== 'undefined' && PageParser.detectMode().mode === 'single') || answers.length === 1;
    const singleAnswer = isSingle ? answers[0] : null;
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : { includeTags: true };

    const rawTags = (cfg.includeTags && q.tags?.length)
      ? q.tags.map(normalizeTag).filter(Boolean)
      : [];
    const tags = ['zhihu', ...new Set(rawTags.filter(t => t !== 'zhihu'))];

    const lines = ['---'];
    lines.push(`title: "${q.title.replace(/"/g, '\\"')}"`);
    lines.push('tags:');
    tags.forEach(t => lines.push(`  - ${t}`));
    lines.push('status: ready');
    lines.push(`source: "${isSingle && singleAnswer?.answerUrl ? singleAnswer.answerUrl : q.url}"`);
    lines.push(`type: ${isSingle ? 'zhihu-answer' : 'zhihu-question'}`);
    if (isSingle && singleAnswer?.author) {
      lines.push(`author: "${singleAnswer.author.replace(/"/g, '\\"')}"`);
    }
    lines.push(`created: "${formatDate()}"`);
    if (q.answerCount != null) lines.push(`answer_count: ${q.answerCount}`);
    if (q.followerCount != null) lines.push(`follower_count: ${q.followerCount}`);
    if (q.viewCount != null) lines.push(`view_count: ${q.viewCount}`);
    lines.push(`clipped_answers: ${answers.length}`);
    lines.push('related: []');
    lines.push('---');
    return lines.join('\n');
  }

  function buildMarkdown(question, answers) {
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : {
      includeFrontmatter: true,
      includeDetail: true,
      includeTags: true,
      includeAnswerMeta: true,
      includeComments: true,
    };
    let md = '';

    if (cfg.includeFrontmatter) {
      md += buildFrontmatter(question, answers) + '\n\n';
    }

    md += `# ${question.title}\n\n`;

    // Meta block
    const metaParts = [];
    metaParts.push(`**来源**: [知乎原文](${question.url})`);
    if (question.answerCount != null) metaParts.push(`**回答数**: ${formatNumber(question.answerCount)}`);
    if (question.followerCount != null) metaParts.push(`**关注者**: ${formatNumber(question.followerCount)}`);
    if (question.viewCount != null) metaParts.push(`**浏览量**: ${formatNumber(question.viewCount)}`);
    md += `> ${metaParts.join(' · ')}\n`;
    if (cfg.includeTags && question.tags?.length) {
      md += `> **话题**: ${question.tags.map(t => `#${t}`).join(' ')}\n`;
    }
    md += `> **剪藏时间**: ${formatDate()}\n\n`;

    // Question detail
    if (cfg.includeDetail && question.detail) {
      md += `## 问题描述\n\n${question.detail}\n\n---\n\n`;
    } else {
      md += '---\n\n';
    }

    // Answers
    const isSingle = (answers.length === 1 && typeof PageParser !== 'undefined' && PageParser.detectMode().mode === 'single') || answers.length === 1;
    if (isSingle) {
      const a = answers[0];
      const authorShow = a.authorUrl ? `[${a.author}](${a.authorUrl})` : a.author;
      md += `## ${authorShow} 的回答\n\n`;

      if (cfg.includeAnswerMeta) {
        const parts = [];
        if (a.publishedAt) parts.push(`🕒 ${a.publishedAt}`);
        if (a.upvoteCount) parts.push(`👍 ${a.upvoteCount}`);
        if (a.commentCount) parts.push(`💬 ${a.commentCount}条评论`);
        if (parts.length) md += `> ${parts.join(' · ')}\n`;
        if (a.authorBio) md += `> 📎 ${a.authorBio}\n`;
        if (a.answerUrl) md += `> 🔗 [原文直链](${a.answerUrl})\n`;
        md += '\n';
      }

      md += `${a.content}\n\n`;

      if (cfg.includeComments && a.comments?.length) {
        md += formatCommentsMarkdown(a.comments, 3);
      }

      md += '---\n\n';
    } else {
      md += `## 回答 (${answers.length})\n\n`;

      answers.forEach((a, i) => {
        const authorShow = a.authorUrl ? `[${a.author}](${a.authorUrl})` : a.author;
        md += `### 回答 ${i + 1} · ${authorShow}\n\n`;

        if (cfg.includeAnswerMeta) {
          const parts = [];
          if (a.publishedAt) parts.push(`🕒 ${a.publishedAt}`);
          if (a.upvoteCount) parts.push(`👍 ${a.upvoteCount}`);
          if (a.commentCount) parts.push(`💬 ${a.commentCount}条评论`);
          if (parts.length) md += `> ${parts.join(' · ')}\n`;
          if (a.authorBio) md += `> 📎 ${a.authorBio}\n`;
          if (a.answerUrl) md += `> 🔗 [原文直链](${a.answerUrl})\n`;
          md += '\n';
        }

        md += `${a.content}\n\n`;

        if (cfg.includeComments && a.comments?.length) {
          md += formatCommentsMarkdown(a.comments, 4);
        }

        md += '---\n\n';
      });
    }

    return md;
  }

  function formatCommentsMarkdown(comments, headingLevel = 3) {
    if (!comments || !comments.length) return '';
    const h = '#'.repeat(headingLevel);
    const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);
    let md = `${h} 💬 评论 (${totalCount} 条)\n\n`;

    comments.forEach(c => {
      const authorShow = c.authorUrl ? `[${c.author}](${c.authorUrl})` : c.author;
      const tagShow = c.roleTag ? ` (${c.roleTag})` : '';
      const meta = [];
      if (c.publishedAt) meta.push(`🕒 ${c.publishedAt}`);
      if (c.likes) meta.push(`👍 ${c.likes}`);
      const metaStr = meta.length ? ` · ${meta.join(' · ')}` : '';

      md += `- **${authorShow}**${tagShow}${metaStr}\n`;
      if (c.content) {
        const indented = c.content.split('\n').map(l => `  ${l}`).join('\n');
        md += `${indented}\n`;
      }

      if (c.replies?.length) {
        c.replies.forEach(r => {
          const rAuthor = r.authorUrl ? `[${r.author}](${r.authorUrl})` : r.author;
          const rTag = r.roleTag ? ` (${r.roleTag})` : '';
          const rMeta = [];
          if (r.publishedAt) rMeta.push(`🕒 ${r.publishedAt}`);
          if (r.likes) rMeta.push(`👍 ${r.likes}`);
          const rMetaStr = rMeta.length ? ` · ${rMeta.join(' · ')}` : '';
          const replyToText = r.replyTo ? ` 回复 **${r.replyTo}**` : '';

          md += `  - **${rAuthor}**${rTag}${replyToText}${rMetaStr}\n`;
          if (r.content) {
            const rIndented = r.content.split('\n').map(l => `    ${l}`).join('\n');
            md += `${rIndented}\n`;
          }
        });
      }
    });

    return md + '\n';
  }

  function toObsidian(md, title) {
    const cfg = typeof ConfigManager !== 'undefined' ? ConfigManager.get() : { vault: '', folder: '' };
    if (!cfg.vault?.trim()) {
      if (typeof UI !== 'undefined') {
        UI.toast('⚠️ 未配置 Obsidian 仓库名，请先设置 Vault');
        if (typeof UI.openSettings === 'function') UI.openSettings(true);
      } else if (typeof alert === 'function') {
        alert('⚠️ 未配置 Obsidian 仓库名，请先设置 Vault');
      }
      return false;
    }

    const folder = (cfg.folder || '').replace(/^\/+|\/+$/g, '');
    const file = folder ? `${folder}/${safeName(title)}` : safeName(title);
    const uri = `obsidian://new?vault=${encodeURIComponent(cfg.vault.trim())}&file=${encodeURIComponent(file)}&content=${encodeURIComponent(md)}&overwrite=true`;

    if (uri.length > 15000) {
      const ok = confirm(`⚠️ 内容较大（约 ${(uri.length / 1000).toFixed(1)}k 字符），通过 URL 协议可能被浏览器截断。\n\n【确定】尝试直接调起 Obsidian\n【取消】降级为下载 .md 文件`);
      if (!ok) {
        toFile(md, title);
        toClipboard(md);
        return;
      }
    }
    window.location.href = uri;
    return true;
  }

  function toClipboard(md) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(md)
        .then(() => { if (typeof UI !== 'undefined') UI.toast('📋 已复制到剪贴板'); })
        .catch(() => clipboardFallback(md));
    } else if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(md);
      if (typeof UI !== 'undefined') UI.toast('📋 已复制到剪贴板');
    } else {
      clipboardFallback(md);
    }
  }

  function clipboardFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    Object.assign(ta.style, { position: 'fixed', opacity: '0' });
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (typeof UI !== 'undefined') UI.toast('📋 已复制到剪贴板');
    } catch {
      alert('复制失败，请手动复制');
    }
    document.body.removeChild(ta);
  }

  function toFile(md, title) {
    const name = safeName(title) + '.md';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, name);
    if (typeof UI !== 'undefined') UI.toast(`📄 已下载: ${name}`);
  }

  async function toZipWithAssets(md, title, imageUrls) {
    if (typeof UI !== 'undefined') UI.toast('📦 正在打包 ZIP 并下载图片资源...');

    const uniqueUrls = [...new Set(imageUrls.filter(Boolean))];
    const zip = ZipBuilder.create();
    const urlMap = new Map();
    let index = 0;

    for (const url of uniqueUrls) {
      try {
        index++;
        const ext = url.split('?')[0].split('.').pop().toLowerCase() || 'jpg';
        const cleanExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) ? ext : 'jpg';
        const filename = `assets/img_${String(index).padStart(3, '0')}.${cleanExt}`;

        const resp = await fetch(url, { mode: 'cors' });
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          zip.add(filename, buf);
          urlMap.set(url, filename);
        }
      } catch {
        // Continue on failure
      }
    }

    // Rewrite markdown image URLs
    let finalMd = md;
    for (const [remote, local] of urlMap.entries()) {
      finalMd = finalMd.split(remote).join(local);
    }

    const mdName = `${safeName(title)}.md`;
    zip.add(mdName, finalMd);

    const zipBlob = zip.generate();
    downloadBlob(zipBlob, `${safeName(title)}.zip`);
    if (typeof UI !== 'undefined') {
      UI.toast(`📦 ZIP 打包完成，共保存 ${urlMap.size} 张图片`);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return {
    buildFrontmatter,
    buildMarkdown,
    formatCommentsMarkdown,
    toObsidian,
    toClipboard,
    toFile,
    toZipWithAssets,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Exporter };
}
