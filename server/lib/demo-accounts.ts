import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";

import { fail, type ActionRunContext } from "@agent-native/core/action";
import { getDbExec } from "@agent-native/core/db";
import {
  createOrganization,
  invalidateMemberOrgCaches,
} from "@agent-native/core/org";
import {
  createBetterAuthSessionForEmail,
  getBrowserCookieSession,
  readDeployCredentialEnv,
  runWithRequestContext,
  setBetterAuthSessionCookie,
} from "@agent-native/core/server";
import { and, count, eq, gt, isNotNull, sql } from "drizzle-orm";
import { H3Event, createError } from "h3";
import { z } from "zod";

import { getDb } from "../db/index.ts";
import {
  DEMO_ORGANIZATION_HOST,
  DEMO_ORGANIZATION_ID,
  demoEmail,
  isDemoEmail,
} from "./demo-identity.ts";
import { assessDemoMonths, type SavedLine } from "./demo-month.ts";
import { DEMO_PEOPLE, DEMO_PROFILES, type DemoPerson } from "./demo-people.ts";
import { removeDemoAccount } from "./demo-reset.ts";
import { processDocumentDeletion } from "./document-deletions.ts";
import { demoSamplePdf } from "./demo-sample.ts";
import { demoAccounts } from "./demo-schema.ts";
import { saveDocument } from "./document-records.ts";
import {
  changeEvidenceRecord,
  createEvidenceDraft,
  listEvidenceRecords,
} from "./evidence-records.ts";
import { browserMemberActor, type MemberActor } from "./member-identity.ts";
import { getMemberRecord, saveMemberRecord } from "./member-records.ts";

