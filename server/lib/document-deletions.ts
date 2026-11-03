import { deletePrivateBlob } from "@agent-native/core/private-blob";
import { eq, lte } from "drizzle-orm";

import { getDb } from "../db/index.ts";
import { documentDeletions } from "../db/schema.ts";

// Internal work only. An authenticated member action creates the durable record.
export async function processDocumentDeletion(id: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(documentDeletions)
      .where(eq(documentDeletions.id, id))
      .for("update");
    if (!row) return true;
    let deleted = false;
    try {
      deleted = (await deletePrivateBlob(row.handle)).deleted;
    } catch {
      /* Keep the handle until a retry succeeds. */
    }
    if (deleted)
      await tx.delete(documentDeletions).where(eq(documentDeletions.id, id));
    else
      await tx
        .update(documentDeletions)
        .set({
          attempts: row.attempts + 1,
          nextAttemptAt: new Date(
            Date.now() +
              Math.min(3_600_000, 60_000 * 2 ** Math.min(row.attempts, 6)),
          ),
        })
        .where(eq(documentDeletions.id, id));
    return deleted;
  });
}
export async function retryDocumentDeletions(signal?: AbortSignal) {
  const due = await getDb()
    .select({ id: documentDeletions.id })
    .from(documentDeletions)
    .where(lte(documentDeletions.nextAttemptAt, new Date()))
    .orderBy(documentDeletions.nextAttemptAt)
    .limit(10);
  for (const row of due) {
    if (signal?.aborted) return;
    await processDocumentDeletion(row.id);
  }
}
