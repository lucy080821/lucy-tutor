"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { adminFetch, AdminAuthError, formatVND, FREE_STATUS_LABEL, pctChange, type FreeStatus, type Overview } from "@/lib/adminApi";
import { ErrorBlock, KpiCard, LoadingBlock, SectionCard } from "./ui";

const SignupChart = dynamic(() => import("./AdminCharts").then((m) => m.SignupChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});

const FREE_STATUS_STYLE: Record<FreeStatus, string> = {
  TRIAL: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  LOCKED: "bg-red-50 text-red-700",
  EXEMPT: "bg-slate-100 text-slate-600",
};

export default function OverviewTab({ onAuthLost, onOpenFinance }: { onAuthLost: () => void; onOpenFinance: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminFetch<Overview>("/overview")
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof AdminAuthError) onAuthLost();
        else setError((err as Error).message);
      });
    return () => { cancelled = true; };
  }, [reloadTick, onAuthLost]);

  if (error) return <ErrorBlock message={error} onRetry={() => { setError(""); setReloadTick((t) => t + 1); }} />;
  if (!data) return <LoadingBlock />;

  const { counts, freeStatus, signups, finance } = data;
  const newThisMonth = signups[signups.length - 1];
  const newLastMonth = signups[signups.length - 2];
  const newUsers = (s?: { students: number; teachers: number }) => (s ? s.students + s.teachers : 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Học viên" value={counts.students.toLocaleString("vi-VN")} hint={`${counts.freeStudents} học viên tự do`} />
        <KpiCard label="Giáo viên" value={counts.teachers.toLocaleString("vi-VN")} hint={`${counts.classrooms} lớp học`} />
        <KpiCard label="Đăng ký tháng này" value={newUsers(newThisMonth).toLocaleString("vi-VN")}
          delta={pctChange(newUsers(newThisMonth), newUsers(newLastMonth))} hint="so với tháng trước" />
        <KpiCard label="Hoạt động 7 ngày" value={counts.active7.toLocaleString("vi-VN")} hint={`${counts.active30} trong 30 ngày`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Tài khoản đăng ký mới" subtitle="12 tháng gần nhất" className="lg:col-span-2">
          <div className="h-72"><SignupChart data={signups} /></div>
        </SectionCard>

        <SectionCard title={`Tài chính tháng ${finance.month}/${finance.year}`} subtitle="Theo sổ thu chi nhập tay"
          actions={<button onClick={onOpenFinance} className="btn-outline px-4 py-2 text-sm cursor-pointer">Xem chi tiết</button>}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Thu nhập</dt><dd className="font-bold">{formatVND(finance.income)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Chi phí</dt><dd className="font-bold">{formatVND(finance.expense)}</dd></div>
            <div className="flex justify-between gap-3 pt-3 border-t border-line">
              <dt className="font-bold text-foreground">Lợi nhuận</dt>
              <dd className={`font-extrabold text-lg ${finance.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatVND(finance.profit)}</dd>
            </div>
            <p className="text-xs text-muted">Tháng trước: {formatVND(finance.prev.profit)}</p>
          </dl>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Học viên tự do" subtitle="Học viên chưa tham gia lớp nào">
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(FREE_STATUS_LABEL) as FreeStatus[]).map((s) => (
              <div key={s} className={`rounded-xl px-4 py-3 ${FREE_STATUS_STYLE[s]}`}>
                <p className="text-xs font-bold">{FREE_STATUS_LABEL[s]}</p>
                <p className="text-2xl font-extrabold mt-1">{freeStatus[s]}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">&quot;Miễn trừ&quot; = tài khoản tạo trước 01/08/2026, không áp dụng dùng thử/khoá.</p>
        </SectionCard>

        <SectionCard title="Nội dung" subtitle="Số liệu hệ thống khác">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Lớp học đang có</dt><dd className="font-bold">{counts.classrooms}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Bài blog đã đăng</dt><dd className="font-bold">{counts.publishedPosts}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Tài khoản hoạt động 30 ngày</dt><dd className="font-bold">{counts.active30}</dd></div>
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
