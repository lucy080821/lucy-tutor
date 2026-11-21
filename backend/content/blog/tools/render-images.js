#!/usr/bin/env node
// Dựng ảnh bìa (thumbnail 1200×630) + infographic (1080×1350) cho bài blog từ post.json — cùng phong cách các bài đã có:
// nền navy #14264a, nhấn vàng #f5b400, thương hiệu "Tiếng Anh Không Khó".
//
//   node backend/content/blog/tools/render-images.js <slug> [<slug>...]   dựng ảnh cho bài chỉ định
//   node backend/content/blog/tools/render-images.js --missing             dựng mọi bài còn thiếu file ảnh
//
// Cần Playwright + Chromium (có sẵn trong môi trường Claude cloud: require('playwright')). Font Inter (có tiếng Việt).
// Ảnh ghi vào frontend/public/images/blog/<slug>/<file> — TÊN FILE PHẢI CHỨA TỪ KHOÁ CHÍNH (xem validate.js).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POSTS = path.join(ROOT, 'posts');
const OUT = path.resolve(ROOT, '../../../frontend/public/images/blog');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// {chữ vàng} → <span class="g">; **đậm**
const rich = (s) => esc(s).replace(/tiếng Anh/g, 'tiếng\u00a0Anh').replace(/(\/[^/\s<>]{1,5}\/)/g, '<span class="ipa">$1</span>').replace(/\{([^}]+)\}/g, '<span class="g">$1</span>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter Display','Inter','DejaVu Sans',sans-serif;-webkit-font-smoothing:antialiased}
.g{color:#f5b400}.brand{font-weight:700;letter-spacing:.01em}.ipa{white-space:nowrap}
`;

function thumbnailHtml(p, c) {
  const len = String(c.title).replace(/[{}]/g, '').length;
  const size = len <= 34 ? 84 : len <= 48 ? 72 : len <= 64 ? 62 : 54;
  return `<!doctype html><meta charset="utf-8"><style>${BASE_CSS}
body{width:1200px;height:630px;background:#14264a;position:relative;overflow:hidden;color:#fff}
.ring{position:absolute;border:2px solid rgba(255,255,255,.12);border-radius:50%}
.wrap{position:absolute;left:72px;top:0;bottom:0;width:860px;display:flex;flex-direction:column;justify-content:center}
.pill{align-self:flex-start;border:2.5px solid #f5b400;color:#f5b400;border-radius:999px;padding:12px 26px;font-weight:800;letter-spacing:.14em;font-size:22px;text-transform:uppercase;margin-bottom:34px}
h1{font-size:${size}px;line-height:1.1;font-weight:800;letter-spacing:-.02em;text-wrap:balance}
.sub{margin-top:26px;font-size:30px;line-height:1.4;color:#c9d4ea;font-weight:500;max-width:880px;text-wrap:balance}
.by{margin-top:34px;font-size:23px;color:#9fb0d3;font-weight:700}
.site{position:absolute;right:56px;bottom:40px;font-size:22px;color:#7f93bd;font-weight:600}
</style>
<div class="ring" style="width:620px;height:620px;right:-170px;top:150px"></div>
<div class="ring" style="width:420px;height:420px;right:-60px;top:250px"></div>
<div class="wrap"><div class="pill">${esc(c.pill)}</div><h1>${rich(c.title)}</h1><div class="sub">${rich(c.subtitle || '')}</div><div class="by">Tiếng Anh Không Khó</div></div>
<div class="site">lucytutor.online</div>`;
}

function infographicHtml(p, c) {
  const items = c.items || [];
  const header = `<div class="eyebrow">${esc(c.eyebrow || '')}</div><h1>${rich(c.title)}</h1>`;
  const footer = `<div class="foot"><div class="ft">${rich(c.footer || '')}</div><div class="fb">Tiếng Anh<br>Không Khó</div></div>`;
  let body = '';
  if (c.type === 'steps') {
    const n = items.length; const gap = 18; const area = 1350 - 290 - 190 - 26; const h = Math.min(150, Math.floor((area - gap * (n - 1)) / n));
    body = `<div class="list">${items.map((it, i) => `<div class="card" style="height:${h}px"><div class="num">${c.mark === 'check' ? (it.ok === false ? '✗' : '✓') : i + 1}</div><div><div class="ct">${rich(it.t)}</div><div class="cs">${rich(it.s || '')}</div></div></div>`).join('')}</div>`;
  } else if (c.type === 'timeline') {
    body = `<div class="tl">${items.map((it, i) => `<div class="tr"><div class="dot">${i + 1}</div><div class="tc"><div class="tt">${rich(it.t)}</div><div class="ts">${rich(it.s || '')}</div></div></div>`).join('')}</div>`;
  } else if (c.type === 'formula') {
    body = `<div class="list">${items.map((it) => `<div class="fcard"><div class="fh">${rich(it.t)}</div><div class="fe">${rich(it.s || '')}</div><div class="fn">${rich(it.n || '')}</div></div>`).join('')}</div>`;
  } else if (c.type === 'versus') {
    body = `<div class="vs-h"><div class="bad">${esc(c.badLabel || 'Hay sai')}</div><div class="good">${esc(c.goodLabel || 'Nên viết')}</div></div><div class="list">${items.map((it) => `<div class="vrow"><div class="vb">${rich(it.bad)}</div><div class="vg">${rich(it.good)}</div></div>`).join('')}</div>`;
  } else if (c.type === 'table') {
    const cols = c.columns || []; const rows = c.rows || [];
    const fs = rows.length > 5 ? 21 : 24;
    const nb = (t) => t.replace(/-/g, '\u2011'); // gạch nối không ngắt dòng (V-ing không bị tách đôi)
    const cell = (x) => { const [a, b] = String(x).split('||'); return `${rich(nb(a))}${b ? `<div class="sub">${rich(b)}</div>` : ''}`; };
    body = `<table class="tb" style="font-size:${fs}px"><thead><tr>${cols.map((x) => `<th>${rich(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x, j) => `<td class="${j === 0 ? 'c0' : ''}">${cell(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  return `<!doctype html><meta charset="utf-8"><style>${BASE_CSS}
body{width:1080px;height:1350px;background:#edf2fa;color:#14264a;position:relative}
.eyebrow{font-size:25px;font-weight:800;letter-spacing:.12em;color:#8a6a00;text-transform:uppercase}
h1{margin-top:14px;font-size:62px;line-height:1.08;font-weight:800;letter-spacing:-.02em;color:#14264a;text-wrap:balance}
.top{position:absolute;left:72px;right:72px;top:70px}
.main{position:absolute;left:72px;right:72px;top:290px;bottom:190px}
.list{display:flex;flex-direction:column;gap:18px}
.card{background:#fff;border-radius:28px;display:flex;align-items:center;gap:28px;padding:0 30px}
.num{flex:none;width:80px;height:80px;border-radius:22px;background:#14264a;color:#f5b400;font-weight:800;font-size:44px;display:flex;align-items:center;justify-content:center}
.ct{font-size:34px;font-weight:800;line-height:1.2}.cs{margin-top:8px;font-size:27px;color:#52627f;font-weight:500;line-height:1.3}
.tl{position:relative;display:flex;flex-direction:column;gap:20px;padding-left:10px}
.tr{display:flex;gap:26px;align-items:stretch}
.dot{flex:none;width:76px;height:76px;border-radius:50%;background:#14264a;color:#f5b400;font-weight:800;font-size:38px;display:flex;align-items:center;justify-content:center;margin-top:8px}
.tc{flex:1;background:#fff;border-radius:26px;padding:24px 30px}.tt{font-size:33px;font-weight:800}.ts{margin-top:8px;font-size:26px;color:#52627f;font-weight:500;line-height:1.35}
.fcard{background:#fff;border-radius:28px;padding:26px 34px}.fh{font-size:31px;font-weight:800;color:#8a6a00}.fe{margin-top:8px;font-size:38px;font-weight:800}.fn{margin-top:6px;font-size:25px;color:#52627f;font-weight:500}
.vs-h{display:flex;gap:18px;margin-bottom:16px}.vs-h div{flex:1;border-radius:18px;padding:14px 22px;font-size:26px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.bad{background:#fde4e4;color:#b42318}.good{background:#dff5e6;color:#1b7a3b}
.vrow{display:flex;gap:18px}.vb,.vg{flex:1;background:#fff;border-radius:22px;padding:22px 26px;font-size:28px;font-weight:600;line-height:1.3}.vb{border-left:8px solid #e5484d}.vg{border-left:8px solid #2fa35a}
.tb{width:100%;height:100%;border-collapse:separate;border-spacing:8px;table-layout:fixed}.tb .sub{margin-top:10px;font-size:.82em;color:#52627f;font-weight:500;font-style:italic}.tb th{background:#14264a;color:#f5b400;border-radius:16px;padding:16px 12px;font-weight:800;font-size:.9em}
.tb td{background:#fff;border-radius:16px;padding:16px 14px;text-align:center;vertical-align:middle;font-weight:600;line-height:1.25}.tb thead tr{height:90px}.tb td.c0{background:#fff4cc;color:#14264a;font-weight:800}
.foot{position:absolute;left:72px;right:72px;bottom:70px;height:120px;border-radius:30px;background:#14264a;display:flex;align-items:center;justify-content:space-between;padding:0 36px;color:#fff}
.ft{font-size:30px;font-weight:600;line-height:1.3;max-width:700px}.ft b,.ft .g{color:#f5b400;font-weight:800}.fb{font-weight:800;font-size:26px;text-align:right;line-height:1.25}
</style><div class="top">${header}</div><div class="main">${body}</div>${footer}`;
}

async function renderOne(browser, slug, only) {
  const dir = path.join(POSTS, slug);
  const post = JSON.parse(fs.readFileSync(path.join(dir, 'post.json'), 'utf8'));
  const outDir = path.join(OUT, slug); fs.mkdirSync(outDir, { recursive: true });
  const jobs = [['cover', 1200, 630, thumbnailHtml], ['infographic', 1080, 1350, infographicHtml]];
  let sharp = null; try { sharp = require(path.resolve(__dirname, '../../../../frontend/node_modules/sharp')); } catch { /* tuỳ chọn */ }
  for (const [key, w, h, fn] of jobs) {
    const c = post.images?.[key]; if (!c) throw new Error(`${slug}: thiếu images.${key} trong post.json`);
    const file = path.join(outDir, c.file);
    if (only === 'missing' && fs.existsSync(file)) continue;
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.setContent(fn(post, c), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    let buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h } });
    await page.close();
    if (sharp) buf = await sharp(buf).png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
    fs.writeFileSync(file, buf);
    console.log(`✓ ${slug}/${c.file} (${Math.round(buf.length / 1024)} KB)`);
  }
}

(async () => {
  const args = process.argv.slice(2);
  const only = args.includes('--missing') ? 'missing' : null;
  let slugs = args.filter((a) => !a.startsWith('--'));
  if (!slugs.length) slugs = fs.readdirSync(POSTS).filter((d) => fs.existsSync(path.join(POSTS, d, 'post.json')));
  if (!slugs.length) { console.log('Không có bài nào trong posts/'); return; }
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try { for (const s of slugs) await renderOne(browser, s, only); } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
