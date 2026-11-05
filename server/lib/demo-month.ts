import { assessMonth } from "../rules/assess-month.ts";
import { shiftMonth } from "../rules/dates.ts";
import type { DemoFacts } from "./demo-people.ts";
import { monthInput as demoMonthInput, type SavedLine } from "./month-input.ts";
export {
  monthInput as demoMonthInput,
  incomeFacts,
  type SavedLine,
} from "./month-input.ts";

export function assessDemoMonths(
  facts: DemoFacts,
  lines: SavedLine[],
  asOf: string,
) {
  const month = asOf.slice(0, 7);
  const summary = (target: string) => {
    const result = assessMonth(demoMonthInput(facts, lines, target, asOf));
    const math = result.math ?? {};
    return {
      month: target,
      status: result.status,
      basis: result.basis,
      citation: result.citation,
      ruleVersion: result.ruleVersion,
      hours: typeof math.hours === "number" ? math.hours : null,
      targetHours: typeof math.targetHours === "number" ? math.targetHours : 80,
      amountCents:
        typeof math.amountCents === "number" ? math.amountCents : null,
      missing: result.missing,
    };
  };
  return {
    asOf,
    thisMonth: summary(month),
    lastMonth: summary(shiftMonth(month, -1)),
  };
}
