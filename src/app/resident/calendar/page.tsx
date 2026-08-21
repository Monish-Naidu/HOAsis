import { CalendarView } from "@/components/app/calendar-view";
import { calendarEntries } from "@/lib/data";

export const metadata = { title: "Calendar" };

export default function ResidentCalendar() {
  return (
    <div className="animate-rise">
      <h1 className="mb-4 text-[22px] font-semibold tracking-[-0.025em] text-fg">Calendar</h1>
      <CalendarView entries={calendarEntries()} />
    </div>
  );
}
