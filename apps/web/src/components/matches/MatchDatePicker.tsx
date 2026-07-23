"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  dateKeyLocal,
  formatDateHeader,
  formatStripDay,
  parseDateKey,
} from "./match-schedule-utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ key: string; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, -startPad + i + 1);
    cells.push({ key: dateKeyLocal(d), day: d.getDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({ key: dateKeyLocal(d), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const d = addDays(parseDateKey(last.key), 1);
    cells.push({ key: dateKeyLocal(d), day: d.getDate(), inMonth: false });
  }
  return cells;
}

export function MatchDatePicker({
  selectedKey,
  onSelect,
  matchDateKeys,
  onFetchMonthDates,
  stripRadius = 7,
  variant = "default",
  hideHeader = false,
  showMonthStrip = false,
}: {
  selectedKey: string;
  onSelect: (key: string) => void;
  matchDateKeys?: Set<string>;
  /** Load fixture-date highlights when the calendar opens or month changes. */
  onFetchMonthDates?: (year: number, monthIndex: number) => void;
  stripRadius?: number;
  variant?: "default" | "public";
  /** When parent renders its own date header bar. */
  hideHeader?: boolean;
  /** Planet Rugby-style Jan–Dec month carousel. */
  showMonthStrip?: boolean;
}) {
  const todayKey = dateKeyLocal(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseDateKey(selectedKey);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const stripRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const fetchedMonthsRef = useRef(new Set<string>());

  const selectedDate = useMemo(() => parseDateKey(selectedKey), [selectedKey]);
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();

  const stripDays = useMemo(() => {
    const days: string[] = [];
    for (let i = -stripRadius; i <= stripRadius; i++) {
      days.push(dateKeyLocal(addDays(selectedDate, i)));
    }
    return days;
  }, [selectedDate, stripRadius]);

  const closeCalendar = useCallback(() => setCalendarOpen(false), []);

  useEffect(() => {
    activeBtnRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selectedKey]);

  useEffect(() => {
    if (!calendarOpen) return;
    const d = parseDateKey(selectedKey);
    const year = d.getFullYear();
    const month = d.getMonth();
    setViewMonth((prev) => (prev.year === year && prev.month === month ? prev : { year, month }));
  }, [calendarOpen, selectedKey]);

  useEffect(() => {
    if (!onFetchMonthDates) return;
    const monthKey = `${selectedYear}-${selectedMonth}`;
    if (fetchedMonthsRef.current.has(monthKey)) return;
    fetchedMonthsRef.current.add(monthKey);
    onFetchMonthDates(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth, onFetchMonthDates]);

  useEffect(() => {
    if (!calendarOpen || !onFetchMonthDates) return;
    const monthKey = `${viewMonth.year}-${viewMonth.month}`;
    if (fetchedMonthsRef.current.has(monthKey)) return;
    fetchedMonthsRef.current.add(monthKey);
    onFetchMonthDates(viewMonth.year, viewMonth.month);
  }, [calendarOpen, viewMonth.year, viewMonth.month, onFetchMonthDates]);

  useEffect(() => {
    if (!calendarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCalendar();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [calendarOpen, closeCalendar]);

  const grid = monthGrid(viewMonth.year, viewMonth.month);
  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const hasFixtures = (key: string) => matchDateKeys?.has(key) ?? false;

  const monthsWithFixtures = useMemo(() => {
    const set = new Set<number>();
    if (!matchDateKeys) return set;
    for (const key of matchDateKeys) {
      if (!key.startsWith(`${selectedYear}-`)) continue;
      const month = Number(key.slice(5, 7)) - 1;
      if (month >= 0 && month <= 11) set.add(month);
    }
    return set;
  }, [matchDateKeys, selectedYear]);

  const jumpToMonth = (monthIndex: number) => {
    const today = new Date();
    const day =
      selectedYear === today.getFullYear() && monthIndex === today.getMonth()
        ? today.getDate()
        : 1;
    const lastDay = new Date(selectedYear, monthIndex + 1, 0).getDate();
    const safeDay = Math.min(day, lastDay);
    const mm = String(monthIndex + 1).padStart(2, "0");
    const dd = String(safeDay).padStart(2, "0");
    onSelect(`${selectedYear}-${mm}-${dd}`);
  };

  const rootClass = [
    "fixtures-date-picker",
    variant === "public" ? "fixtures-date-picker--public" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {showMonthStrip && (
        <div className="fixtures-month-strip" role="group" aria-label="Filter by month">
          {MONTHS.map((label, index) => {
            const active = selectedMonth === index;
            const withFixtures = monthsWithFixtures.has(index);
            return (
              <button
                key={label}
                type="button"
                className={[
                  "fixtures-month-pill",
                  active ? "fixtures-month-pill--active" : "",
                  withFixtures && !active ? "fixtures-month-pill--has-fixtures" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => jumpToMonth(index)}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {!hideHeader && (
        <button
          type="button"
          className="fixtures-date-picker__header"
          onClick={() => setCalendarOpen((open) => !open)}
          aria-haspopup="dialog"
          aria-expanded={calendarOpen}
        >
          <span>{formatDateHeader(selectedKey)}</span>
          <span className="fixtures-date-picker__cal-icon" aria-hidden>
            📅
          </span>
        </button>
      )}

      <div className="fixtures-date-strip" ref={stripRef} role="group" aria-label="Select date">
        {stripDays.map((key) => {
          const { top, bottom } = formatStripDay(key, todayKey);
          const active = key === selectedKey;
          const withFixtures = hasFixtures(key);
          return (
            <button
              key={key}
              ref={active ? activeBtnRef : undefined}
              type="button"
              className={[
                "fixtures-date-strip__day",
                active ? "fixtures-date-strip__day--active" : "",
                withFixtures ? "fixtures-date-strip__day--has-fixtures" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(key)}
              aria-pressed={active}
            >
              <span className="fixtures-date-strip__top">{top}</span>
              <span className="fixtures-date-strip__bottom">{bottom}</span>
            </button>
          );
        })}
      </div>

      {calendarOpen && (
        <>
          <button
            type="button"
            className="fixtures-calendar-dismiss"
            aria-label="Close calendar"
            onClick={closeCalendar}
          />
          <div
            ref={calendarRef}
            className="fixtures-calendar"
            role="dialog"
            aria-label="Choose date"
            aria-modal="true"
          >
            <div className="fixtures-calendar__nav">
              <button
                type="button"
                className="fixtures-calendar__arrow"
                onClick={() =>
                  setViewMonth((m) => {
                    const d = new Date(m.year, m.month - 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })
                }
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="fixtures-calendar__title">{monthLabel}</span>
              <button
                type="button"
                className="fixtures-calendar__arrow"
                onClick={() =>
                  setViewMonth((m) => {
                    const d = new Date(m.year, m.month + 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })
                }
                aria-label="Next month"
              >
                ›
              </button>
              <button
                type="button"
                className="fixtures-calendar__close"
                onClick={closeCalendar}
                aria-label="Close calendar"
              >
                ×
              </button>
            </div>
            <div className="fixtures-calendar__weekdays">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="fixtures-calendar__grid">
              {grid.map((cell) => {
                const active = cell.key === selectedKey;
                const isToday = cell.key === todayKey;
                const withFixtures = hasFixtures(cell.key);
                return (
                  <button
                    key={`${viewMonth.year}-${viewMonth.month}-${cell.key}`}
                    type="button"
                    className={[
                      "fixtures-calendar__day",
                      !cell.inMonth ? "fixtures-calendar__day--muted" : "",
                      withFixtures ? "fixtures-calendar__day--has-fixtures" : "",
                      active ? "fixtures-calendar__day--active" : "",
                      isToday ? "fixtures-calendar__day--today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      onSelect(cell.key);
                      closeCalendar();
                    }}
                    aria-pressed={active}
                    aria-label={`${cell.day}${withFixtures ? ", has fixtures" : ""}`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
