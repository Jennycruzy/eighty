import { randomUUID } from "node:crypto";

import type { ActionRunContext } from "@agent-native/core/action";
import { and, eq, ne } from "drizzle-orm";
import { createError } from "h3";
import { z } from "zod";

import {
  mightDuplicate,
  missingDuplicateKeys,
} from "../../shared/evidence-duplicates.ts";
import {
  evidenceReference,
  confirmInput,
} from "../../shared/evidence-review.ts";
import { evidenceFields, type EvidenceFields } from "../../shared/evidence.ts";
import type { ReaderResult } from "../../shared/evidence.ts";
import type { ReaderQuestion } from "../../shared/reader.ts";
export {
  evidenceReference,
  confirmInput,
} from "../../shared/evidence-review.ts";
import { getDb } from "../db/index.ts";
import {
  documents,
  evidence,
  evidenceVersions,
  memberEvents,
  members,
} from "../db/schema.ts";
import {
  memberActor,
  reviewedMemberActor,
  ownMemberActor,
  type MemberActor,
} from "./member-identity.ts";
import { getMemberRecord } from "./member-records.ts";

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

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Member = Awaited<ReturnType<typeof getMemberRecord>>;
interface ProposedLine {
  fields: EvidenceFields;
  documentId: string | null;
  createdBy: "member" | "agent";
  confidence?: number | null;
  questions?: ReaderQuestion[];
}

