export const RULE_VERSION = "42-CFR-435-2026-10-29";
export const FEDERAL_WAGE = Object.freeze({
  cents: 725,
  effectiveFrom: "2009-07-24",
  citation: "29 USC 206(a)(1)(C)",
});
export const REQUIRED_HOURS = 80;
export const REQUIRED_INCOME_CENTS = FEDERAL_WAGE.cents * REQUIRED_HOURS;
export const HOUR_SCALE = 1_000_000;
