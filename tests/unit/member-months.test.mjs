import assert from "node:assert/strict";
import test from "node:test";

import {
  as,
  openDemo,
  prepareDatabase,
  realMember,
} from "../helpers/demo-database.mjs";

await prepareDatabase();
const { H3Event } = await import("h3");
const middleware = (await import("../../server/middleware/auth.ts")).default;
const { safeMemberNext, isDemoAllowedRequest } =
  await import("../../shared/access.ts");
const { memberMonthFacts, memberMonthResult, checkMemberMonth } =
  await import("../../server/lib/member-month.ts");
const { monthInput } = await import("../../server/lib/month-input.ts");
const { demoMonthInput, assessDemoMonths } =
  await import("../../server/lib/demo-month.ts");
const { DEMO_PROFILES } = await import("../../server/lib/demo-people.ts");
const { createEvidenceDraft, changeEvidenceRecord } =
  await import("../../server/lib/evidence-records.ts");
const member = await realMember("months@example.test");
const other = await realMember("other-months@example.test");
const visitor = await openDemo("maria", "198.51.100.254");

function request(path, method = "GET", cookie) {
  const event = new H3Event(
    new Request(`http://localhost${path}`, {
      method,
      headers: { accept: "text/html", ...(cookie ? { cookie } : {}) },
    }),
  );
  return { event, run: () => middleware(event) };
}
for (const method of ["GET", "HEAD"]) {
  for (const path of ["/demo", "/add", "/months", "/months/2026-10"]) {
    test(`${method} ${path} opens a page when signed out`, async () => {
      const { event, run } = request(`${path}?lang=es`, method);
      const response = await run();
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const url = new URL(response.headers.get("location"), "http://localhost");
      assert.equal(url.searchParams.get("lang"), "es");
      assert.equal(url.pathname, path === "/demo" ? "/" : "/check/sign-in");
      if (path === "/demo") assert.equal(url.hash, "#demo-start-title");
      else
        assert.equal(
          safeMemberNext(url.searchParams.get("next")),
          `${path}?lang=es`,
        );
      assert.equal(event.res.headers.get("cache-control"), "private, no-store");
    });
  }
}
for (const [path, method] of [
  ["/demo.data", "GET"],
  ["/months/2026-10.data", "GET"],
]) {
  test(`${path} still requires sign-in`, async () => {
    await assert.rejects(
      request(path, method).run,
      (error) => error.status === 401 || error.statusCode === 401,
    );
  });
}
test("Return paths stay on member pages", () => {
  for (const value of [
    "//evil.test/months",
    "https://evil.test",
    "/months\\evil",
    "/months/%2f%2fevil",
    "/months/../../help",
    "/monthsevil",
    "/help",
    "months",
    "/months.data",
    "/months/a.data",
    "/months\n",
  ])
    assert.equal(safeMemberNext(value), null, value);
  assert.equal(
    safeMemberNext("/months/2026-10?lang=es"),
    "/months/2026-10?lang=es",
  );
});
for (const path of ["/months", "/months/2026-10"]) {
  test(`${path} accepts a member and sends a demo to its month`, async () => {
    await request(path, "GET", member.cookie).run();
    const response = await request(
      `${path}?lang=es`,
      "GET",
      visitor.cookie,
    ).run();
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/demo?lang=es");
  });
}
const asOf = "2026-11-05";
const line = {
  id: "work",
  version: 1,
  status: "confirmed",
  fields: {
    kind: "work",
    start: "2026-11-01",
    end: "2026-11-04",
    hours: 80,
    organization: "Employer",
  },
};
test("Members and the demo use the same facts and rules for 80 hours", () => {
  const facts = DEMO_PROFILES.maria.facts;
  assert.equal(monthInput, demoMonthInput);
  const result = memberMonthResult(facts, [line], "2026-11", asOf);
  const demo = assessDemoMonths(facts, [line], asOf).thisMonth;
  assert.equal(result.status, "Meets");
  assert.equal(result.citation, "42 CFR 435.552(a)(1)–(5), (b), (d)–(e)");
  assert.equal(result.status, demo.status);
  assert.equal(result.hours, demo.hours);
  assert.equal(result.citation, demo.citation);
  const proposed = memberMonthResult(
    facts,
    [{ ...line, status: "proposed" }],
    "2026-11",
    asOf,
  );
  assert.equal(proposed.hours, 0);
  assert.equal(proposed.lines.length, 0);
});
test("Missing saved coverage facts remain unknown even with 80 hours", () => {
  const result = memberMonthResult(
    memberMonthFacts({
      group: "expansion",
      age: "34",
      pregnant: "no",
      medicare: "no",
    }),
    [line],
    "2026-11",
    asOf,
  );
  assert.equal(result.status, "Not sure yet");
  assert(
    result.missing.includes("applicability.mandatoryGroupEligibleAndEnrolled"),
  );
});
test("Bad and future months use the rule's words", () => {
  for (const month of ["bad", "2026-13", "2026-12"]) {
    const result = memberMonthResult(memberMonthFacts({}), [line], month, asOf);
    assert.equal(result.status, "Not sure yet");
    assert.equal(
      result.basis,
      month === "2026-12"
        ? "A future month is not yet proved."
        : "Check the month and review date.",
    );
  }
});
test("Month reads use only the member's confirmed lines and refuse other callers", async () => {
  for (const account of [member, other]) {
    const draft = await as(account, () =>
      createEvidenceDraft(
        { fields: { ...line.fields, organization: account.email } },
        account.context,
      ),
    );
    await as(account, () =>
      changeEvidenceRecord(
        "confirm",
        { id: draft.id, version: draft.version },
        account.context,
      ),
    );
  }
  await as(member, () =>
    createEvidenceDraft(
      { fields: { ...line.fields, hours: 900, organization: "Waiting" } },
      member.context,
    ),
  );
  const result = await as(member, () =>
    checkMemberMonth("2026-11", member.context),
  );
  assert.equal(result.selected.hours, 80);
  assert.equal(result.selected.lines.length, 1);
  assert.equal(result.selected.lines[0].fields.organization, member.email);
  assert.equal(result.waiting, 1);
  await assert.rejects(
    as(member, () =>
      checkMemberMonth("2026-11", { ...member.context, caller: "agent" }),
    ),
    { statusCode: 403 },
  );
  await assert.rejects(
    as(member, () => checkMemberMonth("2026-11", other.context)),
    { statusCode: 403 },
  );
  await assert.rejects(
    as(visitor, () => checkMemberMonth("2026-11", visitor.context)),
    { statusCode: 403 },
  );
  assert.equal(
    isDemoAllowedRequest("/_agent-native/actions/check_month", "GET"),
    false,
  );
});

