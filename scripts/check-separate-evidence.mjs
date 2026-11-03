import assert from "node:assert/strict";

import { getDbExec } from "@agent-native/core/db";

import {
  createEvidenceDraft,
  changeEvidenceRecord,
} from "../server/lib/evidence-records.ts";

export async function checkSeparateEvidence(
  owner,
  other,
  inAccount,
  context,
  otherContext,
) {
  const fields = {
    kind: "service",
    organization: "Test pantry",
    start: "2027-01-02",
    end: "2027-01-02",
    hours: 3,
  };
  const make = () =>
    inAccount(owner, () => createEvidenceDraft({ fields }, context));
  const confirm = (row, duplicateChoice, callContext = context) =>
    inAccount(owner, () =>
      changeEvidenceRecord(
        "confirm",
        {
          id: row.id,
          version: row.version,
          ...(duplicateChoice ? { duplicateChoice } : {}),
        },
        callContext,
      ),
    );
  const first = await confirm(await make());
  const second = await make();
  const choice = {
    choice: "these-are-separate",
    compared: [{ id: first.id, version: first.version }],
  };
  await assert.rejects(
    confirm(second),
    (error) =>
      error.statusCode === 409 && error.data.duplicates.includes(first.id),
  );
  // These are two real shifts on the same date, not the same shift entered twice.
  const separate = await confirm(second, choice);
  assert.equal(separate.status, "confirmed");
  assert.equal(separate.version, second.version + 1);
  const snapshot = await getDbExec().execute({
    sql: "SELECT duplicate_choice FROM eighty_evidence_versions WHERE evidence_id=? AND version=?",
    args: [separate.id, separate.version],
  });
  assert.deepEqual(snapshot.rows[0].duplicate_choice, choice);
  const event = await getDbExec().execute({
    sql: "SELECT kind,details,actor_id FROM eighty_member_events WHERE target_id=? ORDER BY created_at DESC LIMIT 1",
    args: [separate.id],
  });
  assert.equal(event.rows[0].kind, "evidence-confirm-separate");
  assert.equal(event.rows[0].actor_id, owner.userId);
  assert.deepEqual(event.rows[0].details, choice);
  // Both the target version and every compared version must still be current.
  await assert.rejects(confirm(second, choice), { statusCode: 409 });
  const third = await make();
  await assert.rejects(confirm(third, choice), { statusCode: 409 }); // misses the second line
  const all = {
    choice: "these-are-separate",
    compared: [
      { id: first.id, version: first.version },
      { id: separate.id, version: separate.version },
    ],
  };
  await assert.rejects(
    confirm(third, {
      ...all,
      compared: [...all.compared, { id: third.id, version: third.version }],
    }),
    { statusCode: 409 },
  );
  for (const caller of ["tool", "mcp", "http", "cli", "automation", "a2a"]) {
    await assert.rejects(confirm(third, all, { ...context, caller }), {
      statusCode: 403,
    });
  }
  await assert.rejects(
    confirm(third, all, { ...context, requestHeaders: new Headers() }),
    { statusCode: 403 },
  );
  await inAccount(other, () =>
    assert.rejects(
      changeEvidenceRecord(
        "confirm",
        { id: third.id, version: third.version, duplicateChoice: all },
        otherContext,
      ),
      { statusCode: 404 },
    ),
  );
  const edited = await inAccount(owner, () =>
    changeEvidenceRecord(
      "edit",
      { id: first.id, version: first.version, fields },
      context,
    ),
  );
  const renewed = await confirm(edited, {
    choice: "these-are-separate",
    compared: [{ id: separate.id, version: separate.version }],
  });
  await assert.rejects(confirm(third, all), { statusCode: 409 }); // old compared version
  const current = {
    choice: "these-are-separate",
    compared: [
      { id: renewed.id, version: renewed.version },
      { id: separate.id, version: separate.version },
    ],
  };
  const races = await Promise.allSettled([
    confirm(third, current),
    confirm(third, current),
  ]);
  assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    races.find((r) => r.status === "rejected").reason.statusCode,
    409,
  );
  // A new overlapping confirmation invalidates an earlier comparison list.
  const a = await make();
  const b = await make();
  const thirdVersion = races.find((r) => r.status === "fulfilled").value
    .version;
  const beforeRace = {
    choice: "these-are-separate",
    compared: [...current.compared, { id: third.id, version: thirdVersion }],
  };
  const overlap = await Promise.allSettled([
    confirm(a, beforeRace),
    confirm(b, beforeRace),
  ]);
  assert.equal(overlap.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    overlap.find((r) => r.status === "rejected").reason.statusCode,
    409,
  );
  // Duplicate payouts can also be real: ordinary pay and a bonus on payday.
  const payoutFields = {
    kind: "income",
    organization: "Test employer",
    income: {
      kind: "wages",
      receivedOn: "2027-02-05",
      grossPayCents: 50000,
      preTaxDeductionsCents: 0,
    },
  };
  const pay = await inAccount(owner, () =>
    createEvidenceDraft({ fields: payoutFields }, context),
  );
  const paid = await confirm(pay);
  const bonus = await inAccount(owner, () =>
    createEvidenceDraft(
      {
        fields: {
          ...payoutFields,
          income: { ...payoutFields.income, grossPayCents: 10000 },
        },
      },
      context,
    ),
  );
  await assert.rejects(confirm(bonus), { statusCode: 409 });
  const bonusConfirmed = await confirm(bonus, {
    choice: "these-are-separate",
    compared: [{ id: paid.id, version: paid.version }],
  });
  assert.equal(bonusConfirmed.status, "confirmed");
  const extraPay = await inAccount(owner, () =>
    createEvidenceDraft({ fields: payoutFields }, context),
  );
  const payChoice = {
    choice: "these-are-separate",
    compared: [
      { id: paid.id, version: paid.version },
      { id: bonusConfirmed.id, version: bonusConfirmed.version },
    ],
  };
  // Saving the confirmation, its choice and its member event must be atomic.
  await getDbExec().execute({
    sql: "ALTER TABLE eighty_member_events ADD CONSTRAINT eighty_check_choice_failure CHECK (kind <> 'evidence-confirm-separate') NOT VALID",
    args: [],
  });
  try {
    await assert.rejects(
      confirm(extraPay, payChoice),
      (error) => error.code === "23514" || error.cause?.code === "23514",
    );
  } finally {
    await getDbExec().execute({
      sql: "ALTER TABLE eighty_member_events DROP CONSTRAINT eighty_check_choice_failure",
      args: [],
    });
  }
  const afterFailure = await getDbExec().execute({
    sql: "SELECT status,version FROM eighty_evidence WHERE id=?",
    args: [extraPay.id],
  });
  assert.equal(afterFailure.rows[0].status, "proposed");
  assert.equal(afterFailure.rows[0].version, 1);
  const failedHistory = await getDbExec().execute({
    sql: "SELECT count(*)::int AS count FROM eighty_evidence_versions WHERE evidence_id=? AND duplicate_choice IS NOT NULL",
    args: [extraPay.id],
  });
  assert.equal(failedHistory.rows[0].count, 0);
  console.log(
    "PASS Separate shifts and payouts can be confirmed by the member, with exact current comparisons, saved choice history and concurrent-change checks.",
  );
}
