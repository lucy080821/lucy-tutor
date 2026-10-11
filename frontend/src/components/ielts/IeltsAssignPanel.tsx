"use client";
import { useMemo, useState } from "react";
import Swal from "sweetalert2";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Student = { id: string; name: string; email?: string };
type Classroom = { id: string; name: string; students?: Student[] };

// ISO (UTC) → giá trị cho <input type="datetime-local"> theo giờ máy người dùng
function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

// Phạm vi đang lưu của đề, gộp cả cách giao cũ (1 lớp / 1 học viên) để giáo viên thấy đúng hiện trạng
function initialScope(test: any) {
  const classroomIds = new Set<string>((test.classrooms || []).map((c: any) => c.id));
  const studentIds = new Set<string>((test.assignedStudents || []).map((s: any) => s.id));
  if (test.deliveryMode === "LIBRARY") {
    if (test.libraryClassroomId) classroomIds.add(test.libraryClassroomId);
    if (test.libraryStudentId) studentIds.add(test.libraryStudentId);
  } else if (test.assignedClassroomId) {
    classroomIds.add(test.assignedClassroomId);
  }
  return {
    deliveryMode: test.deliveryMode as "LIBRARY" | "ASSIGNED",
    classroomIds: [...classroomIds].sort(),
    studentIds: [...studentIds].sort(),
    deadline: toLocalInput(test.deadline),
    maxAttempts: String(test.maxAttempts || 1)
  };
}

/**
 * Giao đề IELTS: chọn cách giao + nhiều lớp + học viên lẻ (kể cả học viên tự do), lưu bằng 1 nút.
 * Dùng được cả khi đề đã publish (cập nhật bài đã giao — có hiệu lực ngay khi lưu).
 */