export const startDemoInput = z.strictObject({
  person: z.enum(DEMO_PEOPLE),
  language: z.enum(["en", "es"]).default("en"),
});
export const enterDemoInput = z.strictObject({
  ticket: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
const TICKET_MS = 2 * 60 * 1000;
export const today = () => new Date().toISOString().slice(0, 10);

type SettingReader = (key: string) => string | undefined;
function setting(
  read: SettingReader,
  key: string,
  fallback: number,
  max: number,
) {
  const raw = read(key)?.trim();
  const value = Number(raw);
  return raw && Number.isInteger(value) && value >= 1 && value <= max
    ? value
    : fallback;
}
// Plain settings with safe defaults. A wrong value falls back to the default.
export function demoSettings(read: SettingReader = readDeployCredentialEnv) {
  return {
    enabled: read("EIGHTY_DEMO_ENABLED")?.trim() !== "0",
    perVisitor: setting(read, "EIGHTY_DEMO_STARTS_PER_VISITOR_HOUR", 5, 50),
    total: setting(read, "EIGHTY_DEMO_STARTS_PER_HOUR", 120, 5000),
  };
}
export type DemoSettings = ReturnType<typeof demoSettings>;

// IPv6 visitors share one limit per /64, the block one home or phone is
// usually given. An IPv4 address written in IPv6 form counts as that IPv4.
export function visitorAddress(address: string): string {
  if (isIP(address) !== 6) return address;
  const host = new URL(`http://[${address.split("%")[0]}]`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (mapped) {
    const high = parseInt(mapped[1] ?? "0", 16);
    const low = parseInt(mapped[2] ?? "0", 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  const [left = "", right] = host.split("::");
  const first = left ? left.split(":") : [];
  const last = right ? right.split(":") : [];
  const groups =
    right === undefined
      ? first
      : [...first, ...Array(8 - first.length - last.length).fill("0"), ...last];
  return groups
    .slice(0, 4)
    .map((part) => part.padStart(4, "0"))
    .join(":");
}

// The app sits behind Caddy on 127.0.0.1, which sets X-Forwarded-For to the
// connecting address. Only a hash is kept, never the address itself.
export function visitorKey(headers: Headers | undefined): string {
  const forwarded = headers
    ?.get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  const visitor = visitorAddress(forwarded || "direct");
  return createHash("sha256")
    .update(`eighty-demo-visitor:${visitor}`)
    .digest("hex");
}
export function assertSameSite(headers: Headers | undefined) {
  let origin: URL;
  try {
    origin = new URL(headers?.get("origin") || "");
  } catch {
    throw createError({
      statusCode: 403,
      statusMessage: "Open the demo from this site.",
    });
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    origin.host !== headers?.get("host") ||
    (!local && origin.protocol !== "https:") ||
    headers?.get("sec-fetch-site") === "cross-site"
  )
    throw createError({
      statusCode: 403,
      statusMessage: "Open the demo from this site.",
    });
}
const hashTicket = (ticket: string) =>
  createHash("sha256").update(ticket).digest("hex");

async function sessionHeaders(email: string) {
  const session = await createBetterAuthSessionForEmail(email);
  if (!session)
    throw createError({
      statusCode: 503,
      statusMessage: "The demo could not start. Try again in a minute.",
    });
  const event = new H3Event(new Request("http://localhost/eighty-demo"));
  await setBetterAuthSessionCookie(event, session.token);
  const cookie = event.res.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { token: session.token, headers: new Headers({ cookie }) };
}

async function joinDemoOrganization(email: string) {
  const exec = getDbExec();
  const exists = async () =>
    (
      await exec.execute({
        sql: "SELECT id FROM organizations WHERE id = ?",
        args: [DEMO_ORGANIZATION_ID],
      })
    ).rows.length > 0;
  if (!(await exists()))
    try {
      // The host address cannot sign in. No demo visitor is an owner or admin.
      await createOrganization("Demo", DEMO_ORGANIZATION_HOST, "owner", {
        id: DEMO_ORGANIZATION_ID,
      });
    } catch (error) {
      if (!(await exists())) throw error;
    }
  await exec.execute({
    sql: "INSERT INTO org_members (id, org_id, email, role, joined_at) VALUES (?, ?, ?, 'member', ?)",
    args: [randomUUID(), DEMO_ORGANIZATION_ID, email, Date.now()],
  });
  invalidateMemberOrgCaches();
}

// Seeds go through the same server functions a member's own requests use,
// with a real session for the new account.
async function seedDemoMember(
  person: DemoPerson,
  language: "en" | "es",
  actor: MemberActor,
) {
  const profile = DEMO_PROFILES[person];
  const session = await sessionHeaders(actor.email);
  const context: ActionRunContext = {
    caller: "frontend",
    userEmail: actor.email,
    requestHeaders: session.headers,
  };
  try {
    await runWithRequestContext(
      { userEmail: actor.email, authUserId: actor.userId },
      async () => {
        const member = await saveMemberRecord(actor, {
          screener: profile.screener,
          language: language === "es" ? "es-US" : "en-US",
        });
        await getDb()
          .update(demoAccounts)
          .set({ memberId: member.id })
          .where(eq(demoAccounts.userId, actor.userId));
        for (const line of profile.lines(today())) {
          const row = await createEvidenceDraft(
            { fields: line.fields },
            context,
          );
          if (line.confirm)
            await changeEvidenceRecord(
              "confirm",
              { id: row.id, version: row.version },
              context,
            );
        }
      },
    );
  } finally {
    await getDbExec().execute({
      sql: "DELETE FROM session WHERE token = ? AND user_id = ?",
      args: [session.token, actor.userId],
    });
  }
}

export async function startDemo(
  input: z.input<typeof startDemoInput>,
  context: ActionRunContext | undefined,
  settings: DemoSettings = demoSettings(),
) {
  const { person, language } = startDemoInput.parse(input);
  if (!settings.enabled)
    throw createError({
      statusCode: 503,
      statusMessage: "The demo is closed right now.",
    });
  assertSameSite(context?.requestHeaders);
  const visitor = visitorKey(context?.requestHeaders);
  const userId = randomUUID();
  const email = demoEmail(randomUUID());
  const ticket = randomBytes(32).toString("base64url");
  await getDb().transaction(async (tx) => {
    // One start at a time, so two quick taps cannot both pass the limit.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('eighty-demo-start'))`,
    );
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [mine] = await tx
      .select({ starts: count() })
      .from(demoAccounts)
      .where(
        and(
          eq(demoAccounts.visitor, visitor),
          gt(demoAccounts.createdAt, since),
        ),
      );
    const [all] = await tx
      .select({ starts: count() })
      .from(demoAccounts)
      .where(gt(demoAccounts.createdAt, since));
    if (
      Number(mine?.starts) >= settings.perVisitor ||
      Number(all?.starts) >= settings.total
    )
      fail("Too many demos were opened. Try again in an hour.", {
        errorCode: "demo-limit",
        statusCode: 429,
        details: { retryAfterSeconds: 3600 },
      });
    await tx.insert(demoAccounts).values({
      userId,
      email,
      person,
      visitor,
      ticketHash: hashTicket(ticket),
      ticketExpiresAt: new Date(Date.now() + TICKET_MS),
    });
  });
  // The marked row exists before the account, so the reset can always find it.
  try {
    const now = new Date().toISOString();
    await getDbExec().execute({
      sql: 'INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, true, ?, ?)',
      args: [userId, `${DEMO_PROFILES[person].name} (demo)`, email, now, now],
    });
    await joinDemoOrganization(email);
    await seedDemoMember(person, language, { email, userId });
    return { ticket, person };
  } catch (error) {
    // A failed start leaves nothing behind and does not use up a start.
    const files: string[] = [];
    await removeDemoAccount(userId, files);
    invalidateMemberOrgCaches();
    for (const file of files) {
      try {
        await processDocumentDeletion(file);
      } catch {
        /* The durable record stays for the retry job. */
      }
    }
    throw error;
  }
}

// Exchanges a one-time ticket for a signed-in browser session.
export async function enterDemo(event: H3Event, input: unknown) {
  assertSameSite(event.req.headers);
  const parsed = enterDemoInput.safeParse(input);
  const expired = createError({
    statusCode: 410,
    statusMessage: "This demo link expired. Open the demo again.",
  });
  if (!parsed.success) throw expired;
  const [account] = await getDb()
    .update(demoAccounts)
    .set({ ticketHash: null, ticketExpiresAt: null })
    .where(
      and(
        eq(demoAccounts.ticketHash, hashTicket(parsed.data.ticket)),
        gt(demoAccounts.ticketExpiresAt, new Date()),
        isNotNull(demoAccounts.memberId),
      ),
    )
    .returning({ email: demoAccounts.email, person: demoAccounts.person });
  if (!account || !isDemoEmail(account.email)) throw expired;
  const session = await createBetterAuthSessionForEmail(account.email);
  if (!session) throw expired;
  await setBetterAuthSessionCookie(event, session.token);
  return { person: account.person };
}

async function demoAccountFor(actor: MemberActor) {
  if (!isDemoEmail(actor.email)) return null;
  const [account] = await getDb()
    .select()
    .from(demoAccounts)
    .where(
      and(
        eq(demoAccounts.userId, actor.userId),
        eq(demoAccounts.email, actor.email),
      ),
    );
  return account ?? null;
}
export async function requireDemoAccount(
  context: ActionRunContext | undefined,
) {
  const actor = await browserMemberActor(context);
  const account = await demoAccountFor(actor);
  if (!account)
    throw createError({
      statusCode: 403,
      statusMessage: "This is only for the demo.",
    });
  return { actor, account, person: account.person as DemoPerson };
}

export async function demoStatus(context: ActionRunContext | undefined) {
  if (!isDemoEmail(context?.userEmail)) return { demo: false as const };
  const { person } = await requireDemoAccount(context);
  return { demo: true as const, person };
}

export async function demoMonth(context: ActionRunContext | undefined) {
  const { actor, person } = await requireDemoAccount(context);
  await getMemberRecord(actor);
  const rows = (await listEvidenceRecords(context)) as SavedLine[];
  const months = assessDemoMonths(DEMO_PROFILES[person].facts, rows, today());
  return {
    person,
    ...months,
    waiting: rows.filter((row) => row.status === "proposed").length,
  };
}

export async function addDemoSample(context: ActionRunContext | undefined) {
  const { person } = await requireDemoAccount(context);
  if (person !== "maria")
    throw createError({
      statusCode: 409,
      statusMessage: "The sample belongs to Maria's demo.",
    });
  const bytes = Buffer.from(await demoSamplePdf(today()));
  // The same save path as any upload, with the same limits.
  return saveDocument(
    { data: bytes.toString("base64"), rotation: 0, acceptQuality: false },
    context,
  );
}

// For actions that a demo account must never use, including those open to
// signed-out visitors.
export async function refuseDemoContext(context: ActionRunContext | undefined) {
  let email = context?.userEmail;
  if (!isDemoEmail(email) && context?.requestHeaders?.get("cookie"))
    email = (
      await getBrowserCookieSession(
        new H3Event(
          new Request("http://localhost/eighty-demo-check", {
            headers: context.requestHeaders,
          }),
        ),
      )
    )?.email;
  if (isDemoEmail(email))
    throw createError({
      statusCode: 403,
      statusMessage: "This is not part of the demo.",
    });
}
