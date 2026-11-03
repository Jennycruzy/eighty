import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { closeDbExec, getDbExec } from "@agent-native/core/db";
import {
  runWithRequestContext,
  ensureGoogleAuthIdentity,
  createBetterAuthSessionForEmail,
  setBetterAuthSessionCookie,
} from "@agent-native/core/server";
import { H3Event } from "h3";

import { reviewedMemberActor } from "../server/lib/member-identity.ts";
import {
  getMemberRecord,
  saveMemberRecord,
} from "../server/lib/member-records.ts";
import { checkEvidenceRecords } from "./check-evidence-records.mjs";
import "../server/plugins/agent-native-email-branding.ts";
const runId = process.argv[2];
assert.match(runId || "", /^eighty-check-[a-f0-9-]+$/);
try {
  // This marker exists only in the disposable deployment-check database.
  const marker = await getDbExec().execute({
    sql: "SELECT id FROM eighty_deploy_check WHERE id = ?",
    args: [runId],
  });
  assert.deepEqual(
    marker.rows.map((row) => row.id),
    [runId],
  );
  // Seed a fictional verified identity in this test database, not through public sign-up.
  const reviewEmail = `${runId}-review@example.test`;
  await ensureGoogleAuthIdentity({
    email: reviewEmail,
    accountId: randomUUID(),
    name: "Test member",
  });
  const session = await createBetterAuthSessionForEmail(reviewEmail);
  assert(session);
  const cookieEvent = new H3Event(
    new Request("http://localhost/eighty-review"),
  );
  await setBetterAuthSessionCookie(cookieEvent, session.token);
  const cookie = cookieEvent.res.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const browserActor = await reviewedMemberActor({
    caller: "frontend",
    userEmail: reviewEmail,
    requestHeaders: new Headers({ cookie }),
  });
  assert.equal(browserActor.userId, session.userId);
  await assert.rejects(
    reviewedMemberActor({
      caller: "mcp",
      userEmail: reviewEmail,
      requestHeaders: new Headers({ cookie }),
    }),
    { statusCode: 403 },
  );
  await assert.rejects(
    reviewedMemberActor({
      caller: "frontend",
      userEmail: `${runId}-other@example.test`,
      requestHeaders: new Headers({ cookie }),
    }),
    { statusCode: 403 },
  );
  async function fixtureActor(email) {
    await ensureGoogleAuthIdentity({
      email,
      accountId: randomUUID(),
      name: "Test member",
    });
    const identity = await createBetterAuthSessionForEmail(email);
    assert(identity);
    return { email, userId: identity.userId };
  }
  const owner = await fixtureActor(`${runId}@example.test`);
  const other = await fixtureActor(`${runId}-other@example.test`);
  const inAccount = (actor, callback) =>
    runWithRequestContext(
      { userEmail: actor.email, authUserId: actor.userId },
      callback,
    );
  let saved;
  await inAccount(owner, async () => {
    saved = await saveMemberRecord(owner, {
      language: "es-US",
      screener: { state: "NE", age: "34", care: "unknown" },
    });
    assert.equal(saved.stateCode, "NE");
    assert.equal(saved.language, "es-US");
    const repeated = await saveMemberRecord(owner, {
      language: "en-US",
      screener: { state: "NE", age: "34" },
    });
    assert.equal(repeated.id, saved.id);
    assert.equal((await getMemberRecord(owner)).id, saved.id);
  });
  await inAccount(other, async () => {
    await assert.rejects(getMemberRecord(owner), { statusCode: 403 });
    await assert.rejects(getMemberRecord(other), { statusCode: 404 });
    const record = await saveMemberRecord(other, {
      language: "en-US",
      screener: { state: "MT" },
    });
    assert.notEqual(record.id, saved.id);
  });
  await inAccount(owner, async () => {
    const wrongIdentity = { email: owner.email, userId: randomUUID() };
    await assert.rejects(
      saveMemberRecord(wrongIdentity, {
        language: "en-US",
        screener: { state: "TX" },
      }),
      { statusCode: 403 },
    );
    assert.equal((await getMemberRecord(owner)).stateCode, "NE");
  });
  await checkEvidenceRecords(owner, other, inAccount);
  const validDocumentId = randomUUID();
  await getDbExec().execute({
    sql: "INSERT INTO eighty_documents (id,owner_email,member_id,handle,mime,bytes,hash) VALUES (?,?,?,?,?,?,?)",
    args: [
      validDocumentId,
      owner.email,
      saved.id,
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
  // An encrypted handle must say both encrypted and opaque; absent fields are not enough.
  for (const handle of [
    {},
    { encrypted: false, opaque: true },
    { encrypted: true },
    { encrypted: "true", opaque: true },
    { encrypted: true, opaque: "true" },
  ]) {
    await assert.rejects(
      getDbExec().execute({
        sql: "INSERT INTO eighty_documents (id,owner_email,member_id,handle,mime,bytes,hash) VALUES (?,?,?,?,?,?,?)",
        args: [
          randomUUID(),
          owner.email,
          saved.id,
          JSON.stringify(handle),
          "image/jpeg",
          10,
          randomUUID(),
        ],
      }),
      (error) => error.code === "23514" || error.cause?.code === "23514",
    );
  }
  await assert.rejects(
    getDbExec().execute({
      sql: "INSERT INTO eighty_ai_ledger (id,member_id,action,purpose) VALUES (?,?,?,?)",
      args: [randomUUID(), saved.id, "try_my_month", "try"],
    }),
    (error) => error.code === "23514" || error.cause?.code === "23514",
  );
  console.log(
    "PASS Member profiles stay in the owning account, repeated saves do not duplicate them, and document rows require encrypted opaque handles.",
  );
} finally {
  await closeDbExec();
}
