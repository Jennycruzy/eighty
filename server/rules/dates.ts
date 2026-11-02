import type { DateRange } from "./types.ts";

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function validMonth(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}$/.test(value) &&
    validDate(`${value}-01`)
  );
}
export function addDays(value: string, days: number): string | null {
  const shifted = new Date(
    new Date(`${value}T00:00:00Z`).getTime() + days * 86_400_000,
  ).toISOString();
  return shifted.length === 24 ? shifted.slice(0, 10) : null;
}
export function shiftMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
export function monthBounds(month: string): { start: string; end: string } {
  const start = `${month}-01`;
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return { start, end: date.toISOString().slice(0, 10) };
}
export function validRange(range: DateRange): boolean {
  return (
    validDate(range.start) &&
    (range.end === null || (validDate(range.end) && range.end >= range.start))
  );
}
export function overlaps(
  range: DateRange,
  start: string,
  end: string,
): boolean {
  return range.start <= end && (range.end === null || range.end >= start);
}
export function monthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  const first = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1;
  const last = Number(end.slice(0, 4)) * 12 + Number(end.slice(5, 7)) - 1;
  for (let ordinal = first; ordinal <= last; ordinal++) {
    months.push(
      `${String(Math.floor(ordinal / 12)).padStart(4, "0")}-${String((ordinal % 12) + 1).padStart(2, "0")}`,
    );
  }
  return months;
}
