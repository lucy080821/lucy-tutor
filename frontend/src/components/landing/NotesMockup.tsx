// Mô phỏng giao diện Lucy Notes bằng HTML/CSS (server component, không ảnh) cho trang /ghi-chu-ai và khối giới thiệu
// trên trang chủ. Nội dung minh hoạ đúng tính năng có thật: mốc thời gian ghi âm, việc có hạn, flashcard, hỏi sổ ghi chú.
export function NotesMockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="relative" aria-hidden="true">
      <div className="rounded-2xl border border-line bg-white shadow-card-hover overflow-hidden text-left">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-line bg-background">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/70" /><span className="w-2.5 h-2.5 rounded-full bg-highlight" /><span className="w-2.5 h-2.5 rounded-full bg-[#10b981]/70" />
          <span className="ml-3 text-[11px] text-muted">lucytutor.online/notes</span>
        </div>
        <div className="flex">
          {!compact && (
            <div className="hidden sm:block w-40 shrink-0 border-r border-line p-3 space-y-1.5 text-[11px]">
              <p className="font-bold text-muted uppercase tracking-wider text-[9px]">Sổ tay</p>
              <p className="flex items-center gap-1.5 font-bold"><span className="w-2 h-2 rounded bg-primary" />Học tiếng Anh</p>
              <p className="pl-3.5 rounded-md bg-primary-soft text-primary font-bold py-0.5">Ngữ pháp</p>
              <p className="pl-3.5 text-muted">Từ vựng</p>
              <p className="pl-3.5 text-muted">IELTS</p>
              <p className="flex items-center gap-1.5 font-bold pt-1"><span className="w-2 h-2 rounded bg-[#10b981]" />Công việc</p>
              <p className="flex items-center gap-1.5 font-bold"><span className="w-2 h-2 rounded bg-highlight" />Cá nhân</p>
            </div>
          )}
          <div className="flex-1 min-w-0 p-4 sm:p-5 space-y-3">
            <p className="text-lg sm:text-xl font-extrabold text-primary leading-tight">Bài giảng: Câu bị động</p>
            <div className="rounded-xl border border-line p-2.5">
              <p className="text-[11px] font-bold text-primary">Ghi âm 21/10 · 18:30</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-line"><div className="h-full w-2/5 rounded-full bg-primary" /></div>
            </div>
            <ul className="space-y-1.5 text-[12.5px] leading-snug">
              <li className="flex gap-2"><span className="shrink-0 font-mono text-[10px] font-bold bg-primary-soft text-primary rounded-full px-1.5 py-0.5">02:14</span>Công thức: S + be + V3/ed (+ by O)</li>
              <li className="flex gap-2"><span className="shrink-0 font-mono text-[10px] font-bold bg-primary-soft text-primary rounded-full px-1.5 py-0.5">07:40</span>Dùng khi không quan trọng ai làm hành động</li>
              <li className="flex gap-2 items-center"><span className="w-3.5 h-3.5 rounded border-2 border-primary shrink-0" />Làm bài tập trang 34<span className="ml-auto shrink-0 text-[10px] font-bold rounded-full bg-red-50 text-red-700 px-1.5">Hạn T6</span></li>
            </ul>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">12 flashcard → ôn tập</span>
              <span className="text-[10px] font-bold rounded-full bg-primary-soft text-primary px-2 py-0.5">Quiz 8 câu</span>
              <span className="text-[10px] font-bold rounded-full bg-background text-muted px-2 py-0.5">#ngu-phap</span>
            </div>
          </div>
        </div>
      </div>
      {!compact && (
        <div className="absolute -bottom-6 -left-3 sm:-left-8 w-60 rounded-2xl border border-line bg-white shadow-card-hover p-3">
          <p className="text-[11px] font-bold text-muted">Hỏi sổ ghi chú</p>
          <p className="text-[12px] font-bold mt-0.5">Khi nào dùng since và for?</p>
          <p className="text-[11px] text-muted mt-1 leading-snug">since + mốc thời gian, for + khoảng thời gian <span className="font-bold text-primary">[1]</span></p>
        </div>
      )}
    </div>
  );
}
