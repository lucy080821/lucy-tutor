"use client";
import { useEffect, useState } from "react";
import { API_URL } from "./api";

export type NotesInsights = { studyDue: number; overdue: number; topError: { category: string; count: number } | null };

/** Số liệu nhỏ từ Ghi chú cho panel Nhận Định ở /dashboard (không gọi AI). */
export function useNotesInsights(userId: string | null) {
  const [data, setData] = useState<NotesInsights | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetch(`${API_URL}/api/notes/insights?userId=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId]);
  return data;
}
