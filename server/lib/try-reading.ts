import { browserMemberActor } from "./member-identity.ts";
import { isExampleEmail } from "./example-identity.ts";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

import type { ActionRunContext } from "@agent-native/core/action";
import {
  getRequestContext,
  readDeployCredentialEnv,
  runWithRequestContext,
} from "@agent-native/core/server";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { createError } from "h3";
import { z } from "zod";

import { documentUpload } from "../../shared/document-upload.ts";
import { MAX_READ_PAGES } from "../../shared/reader.ts";
import { tryFieldsFromReading } from "../../shared/try-month.ts";
import { getDb } from "../db/index.ts";
import { aiLedger } from "../db/schema.ts";
import { inspectDocument } from "./document-content.ts";
import { readDocument, ReaderFailure, type ReaderUsage } from "./reader.ts";

export const tryReadInput = documentUpload
  .pick({ data: true, rotation: true })
  .extend({ language: z.enum(["en", "es"]).default("en") });

const ACTION = "try_read_document";
/** Plain settings with safe defaults. 0 turns reading off; typing still works. */
export function tryLimits() {
  const setting = (raw: string | undefined, fallback: number) => {
    const value = Number(raw?.trim());
    return raw?.trim() && Number.isSafeInteger(value) && value >= 0
      ? value
      : fallback;
  };
  return {
    perVisitor: setting(
      readDeployCredentialEnv("EIGHTY_TRY_READS_PER_VISITOR"),
      3,
    ),
    perDay: setting(
      readDeployCredentialEnv("EIGHTY_PUBLIC_MODEL_USES_PER_DAY") ??
        readDeployCredentialEnv("EIGHTY_TRY_READS_PER_DAY"),
      50,
    ),
  };
}

// Per-visitor counts live only in this process's memory, keyed by a keyed
// hash of the address. No address is written anywhere.
const visitorSecret = randomBytes(32);
const visitorTries = new Map<string, { day: string; count: number }>();
const today = () => new Date().toISOString().slice(0, 10);
function visitorKey(headers: Headers | undefined) {
  const address =
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "direct";
  return createHmac("sha256", visitorSecret).update(address).digest("hex");
}
function takeVisitorTry(key: string, limit: number): boolean {
  const day = today();
  for (const [other, entry] of visitorTries)
    if (entry.day !== day) visitorTries.delete(other);
  const entry = visitorTries.get(key) ?? { day, count: 0 };
  if (entry.count >= limit) return false;
  visitorTries.set(key, { day, count: entry.count + 1 });
  return true;
}
function returnVisitorTry(key: string) {
  const entry = visitorTries.get(key);
  if (entry && entry.count > 0)
    visitorTries.set(key, { ...entry, count: entry.count - 1 });
}

