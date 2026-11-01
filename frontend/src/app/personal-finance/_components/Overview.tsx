"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { SectionCard } from "@/app/administrator/_components/ui";
import {
  daysInMonth, dayLabel, monthShort, OTHER_COLOR, SERIES_COLORS, shiftMonth, totalsByBig, vnd, WEEKDAYS, weekdayOf,
  type MonthRow, type PfData,
} from "@/lib/personalFinance";

const chartLoading = () => <div className="h-full flex items-center justify-center text-sm text-muted">Đang tải biểu đồ...</div>;
const CashflowChart = dynamic(() => import("./PfCharts").then((m) => m.CashflowChart), { ssr: false, loading: chartLoading });
const DonutChart = dynamic(() => import("./PfCharts").then((m) => m.DonutChart), { ssr: false, loading: chartLoading });
const HorizontalBars = dynamic(() => import("./PfCharts").then((m) => m.HorizontalBars), { ssr: false, loading: chartLoading });
const DailyBars = dynamic(() => import("./PfCharts").then((m) => m.DailyBars), { ssr: false, loading: chartLoading });
const CumulativeChart = dynamic(() => import("./PfCharts").then((m) => m.CumulativeChart), { ssr: false, loading: chartLoading });
const StackedMonthChart = dynamic(() => import("./PfCharts").then((m) => m.StackedMonthChart), { ssr: false, loading: chartLoading });
const WeekdayChart = dynamic(() => import("./PfCharts").then((m) => m.WeekdayChart), { ssr: false, loading: chartLoading });
const SavingRateChart = dynamic(() => import("./PfCharts").then((m) => m.SavingRateChart), { ssr: false, loading: chartLoading });

type Alert = { level: "critical" | "warning" | "info" | "success"; text: string };
const ALERT_STYLE: Record<Alert["level"], string> = {
  critical: "bg-red-50 text-red-700 border-red-100",
  warning: "bg-amber-50 text-amber-800 border-amber-100",
  info: "bg-sky-50 text-sky-800 border-sky-100",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

function ChartBox({ height = "h-72", children }: { height?: string; children: React.ReactNode }) {
  return <div className={`${height} w-full min-w-0`}>{children}</div>;
}
function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted">{text}</p>;
}
function Legend({ items }: { items: { name: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: i.color }} />
          <span className="truncate text-foreground">{i.name}</span>
          <span className="ml-auto shrink-0 font-semibold">{vnd(i.value)}</span>
          <span className="w-10 shrink-0 text-right text-xs text-muted">{total ? Math.round((i.value / total) * 100) : 0}%</span>
        </li>
      ))}
    </ul>
  );
}

