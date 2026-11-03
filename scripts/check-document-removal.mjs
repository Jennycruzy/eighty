import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { getDbExec } from "@agent-native/core/db";
import {
  registerPrivateBlobProvider,
  unregisterPrivateBlobProvider,
} from "@agent-native/core/private-blob";

import { removeDocument } from "../server/lib/document-records.ts";
import {
  createEvidenceDraft,
  changeEvidenceRecord,
} from "../server/lib/evidence-records.ts";
import { getMemberRecord } from "../server/lib/member-records.ts";

// The caller has checked the disposable database marker and supplied real verified cookie contexts.
export async function checkDocumentRemoval(
  owner,
  other,
  inAccount,
  context,
  otherContext,
) {
  const sql = getDbExec(),
    objects = new Set();
  let deletes = 0,
    failBlob = false;
  const provider = "eighty-removal-check";
  registerPrivateBlobProvider({
    id: provider,
    name: "Disposable deletion transport",
    isConfigured: () => true,
    put: async () => {
      throw new Error("This check seeds only synthetic handles");
    },
    read: async () => {
      throw new Error("This check never reads documents");
    },
    delete: async (handle) => {
      deletes++;
      const row = await sql.execute({
        sql: "SELECT id FROM eighty_documents WHERE id=?",
        args: [handle.id],
      });
      assert.equal(
        row.rows.length,
        0,
        "The row must commit before the stored file is deleted",
      );
      if (failBlob) throw new Error("Synthetic storage outage");
      objects.delete(handle.id);
      return { deleted: true, provider };
    },
  });
  const rows = async (table, id) =>
    (
      await sql.execute({
        sql: `SELECT * FROM ${table} WHERE id=?`,
        args: [id],
      })
    ).rows;
  async function make() {
    const id = randomUUID(),
      member = await inAccount(owner, () => getMemberRecord(owner));
    objects.add(id);
    await sql.execute({
      sql: "INSERT INTO eighty_documents (id,owner_email,member_id,handle,mime,bytes,pages,hash) VALUES (?,?,?,?,?,?,?,?)",
      args: [
        id,
        owner.email,
        member.id,
        JSON.stringify({ id, provider, encrypted: true, opaque: true }),
        "image/png",
        100,
        1,
        id,
      ],
    });
    return id;
  }
  const remove = (id) => inAccount(owner, () => removeDocument(id, context));
  async function trigger(table, enabled) {
    await sql.execute({
      sql: `DROP TRIGGER IF EXISTS eighty_test_delete_failure ON ${table}`,
      args: [],
    });
    if (enabled) {
      await sql.execute({
        sql: "CREATE OR REPLACE FUNCTION eighty_test_delete_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic commit failure'; END $$",
        args: [],
      });
      await sql.execute({
        sql: `CREATE CONSTRAINT TRIGGER eighty_test_delete_failure AFTER DELETE ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION eighty_test_delete_failure()`,
        args: [],
      });
    }
  }
  try {
    const id = await make();
    let line = await inAccount(owner, () =>
      createEvidenceDraft(
        {
          documentId: id,
          fields: {
            kind: "service",
            organization: "Synthetic pantry",
            start: "2026-11-01",
            end: "2026-11-01",
            hours: 3,
          },
        },
        context,
      ),
    );
    await assert.rejects(
      inAccount(other, () => removeDocument(id, otherContext)),
      { statusCode: 404 },
    );
    await assert.rejects(remove(id), { statusCode: 409 });
    line = await inAccount(owner, () =>
      changeEvidenceRecord(
        "confirm",
        { id: line.id, version: line.version },
        context,
      ),
    );
    await assert.rejects(remove(id), { statusCode: 409 });
    line = await inAccount(owner, () =>
      changeEvidenceRecord(
        "reject",
        { id: line.id, version: line.version },
        context,
      ),
    );
    const extra = await inAccount(owner, () =>
      createEvidenceDraft(
        {
          documentId: id,
          fields: {
            kind: "service",
            organization: "Another synthetic group",
            start: "2026-11-02",
            end: "2026-11-02",
            hours: 2,
          },
        },
        context,
      ),
    );
    await assert.rejects(remove(id), { statusCode: 409 });
    await inAccount(owner, () =>
      changeEvidenceRecord(
        "reject",
        { id: extra.id, version: extra.version },
        context,
      ),
    );
    await remove(id); // Regression: the rejected line must not retain its file forever.
    assert.equal(objects.has(id), false);
    assert.equal((await rows("eighty_documents", id)).length, 0);
    const events = await sql.execute({
      sql: "SELECT actor_id FROM eighty_member_events WHERE target_id=? AND kind='document-removed'",
      args: [id],
    });
    assert.equal(events.rows.length, 1);
    assert.equal(events.rows[0].actor_id, owner.userId);
    const rejected = await sql.execute({
      sql: "SELECT document_id,status FROM eighty_evidence WHERE id=?",
      args: [line.id],
    });
    assert.equal(rejected.rows[0].document_id, null);
    assert.equal(rejected.rows[0].status, "rejected");
    const rollback = await make(),
      before = deletes;
    await trigger("eighty_documents", true);
    await assert.rejects(remove(rollback));
    await trigger("eighty_documents", false);
    assert.equal(
      deletes,
      before,
      "A failed database commit must never delete the blob",
    );
    assert.equal(objects.has(rollback), true);
    assert.equal((await rows("eighty_documents", rollback)).length, 1);
    assert.equal((await rows("eighty_document_deletions", rollback)).length, 0);
    const pending = await make();
    failBlob = true;
    const result = await remove(pending);
    assert.equal(result.pending, true);
    assert.equal((await rows("eighty_documents", pending)).length, 0);
    assert.equal(objects.has(pending), true);
    assert.equal((await rows("eighty_document_deletions", pending)).length, 1);
    failBlob = false;
    // A failure acknowledging a successful storage delete must also leave a retry record.
    await trigger("eighty_document_deletions", true);
    await remove(pending);
    await trigger("eighty_document_deletions", false);
    assert.equal(objects.has(pending), false);
    assert.equal((await rows("eighty_document_deletions", pending)).length, 1);
    await remove(pending);
    assert.equal((await rows("eighty_document_deletions", pending)).length, 0);
    await remove(rollback);
    const automatic = await make();
    failBlob = true;
    await remove(automatic);
    failBlob = false;
    await sql.execute({
      sql: "UPDATE eighty_document_deletions SET next_attempt_at=now()-interval '1 minute' WHERE id=?",
      args: [automatic],
    });
    const { retryDocumentDeletions } =
      await import("../server/lib/document-deletions.ts");
    await retryDocumentDeletions();
    assert.equal(objects.has(automatic), false);
    assert.equal(
      (await rows("eighty_document_deletions", automatic)).length,
      0,
    );
    console.log(
      "PASS Rejected evidence releases files; active evidence protects them; commit and storage failures preserve a retryable deletion with one member event.",
    );
  } finally {
    await trigger("eighty_documents", false);
    const exists = await sql.execute({
      sql: "SELECT to_regclass('eighty_document_deletions') AS name",
      args: [],
    });
    if (exists.rows[0]?.name) await trigger("eighty_document_deletions", false);
    await sql.execute({
      sql: "DROP FUNCTION IF EXISTS eighty_test_delete_failure()",
      args: [],
    });
    unregisterPrivateBlobProvider(provider);
  }
}
