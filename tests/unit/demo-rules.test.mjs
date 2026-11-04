import assert from "node:assert/strict";
import test from "node:test";

import {
  assessDemoMonths,
  demoMonthInput,
} from "../../server/lib/demo-month.ts";
import {
  DEMO_PROFILES,
  MARIA,
  mariaSampleFields,
} from "../../server/lib/demo-people.ts";
import {
  assessMonth,
  combineHours,
  educationHours,
  incomeTest,
} from "../../server/rules/index.ts";

// Seeded lines as they are after start_demo: proposed v1, confirmed v2.
function seeded(person, asOf) {
  return DEMO_PROFILES[person].lines(asOf).map((line, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    version: line.confirm ? 2 : 1,
    status: line.confirm ? "confirmed" : "proposed",
    fields: line.fields,
  }));
}
// Mid-month, the first day of a month and the last day of a long month.
const days = ["2026-11-04", "2026-12-01", "2027-01-31", "2028-02-29"];

for (const asOf of days) {
  test(`Maria is Short with exactly 61 confirmed hours on ${asOf}`, () => {
    const facts = DEMO_PROFILES.maria.facts;
    const lines = seeded("maria", asOf);
    const input = demoMonthInput(facts, lines, asOf.slice(0, 7), asOf);
    const result = assessMonth(input);
    assert.equal(result.status, "Short");
    assert.equal(result.math.hours, 61);
    assert.equal(result.math.work, MARIA.deliveryHours);
    assert.equal(result.math.service, MARIA.pantryHours);
    assert.equal(result.math.gapHours, 19);
    assert.deepEqual(result.missing, []);
    assert.equal(result.citation, "42 CFR 435.552(a), (e)–(g)");
    // The hours alone, through the hour rule, are the same 61.
    const hours = combineHours(input);
    assert.equal(hours.status, "Short");
    assert.equal(hours.hours, 61);
    const months = assessDemoMonths(facts, lines, asOf);
    assert.equal(months.thisMonth.status, "Short");
    assert.equal(months.thisMonth.hours, 61);
    assert.equal(months.lastMonth.status, "Meets");
    assert.equal(months.lastMonth.hours, 84);
  });

  test(`Maria's month meets through net pay once the sample is confirmed on ${asOf}`, () => {
    const facts = DEMO_PROFILES.maria.facts;
    const sample = {
      id: "00000000-0000-4000-8000-0000000000aa",
      version: 2,
      status: "confirmed",
      fields: mariaSampleFields(asOf),
    };
    const lines = [...seeded("maria", asOf), sample];
    const result = assessMonth(
      demoMonthInput(facts, lines, asOf.slice(0, 7), asOf),
    );
    assert.equal(result.status, "Meets");
    assert.equal(result.citation, "42 CFR 435.552(a)(6), (f)(2); 435.603(e)");
    assert.equal(result.math.amountCents, MARIA.sample.netCents);
    assert.equal(result.math.costsConfirmed, true);
    assert.equal(
      incomeTest({
        basis: "self-employment",
        confirmed: true,
        netEarningsCents: MARIA.sample.netCents,
        costsConfirmed: true,
      }).status,
      "Meets",
    );
    // Proposed, it does not count yet.
    const proposed = assessMonth(
      demoMonthInput(
        facts,
        [
          ...seeded("maria", asOf),
          { ...sample, version: 1, status: "proposed" },
        ],
        asOf.slice(0, 7),
        asOf,
      ),
    );
    assert.equal(proposed.status, "Not sure yet");
    assert.ok(proposed.missing.includes("income.confirmed"));
  });
}

