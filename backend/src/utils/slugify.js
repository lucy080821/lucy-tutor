// Chuyển chuỗi tiếng Việt thành slug URL: "Bí quyết đạt 9+ Tiếng Anh" -> "bi-quyet-dat-9-tieng-anh".
// Frontend có bản sao y hệt ở frontend/src/lib/blog.ts (để xem trước link ngay khi gõ tiêu đề).
function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
}

module.exports = { slugify };