export default function Overview({ data, month, rows }: { data: PfData; month: string; rows: MonthRow[] }) {
  const calc = useMemo(() => {
    const { categories, transactions, today } = data;
    const monthTx = transactions.filter((t) => t.date.startsWith(month));
    const prevTx = transactions.filter((t) => t.date.startsWith(shiftMonth(month, -1)));
    const expenses = totalsByBig(monthTx, categories, "EXPENSE");
    const incomes = totalsByBig(monthTx, categories, "INCOME");
    const prevExpenses = new Map(totalsByBig(prevTx, categories, "EXPENSE").map((e) => [e.id, e.total]));
    const cur = rows.find((r) => r.month === month);
    const N = daysInMonth(month);
    const todayMonth = today.slice(0, 7);
    const elapsed = month === todayMonth ? Number(today.slice(8)) : month < todayMonth ? N : 0;

    // Donut chi: 7 danh mục lớn nhất + "Khác"
    const toDonut = (list: typeof expenses) => {
      const top = list.slice(0, 7).map((e, i) => ({ name: e.name, value: e.total, color: SERIES_COLORS[i] }));
      const rest = list.slice(7).reduce((s, e) => s + e.total, 0);
      return rest > 0 ? [...top, { name: "Khác", value: rest, color: OTHER_COLOR }] : top;
    };

    // Top danh mục nhỏ
    const subs = expenses
      .flatMap((e) => e.subs.map((s) => ({ name: s.name === "Chưa chia nhỏ" ? e.name : `${e.name} › ${s.name}`, value: s.total })))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Theo ngày
    const perDay = new Array(N).fill(0) as number[];
    const perWeekday = new Array(7).fill(0) as number[];
    for (const t of monthTx) {
      if (t.type !== "EXPENSE") continue;
      perDay[Number(t.date.slice(8)) - 1] += t.amount;
      perWeekday[weekdayOf(t.date)] += t.amount;
    }
    const daily = perDay.map((amount, i) => ({ day: String(i + 1).padStart(2, "0"), amount }));
    const cumulative: { day: string; cumulative: number | null }[] = [];
    for (let i = 0, run = 0; i < N; i++) {
      run += perDay[i];
      cumulative.push({ day: String(i + 1).padStart(2, "0"), cumulative: i < Math.max(elapsed, 1) || elapsed === N ? run : null });
    }
    const totalBudget = expenses.reduce((s, e) => s + (e.budget || 0), 0)
      + categories.filter((c) => !c.parentId && c.type === "EXPENSE" && c.budget && !expenses.some((e) => e.id === c.id)).reduce((s, c) => s + (c.budget || 0), 0);

    // Qua các tháng (12 tháng gần nhất đến tháng đang xem)
    const upto = rows.filter((r) => r.month <= month).slice(-12);
    const cashflow = upto.map((r) => ({ name: monthShort(r.month), income: r.income, expense: r.expense, closing: r.closing }));
    const saving = upto.map((r) => ({ name: monthShort(r.month), rate: r.income > 0 ? ((r.income - r.expense) / r.income) * 100 : null }));
    const monthSet = new Set(upto.map((r) => r.month));
    const perMonthBig = new Map<string, Map<string, number>>();
    const overall = new Map<string, number>();
    for (const m of upto) {
      const list = totalsByBig(transactions.filter((t) => t.date.startsWith(m.month)), categories, "EXPENSE");
      const mm = new Map<string, number>();
      for (const e of list) { mm.set(e.name, e.total); overall.set(e.name, (overall.get(e.name) || 0) + e.total); }
      perMonthBig.set(m.month, mm);
    }
    const topNames = [...overall.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
    const stackKeys = [...topNames.map((n, i) => ({ key: n, color: SERIES_COLORS[i] })), ...(overall.size > 6 ? [{ key: "Khác", color: OTHER_COLOR }] : [])];
    const stacked = upto.map((r) => {
      const mm = perMonthBig.get(r.month)!;
      const row: Record<string, number | string> = { name: monthShort(r.month) };
      let other = 0;
      for (const [n, v] of mm) { if (topNames.includes(n)) row[n] = v; else other += v; }
      if (other) row["Khác"] = other;
      return row;
    });

    // Cảnh báo nhanh (theo quy tắc, không gọi AI)
    const alerts: Alert[] = [];
    if (cur && cur.closing < 0) alerts.push({ level: "critical", text: `Số dư cuối kỳ đang âm ${vnd(-cur.closing)} — chi nhiều hơn tiền đang có.` });
    for (const e of expenses) {
      if (!e.budget) continue;
      const pct = Math.round((e.total / e.budget) * 100);
      if (pct > 100) alerts.push({ level: "critical", text: `${e.name}: đã chi ${vnd(e.total)}, vượt hạn mức ${vnd(e.total - e.budget)} (${pct}%).` });
      else if (pct >= 80) alerts.push({ level: "warning", text: `${e.name}: đã dùng ${pct}% hạn mức, còn ${vnd(e.budget - e.total)}.` });
    }
    if (cur && elapsed >= 5 && elapsed < N && cur.income > 0) {
      const projected = (cur.expense / elapsed) * N;
      if (projected > cur.income) alerts.push({ level: "warning", text: `Giữ nhịp chi hiện tại, cả tháng sẽ chi khoảng ${vnd(projected)} — nhiều hơn thu nhập ${vnd(cur.income)}.` });
    }
    for (const e of expenses) {
      const prev = prevExpenses.get(e.id);
      if (prev && e.total >= 200000 && e.total >= prev * 1.5) alerts.push({ level: "info", text: `${e.name} tăng ${Math.round((e.total / prev - 1) * 100)}% so với tháng trước (${vnd(prev)} → ${vnd(e.total)}).` });
    }
    if (month === todayMonth && transactions.length) {
      const lastDate = transactions.reduce((m, t) => (t.date > m ? t.date : m), "");
      const gap = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastDate}T00:00:00Z`)) / 86400000);
      if (gap >= 3) alerts.push({ level: "info", text: `Đã ${gap} ngày chưa ghi giao dịch nào — nhớ cập nhật để số liệu chính xác.` });
    }
    if (!alerts.length && expenses.length) alerts.push({ level: "success", text: "Chưa có cảnh báo — chi tiêu đang trong tầm kiểm soát." });

    // Hạn mức: mọi danh mục chi lớn có đặt hạn mức
    const budgets = categories
      .filter((c) => !c.parentId && c.type === "EXPENSE" && c.budget)
      .map((c) => ({ id: c.id, name: c.name, budget: c.budget as number, spent: expenses.find((e) => e.id === c.id)?.total || 0 }))
      .sort((a, b) => b.spent / b.budget - a.spent / a.budget);

    return {
      monthTx, expenses, incomes, cur, elapsed, N, donutExpense: toDonut(expenses), donutIncome: toDonut(incomes), subs, daily, cumulative,
      weekday: WEEKDAYS.map((name, i) => ({ name, total: perWeekday[i] })), totalBudget, cashflow, saving, stacked, stackKeys, alerts, budgets,
      multiMonth: monthSet.size > 1,
    };
  }, [data, month, rows]);

  const { cur } = calc;
  const hasExpense = calc.expenses.length > 0;
  const avgDay = cur && calc.elapsed ? cur.expense / calc.elapsed : 0;
  const projected = cur && calc.elapsed && calc.elapsed < calc.N ? avgDay * calc.N : null;

  return (
    <div className="space-y-6">
      {/* Cảnh báo + hạn mức */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Cảnh báo nhanh" subtitle="Tự tính theo quy tắc từ số liệu của bạn">
          {calc.alerts.length === 0 ? <Empty text="Ghi vài giao dịch để bắt đầu theo dõi." /> : (
            <ul className="space-y-2">
              {calc.alerts.map((a, i) => <li key={i} className={`rounded-xl border px-3 py-2 text-sm ${ALERT_STYLE[a.level]}`}>{a.text}</li>)}
            </ul>
          )}
          {projected !== null && (
            <p className="mt-3 text-sm text-muted">Chi trung bình <b className="text-foreground">{vnd(avgDay)}/ngày</b> → dự kiến cả tháng khoảng <b className="text-foreground">{vnd(projected)}</b>.</p>
          )}
        </SectionCard>

        <SectionCard title="Hạn mức chi theo danh mục" subtitle="Đặt hạn mức ở tab Danh mục để kiểm soát từng khoản">
          {calc.budgets.length === 0 ? <Empty text="Chưa đặt hạn mức nào. Vào tab Danh mục → bấm “Hạn mức” ở danh mục chi lớn." /> : (
            <ul className="space-y-3">
              {calc.budgets.map((b) => {
                const pct = (b.spent / b.budget) * 100;
                const color = pct > 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary";
                return (
                  <li key={b.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-semibold truncate">{b.name}</span>
                      <span className="shrink-0 text-xs text-muted">{vnd(b.spent)} / {vnd(b.budget)} · <b className={pct > 100 ? "text-red-600" : "text-foreground"}>{Math.round(pct)}%</b></span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Dòng tiền & số dư theo tháng" subtitle="Cột: thu và chi từng tháng · Đường cam: số dư cuối kỳ">
        <ChartBox><CashflowChart data={calc.cashflow} /></ChartBox>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Chi theo danh mục lớn" subtitle="Cơ cấu chi tiêu trong tháng">
          {hasExpense ? (
            <>
              <ChartBox height="h-64"><DonutChart data={calc.donutExpense} centerLabel="Tổng chi" /></ChartBox>
              <Legend items={calc.donutExpense} />
            </>
          ) : <Empty text="Tháng này chưa có khoản chi." />}
        </SectionCard>
        <SectionCard title="Thu theo danh mục" subtitle="Nguồn thu trong tháng">
          {calc.incomes.length ? (
            <>
              <ChartBox height="h-64"><DonutChart data={calc.donutIncome} centerLabel="Tổng thu" /></ChartBox>
              <Legend items={calc.donutIncome} />
            </>
          ) : <Empty text="Tháng này chưa có khoản thu." />}
        </SectionCard>
      </div>

      <SectionCard title="Top khoản chi theo danh mục nhỏ" subtitle="Tiền đang đi đâu nhiều nhất">
        {calc.subs.length ? <ChartBox height="h-80"><HorizontalBars data={calc.subs} /></ChartBox> : <Empty text="Chưa có dữ liệu." />}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Chi từng ngày" subtitle="Ngày nào tiêu nhiều bất thường?">
          {hasExpense ? <ChartBox><DailyBars data={calc.daily} /></ChartBox> : <Empty text="Chưa có dữ liệu." />}
        </SectionCard>
        <SectionCard title="Chi lũy kế trong tháng" subtitle="So với thu nhập (xanh đậm) và tổng hạn mức (đỏ)">
          {hasExpense ? <ChartBox><CumulativeChart data={calc.cumulative} budget={calc.totalBudget} income={cur?.income || 0} /></ChartBox> : <Empty text="Chưa có dữ liệu." />}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Chi theo thứ trong tuần" subtitle="Bạn hay tiêu vào ngày nào?">
          {hasExpense ? <ChartBox><WeekdayChart data={calc.weekday} /></ChartBox> : <Empty text="Chưa có dữ liệu." />}
        </SectionCard>
        <SectionCard title="Tỷ lệ tiết kiệm" subtitle="% thu nhập còn lại sau khi chi · đường xanh lá: mục tiêu 20%">
          {calc.saving.some((s) => s.rate !== null) ? <ChartBox><SavingRateChart data={calc.saving} /></ChartBox> : <Empty text="Cần có khoản thu để tính tỷ lệ tiết kiệm." />}
        </SectionCard>
      </div>

      {calc.multiMonth && (
        <SectionCard title="Chi theo danh mục qua các tháng" subtitle="Danh mục nào đang phình to?">
          <ChartBox height="h-80"><StackedMonthChart data={calc.stacked} keys={calc.stackKeys} /></ChartBox>
        </SectionCard>
      )}

      <p className="text-xs text-muted text-center">Giao dịch gần nhất: {calc.monthTx.length ? dayLabel(calc.monthTx.reduce((m, t) => (t.date > m ? t.date : m), "")) : "—"} · {calc.monthTx.length} giao dịch trong tháng</p>
    </div>
  );
}
