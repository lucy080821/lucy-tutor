// Resizes and re-encodes an image client-side before it gets stored as a base64 string in the
// DB (this app has no server-side image processing — see AGENTS notes on avatar handling).
// Without this, a raw phone photo (often several MB, sometimes 10MB+) gets embedded as-is and
// re-transferred on every page that renders that avatar, even at a 32px thumbnail size.
export function compressImageToBase64(file: File, maxDimension = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas không khả dụng trên trình duyệt này"));

      // Flatten transparency onto white — avatars are photos, JPEG has no alpha channel.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Không thể đọc ảnh này"));
    };
    img.src = objectUrl;
  });
}
