import { income, month, state } from "./fixtures.mjs";
const citation = "42 CFR 435.552(a)(6), (f)(2); 435.603(e)";
const wage = (patch = {}) => ({
  basis: "taxable-wages",
  grossPayCents: 68000,
  preTaxDeductionsCents: 10000,
  confirmed: true,
  ...patch,
});
const gig = (patch = {}) => ({
  basis: "self-employment",
  netEarningsCents: 58000,
  costsConfirmed: true,
  confirmed: true,
  ...patch,
});
const item = (
  id,
  title,
  facts,
  expected,
  rule = "incomeTest",
  args = [facts],
) => ({ id, title, citation, rule, args, expected });
export const confirmedIncomeCases = [
  item(
    "wages-at-line",
    "Confirmed taxable wages meet exactly at $580",
    wage(),
    {
      status: "Meets",
      math: { amountCents: 58000, stateCountMayDiffer: true },
    },
  ),
  item(
    "wages-below-line",
    "Pre-tax deductions put wages one cent below the line",
    wage({ preTaxDeductionsCents: 10001 }),
    { status: "Short", math: { amountCents: 57999 } },
  ),
  item(
    "wages-zero-deductions",
    "Confirmed zero pre-tax deductions use gross wages",
    wage({ grossPayCents: 58000, preTaxDeductionsCents: 0 }),
    { status: "Meets", math: { amountCents: 58000 } },
  ),
  item(
    "wages-zero-pay",
    "Confirmed zero wages do not meet",
    wage({ grossPayCents: 0, preTaxDeductionsCents: 0 }),
    { status: "Short" },
  ),
  item(
    "wages-unconfirmed",
    "Proposed wage details cannot meet",
    wage({ confirmed: false }),
    { status: "Not sure yet", missingIncludes: ["income.confirmed"] },
  ),
  item(
    "wages-too-many-deductions",
    "Deductions greater than gross pay need review",
    wage({ preTaxDeductionsCents: 68001 }),
    {
      status: "Not sure yet",
      missingIncludes: ["income.preTaxDeductionsCents"],
    },
  ),
  item(
    "gig-confirmed-net",
    "Confirmed gig net earnings after costs meet",
    gig(),
    { status: "Meets", math: { amountCents: 58000, costsConfirmed: true } },
  ),
  item(
    "gig-net-below",
    "Gig net earnings below the line are Short",
    gig({ netEarningsCents: 57999 }),
    { status: "Short" },
  ),
  item(
    "gig-loss",
    "Confirmed business loss does not meet",
    gig({ netEarningsCents: -10000 }),
    { status: "Short", math: { amountCents: -10000 } },
  ),
  item(
    "gig-unconfirmed-costs",
    "Net amount without confirmed costs stays unsure",
    gig({ costsConfirmed: false }),
    { status: "Not sure yet", missingIncludes: ["income.costsConfirmed"] },
  ),
  item(
    "gig-gross-only",
    "Gig gross receipts alone cannot meet",
    { basis: "self-employment", amountCents: 100000, confirmed: true },
    {
      status: "Not sure yet",
      missingIncludes: ["income.netEarningsCents", "income.costsConfirmed"],
    },
  ),
  item(
    "gig-net-unconfirmed",
    "Proposed net earnings do not count",
    gig({ confirmed: false }),
    { status: "Not sure yet", missingIncludes: ["income.confirmed"] },
  ),
];
for (const field of ["grossPayCents", "preTaxDeductionsCents"]) {
  for (const [label, value] of [
    ["missing", undefined],
    ["negative", -1],
    ["fractional-cent", 1.5],
    ["overflow", Number.MAX_SAFE_INTEGER + 1],
  ]) {
    confirmedIncomeCases.push(
      item(
        `wages-${field}-${label}`,
        `Wages need valid ${field}: ${label}`,
        wage({ [field]: value }),
        { status: "Not sure yet", missingIncludes: [`income.${field}`] },
      ),
    );
  }
}
for (const [label, value] of [
  ["missing", undefined],
  ["fractional", 0.5],
  ["overflow", Number.MAX_SAFE_INTEGER + 1],
]) {
  confirmedIncomeCases.push(
    item(
      `gig-net-${label}`,
      `Net earnings need whole valid cents: ${label}`,
      gig({ netEarningsCents: value }),
      { status: "Not sure yet", missingIncludes: ["income.netEarningsCents"] },
    ),
  );
}
confirmedIncomeCases.push(
  item(
    "month-confirmed-stub",
    "Confirmed taxable wages can establish a Meets month",
    null,
    { status: "Meets" },
    "assessMonth",
    [month({ income: income(wage()) })],
  ),
  item(
    "month-gig-before-costs",
    "A month with gross gig earnings alone stays unsure",
    null,
    { status: "Not sure yet", missingIncludes: ["income.costsConfirmed"] },
    "assessMonth",
    [month({ income: income(gig({ costsConfirmed: false })) })],
  ),
  item(
    "derived-wages-below-line",
    "State income-derived hours use taxable wages after deductions",
    null,
    { status: "Short", hours: 40 },
    "incomeDerivedHours",
    [
      state({ incomeDerivedHours: true }),
      income(
        wage({
          amountCents: undefined,
          grossPayCents: 39000,
          preTaxDeductionsCents: 10000,
        }),
      ),
    ],
  ),
  item(
    "derived-wages-at-line",
    "Taxable wages at threshold use income instead of derived hours",
    null,
    { status: "Not sure yet", hours: 0, matched: false },
    "incomeDerivedHours",
    [
      state({ incomeDerivedHours: true }),
      income(wage({ amountCents: undefined })),
    ],
  ),
);

confirmedIncomeCases.push(
  item(
    "derived-wage-gross-is-not-count",
    "Gross wage total cannot replace the after-deduction count",
    null,
    { status: "Short", hours: 40 },
    "incomeDerivedHours",
    [
      state({ incomeDerivedHours: true }),
      income({
        basis: "taxable-wages",
        amountCents: 100000,
        grossPayCents: 100000,
        preTaxDeductionsCents: 71000,
        confirmed: true,
      }),
    ],
  ),
  item(
    "derived-gig-gross-is-not-net",
    "Gig gross receipts cannot replace confirmed net earnings",
    null,
    { status: "Short", hours: 40 },
    "incomeDerivedHours",
    [
      state({ incomeDerivedHours: true }),
      income({
        basis: "self-employment",
        amountCents: 100000,
        netEarningsCents: 29000,
        costsConfirmed: true,
        confirmed: true,
      }),
    ],
  ),
);
