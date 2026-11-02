import type { Finding, Flag, RuleResult, Status } from "./types.ts";

export function result(
  status: Status,
  basis: string,
  citation: string,
  math: Record<string, unknown> | null = {},
  missing: string[] = [],
): RuleResult {
  return { status, basis, citation, math, missing: [...new Set(missing)] };
}
export function finding(
  matched: Flag,
  basis: string,
  citation: string,
  missing: string[] = [],
  math: Record<string, unknown> = {},
  positive: Status = "Not sure yet",
): Finding {
  return {
    ...result(
      matched === true ? positive : "Not sure yet",
      basis,
      citation,
      math,
      missing,
    ),
    matched,
  };
}
export interface Condition {
  value: Flag;
  missing: string[];
}
export function flag(value: unknown, name: string): Condition {
  return typeof value === "boolean"
    ? { value, missing: [] }
    : { value: null, missing: [name] };
}
export function all(conditions: Condition[]): Condition {
  if (conditions.some((item) => item.value === false))
    return { value: false, missing: [] };
  const missing = conditions.flatMap((item) => item.missing);
  return {
    value: conditions.every((item) => item.value === true) ? true : null,
    missing,
  };
}
export function any(conditions: Condition[]): Condition {
  if (conditions.some((item) => item.value === true))
    return { value: true, missing: [] };
  return {
    value: conditions.every((item) => item.value === false) ? false : null,
    missing: conditions.flatMap((item) => item.missing),
  };
}
export function negate(condition: Condition): Condition {
  return {
    ...condition,
    value: condition.value === null ? null : !condition.value,
  };
}
export function units(value: unknown, scale: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return null;
  const scaled = value * scale;
  const rounded = Math.round(scaled);
  if (
    !Number.isSafeInteger(rounded) ||
    Math.abs(rounded - scaled) >
      Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4
  )
    return null;
  return rounded;
}
export function cents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}