export default function IeltsAssignPanel({
  test, classrooms, freeStudents, onUpdated
}: {
  test: any;
  classrooms: Classroom[];
  freeStudents: Student[];
  onUpdated: (patch: any) => void;
}) {
  const saved = useMemo(() => initialScope(test), [test]);
  const [draft, setDraft] = useState(saved);
  const [savedKey, setSavedKey] = useState(JSON.stringify(saved));
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "publish" | "unpublish">("");

  // Đề được tải lại / lưu xong → đồng bộ bản nháp theo dữ liệu server
  const currentKey = JSON.stringify(saved);
  if (currentKey !== savedKey) {
    setSavedKey(currentKey);
    setDraft(saved);
  }

  const dirty = JSON.stringify({ ...draft, classroomIds: [...draft.classroomIds].sort(), studentIds: [...draft.studentIds].sort() }) !== savedKey;
  const isPublished = test.status === "PUBLISHED";

  // Danh sách học viên chọn lẻ: học viên các lớp + học viên tự do phụ trách + học viên đã gán trước đó
  const studentGroups = useMemo(() => {
    const seen = new Set<string>();
    const groups: { label: string; students: Student[] }[] = [];
    for (const c of classrooms) {
      const list = (c.students || []).filter((s) => !seen.has(s.id));
      list.forEach((s) => seen.add(s.id));
      if (list.length) groups.push({ label: c.name, students: list });
    }
    const free = freeStudents.filter((s) => !seen.has(s.id));
    free.forEach((s) => seen.add(s.id));
    if (free.length) groups.push({ label: "Học viên tự do", students: free });
    const other = (test.assignedStudents || []).filter((s: Student) => !seen.has(s.id));
    if (other.length) groups.push({ label: "Khác (đã gán trước đó)", students: other });
    return groups;
  }, [classrooms, freeStudents, test.assignedStudents]);

  const classOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of classrooms) for (const s of c.students || []) map.set(s.id, [...(map.get(s.id) || []), c.id]);
    return map;
  }, [classrooms]);

  const coveredByClass = (studentId: string) => (classOf.get(studentId) || []).some((cid) => draft.classroomIds.includes(cid));

  const reachCount = useMemo(() => {
    const ids = new Set<string>(draft.studentIds);
    for (const c of classrooms) if (draft.classroomIds.includes(c.id)) (c.students || []).forEach((s) => ids.add(s.id));
    return ids.size;
  }, [draft, classrooms]);

  const q = normalize(search.trim());
  const filteredGroups = q
    ? studentGroups.map((g) => ({ ...g, students: g.students.filter((s) => normalize(`${s.name} ${s.email || ""}`).includes(q)) })).filter((g) => g.students.length)
    : studentGroups;

  const toggle = (key: "classroomIds" | "studentIds", id: string) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id] }));

  const save = async (): Promise<boolean> => {
    if (draft.deliveryMode === "ASSIGNED" && !draft.deadline) {
      const ok = await Swal.fire({ title: "Chưa đặt hạn nộp", text: "Đề giao bài sẽ không có hạn nộp. Vẫn lưu?", icon: "question", showCancelButton: true, confirmButtonText: "Vẫn lưu", cancelButtonText: "Quay lại" });
      if (!ok.isConfirmed) return false;
    }
    setBusy("save");
    try {
      const res = await fetch(`${API}/api/ielts/tests/${test.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryMode: draft.deliveryMode,
          classroomIds: draft.classroomIds,
          // Học viên đã nằm trong lớp được chọn thì không cần gán lẻ nữa
          assignedStudentIds: draft.studentIds.filter((id) => !coveredByClass(id)),
          deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
          maxAttempts: draft.maxAttempts
        })
      });
      const data = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", data.error || "Không thể lưu phạm vi giao", "error"); return false; }
      onUpdated(data);
      return true;
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể lưu phạm vi giao", "error");
      return false;
    } finally { setBusy(""); }
  };

  const handleSave = async () => {
    if (await save()) {
      Swal.fire({ title: isPublished ? "Đã cập nhật bài đã giao" : "Đã lưu phạm vi giao", icon: "success", timer: 1600, toast: true, position: "top-end", showConfirmButton: false });
    }
  };

  const handlePublish = async () => {
    if (dirty && !(await save())) return;
    setBusy("publish");
    try {
      const res = await fetch(`${API}/api/ielts/tests/${test.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { Swal.fire("Chưa thể publish", data.error, "warning"); return; }
      onUpdated({ status: data.status });
      Swal.fire("Đã publish!", `Đề đã sẵn sàng cho ${reachCount} học viên.`, "success");
    } catch (err) { console.error(err); } finally { setBusy(""); }
  };

  const handleUnpublish = async () => {
    const ok = await Swal.fire({ title: "Gỡ publish đề này?", text: "Học viên sẽ không còn thấy đề. Lịch sử bài đã làm vẫn được giữ.", icon: "warning", showCancelButton: true, confirmButtonText: "Gỡ publish", cancelButtonText: "Huỷ" });
    if (!ok.isConfirmed) return;
    setBusy("unpublish");
    try {
      const res = await fetch(`${API}/api/ielts/tests/${test.id}/unpublish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", data.error || "Không thể gỡ publish", "error"); return; }
      onUpdated({ status: data.status });
    } catch (err) { console.error(err); } finally { setBusy(""); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="ui-label text-xs">Cách giao đề</label>
        <div className="flex flex-wrap gap-2">
          {([["LIBRARY", "Thư viện tự luyện (không hạn nộp)"], ["ASSIGNED", "Giao bài có hạn nộp"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setDraft((d) => ({ ...d, deliveryMode: v }))}
              className={`ui-chip cursor-pointer ${draft.deliveryMode === v ? "ui-chip-active" : ""}`}>{label}</button>
          ))}
        </div>
      </div>

      {draft.deliveryMode === "ASSIGNED" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="ui-label text-xs">Hạn nộp</label>
            <input type="datetime-local" value={draft.deadline} onChange={(e) => setDraft((d) => ({ ...d, deadline: e.target.value }))} className="w-full p-2.5 ui-input" />
          </div>
          <div>
            <label className="ui-label text-xs">Số lần làm tối đa (mỗi kỹ năng)</label>
            <input type="number" min={1} value={draft.maxAttempts} onChange={(e) => setDraft((d) => ({ ...d, maxAttempts: e.target.value }))} className="w-full p-2.5 ui-input" />
          </div>
        </div>
      )}

      <div>
        <label className="ui-label text-xs">Giao theo lớp <span className="font-normal text-muted">— học viên vào lớp sau cũng tự thấy đề</span></label>
        {classrooms.length === 0 ? (
          <p className="text-sm text-muted">Bạn chưa có lớp học nào.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {classrooms.map((c) => {
              const checked = draft.classroomIds.includes(c.id);
              return (
                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle("classroomIds", c.id)} className="w-4 h-4 accent-[#1E3A8A]" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-sm text-foreground truncate">{c.name}</span>
                    <span className="block text-xs text-muted">{(c.students || []).length} học viên</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="ui-label text-xs">Giao thêm cho từng học viên <span className="font-normal text-muted">— gồm cả học viên tự do bạn phụ trách</span></label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc email..." className="w-full p-2.5 ui-input mb-2" />
        <div className="max-h-72 overflow-y-auto border border-line rounded-xl divide-y divide-line">
          {filteredGroups.length === 0 ? (
            <p className="text-sm text-muted p-3">Không có học viên phù hợp.</p>
          ) : filteredGroups.map((g) => (
            <div key={g.label}>
              <p className="px-3 py-1.5 text-xs font-bold text-muted bg-background sticky top-0">{g.label}</p>
              {g.students.map((s) => {
                const viaClass = coveredByClass(s.id);
                const checked = viaClass || draft.studentIds.includes(s.id);
                return (
                  <label key={s.id} className={`flex items-center gap-3 px-3 py-2 ${viaClass ? "opacity-60 cursor-default" : "cursor-pointer hover:bg-background"}`}>
                    <input type="checkbox" checked={checked} disabled={viaClass} onChange={() => toggle("studentIds", s.id)} className="w-4 h-4 accent-[#1E3A8A]" />
                    <span className="flex-1 min-w-0 text-sm">
                      <span className="font-semibold text-foreground">{s.name}</span>
                      {s.email && <span className="text-muted"> · {s.email}</span>}
                    </span>
                    {viaClass && <span className="text-xs text-muted shrink-0">đã có qua lớp</span>}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-xl p-3 text-sm ${reachCount ? "bg-primary-soft text-primary" : "bg-amber-50 text-amber-700"}`}>
        {reachCount
          ? <>Đề sẽ hiện với <b>{reachCount} học viên</b> ({draft.classroomIds.length} lớp{draft.studentIds.filter((id) => !coveredByClass(id)).length ? ` + ${draft.studentIds.filter((id) => !coveredByClass(id)).length} học viên lẻ` : ""}).</>
          : <>⚠️ Chưa giao cho ai — học viên sẽ không thấy đề này.</>}
        {isPublished && dirty && <span className="block mt-1">Đề đang publish: thay đổi có hiệu lực ngay khi bấm Lưu.</span>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleSave} disabled={!dirty || !!busy} className="btn-outline px-5 py-2 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {busy === "save" ? "Đang lưu..." : isPublished ? "Cập nhật bài đã giao" : "Lưu phạm vi giao"}
        </button>
        {isPublished ? (
          <>
            <span className="ui-badge bg-emerald-50 text-emerald-700 px-3 py-1">✓ Đang publish</span>
            <button onClick={handleUnpublish} disabled={!!busy} className="btn-ghost px-4 py-2 text-sm text-red-700 cursor-pointer">
              {busy === "unpublish" ? "Đang gỡ..." : "Gỡ publish"}
            </button>
          </>
        ) : (
          <button onClick={handlePublish} disabled={!!busy} className="btn-primary px-5 py-2 text-sm cursor-pointer">
            {busy === "publish" ? "Đang publish..." : dirty ? "Lưu & Publish" : "Publish"}
          </button>
        )}
        {dirty && !busy && <span className="text-xs text-amber-700">Có thay đổi chưa lưu</span>}
      </div>
    </div>
  );
}
