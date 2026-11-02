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
  Finding,
  IncomeFacts,
  SeasonalFacts,
  StateOptions,
} from "./types.ts";

export function incomeTest(facts: IncomeFacts): Finding {
  const wageCitation = "42 CFR 435.552(a)(6), (f)(2); 435.603(e)";
  if (facts.basis === "taxable-wages") {
    const missing: string[] = [];
    if (!cents(facts.grossPayCents) || facts.grossPayCents < 0)
      missing.push("income.grossPayCents");
    if (!cents(facts.preTaxDeductionsCents) || facts.preTaxDeductionsCents < 0)
      missing.push("income.preTaxDeductionsCents");
    if (missing.length)
      return finding(
        null,
        "Check gross pay and the pre-tax deductions shown on the stub.",
        wageCitation,
        missing,
      );
    if (facts.preTaxDeductionsCents! > facts.grossPayCents!)
      return finding(
        null,
        "The pre-tax deductions exceed gross pay. Check the stub.",
        wageCitation,
        ["income.preTaxDeductionsCents"],
      );
    const amountCents = facts.grossPayCents! - facts.preTaxDeductionsCents!;
    const counted = incomeTest({
      ...facts,
      amountCents,
      basis: "medicaid-magi",
    });
    return {
      ...counted,
      citation: wageCitation,
      basis: "Pay you showed us; the state may count it differently.",
      math: {
        ...counted.math,
        grossPayCents: facts.grossPayCents,
        preTaxDeductionsCents: facts.preTaxDeductionsCents,
        stateCountMayDiffer: true,
      },
    };
  }
  if (facts.basis === "self-employment") {
    const missing: string[] = [];
    if (!cents(facts.netEarningsCents)) missing.push("income.netEarningsCents");
    if (facts.costsConfirmed !== true) missing.push("income.costsConfirmed");
    if (missing.length)
      return finding(
        null,
        "Confirm net earnings after business costs. A gig screenshot alone is not enough.",
        wageCitation,
        missing,
      );
    const counted = incomeTest({
      ...facts,
      amountCents: facts.netEarningsCents as number,
      basis: "medicaid-magi",
    });
    return {
      ...counted,
      citation: wageCitation,
      basis: "Pay you showed us; the state may count it differently.",
      math: {
        ...counted.math,
        costsConfirmed: true,
        stateCountMayDiffer: true,
      },
    };
  }
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
  const counted = incomeTest(facts);
  if (counted.matched === true)
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
  const amountCents = counted.math?.amountCents as number;
  if (amountCents < 0)
    return finish(
      null,
      null,
      "A loss cannot establish work hours. Use a record of hours.",
      ["income.actualHours"],
    );
  const potentialUnits = Math.floor(
    (amountCents * HOUR_SCALE) / FEDERAL_WAGE.cents,
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
