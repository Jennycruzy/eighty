import { createHash, randomUUID } from "node:crypto";

import type { ActionRunContext } from "@agent-native/core/action";
import {
  putPrivateBlob,
  readPrivateBlob,
  deletePrivateBlob,
  type PrivateBlobHandle,
} from "@agent-native/core/private-blob";
import { and, eq, ne, count, sum } from "drizzle-orm";
import { createError } from "h3";

import { documentUpload } from "../../shared/document-upload.ts";
import { getDb } from "../db/index.ts";
import {
  documents,
  documentDeletions,
  evidence,
  members,
  memberEvents,
} from "../db/schema.ts";
import { inspectDocument } from "./document-content.ts";
import { processDocumentDeletion } from "./document-deletions.ts";
import { reviewedMemberActor, browserMemberActor } from "./member-identity.ts";
import { getMemberRecord } from "./member-records.ts";

const publicColumns = {
  id: documents.id,
  mime: documents.mime,
  pages: documents.pages,
  bytes: documents.bytes,
  rotation: documents.rotation,
  createdAt: documents.createdAt,
};
export async function inspectUpload(
  input: unknown,
  context: ActionRunContext | undefined,
) {
  await getMemberRecord(await reviewedMemberActor(context));
  const parsed = documentUpload.parse(input);
  return inspectDocument(Buffer.from(parsed.data, "base64"), parsed.rotation);
}
export async function saveDocument(
  input: unknown,
  context: ActionRunContext | undefined,
) {
  const parsed = documentUpload.parse(input),
    actor = await reviewedMemberActor(context);
  const member = await getMemberRecord(actor),
    bytes = Buffer.from(parsed.data, "base64");
  const inspected = await inspectDocument(bytes, parsed.rotation);
  if (
    (inspected.quality?.dark || inspected.quality?.blurry) &&
    !parsed.acceptQuality
  )
    throw createError({
      statusCode: 422,
      statusMessage: "Retake this photo or check that you can read it",
    });
  const hash = createHash("sha256").update(bytes).digest("hex");
  let uploaded: PrivateBlobHandle | null = null;
  try {
    return await getDb().transaction(async (tx) => {
      await tx
        .select({ id: members.id })
        .from(members)
        .where(eq(members.id, member.id))
        .for("update");
      const own = and(
        eq(documents.memberId, member.id),
        eq(documents.ownerEmail, actor.email),
      );
      const [existing] = await tx
        .select(publicColumns)
        .from(documents)
        .where(and(own, eq(documents.hash, hash)));
      if (existing) return { ...existing, existing: true };
      const [usage] = await tx
        .select({ files: count(), bytes: sum(documents.bytes) })
        .from(documents)
        .where(own);
      if (
        Number(usage?.files) >= 200 ||
        Number(usage?.bytes) + bytes.length > 300 * 1024 * 1024
      )
        throw createError({
          statusCode: 413,
          statusMessage:
            "Your file space is full. Remove an unused file first.",
        });
      const id = randomUUID();
      const handle = await putPrivateBlob({
        data: bytes,
        filename: id,
        mimeType: inspected.mime,
        ownerEmail: actor.email,
        metadata: { purpose: "eighty-document" },
      });
      if (!handle)
        throw createError({
          statusCode: 503,
          statusMessage:
            "Private file storage is not ready. You can type the facts instead.",
        });
      uploaded = handle;
      if (!handle.encrypted || !handle.opaque)
        throw new Error("Private encryption required");
      const [row] = await tx
        .insert(documents)
        .values({
          id,
          memberId: member.id,
          ownerEmail: actor.email,
          handle,
          mime: inspected.mime,
          pages: inspected.pages,
          bytes: bytes.length,
          rotation: parsed.rotation,
          hash,
        })
        .returning(publicColumns);
      return { ...row!, existing: false };
    });
  } catch (error) {
    if (uploaded) await deletePrivateBlob(uploaded);
    throw error;
  }
}
export async function listDocuments(context: ActionRunContext | undefined) {
  const actor = await browserMemberActor(context),
    member = await getMemberRecord(actor);
  return getDb()
    .select(publicColumns)
    .from(documents)
    .where(
      and(
        eq(documents.memberId, member.id),
        eq(documents.ownerEmail, actor.email),
      ),
    )
    .orderBy(documents.createdAt);
}
export async function readDocument(
  id: string,
  context: ActionRunContext | undefined,
) {
  const actor = await browserMemberActor(context),
    member = await getMemberRecord(actor);
  const [row] = await getDb()
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.memberId, member.id),
        eq(documents.ownerEmail, actor.email),
      ),
    );
  if (!row)
    throw createError({ statusCode: 404, statusMessage: "File not found" });
  const original = Buffer.from((await readPrivateBlob(row.handle)).data);
  const inspected = await inspectDocument(original, row.rotation);
  return { id: row.id, original: original.toString("base64"), ...inspected };
}
export async function removeDocument(
  id: string,
  context: ActionRunContext | undefined,
) {
  const actor = await reviewedMemberActor(context),
    member = await getMemberRecord(actor);
  await getDb().transaction(async (tx) => {
    await tx
      .select({ id: members.id })
      .from(members)
      .where(eq(members.id, member.id))
      .for("update");
    const condition = and(
      eq(documents.id, id),
      eq(documents.memberId, member.id),
      eq(documents.ownerEmail, actor.email),
    );
    const [row] = await tx.select().from(documents).where(condition);
    if (!row) {
      const [pending] = await tx
        .select({ id: documentDeletions.id })
        .from(documentDeletions)
        .where(
          and(
            eq(documentDeletions.id, id),
            eq(documentDeletions.memberId, member.id),
            eq(documentDeletions.ownerEmail, actor.email),
          ),
        );
      if (pending) return;
      throw createError({ statusCode: 404, statusMessage: "File not found" });
    }
    const active = await tx
      .select({ id: evidence.id })
      .from(evidence)
      .where(and(eq(evidence.documentId, id), ne(evidence.status, "rejected")))
      .limit(1);
    if (active.length)
      throw createError({
        statusCode: 409,
        statusMessage:
          "This file backs a line that still needs review or is confirmed. Keep it as proof.",
      });
    await tx.insert(documentDeletions).values({
      id,
      memberId: member.id,
      ownerEmail: actor.email,
      handle: row.handle,
      nextAttemptAt: new Date(Date.now() + 60_000),
    });
    await tx.delete(documents).where(condition);
    await tx.insert(memberEvents).values({
      id: randomUUID(),
      memberId: member.id,
      ownerEmail: actor.email,
      actorId: actor.userId,
      kind: "document-removed",
      targetId: id,
    });
  });
  // Storage is touched only after the row, event and retry record have committed.
  // A failed acknowledgment also leaves the retry record for an idempotent delete.
  let deleted = false;
  try {
    deleted = await processDocumentDeletion(id);
  } catch {
    /* The durable record remains. */
  }
  return { deleted, pending: !deleted };
}
