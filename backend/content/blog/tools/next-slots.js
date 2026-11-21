#!/usr/bin/env node
// In ra N khung giờ đăng tiếp theo (05:00 giờ VN, thứ 2–thứ 6) sau bài hẹn muộn nhất trong posts/ (hoặc sau hôm nay nếu chưa có bài nào).
//   node backend/content/blog/tools/next-slots.js 5
const fs = require('fs');
const path = require('path');
const POSTS = path.resolve(__dirname, '../posts');
const n = parseInt(process.argv[2], 10) || 5;
const times = fs.existsSync(POSTS)
  ? fs.readdirSync(POSTS).map((d) => path.join(POSTS, d, 'post.json')).filter(fs.existsSync).map((f) => new Date(JSON.parse(fs.readFileSync(f, 'utf8')).publishAt).getTime())
  : [];
const vnDay = (ms) => new Date(ms + 7 * 3600e3); // đọc ngày/giờ theo giờ VN bằng getUTC*
let cursor = vnDay(Math.max(Date.now(), ...times));
const out = [];
while (out.length < n) {
  cursor = new Date(cursor.getTime() + 86400e3);
  const dow = cursor.getUTCDay(); if (dow === 0 || dow === 6) continue;
  const iso = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}T05:00:00+07:00`;
  out.push(iso);
}
console.log(out.join('\n'));
