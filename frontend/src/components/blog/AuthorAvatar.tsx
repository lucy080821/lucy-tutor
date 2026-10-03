import { authorAvatarUrl } from "@/lib/blog";

// Avatar tác giả: ảnh thật nếu có (tải qua API, không nhúng base64), ngược lại là chữ cái đầu.
export default function AuthorAvatar({
  name, authorSlug, hasAvatar, size = 32,
}: { name: string; authorSlug: string | null; hasAvatar?: boolean; size?: number }) {
  if (authorSlug && hasAvatar) {
    return (
      <img
        src={authorAvatarUrl(authorSlug)}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        className="rounded-full object-cover shrink-0 bg-primary-soft"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
