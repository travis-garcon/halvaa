"use client";

import { useEffect, useMemo, useState } from "react";
import { isValidJalaaliDate, jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";

type CalendarMode = "persian" | "gregorian";

type LocalizedDateInputProps = {
  id?: string;
  locale: string;
  value: string;
  onChange: (value: string) => void;
  labels: {
    persian: string;
    gregorian: string;
    year: string;
    month: string;
    day: string;
    converted: string;
    empty: string;
  };
};

const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function LocalizedDateInput({ id, locale, value, onChange, labels }: LocalizedDateInputProps) {
  const initialJalaali = useMemo(() => {
    const parsed = parseIsoDate(value);
    return parsed ? toJalaali(parsed.year, parsed.month, parsed.day) : toJalaali(new Date());
  }, [value]);
  const [mode, setMode] = useState<CalendarMode>("persian");
  const [jy, setJy] = useState(initialJalaali.jy);
  const [jm, setJm] = useState(initialJalaali.jm);
  const [jd, setJd] = useState(initialJalaali.jd);

  useEffect(() => {
    const parsed = parseIsoDate(value);
    if (!parsed) return;
    const next = toJalaali(parsed.year, parsed.month, parsed.day);
    setJy(next.jy);
    setJm(next.jm);
    setJd(next.jd);
  }, [value]);

  const years = useMemo(() => {
    const currentYear = toJalaali(new Date()).jy;
    return Array.from({ length: currentYear - 1199 }, (_, index) => currentYear - index);
  }, []);
  const maxDay = jalaaliMonthLength(jy, jm);
  const days = Array.from({ length: maxDay }, (_, index) => index + 1);

  const updatePersianDate = (nextYear: number, nextMonth: number, nextDay: number) => {
    const safeDay = Math.min(nextDay, jalaaliMonthLength(nextYear, nextMonth));
    setJy(nextYear);
    setJm(nextMonth);
    setJd(safeDay);
    if (!isValidJalaaliDate(nextYear, nextMonth, safeDay)) return;
    const converted = toGregorian(nextYear, nextMonth, safeDay);
    onChange(`${converted.gy}-${pad(converted.gm)}-${pad(converted.gd)}`);
  };

  if (locale !== "fa") {
    return <input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />;
  }

  return (
    <div className="localized-date-input">
      <div className="calendar-mode-tabs" role="tablist" aria-label={labels.persian}>
        <button type="button" role="tab" aria-selected={mode === "persian"} onClick={() => setMode("persian")} className={mode === "persian" ? "is-active" : ""}>
          {labels.persian}
        </button>
        <button type="button" role="tab" aria-selected={mode === "gregorian"} onClick={() => setMode("gregorian")} className={mode === "gregorian" ? "is-active" : ""}>
          {labels.gregorian}
        </button>
      </div>
      {mode === "gregorian" ? (
        <input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
      ) : (
        <div className="persian-date-grid">
          <select aria-label={labels.day} value={jd} onChange={(event) => updatePersianDate(jy, jm, Number(event.target.value))}>
            {days.map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
          <select aria-label={labels.month} value={jm} onChange={(event) => updatePersianDate(jy, Number(event.target.value), jd)}>
            {PERSIAN_MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
          <select aria-label={labels.year} value={jy} onChange={(event) => updatePersianDate(Number(event.target.value), jm, jd)}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        {labels.converted}: {value || labels.empty}
      </p>
    </div>
  );
}

