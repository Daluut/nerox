import type { DateOnly } from "./types";

/**
 * Calendar-date helpers.
 *
 * Deadlines and due dates are stored as Postgres `date` values and handled here as
 * "YYYY-MM-DD" strings. They are never converted through the viewer's local timezone,
 * so a deadline of 2026-11-02 stays 2026-11-02 wherever it is displayed. "Today" is
 * resolved in the workspace's timezone.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isValidDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function toUtcMs(date: DateOnly): number {
  if (!isValidDateOnly(date)) throw new Error(`Invalid date: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): DateOnly {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: DateOnly, b: DateOnly): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

export function addDays(date: DateOnly, days: number): DateOnly {
  return fromUtcMs(toUtcMs(date) + Math.round(days) * DAY_MS);
}

export function compareDates(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxDate(...dates: (DateOnly | null | undefined)[]): DateOnly | null {
  const valid = dates.filter((d): d is DateOnly => !!d);
  return valid.length ? valid.reduce((m, d) => (d > m ? d : m)) : null;
}

export function minDate(...dates: (DateOnly | null | undefined)[]): DateOnly | null {
  const valid = dates.filter((d): d is DateOnly => !!d);
  return valid.length ? valid.reduce((m, d) => (d < m ? d : m)) : null;
}

/** The calendar date of `instant` in the given IANA timezone. */
export function todayInTimeZone(timeZone: string, instant: Date = new Date()): DateOnly {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

/** Calendar date of an ISO timestamp in a timezone. */
export function dateOfTimestamp(iso: string, timeZone: string): DateOnly {
  return todayInTimeZone(timeZone, new Date(iso));
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Oct" or "12 Oct 2027" when the year differs from `today`'s. */
export function formatDate(date: DateOnly | null | undefined, today?: DateOnly): string {
  if (!date || !isValidDateOnly(date)) return "—";
  const [y, m, d] = date.split("-").map(Number);
  const showYear = !today || today.slice(0, 4) !== String(y);
  return `${d} ${MONTHS[m - 1]}${showYear ? ` ${y}` : ""}`;
}

/** "today", "tomorrow", "in 4 days", "3 days ago". */
export function relativeDay(date: DateOnly, today: DateOnly): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

/** Linear position (0–1) of a date along the interval [start, end]. */
export function fractionOfInterval(date: DateOnly, start: DateOnly, end: DateOnly): number {
  const total = daysBetween(start, end);
  if (total <= 0) return date >= end ? 1 : 0;
  return Math.min(1, Math.max(0, daysBetween(start, date) / total));
}

/** "1 day late", "5 days late". */
export const lateLabel = (days: number) => `${days} ${days === 1 ? "day" : "days"} late`;
