import { randomUUID } from "node:crypto";

import { getDb } from "../db/index.ts";
import { aiLedger } from "../db/schema.ts";
import type { ReaderUsage } from "./reader.ts";

/** One row per call. It holds counts only, never document content or numbers. */
export async function recordReaderCall(row: {
  memberId: string | null;
  action: string;
  purpose: "extraction" | "try";
  usage: ReaderUsage;
}) {
  await getDb()
    .insert(aiLedger)
    .values({
      id: randomUUID(),
      memberId: row.purpose === "try" ? null : row.memberId,
      action: row.action,
      purpose: row.purpose,
      inputTokens: row.usage.inputTokens,
      outputTokens: row.usage.outputTokens,
    });
}
