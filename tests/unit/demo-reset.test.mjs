import assert from "node:assert/strict";
import test from "node:test";

import {
  as,
  openDemo,
  prepareDatabase,
  realMember,
  storage,
  stored,
} from "../helpers/demo-database.mjs";

const sql = await prepareDatabase();
const demo = await import("../../server/lib/demo-accounts.ts");
const evidence = await import("../../server/lib/evidence-records.ts");
const files = await import("../../server/lib/document-records.ts");
const { runDemoReset } = await import("../../server/lib/demo-reset.ts");
const { retryDocumentDeletions } =
  await import("../../server/lib/document-deletions.ts");

const rows = async (query, args = []) =>
  (await sql.execute({ sql: query, args })).rows;
const count = async (query, args = []) =>
  Number((await rows(query, args))[0].n);
const age = (table, column, where, args) =>
  sql.execute({
    sql: `UPDATE ${table} SET ${column} = now() - interval '30 days' WHERE ${where}`,
    args,
  });
async function holdings(account) {
  return {
    users: await count('SELECT count(*) AS n FROM "user" WHERE id = ?', [
      account.userId,
    ]),
    sessions: await count(
      "SELECT count(*) AS n FROM session WHERE user_id = ?",
      [account.userId],
    ),
    orgs: await count("SELECT count(*) AS n FROM org_members WHERE email = ?", [
      account.email,
    ]),
    members: await count(
      "SELECT count(*) AS n FROM eighty_members WHERE owner_email = ?",
      [account.email],
    ),
    evidence: await count(
      "SELECT count(*) AS n FROM eighty_evidence WHERE owner_email = ?",
      [account.email],
    ),
    versions: await count(
      "SELECT count(*) AS n FROM eighty_evidence_versions WHERE owner_email = ?",
      [account.email],
    ),
    events: await count(
      "SELECT count(*) AS n FROM eighty_member_events WHERE owner_email = ?",
      [account.email],
    ),
    documents: await count(
      "SELECT count(*) AS n FROM eighty_documents WHERE owner_email = ?",
      [account.email],
    ),
  };
}
const nothing = {
  users: 0,
  sessions: 0,
  orgs: 0,
  members: 0,
  evidence: 0,
  versions: 0,
  events: 0,
  documents: 0,
};

const real = await realMember();
await as(real, () =>
  evidence.createEvidenceDraft(
    {
      fields: {
        kind: "work",
        organization: "Real employer",
        start: "2026-01-01",
        end: "2026-01-07",
        hours: 30,
      },
    },
    real.context,
  ),
);
const realPdf = Buffer.from(
  await (
    await import("../../server/lib/demo-sample.ts")
  ).demoSamplePdf("2026-01-07"),
).toString("base64");
const realFile = await as(real, () =>
  files.saveDocument({ data: realPdf }, real.context),
);
// The real member's rows are all very old. The reset must still leave them.
for (const table of [
  "eighty_members",
  "eighty_evidence",
  "eighty_evidence_versions",
  "eighty_member_events",
  "eighty_documents",
])
  await age(table, "created_at", "owner_email = ?", [real.email]);
await age('"user"', "created_at", "id = ?", [real.userId]);

test("The reset removes only demo data older than a day, queues its files and records the run", async () => {
  const old = await openDemo("maria", "203.0.113.1");
  const sample = await as(old, () => demo.addDemoSample(old.context));
  const fresh = await openDemo("daniel", "203.0.113.2");
  await age("eighty_demo_accounts", "created_at", "user_id = ?", [old.userId]);
  const before = await holdings(old);
  assert.ok(
    before.members === 1 && before.evidence === 5 && before.documents === 1,
  );
  const realBefore = await holdings(real);
  const freshBefore = await holdings(fresh);
  storage.deletes = 0;

  const result = await runDemoReset();
  assert.deepEqual(
    { removed: result.accountsRemoved, queued: result.documentsQueued },
    { removed: 1, queued: 1 },
  );
  assert.deepEqual(await holdings(old), nothing);
  assert.equal(
    await count(
      "SELECT count(*) AS n FROM eighty_demo_accounts WHERE user_id = ?",
      [old.userId],
    ),
    0,
  );
  // The stored file went through the deletion path and storage confirmed it.
  assert.equal(storage.deletes, 1);
  assert.equal(
    await count(
      "SELECT count(*) AS n FROM eighty_document_deletions WHERE id = ?",
      [sample.id],
    ),
    0,
  );
  // Real data, even years old, and the young demo stay exactly as they were.
  assert.deepEqual(await holdings(real), realBefore);
  assert.deepEqual(await holdings(fresh), freshBefore);
  assert.equal(
    (await as(real, () => files.readDocument(realFile.id, real.context))).id,
    realFile.id,
  );
  const [run] = await rows("SELECT * FROM eighty_demo_resets WHERE id = ?", [
    result.id,
  ]);
  assert.equal(run.status, "completed");
  assert.equal(run.accounts_removed, 1);
  assert.equal(run.documents_queued, 1);
  assert.equal(run.errors, null);
  assert.ok(run.finished_at >= run.started_at);
  // The Demo organisation stays for the next visitor.
  assert.equal(
    await count(
      "SELECT count(*) AS n FROM organizations WHERE id = 'eighty-demo'",
    ),
    1,
  );
});

