import assert from "node:assert/strict";
import test from "node:test";

import {
  as,
  openExample,
  prepareDatabase,
  realMember,
} from "../helpers/example-database.mjs";

await prepareDatabase();
const evidence = await import("../../server/lib/evidence-records.ts");
const { exampleMonth, today } =
  await import("../../server/lib/example-accounts.ts");
const { MARIA } = await import("../../server/lib/example-people.ts");
const propose = (await import("../../actions/propose_evidence.ts")).default;

const run = (account, fields) =>
  as(account, () =>
    propose.run({ fields }, { ...account.context, caller: "tool" }),
  );
const saturday = today();
const sixFlags = {
  unpaid: true,
  directCommunityBenefit: true,
  publicOrNonprofit: true,
  structuredAndSupervised: true,
  nonpartisan: true,
  tracksDatesAndHours: true,
};

test("A spoken pantry shift takes the service facts and contact from Maria's confirmed pantry line", async () => {
  const maria = await openExample("maria", "198.51.100.71");
  const before = await as(maria, () => exampleMonth(maria.context));
  assert.equal(before.thisMonth.hours, MARIA.deliveryHours + MARIA.pantryHours);
  const saved = await run(maria, {
    kind: "service",
    organization: "Westside pantry",
    start: saturday,
    end: saturday,
    hours: 4,
  });
  assert.equal(saved.status, "proposed");
  assert.equal(saved.fields.organization, MARIA.pantry);
  assert.equal(saved.fields.hours, 4);
  assert.deepEqual(saved.fields.service, {
    ...sixFlags,
    confirmationContact: "Pantry lead, Ana (made up), 402-555-0148",
  });
  assert.equal(saved.carried.organization, MARIA.pantry);
  assert.equal(saved.carried.facts.length, 7);
  const lines = await as(maria, () => evidence.listEvidenceRecords(maria.context));
  const source = lines.find((row) => row.id === saved.carried.fromLine);
  assert.equal(source.status, "confirmed");
  assert.equal(source.fields.organization, MARIA.pantry);
  const after = await as(maria, () => exampleMonth(maria.context));
  assert.equal(after.thisMonth.hours, 61);
  assert.equal(after.thisMonth.ifConfirmed.hours, 65);
});

test("Facts the member gave are kept; only missing ones are copied", async () => {
  const maria = await openExample("maria", "198.51.100.72");
  const saved = await run(maria, {
    kind: "service",
    organization: MARIA.pantry,
    start: saturday,
    end: saturday,
    hours: 3,
    service: { confirmationContact: "Shift lead, Luis (made up)" },
  });
  assert.equal(saved.fields.service.confirmationContact, "Shift lead, Luis (made up)");
  assert.equal(saved.fields.service.unpaid, true);
  assert.equal(saved.carried.facts.includes("confirmationContact"), false);
  assert.equal(saved.carried.facts.length, 6);
});

test("An organization with no confirmed line gets nothing carried", async () => {
  const maria = await openExample("maria", "198.51.100.73");
  for (const organization of ["Library book sale", "Pantry", "Eastside Food Pantry"]) {
    const fields = {
      kind: "service",
      organization,
      start: saturday,
      end: saturday,
      hours: 2,
    };
    const saved = await run(maria, fields);
    assert.equal(saved.carried, undefined, organization);
    assert.deepEqual(saved.fields, fields);
  }
  const work = {
    kind: "work",
    organization: MARIA.pantry,
    start: saturday,
    end: saturday,
    hours: 2,
  };
  const saved = await run(maria, work);
  assert.equal(saved.carried, undefined);
  assert.deepEqual(saved.fields, work);
});

test("Another member's lines and a member's own unconfirmed lines are never used", async () => {
  await openExample("maria", "198.51.100.74");
  const member = await realMember("carry-member@example.test");
  const fields = {
    kind: "service",
    organization: MARIA.pantry,
    start: saturday,
    end: saturday,
    hours: 4,
  };
  const first = await run(member, fields);
  assert.equal(first.carried, undefined);
  assert.deepEqual(first.fields, fields);
  await as(member, () =>
    evidence.createEvidenceDraft(
      {
        fields: {
          ...fields,
          service: { ...sixFlags, confirmationContact: "Not yet confirmed" },
        },
      },
      member.context,
      "agent",
    ),
  );
  const second = await run(member, fields);
  assert.equal(second.carried, undefined);
  assert.deepEqual(second.fields, fields);
});

test("Organization names compare by their words", () => {
  assert.deepEqual(evidence.organizationWords("Westside Food Pantry (made up)"), [
    "westside",
    "food",
    "pantry",
  ]);
  assert.deepEqual(evidence.organizationWords("  Despensa  San José! "), [
    "despensa",
    "san",
    "josé",
  ]);
  assert.deepEqual(evidence.organizationWords(null), []);
});