test("A signed-out evidence action still refuses the request", async () => {
  const action = (await import("../../actions/confirm_evidence.ts")).default;
  await assert.rejects(
    action.run(
      { id: "00000000-0000-4000-8000-000000000000", version: 1 },
      { caller: "frontend" },
    ),
    { statusCode: 401 },
  );
});

test("The demo month action and member calculation agree on saved confirmed proof", async () => {
  const action = (await import("../../actions/demo_month.ts")).default;
  const { listEvidenceRecords } =
    await import("../../server/lib/evidence-records.ts");
  const demo = await as(visitor, () => action.run({}, visitor.context));
  const lines = await as(visitor, () => listEvidenceRecords(visitor.context));
  for (const summary of [demo.thisMonth, demo.lastMonth]) {
    const result = memberMonthResult(
      DEMO_PROFILES.maria.facts,
      lines,
      summary.month,
      demo.asOf,
    );
    assert.equal(result.status, summary.status);
    assert.equal(result.citation, summary.citation);
    assert.equal(result.hours, summary.hours);
    assert.equal(result.basis, summary.basis);
    assert.equal(result.ruleVersion, summary.ruleVersion);
    assert.deepEqual(result.missing, summary.missing);
    const { incomeTest } = await import("../../server/rules/income.ts");
    const income = incomeTest(
      monthInput(
        DEMO_PROFILES.maria.facts,
        lines.filter((line) => line.status === "confirmed"),
        summary.month,
        demo.asOf,
      ).income,
    );
    assert.equal(result.amountCents, income.math?.amountCents ?? null);
  }
});

test("The member month action has no owner input and requires browser review", async () => {
  const action = (await import("../../actions/check_month.ts")).default;
  assert.equal(action.requiresAuth, true);
  assert.equal(action.uiOnly, true);
  assert.equal(action.agentTool, false);
  assert.equal(action.mcpTool, false);
  assert.equal(
    action.schema.safeParse({ month: "2026-11", memberId: other.member.id })
      .success,
    false,
  );
});

test("Older confirmed proof appears newest first; incomplete dates stay unconfirmed", async () => {
  const draft = await as(member, () =>
    createEvidenceDraft(
      {
        fields: {
          kind: "work",
          start: "2026-08-01",
          hours: 1,
          organization: "Missing end date",
        },
      },
      member.context,
    ),
  );
  await assert.rejects(
    as(member, () =>
      changeEvidenceRecord(
        "confirm",
        { id: draft.id, version: draft.version },
        member.context,
      ),
    ),
    /Add the dates and organization before confirming/,
  );
  const complete = await as(member, () =>
    createEvidenceDraft(
      { fields: { ...draft.fields, end: "2026-08-01" } },
      member.context,
    ),
  );
  await as(member, () =>
    changeEvidenceRecord(
      "confirm",
      { id: complete.id, version: complete.version },
      member.context,
    ),
  );
  const result = await as(member, () =>
    checkMemberMonth(undefined, member.context),
  );
  assert(result.months.some((month) => month.month === "2026-08"));
  assert.deepEqual(
    result.months.map((month) => month.month),
    result.months
      .map((month) => month.month)
      .sort()
      .reverse(),
  );
});

test("One long line shows at most two years of months", async () => {
  const long = await realMember("long-months@example.test");
  const today = new Date().toISOString().slice(0, 10);
  const draft = await as(long, () =>
    createEvidenceDraft(
      {
        fields: {
          kind: "work",
          start: "2019-01-01",
          end: today,
          hours: 1,
          organization: "Long line",
        },
      },
      long.context,
    ),
  );
  await as(long, () =>
    changeEvidenceRecord(
      "confirm",
      { id: draft.id, version: draft.version },
      long.context,
    ),
  );
  const result = await as(long, () =>
    checkMemberMonth(undefined, long.context),
  );
  assert.equal(result.months.length, 24);
  assert.equal(result.months[0].month, today.slice(0, 7));
  const action = (await import("../../actions/check_month.ts")).default;
  assert.equal(action.schema.safeParse({ month: "2026-11" }).success, true);
  assert.equal(
    action.schema.safeParse({ month: "2026-11".repeat(3) }).success,
    false,
  );
});
