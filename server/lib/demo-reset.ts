import { randomUUID } from "node:crypto";

import { invalidateMemberOrgCaches } from "@agent-native/core/org";
import { and, eq, like, lt, sql } from "drizzle-orm";

import { getDb } from "../db/index.ts";
import { documentDeletions, documents, members } from "../db/schema.ts";
import { DEMO_EMAIL_DOMAIN, DEMO_ORGANIZATION_ID } from "./demo-identity.ts";
import { demoAccounts, demoResets } from "./demo-schema.ts";
import { processDocumentDeletion } from "./document-deletions.ts";

export const DEMO_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const demoAddress = `%@${DEMO_EMAIL_DOMAIN}`;

// Removes demo accounts older than a day, with their member record, evidence,
// versions, events and documents. Every delete names a demo address in the
// query itself, so a real member can never match.
async function removeAccount(userId: string, documentIds: string[]) {
  return getDb().transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(demoAccounts)
      .where(
        and(
          eq(demoAccounts.userId, userId),
          like(demoAccounts.email, demoAddress),
        ),
      )
      .for("update");
    if (!account) return false;
    // Matched by the demo address, so a record left by a half-finished start
    // is removed too.
    const own = and(
      eq(documents.ownerEmail, account.email),
      like(documents.ownerEmail, demoAddress),
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
          like(members.ownerEmail, demoAddress),
        ),
      );
    await tx.execute(
      sql`DELETE FROM org_members WHERE org_id = ${DEMO_ORGANIZATION_ID} AND email = ${account.email} AND email LIKE ${demoAddress}`,
    );
    await tx.execute(
      sql`DELETE FROM session WHERE user_id IN (SELECT id FROM "user" WHERE id = ${account.userId} AND email = ${account.email} AND email LIKE ${demoAddress})`,
    );
    await tx.execute(
      sql`DELETE FROM account WHERE user_id IN (SELECT id FROM "user" WHERE id = ${account.userId} AND email = ${account.email} AND email LIKE ${demoAddress})`,
    );
    await tx.execute(
      sql`DELETE FROM "user" WHERE id = ${account.userId} AND email = ${account.email} AND email LIKE ${demoAddress}`,
    );
    await tx
      .delete(demoAccounts)
      .where(
        and(
          eq(demoAccounts.userId, account.userId),
          like(demoAccounts.email, demoAddress),
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

export async function runDemoReset(
  signal?: AbortSignal,
  now: Date = new Date(),
) {
  const id = randomUUID();
  await getDb()
    .insert(demoResets)
    .values({ id, startedAt: new Date(), status: "running" });
  let accountsRemoved = 0;
  const queued: string[] = [];
  try {
    const old = await getDb()
      .select({ userId: demoAccounts.userId })
      .from(demoAccounts)
      .where(
        and(
          lt(demoAccounts.createdAt, new Date(now.getTime() - DEMO_MAX_AGE_MS)),
          like(demoAccounts.email, demoAddress),
        ),
      )
      .orderBy(demoAccounts.createdAt);
    for (const row of old) {
      if (signal?.aborted) throw new Error("The reset ran out of time.");
      const files: string[] = [];
      if (await removeAccount(row.userId, files)) accountsRemoved++;
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
      .update(demoResets)
      .set({
        status: "completed",
        finishedAt: new Date(),
        accountsRemoved,
        documentsQueued: queued.length,
      })
      .where(eq(demoResets.id, id));
  } catch (error) {
    await getDb()
      .update(demoResets)
      .set({
        status: "failed",
        finishedAt: new Date(),
        accountsRemoved,
        documentsQueued: queued.length,
        errors: reason(error),
      })
      .where(eq(demoResets.id, id));
    throw error;
  }
  return { id, accountsRemoved, documentsQueued: queued.length };
}
