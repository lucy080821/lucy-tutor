"use client";
import dynamic from "next/dynamic";

// FullCalendar + 3 plugins are heavy (~250KB+). Load them only when the calendar tab actually
// renders, instead of pulling them into the dashboard/teacher page bundles on every navigation.
const CalendarView = dynamic(() => import("./CalendarView"), {
  ssr: false,
  loading: () => (
    <div className="ui-card p-6 space-y-3" aria-busy="true" aria-label="Đang tải lịch học">
      <div className="skeleton h-8 w-1/3" />
      <div className="skeleton h-[420px] w-full" />
    </div>
  ),
});

export default function CalendarComponent(props: {
  user: any;
  role: "STUDENT" | "TEACHER";
  classrooms?: any[];
}) {
  return <CalendarView {...props} />;
}
