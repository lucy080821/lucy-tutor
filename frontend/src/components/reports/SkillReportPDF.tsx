import React from "react";
import { formatPracticedAt } from "@/lib/skillPractice";

export interface SkillReportRubricItem {
  label: string;
  note: string;
}

interface SkillReportPDFProps {
  skillLabel: string; // e.g. "Luyện Nói (Speaking)"
  skillIcon: string;
  studentName: string;
  practicedAt: string | Date;
  level?: string;
  purpose?: string;
  contextTitle: string; // topic/prompt/passage/scenario title
  overallComment: string;
  rubric: SkillReportRubricItem[];
  suggestions: string[];
  transcriptTitle: string; // "Bài viết", "Hội thoại", "Bài đọc"...
  transcriptBody: string;
  score?: number | null; // optional 0-10, shown only when provided
}

// Ensure this component is wrapped in a div with a fixed width (e.g., 800px) when rendering to PDF.
// Height is intentionally auto (not fixed like TuitionInvoice) since practice content varies a lot in
// length; pdfExport.ts's exportNodeToPDF() splits the resulting image across multiple PDF pages.
export const SkillReportPDF = React.forwardRef<HTMLDivElement, SkillReportPDFProps>(({
  skillLabel, skillIcon, studentName, practicedAt, level, purpose, contextTitle,
  overallComment, rubric, suggestions, transcriptTitle, transcriptBody, score
}, ref) => {
  return (
    <div ref={ref} className="bg-white text-slate-800 p-10 font-sans mx-auto" style={{ width: "800px", boxSizing: "border-box" }}>

      {/* Header */}
      <div className="flex justify-between items-start mb-10 border-b-2 border-primary pb-8">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="LucyTutor Logo" className="w-16 h-16 object-contain" />
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tight">LUCYTUTOR</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Học tập không ngừng, vươn tới thành công</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-black text-slate-800 mb-1 tracking-tight">{skillIcon} BÁO CÁO LUYỆN TẬP</h2>
          <p className="text-slate-500 font-medium">{skillLabel}</p>
        </div>
      </div>

      {/* Info Section */}
      <div className="mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500 mb-1">Học viên</p>
            <h3 className="text-xl font-bold text-primary">{studentName}</h3>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-500 mb-1">Thời gian thực hành</p>
            <p className="font-bold text-slate-700">{formatPracticedAt(practicedAt)}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          {level && <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary">Cấp độ: {level}</span>}
          {purpose && <span className="text-xs font-bold px-3 py-1 rounded-full bg-secondary/10 text-secondary">{purpose === "IELTS" ? "🎓 Mục đích: Luyện thi IELTS" : "💬 Mục đích: Giao tiếp"}</span>}
          {score != null && <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">Điểm tham khảo: {score.toFixed(1)}/10</span>}
        </div>
        <p className="text-sm font-semibold text-slate-600 mt-4">{contextTitle}</p>
      </div>

      {/* Overall comment */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">📝 Nhận Xét Tổng Quan</h3>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{overallComment}</p>
      </div>

      {/* Rubric breakdown */}
      {rubric.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">📊 Đánh Giá Chi Tiết</h3>
          <div className="space-y-3">
            {rubric.map((r, i) => (
              <div key={i} className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <p className="font-bold text-primary text-sm mb-1">{r.label}</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{r.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">💡 Gợi Ý Cải Thiện</h3>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="text-sm text-slate-700 leading-relaxed flex gap-2">
                <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transcript / essay / passage body */}
      {transcriptBody && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">📄 {transcriptTitle}</h3>
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {transcriptBody}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center border-t border-slate-200 pt-6 mt-10">
        <p className="text-sm font-semibold text-slate-600 mb-1">Cảm ơn bạn đã đồng hành cùng LucyTutor trên hành trình chinh phục Tiếng Anh!</p>
        <p className="text-xs text-slate-400">Mọi thắc mắc vui lòng liên hệ Zalo/SĐT: 0869.603.164</p>
      </div>

    </div>
  );
});

SkillReportPDF.displayName = "SkillReportPDF";