test("The sample's numbers: net is what counts, never gross alone", () => {
  const { deliveryPayCents, tipsCents, totalCents, costsCents, netCents } =
    MARIA.sample;
  assert.equal(deliveryPayCents + tipsCents, totalCents);
  assert.equal(totalCents - costsCents, netCents);
  assert.ok(netCents >= 58000, "net pay reaches the $580 line");
  assert.ok(totalCents > netCents);
  const asOf = "2026-11-04";
  const grossOnly = {
    id: "00000000-0000-4000-8000-0000000000ab",
    version: 2,
    status: "confirmed",
    fields: {
      ...mariaSampleFields(asOf),
      income: {
        kind: "self-employment",
        receivedOn: asOf,
        grossPayCents: totalCents,
      },
    },
  };
  const result = assessMonth(
    demoMonthInput(
      DEMO_PROFILES.maria.facts,
      [...seeded("maria", asOf), grossOnly],
      "2026-11",
      asOf,
    ),
  );
  assert.equal(result.status, "Not sure yet");
  assert.ok(result.missing.includes("income.netEarningsCents"));
  assert.ok(result.missing.includes("income.costsConfirmed"));
  // Costs not yet answered: still not counted.
  const unanswered = assessMonth(
    demoMonthInput(
      DEMO_PROFILES.maria.facts,
      [
        ...seeded("maria", asOf),
        {
          ...grossOnly,
          fields: {
            ...grossOnly.fields,
            income: { ...grossOnly.fields.income, netEarningsCents: netCents },
          },
        },
      ],
      "2026-11",
      asOf,
    ),
  );
  assert.equal(unanswered.status, "Not sure yet");
  assert.deepEqual(unanswered.missing, ["income.costsConfirmed"]);
});

for (const asOf of days) {
  test(`Daniel meets through 77.94 school hours plus his job on ${asOf}`, () => {
    const lines = seeded("daniel", asOf);
    const input = demoMonthInput(
      DEMO_PROFILES.daniel.facts,
      lines,
      asOf.slice(0, 7),
      asOf,
    );
    const school = educationHours(input.month, asOf, input.education);
    assert.equal(school.hours, 77.94);
    assert.equal(school.citation, "42 CFR 435.552(d)(1)(i)–(ii)");
    const result = assessMonth(input);
    assert.equal(result.status, "Meets");
    assert.equal(result.math.education, 77.94);
    assert.equal(result.math.work, 5);
    assert.equal(result.math.hours, 82.94);
    const months = assessDemoMonths(DEMO_PROFILES.daniel.facts, lines, asOf);
    assert.equal(months.lastMonth.status, "Meets");
    assert.equal(months.lastMonth.hours, 97.94);
  });

  test(`Rosa is exempt as a family caregiver on ${asOf}`, () => {
    const result = assessMonth(
      demoMonthInput(DEMO_PROFILES.rosa.facts, [], asOf.slice(0, 7), asOf),
    );
    assert.equal(result.status, "Exempt");
    assert.equal(result.citation, "42 CFR 435.554(c)(3)(i)(A)");
    assert.deepEqual(result.missing, []);
  });
}

test("Seed lines never carry a date after the day they are made", () => {
  for (const person of ["maria", "daniel", "rosa"])
    for (const asOf of days)
      for (const line of DEMO_PROFILES[person].lines(asOf))
        if (line.fields.kind !== "education")
          assert.ok(line.fields.end <= asOf, `${person} ${line.fields.end}`);
});

test("A proposed or mixed pay line never counts as income", async () => {
  const { incomeFacts } = await import("../../server/lib/demo-month.ts");
  const facts = { evidenceComplete: true, householdWorkers: 1 };
  const pay = (status, kind, extra = {}) => ({
    id: "x",
    version: 1,
    status,
    fields: {
      kind: "income",
      organization: "Made up",
      income: { kind, receivedOn: "2026-11-02", ...extra },
    },
  });
  assert.equal(
    incomeTest(incomeFacts([pay("proposed", "wages")], "2026-11", facts))
      .status,
    "Not sure yet",
  );
  assert.equal(
    incomeTest(
      incomeFacts(
        [
          pay("confirmed", "wages", {
            grossPayCents: 70000,
            preTaxDeductionsCents: 0,
          }),
          pay("confirmed", "self-employment", {
            netEarningsCents: 70000,
            costsConfirmed: true,
          }),
        ],
        "2026-11",
        facts,
      ),
    ).status,
    "Not sure yet",
  );
  assert.equal(
    incomeTest(
      incomeFacts(
        [
          pay("confirmed", "wages", {
            grossPayCents: 40000,
            preTaxDeductionsCents: 1000,
          }),
          pay("confirmed", "wages", {
            grossPayCents: 30000,
            preTaxDeductionsCents: 1000,
          }),
        ],
        "2026-11",
        facts,
      ),
    ).math.amountCents,
    68000,
  );
  assert.equal(
    incomeTest(
      incomeFacts([], "2026-11", { ...facts, evidenceComplete: false }),
    ).status,
    "Not sure yet",
  );
});