// Typed entry and the reader both save through here: always "proposed",
// version 1, with its history row and member event in the same transaction.
async function insertProposedLine(
  tx: Tx,
  actor: MemberActor,
  member: Member,
  line: ProposedLine,
) {
  const [row] = await tx
    .insert(evidence)
    .values({
      id: randomUUID(),
      ownerEmail: actor.email,
      memberId: member.id,
      documentId: line.documentId,
      fields: line.fields,
      status: "proposed",
      createdBy: line.createdBy,
      confidence: line.confidence ?? null,
      questions: line.questions ?? [],
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
    createdBy: line.createdBy,
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
}

async function lockMemberAndDocument(
  tx: Tx,
  actor: MemberActor,
  member: Member,
  documentId: string | undefined | null,
) {
  await tx
    .select({ id: members.id })
    .from(members)
    .where(eq(members.id, member.id))
    .for("update");
  if (!documentId) return;
  const [document] = await tx
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
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

export async function createEvidenceDraft(
  input: z.infer<typeof draftInput>,
  context: ActionRunContext | undefined,
  createdBy: "member" | "agent" = "member",
) {
  const parsed = draftInput.parse(input);
  const actor =
    createdBy === "agent"
      ? await ownMemberActor(context)
      : await reviewedMemberActor(context);
  const member = await getMemberRecord(actor);
  return getDb().transaction(async (tx) => {
    await lockMemberAndDocument(tx, actor, member, parsed.documentId);
    const { fields, carried } = await carryServiceFacts(
      tx,
      actor,
      member,
      parsed.fields,
    );
    const row = await insertProposedLine(tx, actor, member, {
      fields,
      documentId: parsed.documentId ?? null,
      createdBy,
    });
    return carried ? { ...row, carried } : row;
  });
}

const SERVICE_FACTS = [
  "unpaid",
  "directCommunityBenefit",
  "publicOrNonprofit",
  "structuredAndSupervised",
  "nonpartisan",
  "tracksDatesAndHours",
  "confirmationContact",
] as const;

/** Lowercase words of a name, without notes in brackets or punctuation. */
export function organizationWords(name: string | null | undefined): string[] {
  return (name ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

type EvidenceRow = typeof evidence.$inferSelect;
const fieldsOf = (row: EvidenceRow) => row.fields as EvidenceFields;

/**
 * A volunteer line told in a few words ("4 hours at the pantry on Saturday")
 * lacks the facts the rule needs. When the member already has a confirmed
 * service line at the same organization, copy that line's service facts and
 * contact into the new proposal: only fields still missing, and only from this
 * member's own confirmed lines. The member still checks the line before it counts.
 */
async function carryServiceFacts(
  tx: Tx,
  actor: MemberActor,
  member: Member,
  fields: EvidenceFields,
): Promise<{
  fields: EvidenceFields;
  carried?: { fromLine: string; organization: string; facts: string[] };
}> {
  const said = organizationWords(fields.organization);
  if (fields.kind !== "service" || !said.length) return { fields };
  const confirmed = await tx
    .select()
    .from(evidence)
    .where(
      and(
        eq(evidence.memberId, member.id),
        eq(evidence.ownerEmail, actor.email),
        eq(evidence.status, "confirmed"),
      ),
    )
    .orderBy(evidence.createdAt, evidence.id);
  const lines = confirmed.filter((row) => {
    const f = fieldsOf(row);
    return f.kind === "service" && f.service && f.organization;
  });
  const wordsOf = (row: EvidenceRow) =>
    organizationWords(fieldsOf(row).organization);
  // The same name first; otherwise the one organization whose name holds every word said.
  let matches = lines.filter((row) => wordsOf(row).join(" ") === said.join(" "));
  if (!matches.length && said.length >= 2) {
    const named = new Set(
      lines
        .filter((row) => said.every((word) => wordsOf(row).includes(word)))
        .map((row) => fieldsOf(row).organization),
    );
    if (named.size === 1) {
      const [only] = [...named];
      matches = lines.filter((row) => fieldsOf(row).organization === only);
    }
  }
  const source = matches[matches.length - 1];
  if (!source) return { fields };
  const from = fieldsOf(source);
  const known = (from.service ?? {}) as Record<string, unknown>;
  const service = { ...(fields.service ?? {}) } as Record<string, unknown>;
  const facts: string[] = [];
  for (const key of SERVICE_FACTS) {
    if (service[key] == null && known[key] != null) {
      service[key] = known[key];
      facts.push(key);
    }
  }
  if (!facts.length) return { fields };
  return {
    fields: evidenceFields.parse({
      ...fields,
      organization: from.organization,
      service,
    }),
    carried: {
      fromLine: source.id,
      organization: from.organization as string,
      facts,
    },
  };
}

/** Lines the reader already proposed from this document, in any status. */
export async function readerLinesFor(
  actor: MemberActor,
  member: Member,
  documentId: string,
  tx: Tx | ReturnType<typeof getDb> = getDb(),
) {
  return tx
    .select()
    .from(evidence)
    .where(
      and(
        eq(evidence.memberId, member.id),
        eq(evidence.ownerEmail, actor.email),
        eq(evidence.documentId, documentId),
        eq(evidence.createdBy, "agent"),
      ),
    )
    .orderBy(evidence.createdAt, evidence.id);
}

function sameFields(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .sort(([x], [y]) => (x < y ? -1 : 1))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * Saves a reading as proposed lines. A document is read into lines once: when
 * it already has reader lines, those are returned and nothing new is saved.
 * The member lock makes two reads of one document save one set of lines.
 */
export async function saveReaderProposals(
  actor: MemberActor,
  member: Member,
  documentId: string,
  proposals: ReaderResult["proposals"],
) {
  return getDb().transaction(async (tx) => {
    await lockMemberAndDocument(tx, actor, member, documentId);
    const existing = await readerLinesFor(actor, member, documentId, tx);
    if (existing.length) return { lines: existing, created: false };
    const lines = [];
    const seen: unknown[] = [];
    for (const proposal of proposals) {
      if (seen.some((fields) => sameFields(fields, proposal.fields))) continue;
      seen.push(proposal.fields);
      lines.push(
        await insertProposedLine(tx, actor, member, {
          fields: evidenceFields.parse(proposal.fields),
          documentId,
          createdBy: "agent",
          confidence: Math.round(proposal.confidence * 10_000),
          questions: proposal.questions,
        }),
      );
    }
    return { lines, created: lines.length > 0 };
  });
}

export async function changeEvidenceRecord(
  operation: "edit" | "confirm" | "reject",
  input: z.infer<typeof editInput> | z.infer<typeof confirmInput>,
  context: ActionRunContext | undefined,
) {
  const reference =
    operation === "edit"
      ? editInput.parse(input)
      : operation === "confirm"
        ? confirmInput.parse(input)
        : evidenceReference.parse(input);
  const separate =
    operation === "confirm"
      ? confirmInput.parse(input).duplicateChoice
      : undefined;
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
        .select({
          id: evidence.id,
          version: evidence.version,
          fields: evidence.fields,
        })
        .from(evidence)
        .where(
          and(
            eq(evidence.memberId, member.id),
            eq(evidence.ownerEmail, actor.email),
            eq(evidence.status, "confirmed"),
            ne(evidence.id, current.id),
          ),
        );
      const compared = confirmed
        .filter((other) => mightDuplicate(fields, other.fields))
        .map(({ id, version }) => ({ id, version }));
      const duplicates = compared.map((line) => line.id);
      const unchangedComparison =
        separate &&
        compared.length === separate.compared.length &&
        compared.every((line) =>
          separate.compared.some(
            (previous) =>
              previous.id === line.id && previous.version === line.version,
          ),
        );
      if (separate && !unchangedComparison)
        throw createError({
          statusCode: 409,
          statusMessage: "The other lines changed. Review the warning again.",
          data: { duplicates, compared },
        });
      if (duplicates.length && !separate)
        throw createError({
          statusCode: 409,
          statusMessage:
            "These dates may already count. Review the other line first.",
          data: { duplicates, compared },
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
        // The member's own edit answers the reader's questions.
        ...(operation === "edit" ? { questions: [] } : {}),
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
      duplicateChoice: separate ?? null,
    });
    await tx.insert(memberEvents).values({
      id: randomUUID(),
      ownerEmail: actor.email,
      memberId: member.id,
      actorId: actor.userId,
      kind: separate ? "evidence-confirm-separate" : `evidence-${operation}`,
      details: separate ?? null,
      targetId: row.id,
    });
    return row;
  });
}
