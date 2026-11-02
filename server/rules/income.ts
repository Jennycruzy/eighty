import { cents, finding, result, units } from "./common.ts";
import {
  FEDERAL_WAGE,
  HOUR_SCALE,
  REQUIRED_HOURS,
  REQUIRED_INCOME_CENTS,
} from "./constants.ts";
import { shiftMonth, validMonth } from "./dates.ts";
import type {
  DerivedIncomeFacts,
  IncomeFacts,
  SeasonalFacts,
  StateOptions,
} from "./types.ts";

export function incomeTest(facts: IncomeFacts) {
  const citation = "42 CFR 435.552(a)(6), (f)(1)–(2)";
  const missing: string[] = [];
  if (!cents(facts.amountCents)) missing.push("income.amountCents");
  if (facts.confirmed !== true) missing.push("income.confirmed");
  if (facts.basis !== "medicaid-magi" && facts.basis !== "pay-shown")
    missing.push("income.basis");
  if (missing.length)
    return finding(
      null,
      "Confirm the monthly income and how it was counted.",
      citation,
      missing,
    );
  const matched = (facts.amountCents as number) >= REQUIRED_INCOME_CENTS;
  if (facts.basis === "pay-shown")
    return finding(
      null,
      "This is pay you showed us. Confirm the Medicaid income count before relying on this test.",
      citation,
      ["income.medicaidMagiCount"],
      {
        payShownCents: facts.amountCents,
        thresholdCents: REQUIRED_INCOME_CENTS,
        payAtOrAboveThreshold: matched,
        stateCountMayDiffer: true,
      },
    );
  return {
    ...result(
      matched ? "Meets" : "Short",
      "Use the Medicaid MAGI-based monthly income count.",
      citation,
      {
        amountCents: facts.amountCents,
        thresholdCents: REQUIRED_INCOME_CENTS,
        hourlyWageCents: FEDERAL_WAGE.cents,
        hours: REQUIRED_HOURS,
        stateCountMayDiffer: false,
      },
    ),
    matched,
  };
}

export function seasonalIncomeTest(month: string, facts: SeasonalFacts) {
  const citation = "42 CFR 435.552(a)(7), (g)(1)–(2)";
  if (!validMonth(month))
    return finding(null, "Check the month.", citation, ["month"]);
  if (facts.qualifiesUnder45R === false)
    return finding(
      false,
      "This test applies only to a qualifying seasonal worker.",
      citation,
    );
  const missing: string[] = [];
  if (facts.qualifiesUnder45R !== true)
    missing.push("seasonal.qualifiesUnder45R");
  const required = Array.from({ length: 6 }, (_, i) =>
    shiftMonth(month, i - 6),
  );
  const records = facts.months;
  let sum = 0n;
  for (const requiredMonth of required) {
    const matches = records?.filter((item) => item.month === requiredMonth);
    if (
      !matches ||
      matches.length !== 1 ||
      !cents(matches[0]?.amountCents) ||
      matches[0].confirmed !== true
    )
      missing.push(`seasonal.months.${requiredMonth}`);
    else if (matches[0].basis !== "medicaid-magi")
      missing.push(`seasonal.months.${requiredMonth}.medicaidMagiCount`);
    else sum += BigInt(matches[0].amountCents);
  }
  if (
    sum > BigInt(Number.MAX_SAFE_INTEGER) ||
    sum < BigInt(Number.MIN_SAFE_INTEGER)
  )
    missing.push("seasonal.totalIncome");
  if (missing.length)
    return finding(
      null,
      "Confirm seasonal status and all six prior months, including zero-pay months.",
      citation,
      missing,
    );
  const total = Number(sum);
  const matched = total >= REQUIRED_INCOME_CENTS * 6;
  return {
    ...result(
      matched ? "Meets" : "Short",
      "The seasonal test uses all six months before this month.",
      citation,
      {
        months: required,
        totalCents: total,
        divisor: 6,
        averageCents: total / 6,
        thresholdCents: REQUIRED_INCOME_CENTS,
      },
    ),
    matched,
  };
}

export function incomeDerivedHours(
  state: StateOptions,
  facts: DerivedIncomeFacts,
) {
  const citation = "42 CFR 435.552(e)(2)(i)–(ii)";
  const finish = (
    matched: boolean | null,
    hours: number | null,
    basis: string,
    missing: string[] = [],
  ) => ({
    ...finding(
      matched,
      basis,
      citation,
      missing,
      { hours, hourlyWageCents: FEDERAL_WAGE.cents },
      "Short",
    ),
    hours,
  });
  if (facts.hoursDocumented === true)
    return finish(
      false,
      0,
      "Use the recorded work hours. Do not add hours from the same pay.",
    );
  if (cents(facts.amountCents) && facts.amountCents >= REQUIRED_INCOME_CENTS)
    return finish(
      false,
      0,
      "Use the monthly income test at or above the income line.",
    );
  if (state.verified !== true)
    return finish(null, null, "Confirm the state option.", ["state.verified"]);
  if (state.incomeDerivedHours === false)
    return finish(false, 0, "This state does not use hours from income.");
  const missing: string[] = [];
  if (state.incomeDerivedHours !== true)
    missing.push("state.incomeDerivedHours");
  if (facts.hoursDocumented !== false) missing.push("income.hoursDocumented");
  const counted = incomeTest(facts);
  missing.push(...counted.missing);
  if (
    !Number.isInteger(facts.householdWorkers) ||
    (facts.householdWorkers as number) < 1
  )
    missing.push("income.householdWorkers");
  if (missing.length)
    return finish(
      null,
      null,
      "More facts are needed before the state can count hours from income.",
      missing,
    );
  if ((facts.amountCents as number) < 0)
    return finish(
      null,
      null,
      "A loss cannot establish work hours. Use a record of hours.",
      ["income.actualHours"],
    );
  const potentialUnits = Math.floor(
    ((facts.amountCents as number) * HOUR_SCALE) / FEDERAL_WAGE.cents,
  );
  if ((facts.householdWorkers as number) > 1) {
    const allocated = units(facts.stateAllocatedHours, HOUR_SCALE);
    if (
      facts.allocationVerified !== true ||
      allocated === null ||
      allocated > potentialUnits
    )
      return finish(
        null,
        null,
        "The state must split household hours in a reasonable way.",
        ["income.stateAllocation"],
      );
    return finish(
      true,
      allocated / HOUR_SCALE,
      "These hours use the state-verified household allocation.",
    );
  }
  return finish(
    true,
    potentialUnits / HOUR_SCALE,
    "Your state may count this pay as work hours. It uses pay divided by the federal wage.",
  );
}
