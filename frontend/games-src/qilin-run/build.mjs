// Build game Qilin Run → public/games/qilin-run/play.html (trang nhúng trong /game-hoc-tieng-anh).
// Chạy: cd frontend && node games-src/qilin-run/build.mjs   (sửa game.html / content.js rồi chạy lại)
//  - game.html  : mã nguồn game (HTML + CSS + JS thuần, canvas 2D, không thư viện ngoài)
//  - content.js : kho từ vựng/ngữ pháp theo chủ đề A1–C1 (định dạng ghi ở đầu file)
//  - Từ vựng Lớp 3 dự phòng lấy từ src/lib/games/grade3.ts; từ vựng SGK lớp 1–12 game tự tải lúc chạy
//    từ /game-hoc-tieng-anh/tu-vung-sgk.json (cùng nguồn với trang Flashcard).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const read = (p) => readFileSync(p, "utf8");

const grade3Src = read(join(root, "src/lib/games/grade3.ts"));
const grade3 = {};
for (const m of grade3Src.matchAll(/\{ en: "([^"]+)", vi: "([^"]+)", unit: "(\w+)"/g)) {
  (grade3[m[3]] ||= []).push([m[1], m[2]]);
}

let html = read(join(here, "game.html"));
const swap = (token, value) => {
  if (!html.includes(token)) throw new Error("Thiếu " + token + " trong game.html");
  html = html.split(token).join(value);
};
swap('"data:image/webp;base64,__QILIN__"', '"/games/qilin-run/qilin.webp"');
swap("__VOCAB__", JSON.stringify(grade3));
swap("__CONTENT__", read(join(here, "content.js")));
swap("__GRADES_URL__", JSON.stringify("/game-hoc-tieng-anh/tu-vung-sgk.json"));
swap("__GRADES__", "{}");

const page = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="https://lucytutor.online/game-hoc-tieng-anh">
<link rel="icon" href="/games/qilin-run/qilin.webp">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${html}
</body>
</html>
`;
const out = join(root, "public/games/qilin-run/play.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log("Đã build", out, Math.round(page.length / 1024) + "KB");
