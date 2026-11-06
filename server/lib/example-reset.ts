import { randomUUID } from "node:crypto";

import { invalidateMemberOrgCaches } from "@agent-native/core/org";
import { and, eq, like, lt, sql } from "drizzle-orm";

import { getDb } from "../db/index.ts";
import { documentDeletions, documents, members } from "../db/schema.ts";
import {
  EXAMPLE_EMAIL_DOMAIN,
  EXAMPLE_ORGANIZATION_ID,
} from "./example-identity.ts";
import { exampleAccounts, exampleResets } from "./example-schema.ts";
import { processDocumentDeletion } from "./document-deletions.ts";

export const EXAMPLE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const exampleAddress = `%@${EXAMPLE_EMAIL_DOMAIN}`;

// Removes one example account with its member record, evidence, versions, events
// and documents. Every delete names a example address in the query itself, so a
// real member can never match.
export async function removeExampleAccount(
  userId: string,
  documentIds: string[],
) {
  return getDb().transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(exampleAccounts)
      .where(
        and(
          eq(exampleAccounts.userId, userId),
          like(exampleAccounts.email, exampleAddress),
        ),
      )
      .for("update");
    if (!account) return false;
    // Matched by the example address, so a record left by a half-finished start
    // is removed too.
    const own = and(
      eq(documents.ownerEmail, account.email),
      like(documents.ownerEmail, exampleAddress),
    );
    const files = await tx.select().from(documents).where(own);
    // Same durable record as a member's own removal. Storage is deleted after
    // commit, and the existing retry job keeps trying until it is confirmed.
    for (const file of files) {
      await tx.insert(documentDeletions).values({
        id: file.id,
        memberId: file.memberId,
        ownerEmail: file.ownerEmail,
        handle: file.handle,
        nextAttemptAt: new Date(),
      });
      documentIds.push(file.id);
    }
    await tx.delete(documents).where(own);
    // Evidence, versions and events go with the member row (ON DELETE CASCADE).
    await tx
      .delete(members)
      .where(
        and(
          eq(members.ownerEmail, account.email),
          like(members.ownerEmail, exampleAddress),
        ),
      );
    await tx.execute(
      sql`DELETE FROM org_members WHERE org_id = ${EXAMPLE_ORGANIZATION_ID} AND email = ${account.email} AND email LIKE ${exampleAddress}`,
    );
    await tx.execute(
      sql`DELETE FROM session WHERE user_id IN (SELECT id FROM "user" WHERE id = ${account.userId} AND email = ${account.email} AND email LIKE ${exampleAddress})`,
    );
    await tx.execute(
      sql`DELETE FROM account WHERE user_id IN (SELECT id FROM "user" WHERE id = ${account.userId} AND email = ${account.email} AND email LIKE ${exampleAddress})`,
    );
    await tx.execute(
      sql`DELETE FROM "user" WHERE id = ${account.userId} AND email = ${account.email} AND email LIKE ${exampleAddress}`,
    );
    await tx
      .delete(exampleAccounts)
      .where(
        and(
          eq(exampleAccounts.userId, account.userId),
          like(exampleAccounts.email, exampleAddress),
        ),
      );
    return true;
  });
}

// The database's own message, without the query text and its values.
function reason(error: unknown): string {
  const cause =
    error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
  const text =
    cause instanceof Error
      ? cause.message
      : error instanceof Error
        ? error.message
        : String(error ?? "unknown error");
  return text.slice(0, 500) || "unknown error";
}

export async function runExampleReset(
  signal?: AbortSignal,
  now: Date = new Date(),
) {
  const id = randomUUID();
  await getDb()
    .insert(exampleResets)
    .values({ id, startedAt: new Date(), status: "running" });
  let accountsRemoved = 0;
  const queued: string[] = [];
  try {
    const old = await getDb()
      .select({ userId: exampleAccounts.userId })
      .from(exampleAccounts)
      .where(
        and(
          lt(
            exampleAccounts.createdAt,
            new Date(now.getTime() - EXAMPLE_MAX_AGE_MS),
          ),
          like(exampleAccounts.email, exampleAddress),
        ),
      )
      .orderBy(exampleAccounts.createdAt);
    for (const row of old) {
      if (signal?.aborted) throw new Error("The reset ran out of time.");
      const files: string[] = [];
      if (await removeExampleAccount(row.userId, files)) accountsRemoved++;
      queued.push(...files);
    }
    invalidateMemberOrgCaches();
    for (const file of queued) {
      try {
        await processDocumentDeletion(file);
      } catch {
        /* The durable record stays for the retry job. */
      }
    }
    await getDb()
      .update(exampleResets)
      .set({
        status: "completed",
        finishedAt: new Date(),
        accountsRemoved,
        documentsQueued: queued.length,
      })
      .where(eq(exampleResets.id, id));
  } catch (error) {
    await getDb()
      .update(exampleResets)
      .set({
        status: "failed",
        finishedAt: new Date(),
        accountsRemoved,
        documentsQueued: queued.length,
        errors: reason(error),
      })
      .where(eq(exampleResets.id, id));
    throw error;
  }
  return { id, accountsRemoved, documentsQueued: queued.length };
}
