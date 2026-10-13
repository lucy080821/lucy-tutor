// BLOG_ADMIN_EMAILS = danh sách email (phân tách bằng dấu phẩy) được duyệt/đăng bài, sửa bài của người khác,
// xoá danh mục, duyệt/xoá mọi bình luận. Để trống = mọi giáo viên đều là admin blog (không ai bị khoá khi chưa cấu hình).
const BLOG_ADMIN_EMAILS = (process.env.BLOG_ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

const isBlogAdmin = (user) => BLOG_ADMIN_EMAILS.length === 0 || BLOG_ADMIN_EMAILS.includes(String(user.email).toLowerCase());

module.exports = { isBlogAdmin };
