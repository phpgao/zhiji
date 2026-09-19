/**
 * 知集 (ZhiJi) — 扩展图标多尺寸生成器
 * 严格符合 Chrome Web Store 规范：
 * 128x128 图标内容尺寸最大 96x96，四周保留至少 16px 透明内边距 (Transparent Padding)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'logo.png');
const ICONS_DIR = path.join(ROOT, 'extension', 'icons');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

console.log('🎨 正在生成符合 Chrome Web Store 规范的扩展图标...');

const pythonScript = `
import os
from PIL import Image

source = r"${SOURCE}"
icons_dir = r"${ICONS_DIR}"

img = Image.open(source).convert("RGBA")
bbox = img.getbbox()
content = img.crop(bbox)

# Specs: (canvas_size, max_content_size)
specs = [
    (128, 96),  # CWS 严格规范: 128x128 画面内内容最大 96x96，四周至少 16px 透明内边距
    (48, 38),   # Chrome 管理页
    (32, 28),   # Windows/Retina
    (16, 16),   # Favicon
]

for size, max_c in specs:
    c = content.copy()
    c.thumbnail((max_c, max_c), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - c.width) // 2, (size - c.height) // 2)
    canvas.paste(c, offset, c)
    out_path = os.path.join(icons_dir, f"icon-{size}.png")
    canvas.save(out_path, "PNG")
    b = canvas.getbbox()
    print(f"  ✅ icon-{size}.png ({size}x{size}, 内容: {b[2]-b[0]}x{b[3]-b[1]}, 边距: 上={b[1]}px, 下={size-b[3]}px, 左={b[0]}px, 右={size-b[2]}px)")
`;

try {
  const output = execFileSync('python3', ['-c', pythonScript], { encoding: 'utf8' });
  console.log(output.trim());
  console.log('✨ 图标生成完成！\n');
} catch (err) {
  console.error('  ❌ 生成图标失败:', err.message);
  process.exit(1);
}
