"use client";
// "Ghi chú của tôi" trên trang nội dung lớp học (bài học…): trang ghi chú của chính người dùng đã liên kết với
// nội dung này + nút tạo nhanh 1 trang đã liên kết sẵn. Ẩn hẳn nếu chưa đăng nhập.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { notesApi, errMsg } from "./api";
import { getSessionUserId } from "@/lib/session";
import type { LinkType } from "./types";

export default function LinkedNotes({ targetType, targetId, label }: { targetType: LinkType; targetId: string; label: string }) {
  const router = useRouter();
  const [pages, setPages] = useState<{ id: string; title: string; excerpt: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!getSessionUserId()) return;
    notesApi(`/linked?type=${targetType}&id=${encodeURIComponent(targetId)}`).then(setPages).catch(() => setPages(null));
  }, [targetType, targetId]);

  const create = async () => {
    setBusy(true);
    try {
      const page = await notesApi<{ id: string }>("/pages", { body: { title: `Ghi chú: ${label}`.slice(0, 200), tags: [] } });
      await notesApi(`/pages/${page.id}/links`, { body: { targetType, targetId } }).catch(() => {});
      router.push(`/notes?v=inbox&p=${page.id}`);
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); setBusy(false); }
  };

  if (!pages) return null;
  return (
    <section className="ui-card p-5" aria-labelledby="linked-notes-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="linked-notes-title" className="ui-section-title text-lg">Ghi chú của tôi</h2>
        <button type="button" onClick={create} disabled={busy} className="ml-auto btn-outline px-4 py-2 text-sm">{busy ? "Đang tạo…" : "+ Ghi chú cho bài này"}</button>
      </div>
      {pages.length === 0 ? (
        <p className="text-sm text-muted mt-2">Chưa có. Ghi chú bài này trong Lucy Notes — ghi âm buổi học, tự tạo flashcard, hỏi lại khi ôn thi.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pages.map((p) => (
            <li key={p.id}>
              <Link href={`/notes?v=all&p=${p.id}`} className="block rounded-xl border border-line px-4 py-3 hover:border-primary">
                <span className="block font-bold text-primary text-sm">{p.title || "Không tiêu đề"}</span>
                {p.excerpt && <span className="block text-xs text-muted line-clamp-2 mt-0.5">{p.excerpt}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
