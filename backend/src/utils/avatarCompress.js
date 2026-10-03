// Nén avatar phía server — lớp bảo vệ thứ 2 sau compressImageToBase64 ở frontend.
//
// Avatar lưu dạng chuỗi base64 trong bảng User và bị trả kèm ở nhiều API (/api/auth/me,
// danh sách lớp, bảng xếp hạng...) mà dashboard tự gọi lại mỗi 30 giây. Từng có avatar 15MB
// (upload trước khi frontend có bước nén) làm Supabase vượt hạn mức băng thông 5GB/tháng của
// gói Free và khoá toàn bộ dịch vụ. Server tự nén nên dù ảnh tới từ đâu (bản frontend cũ còn
// cache, gọi API trực tiếp...), DB luôn chỉ lưu bản nhỏ.
//
// Dùng jimp (thuần JS, không cần binary native như sharp) để deploy Hostinger không phải build gì thêm.
const { Jimp } = require('jimp');

const MAX_DIMENSION = 256; // giống compressImageToBase64 ở frontend
const JPEG_QUALITY = 85;
// Ảnh đã đủ nhỏ (vd frontend đã nén) thì giữ nguyên, không nén chồng làm giảm chất lượng
const SKIP_BELOW_BYTES = 60 * 1024;

const DATA_URL_RE = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i;

// Nhận data URL base64 -> trả data URL JPEG đã nén. Ném lỗi nếu không phải ảnh hợp lệ.
async function compressAvatarDataUrl(dataUrl) {
  const match = typeof dataUrl === 'string' && dataUrl.match(DATA_URL_RE);
  if (!match) throw new Error('Ảnh đại diện không hợp lệ');
  const input = Buffer.from(match[1], 'base64');

  const img = await Jimp.read(input).catch(() => { throw new Error('Không đọc được ảnh, vui lòng chọn ảnh khác'); });
  if (input.length <= SKIP_BELOW_BYTES && Math.max(img.width, img.height) <= MAX_DIMENSION) return dataUrl;

  if (Math.max(img.width, img.height) > MAX_DIMENSION) img.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });
  // JPEG không có kênh trong suốt -> lót nền trắng (cùng cách làm với frontend)
  const canvas = new Jimp({ width: img.width, height: img.height, color: 0xffffffff });
  canvas.composite(img, 0, 0);
  const out = await canvas.getBuffer('image/jpeg', { quality: JPEG_QUALITY });
  return `data:image/jpeg;base64,${out.toString('base64')}`;
}

module.exports = { compressAvatarDataUrl };
