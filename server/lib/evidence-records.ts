import { randomUUID } from "node:crypto";

import type { ActionRunContext } from "@agent-native/core/action";
import { and, eq, ne } from "drizzle-orm";
import { createError } from "h3";
import { z } from "zod";

import {
  mightDuplicate,
  missingDuplicateKeys,
} from "../../shared/evidence-duplicates.ts";
import { evidenceFields } from "../../shared/evidence.ts";
import { getDb } from "../db/index.ts";
import {
  documents,
  evidence,
  evidenceVersions,
  memberEvents,
  members,
} from "../db/schema.ts";
import { memberActor, reviewedMemberActor } from "./member-identity.ts";
import { getMemberRecord } from "./member-records.ts";

export const evidenceReference = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
});
export const draftInput = z.strictObject({
  fields: evidenceFields,
  documentId: z.uuid().optional(),
});
export const editInput = evidenceReference.extend({ fields: evidenceFields });

export async function listEvidenceRecords(
  context: ActionRunContext | undefined,
) {
  const actor = await memberActor(context);
  const member = await getMemberRecord(actor);
  // Never return private storage handles or an unrelated account's rows.
  return getDb()
    .select()
    .from(evidence)
    .where(
      and(
        eq(evidence.memberId, member.id),
        eq(evidence.ownerEmail, actor.email),
      ),
    )
    .orderBy(evidence.createdAt, evidence.id);
}

export async function createEvidenceDraft(
  input: z.infer<typeof draftInput>,
  context: ActionRunContext | undefined,
) {
  const parsed = draftInput.parse(input);
  const actor = await reviewedMemberActor(context);
  const member = await getMemberRecord(actor);
  return getDb().transaction(async (tx) => {
    await tx
      .select({ id: members.id })
      .from(members)
      .where(eq(members.id, member.id))
      .for("update");
    if (parsed.documentId) {
      const [document] = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.id, parsed.documentId),
            eq(documents.memberId, member.id),
            eq(documents.ownerEmail, actor.email),
          ),
        );
      if (!document)
        throw createError({
          statusCode: 404,
          statusMessage: "Document not found",
        });
    }
    const [row] = await tx
      .insert(evidence)
      .values({
        id: randomUUID(),
        ownerEmail: actor.email,
        memberId: member.id,
        documentId: parsed.documentId ?? null,
        fields: parsed.fields,
        status: "proposed",
        createdBy: "member",
        version: 1,
      })
      .returning();
    if (!row)
      throw createError({
        statusCode: 500,
        statusMessage: "Evidence could not be saved",
      });
    await tx.insert(evidenceVersions).values({
      evidenceId: row.id,
      version: row.version,
      ownerEmail: actor.email,
      fields: row.fields,
      status: row.status,
      createdBy: "member",
    });
    await tx.insert(memberEvents).values({
      id: randomUUID(),
      ownerEmail: actor.email,
      memberId: member.id,
      actorId: actor.userId,
      kind: "evidence-proposed",
      targetId: row.id,
    });
    return row;
  });
}

export async function changeEvidenceRecord(
  operation: "edit" | "confirm" | "reject",
  input: z.infer<typeof editInput> | z.infer<typeof evidenceReference>,
  context: ActionRunContext | undefined,
) {
  const reference =
    operation === "edit"
      ? editInput.parse(input)
      : evidenceReference.parse(input);
  const actor = await reviewedMemberActor(context);
  const member = await getMemberRecord(actor);
  return getDb().transaction(async (tx) => {
    // Serialize changes for this member, including two overlapping confirmations.
    await tx
      .select({ id: members.id })
      .from(members)
      .where(eq(members.id, member.id))
      .for("update");
    const ownRow = and(
      eq(evidence.id, reference.id),
      eq(evidence.memberId, member.id),
      eq(evidence.ownerEmail, actor.email),
    );
    const [current] = await tx.select().from(evidence).where(ownRow);
    if (!current)
      throw createError({
        statusCode: 404,
        statusMessage: "Evidence not found",
      });
    if (current.version !== reference.version)
      throw createError({
        statusCode: 409,
        statusMessage: "This evidence changed. Open it again before saving.",
      });
    if (operation === "confirm" && current.status !== "proposed")
      throw createError({
        statusCode: 409,
        statusMessage: "Only a proposed line can be confirmed",
      });
    const fields =
      operation === "edit" ? editInput.parse(input).fields : current.fields;
    if (operation === "confirm") {
      const missing = missingDuplicateKeys(fields);
      if (missing.length)
        throw createError({
          statusCode: 422,
          statusMessage: "Add the dates and organization before confirming",
          data: { missing },
        });
      const confirmed = await tx
        .select({ id: evidence.id, fields: evidence.fields })
        .from(evidence)
        .where(
          and(
            eq(evidence.memberId, member.id),
            eq(evidence.ownerEmail, actor.email),
            eq(evidence.status, "confirmed"),
            ne(evidence.id, current.id),
          ),
        );
      const duplicates = confirmed
        .filter((other) => mightDuplicate(fields, other.fields))
        .map((other) => other.id);
      if (duplicates.length)
        throw createError({
          statusCode: 409,
          statusMessage:
            "These dates may already count. Review the other line first.",
          data: { duplicates },
        });
    }
    // Editing a confirmed line removes its confirmation before its new values can count.
    const status =
      operation === "edit"
        ? "proposed"
        : operation === "confirm"
          ? "confirmed"
          : "rejected";
    const [row] = await tx
      .update(evidence)
      .set({
        fields,
        status,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(ownRow)
      .returning();
    if (!row)
      throw createError({
        statusCode: 500,
        statusMessage: "Evidence could not be saved",
      });
    await tx.insert(evidenceVersions).values({
      evidenceId: row.id,
      version: row.version,
      ownerEmail: actor.email,
      fields: row.fields,
      status: row.status,
      createdBy: "member",
    });
    await tx.insert(memberEvents).values({
      id: randomUUID(),
      ownerEmail: actor.email,
      memberId: member.id,
      actorId: actor.userId,
      kind: `evidence-${operation}`,
      targetId: row.id,
    });
    return row;
  });
}
