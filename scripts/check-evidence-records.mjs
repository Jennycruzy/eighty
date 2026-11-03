import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getDbExec } from "@agent-native/core/db";
import {
  createBetterAuthSessionForEmail,
  setBetterAuthSessionCookie,
} from "@agent-native/core/server";
import { H3Event } from "h3";

import {
  createEvidenceDraft,
  changeEvidenceRecord,
  listEvidenceRecords,
} from "../server/lib/evidence-records.ts";
import { checkDocumentRemoval } from "./check-document-removal.mjs";
import { checkSeparateEvidence } from "./check-separate-evidence.mjs";

// Called only after the parent has checked the unique disposable-database marker.
export async function checkEvidenceRecords(owner, other, inAccount) {
  async function browserContext(actor) {
    const session = await createBetterAuthSessionForEmail(actor.email);
    assert(session);
    const event = new H3Event(new Request("http://localhost/eighty-review"));
    await setBetterAuthSessionCookie(event, session.token);
    const cookie = event.res.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    return {
      caller: "frontend",
      userEmail: actor.email,
      requestHeaders: new Headers({ cookie }),
    };
  }
  const ownerContext = await browserContext(owner);
  const otherContext = await browserContext(other);
  await checkDocumentRemoval(
    owner,
    other,
    inAccount,
    ownerContext,
    otherContext,
  );
  const shift = {
    kind: "work",
    organization: "Test employer",
    start: "2026-11-01",
    end: "2026-11-07",
    hours: 40,
  };
  const first = await inAccount(owner, () =>
    createEvidenceDraft({ fields: shift }, ownerContext),
  );
  assert.equal(first.status, "proposed");
  assert.equal(first.version, 1);
  await inAccount(other, async () => {
    assert.deepEqual(await listEvidenceRecords(otherContext), []);
    await assert.rejects(
      changeEvidenceRecord(
        "confirm",
        { id: first.id, version: 1 },
        otherContext,
      ),
      { statusCode: 404 },
    );
  });
  await inAccount(owner, async () => {
    for (const caller of ["agent", "mcp", "http", "cli", "automation", "a2a"]) {
      await assert.rejects(
        changeEvidenceRecord(
          "confirm",
          { id: first.id, version: 1 },
          { ...ownerContext, caller },
        ),
        { statusCode: 403 },
      );
      await assert.rejects(
        changeEvidenceRecord(
          "edit",
          { id: first.id, version: 1, fields: { ...shift, hours: 80 } },
          { ...ownerContext, caller },
        ),
        { statusCode: 403 },
      );
    }
    await assert.rejects(
      changeEvidenceRecord(
        "confirm",
        { id: first.id, version: 1 },
        { ...ownerContext, requestHeaders: new Headers() },
      ),
      { statusCode: 403 },
    );
    const confirmed = await changeEvidenceRecord(
      "confirm",
      { id: first.id, version: 1 },
      ownerContext,
    );
    assert.equal(confirmed.status, "confirmed");
    assert.equal(confirmed.version, 2);
    await assert.rejects(
      changeEvidenceRecord(
        "edit",
        { id: first.id, version: 1, fields: shift },
        ownerContext,
      ),
      { statusCode: 409 },
    );
    const duplicate = await createEvidenceDraft(
      { fields: { ...shift, hours: 80, organization: " TEST   employer " } },
      ownerContext,
    );
    await assert.rejects(
      changeEvidenceRecord(
        "confirm",
        { id: duplicate.id, version: 1 },
        ownerContext,
      ),
      (error) =>
        error.statusCode === 409 && error.data.duplicates.includes(first.id),
    );
    const edited = await changeEvidenceRecord(
      "edit",
      { id: first.id, version: 2, fields: { ...shift, hours: 39 } },
      ownerContext,
    );
    assert.equal(edited.status, "proposed");
    assert.equal(edited.version, 3);
    // A stale second tab cannot confirm or overwrite the edit.
    await assert.rejects(
      changeEvidenceRecord(
        "confirm",
        { id: first.id, version: 2 },
        ownerContext,
      ),
      { statusCode: 409 },
    );
    const rejected = await changeEvidenceRecord(
      "reject",
      { id: first.id, version: 3 },
      ownerContext,
    );
    assert.equal(rejected.status, "rejected");
    await assert.rejects(
      changeEvidenceRecord(
        "confirm",
        { id: first.id, version: 4 },
        ownerContext,
      ),
      { statusCode: 409 },
    );
    const restored = await changeEvidenceRecord(
      "edit",
      {
        id: first.id,
        version: 4,
        fields: { ...shift, start: "2026-11-08", end: "2026-11-14" },
      },
      ownerContext,
    );
    assert.equal(restored.status, "proposed");
    // Two requests to confirm the same version must yield one change, not two.
    const races = await Promise.allSettled([
      changeEvidenceRecord(
        "confirm",
        { id: restored.id, version: restored.version },
        ownerContext,
      ),
      changeEvidenceRecord(
        "confirm",
        { id: restored.id, version: restored.version },
        ownerContext,
      ),
    ]);
    assert.equal(
      races.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      races.find((result) => result.status === "rejected").reason.statusCode,
      409,
    );
    const missing = await createEvidenceDraft(
      { fields: { kind: "work", hours: 80 } },
      ownerContext,
    );
    await assert.rejects(
      changeEvidenceRecord(
        "confirm",
        { id: missing.id, version: 1 },
        ownerContext,
      ),
      (error) =>
        error.statusCode === 422 && error.data.missing.includes("start"),
    );
    const two = await Promise.all([
      createEvidenceDraft(
        { fields: { ...shift, start: "2026-11-15", end: "2026-11-21" } },
        ownerContext,
      ),
      createEvidenceDraft(
        { fields: { ...shift, start: "2026-11-20", end: "2026-11-22" } },
        ownerContext,
      ),
    ]);
    const overlap = await Promise.allSettled(
      two.map((row) =>
        changeEvidenceRecord(
          "confirm",
          { id: row.id, version: 1 },
          ownerContext,
        ),
      ),
    );
    assert.equal(
      overlap.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      overlap.find((result) => result.status === "rejected").reason.statusCode,
      409,
    );
  });
  // A failed event write must roll back the status and version too.
  const rollback = await inAccount(owner, () =>
    createEvidenceDraft(
      { fields: { ...shift, start: "2026-12-01", end: "2026-12-07" } },
      ownerContext,
    ),
  );
  await getDbExec().execute({
    sql: "ALTER TABLE eighty_member_events ADD CONSTRAINT eighty_check_event_failure CHECK (kind <> 'evidence-confirm') NOT VALID",
    args: [],
  });
  try {
    await inAccount(owner, () =>
      assert.rejects(
        changeEvidenceRecord(
          "confirm",
          { id: rollback.id, version: 1 },
          ownerContext,
        ),
        (error) => error.code === "23514" || error.cause?.code === "23514",
      ),
    );
  } finally {
    await getDbExec().execute({
      sql: "ALTER TABLE eighty_member_events DROP CONSTRAINT eighty_check_event_failure",
      args: [],
    });
  }
  const afterFailure = await inAccount(owner, () =>
    listEvidenceRecords(ownerContext),
  );
  assert.equal(
    afterFailure.find((row) => row.id === rollback.id).status,
    "proposed",
  );
  assert.equal(afterFailure.find((row) => row.id === rollback.id).version, 1);
  const ownerMember = await getDbExec().execute({
    sql: "SELECT id FROM eighty_members WHERE owner_email=?",
    args: [owner.email],
  });
  const documentId = randomUUID();
  await getDbExec().execute({
    sql: "INSERT INTO eighty_documents (id,owner_email,member_id,handle,mime,bytes,hash) VALUES (?,?,?,?,?,?,?)",
    args: [
      documentId,
      owner.email,
      ownerMember.rows[0].id,
      JSON.stringify({
        id: "opaque-fixture",
        provider: "fixture",
        encrypted: true,
        opaque: true,
      }),
      "image/jpeg",
      10,
      randomUUID(),
    ],
  });
  await inAccount(other, () =>
    assert.rejects(
      createEvidenceDraft({ fields: shift, documentId }, otherContext),
      { statusCode: 404 },
    ),
  );
  await checkSeparateEvidence(
    owner,
    other,
    inAccount,
    ownerContext,
    otherContext,
  );
  const versions = await getDbExec().execute({
    sql: "SELECT version,status,fields FROM eighty_evidence_versions WHERE evidence_id=? ORDER BY version",
    args: [first.id],
  });
  assert.deepEqual(
    versions.rows.map((row) => [row.version, row.status]),
    [
      [1, "proposed"],
      [2, "confirmed"],
      [3, "proposed"],
      [4, "rejected"],
      [5, "proposed"],
      [6, "confirmed"],
    ],
  );
  assert.equal(versions.rows[1].fields.hours, 40);
  assert.equal(versions.rows[2].fields.hours, 39);
  const events = await getDbExec().execute({
    sql: "SELECT count(*)::int AS count FROM eighty_member_events WHERE target_id=?",
    args: [first.id],
  });
  assert.equal(events.rows[0].count, 6);
  console.log(
    "PASS Evidence stays private, requires member review, rejects stale edits and overlapping confirmations, and keeps every saved version.",
  );
}