test("A file whose storage delete fails stays queued for the retry job", async () => {
  const old = await openDemo("maria", "203.0.113.3");
  const sample = await as(old, () => demo.addDemoSample(old.context));
  await age("eighty_demo_accounts", "created_at", "user_id = ?", [old.userId]);
  storage.failDeletes = true;
  try {
    const result = await runDemoReset();
    assert.equal(result.documentsQueued, 1);
  } finally {
    storage.failDeletes = false;
  }
  assert.deepEqual(await holdings(old), nothing);
  const [queued] = await rows(
    "SELECT attempts, owner_email FROM eighty_document_deletions WHERE id = ?",
    [sample.id],
  );
  assert.equal(queued.attempts, 1);
  assert.equal(queued.owner_email, old.email);
  // The existing retry job finishes it once storage answers.
  await sql.execute({
    sql: "UPDATE eighty_document_deletions SET next_attempt_at = now() - interval '1 second' WHERE id = ?",
    args: [sample.id],
  });
  await retryDocumentDeletions();
  assert.equal(
    await count(
      "SELECT count(*) AS n FROM eighty_document_deletions WHERE id = ?",
      [sample.id],
    ),
    0,
  );
  assert.ok(![...stored.keys()].some((key) => key.startsWith(sample.id)));
});

test("A run that throws is recorded as failed with its reason, never completed", async () => {
  const old = await openDemo("rosa", "203.0.113.4");
  await age("eighty_demo_accounts", "created_at", "user_id = ?", [old.userId]);
  const stopped = new AbortController();
  stopped.abort();
  await assert.rejects(runDemoReset(stopped.signal), /ran out of time/);
  const [run] = await rows(
    "SELECT * FROM eighty_demo_resets ORDER BY started_at DESC LIMIT 1",
  );
  assert.equal(run.status, "failed");
  assert.equal(run.errors, "The reset ran out of time.");
  assert.ok(run.finished_at);
  // A database step that throws is also a failure.
  await sql.execute(`CREATE FUNCTION eighty_test_refuse() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'test refusal'; END; $$ LANGUAGE plpgsql`);
  await sql.execute(
    "CREATE TRIGGER eighty_test_refuse BEFORE DELETE ON eighty_members FOR EACH ROW EXECUTE FUNCTION eighty_test_refuse()",
  );
  try {
    await assert.rejects(runDemoReset(), (error) =>
      /test refusal/.test(error.cause?.message),
    );
  } finally {
    await sql.execute("DROP TRIGGER eighty_test_refuse ON eighty_members");
  }
  const [failed] = await rows(
    "SELECT * FROM eighty_demo_resets ORDER BY started_at DESC LIMIT 1",
  );
  assert.equal(failed.status, "failed");
  assert.equal(failed.errors, "test refusal");
  // The account that could not be removed is still whole, not half deleted.
  assert.equal((await holdings(old)).members, 1);
  assert.equal((await holdings(old)).users, 1);
  // Nothing in the table says completed for these runs.
  assert.equal(
    await count(
      "SELECT count(*) AS n FROM eighty_demo_resets WHERE status = 'completed' AND errors IS NOT NULL",
    ),
    0,
  );
  // With the step working again, the next run removes it.
  const next = await runDemoReset();
  assert.equal(next.accountsRemoved, 1);
  assert.deepEqual(await holdings(old), nothing);
});

test("The reset query itself only names demo addresses", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../server/lib/demo-reset.ts", import.meta.url),
    "utf8",
  );
  const deletes = source.match(/delete\(|DELETE FROM/g) ?? [];
  const limited =
    source.match(/like\([^)]*demoAddress\)|LIKE \$\{demoAddress\}/g) ?? [];
  assert.ok(deletes.length >= 7);
  assert.ok(
    limited.length >= deletes.length,
    "every delete names a demo address",
  );
  // A real member that somehow had a demo row would still be refused by the table.
  await assert.rejects(
    sql.execute({
      sql: "INSERT INTO eighty_demo_accounts (user_id, email, person, visitor, created_at) VALUES (?, ?, 'maria', 'x', now() - interval '30 days')",
      args: [real.userId, real.email],
    }),
  );
  await runDemoReset();
  assert.equal((await holdings(real)).members, 1);
});
