"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  setMonth,
  setYear,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Lightweight month-grid calendar with month + year dropdowns for fast
 * navigation (important for dates of birth). Token-driven, no external
 * day-picker dependency — just date-fns for the date maths.
 */
function Calendar({
  value,
  onSelect,
  fromYear = 1920,
  toYear = new Date().getFullYear(),
}: {
  value: Date | null;
  onSelect: (date: Date) => void;
  fromYear?: number;
  toYear?: number;
}) {
  const [view, setView] = React.useState<Date>(() =>
    startOfMonth(value ?? new Date(toYear - 25, 0, 1)),
  );

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(view), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(view), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [view]);

  const monthItems = MONTHS.map((m, i) => ({ value: String(i), label: m }));
  const yearItems = React.useMemo(() => {
    const arr: { value: string; label: string }[] = [];
    for (let y = toYear; y >= fromYear; y--) arr.push({ value: String(y), label: String(y) });
    return arr;
  }, [fromYear, toYear]);

  return (
    <div className="w-[17.5rem]">
      {/* Header — month + year dropdowns with prev/next arrows */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setView((v) => subMonths(v, 1))}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>

        <Select
          items={monthItems}
          value={String(view.getMonth())}
          onValueChange={(v) => setView((d) => setMonth(startOfMonth(d), Number(v)))}
        >
          <SelectTrigger className="h-8 flex-1 data-[size=default]:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthItems.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={yearItems}
          value={String(view.getFullYear())}
          onValueChange={(v) => setView((d) => setYear(startOfMonth(d), Number(v)))}
        >
          <SelectTrigger className="h-8 w-[5.25rem] data-[size=default]:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearItems.map((y) => (
              <SelectItem key={y.value} value={y.value}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          aria-label="Next month"
          onClick={() => setView((v) => addMonths(v, 1))}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="mt-3 grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className="grid h-8 place-items-center text-[11px] font-medium text-muted-foreground"
          >
            {w}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const selected = value ? isSameDay(day, value) : false;
          const outside = !isSameMonth(day, view);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                "grid size-9 cursor-pointer place-items-center rounded-lg text-sm tabular-nums transition-colors",
                selected
                  ? "bg-primary font-semibold text-primary-foreground hover:bg-primary"
                  : "hover:bg-muted",
                !selected && outside && "text-muted-foreground/40",
                !selected && !outside && isToday(day) && "ring-1 ring-primary/40",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { Calendar };