/** Records that a try happened, if today's budget allows one more. */
export async function reserveDailyTry(
  limit: number,
  action: string = ACTION,
): Promise<string | null> {
  const start = new Date(`${today()}T00:00:00.000Z`);
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('eighty-try-budget'))`,
    );
    const [used] = await tx
      .select({ count: count() })
      .from(aiLedger)
      .where(and(eq(aiLedger.purpose, "try"), gte(aiLedger.createdAt, start)));
    if (Number(used?.count ?? 0) >= limit) return null;
    const id = randomUUID();
    await tx.insert(aiLedger).values({
      id,
      memberId: null,
      action,
      purpose: "try",
    });
    return id;
  });
}
export async function recordUsage(id: string, usage: ReaderUsage) {
  await getDb()
    .update(aiLedger)
    .set({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens })
    .where(eq(aiLedger.id, id));
}

export type TryOutcome =
  | "read"
  | "nothing-found"
  | "not-us-document"
  | "unreadable"
  | "unavailable"
  | "visitor-limit"
  | "budget-used";

/**
 * Reads one visitor document in memory. Nothing is written to storage and the
 * only database row is the ledger's note that a try happened, with token
 * counts. The bytes are cleared as soon as the answer is ready.
 */
export async function tryReadDocument(
  input: z.input<typeof tryReadInput>,
  context: ActionRunContext | undefined,
) {
  // Only this site's own page may send a document: the browser marks
  // same-origin requests and the app's client marks its own action calls.
  if (
    context?.caller !== "frontend" ||
    context.requestHeaders?.get("sec-fetch-site") !== "same-origin"
  )
    throw createError({
      statusCode: 403,
      statusMessage: "Use the Eighty page to read a document",
    });
  const hasOwnAccount =
    !!context.userEmail && !isExampleEmail(context.userEmail);
  if (hasOwnAccount) await browserMemberActor(context);
  const parsed = tryReadInput.parse(input);
  const bytes = Buffer.from(parsed.data, "base64");
  try {
    const answer = await readForVisitor(
      bytes,
      parsed,
      context.requestHeaders,
      hasOwnAccount,
    );
    bytes.fill(0);
    return { ...answer, deletedAt: new Date().toISOString() };
  } finally {
    bytes.fill(0);
  }
}

async function readForVisitor(
  bytes: Buffer,
  parsed: z.output<typeof tryReadInput>,
  headers: Headers | undefined,
  hasOwnAccount = false,
) {
  const inspected = await inspectDocument(bytes, parsed.rotation);
  const pages = {
    pages: inspected.pages,
    pagesRead: Math.min(inspected.pages, MAX_READ_PAGES),
  };
  let ledgerId: string;
  if (hasOwnAccount) {
    ledgerId = randomUUID();
    await getDb().insert(aiLedger).values({
      id: ledgerId,
      memberId: null,
      action: ACTION,
      purpose: "extraction",
    });
  } else {
    const limits = tryLimits();
    const visitor = visitorKey(headers);
    if (!takeVisitorTry(visitor, limits.perVisitor))
      return { outcome: "visitor-limit" as TryOutcome, ...pages };
    const publicId = await reserveDailyTry(limits.perDay);
    if (!publicId) {
      returnVisitorTry(visitor);
      return { outcome: "budget-used" as TryOutcome, ...pages };
    }
    ledgerId = publicId;
  }
  let reading;
  try {
    // A signed-out visitor has no organization: use the deployment's model
    // setting, as the framework does for anonymous agent runs.
    reading = await runWithRequestContext(
      { ...getRequestContext(), defaultAgentEngineScope: "deployment" },
      () =>
        readDocument({
          bytes,
          mime: inspected.mime,
          language: parsed.language,
          rotation: parsed.rotation,
        }),
    );
  } catch (error) {
    if (!(error instanceof ReaderFailure)) throw error;
    await recordUsage(ledgerId, error.usage);
    return { outcome: error.reason as TryOutcome, ...pages };
  }
  await recordUsage(ledgerId, reading.usage);
  const { result } = reading;
  if (!result.usDocument)
    return { outcome: "not-us-document" as TryOutcome, ...pages };
  return {
    outcome: (result.proposals.length ? "read" : "nothing-found") as TryOutcome,
    proposals: result.proposals,
    fill: tryFieldsFromReading(result),
    ...pages,
  };
}

export const PUBLIC_HELPER_REST =
  "The example helper is resting until tomorrow. You can still look around and type lines yourself.";
export const PUBLIC_HELPER_REST_ES =
  "La ayuda del ejemplo descansa hasta mañana. Aún puedes mirar y escribir líneas por tu cuenta.";

export async function reservePublicModelUse(
  headers: Headers | undefined,
  action: string,
  exampleVisitor?: string,
) {
  const limits = tryLimits();
  const visitor = exampleVisitor ?? visitorKey(headers);
  if (!takeVisitorTry(visitor, limits.perVisitor)) return null;
  const id = await reserveDailyTry(limits.perDay, action);
  if (!id) returnVisitorTry(visitor);
  return id;
}
