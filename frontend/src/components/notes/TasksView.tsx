"use client";
// Gom mọi việc cần làm (checklist) từ tất cả trang. Tick ở đây = tick trong trang (server sửa JSON trang theo tid).
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { notesApi, errMsg } from "./api";
import { Spinner } from "./ui";

type Task = { id: string; text: string; done: boolean; dueAt: string | null; page: { id: string; title: string } };

export default function TasksView({ onOpen, refreshBoot }: { onOpen: (id: string) => void; refreshBoot: () => void }) {
  const [filter, setFilter] = useState<"open" | "done">("open");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  useEffect(() => { setTasks(null); notesApi<Task[]>(`/tasks?filter=${filter}`).then(setTasks).catch((e) => { setTasks([]); Swal.fire({ icon: "error", text: errMsg(e) }); }); }, [filter]);

  const toggle = async (t: Task) => {
    setTasks((ts) => ts?.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) || null);
    try { await notesApi(`/tasks/${t.id}/toggle`, { body: { done: !t.done } }); refreshBoot(); }
    catch (err) { setTasks((ts) => ts?.map((x) => (x.id === t.id ? t : x)) || null); Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  const now = Date.now();
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const groups: [string, Task[]][] = filter === "done" ? [["Đã xong", tasks || []]] : [
    ["Quá hạn", (tasks || []).filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now)],
    ["Hôm nay", (tasks || []).filter((t) => t.dueAt && new Date(t.dueAt).getTime() >= now && new Date(t.dueAt) <= endToday)],
    ["Sắp tới", (tasks || []).filter((t) => t.dueAt && new Date(t.dueAt) > endToday)],
    ["Không có hạn", (tasks || []).filter((t) => !t.dueAt)],
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-sm text-muted">Trang chủ / Ghi chú / Việc cần làm</p>
        <h1 className="ui-page-title mt-1">Việc cần làm</h1>
        <p className="ui-page-subtitle">Tất cả checklist trong mọi trang. Đặt hạn: trong trang, gõ / → "Đặt hạn cho việc này", hoặc bấm nhãn hạn cạnh việc.</p>
        <div className="flex gap-2 my-4">
          <button type="button" onClick={() => setFilter("open")} className={`ui-chip ${filter === "open" ? "ui-chip-active" : ""}`}>Chưa xong</button>
          <button type="button" onClick={() => setFilter("done")} className={`ui-chip ${filter === "done" ? "ui-chip-active" : ""}`}>Đã xong</button>
        </div>
        {!tasks ? <Spinner /> : !tasks.length ? <p className="ui-card p-6 text-center text-sm text-muted">{filter === "open" ? "Không còn việc nào. Thêm checklist trong bất kỳ trang nào, chúng sẽ hiện ở đây." : "Chưa có việc nào hoàn thành."}</p> : (
          <div className="space-y-5">
            {groups.filter(([, list]) => list.length).map(([label, list]) => (
              <section key={label}>
                <h2 className={`ui-label ${label === "Quá hạn" ? "text-red-700" : ""}`}>{label} ({list.length})</h2>
                <ul className="ui-card divide-y divide-line">
                  {list.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                      <input type="checkbox" checked={t.done} onChange={() => toggle(t)} className="mt-1 w-4 h-4" aria-label={`Đánh dấu ${t.text}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${t.done ? "line-through text-muted" : "font-semibold"}`}>{t.text}</span>
                        <button type="button" onClick={() => onOpen(t.page.id)} className="text-xs text-primary hover:underline">{t.page.title || "Không tiêu đề"}</button>
                      </span>
                      {t.dueAt && <span className={`text-xs shrink-0 ${!t.done && new Date(t.dueAt).getTime() < now ? "text-red-700 font-bold" : "text-muted"}`}>{new Date(t.dueAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
