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
  EXAMPLE_ORGANIZATION_HOST,
  EXAMPLE_ORGANIZATION_ID,
  exampleEmail,
  isExampleEmail,
} from "./example-identity.ts";
import { assessExampleMonths, type SavedLine } from "./example-month.ts";
import {
  EXAMPLE_PEOPLE,
  EXAMPLE_PROFILES,
  type ExamplePerson,
} from "./example-people.ts";
import { removeExampleAccount } from "./example-reset.ts";
import { processDocumentDeletion } from "./document-deletions.ts";
import { exampleSamplePdf } from "./example-sample.ts";
import { exampleAccounts } from "./example-schema.ts";
import { saveDocument } from "./document-records.ts";
import {
  changeEvidenceRecord,
  createEvidenceDraft,
  listEvidenceRecords,
} from "./evidence-records.ts";
import { ownMemberActor, type MemberActor } from "./member-identity.ts";
import { getMemberRecord, saveMemberRecord } from "./member-records.ts";

export const startExampleInput = z.strictObject({
  person: z.enum(EXAMPLE_PEOPLE),
  language: z.enum(["en", "es"]).default("en"),
});
export const enterExampleInput = z.strictObject({
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
export function exampleSettings(read: SettingReader = readDeployCredentialEnv) {
  return {
    enabled: read("EIGHTY_EXAMPLE_ENABLED")?.trim() !== "0",
    perVisitor: setting(read, "EIGHTY_EXAMPLE_STARTS_PER_VISITOR_HOUR", 5, 50),
    total: setting(read, "EIGHTY_EXAMPLE_STARTS_PER_HOUR", 120, 5000),
  };
}
export type ExampleSettings = ReturnType<typeof exampleSettings>;

// IPv6 visitors share one limit per /64, the block one home or phone is
// usually given. An IPv4 address written in IPv6 form counts as that IPv4.
export function visitorAddress(address: string): string {
  if (isIP(address) !== 6) return address;
  const host = new URL(`http://[${address.split("%")[0]}]`).hostname.slice(
    1,
    -1,
  );
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
    .update(`eighty-example-visitor:${visitor}`)
    .digest("hex");
}
export function assertSameSite(headers: Headers | undefined) {
  let origin: URL;
  try {
    origin = new URL(headers?.get("origin") || "");
  } catch {
    throw createError({
      statusCode: 403,
      statusMessage: "Open the example from this site.",
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
      statusMessage: "Open the example from this site.",
    });
}
const hashTicket = (ticket: string) =>
  createHash("sha256").update(ticket).digest("hex");

async function sessionHeaders(email: string) {
  const session = await createBetterAuthSessionForEmail(email);
  if (!session)
    throw createError({
      statusCode: 503,
      statusMessage: "The example did not open. Try again.",
    });
  const event = new H3Event(new Request("http://localhost/eighty-example"));
  await setBetterAuthSessionCookie(event, session.token);
  const cookie = event.res.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { token: session.token, headers: new Headers({ cookie }) };
}

async function joinExampleOrganization(email: string) {
  const exec = getDbExec();
  const exists = async () =>
    (
      await exec.execute({
        sql: "SELECT id FROM organizations WHERE id = ?",
        args: [EXAMPLE_ORGANIZATION_ID],
      })
    ).rows.length > 0;
  if (!(await exists()))
    try {
      // The host address cannot sign in. No example visitor is an owner or admin.
      await createOrganization("Example", EXAMPLE_ORGANIZATION_HOST, "owner", {
        id: EXAMPLE_ORGANIZATION_ID,
      });
    } catch (error) {
      if (!(await exists())) throw error;
    }
  await exec.execute({
    sql: "INSERT INTO org_members (id, org_id, email, role, joined_at) VALUES (?, ?, ?, 'member', ?)",
    args: [randomUUID(), EXAMPLE_ORGANIZATION_ID, email, Date.now()],
  });
  invalidateMemberOrgCaches();
}

// Seeds go through the same server functions a member's own requests use,
// with a real session for the new account.
async function seedExampleMember(
  person: ExamplePerson,
  language: "en" | "es",
  actor: MemberActor,
) {
  const profile = EXAMPLE_PROFILES[person];
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
          .update(exampleAccounts)
          .set({ memberId: member.id })
          .where(eq(exampleAccounts.userId, actor.userId));
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

export async function startExample(
  input: z.input<typeof startExampleInput>,
  context: ActionRunContext | undefined,
  settings: ExampleSettings = exampleSettings(),
) {
  const { person, language } = startExampleInput.parse(input);
  if (!settings.enabled)
    throw createError({
      statusCode: 503,
      statusMessage: "The example is closed right now. Try again later.",
    });
  assertSameSite(context?.requestHeaders);
  const visitor = visitorKey(context?.requestHeaders);
  const userId = randomUUID();
  const email = exampleEmail(randomUUID());
  const ticket = randomBytes(32).toString("base64url");
  await getDb().transaction(async (tx) => {
    // One start at a time, so two quick taps cannot both pass the limit.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('eighty-example-start'))`,
    );
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [mine] = await tx
      .select({ starts: count() })
      .from(exampleAccounts)
      .where(
        and(
          eq(exampleAccounts.visitor, visitor),
          gt(exampleAccounts.createdAt, since),
        ),
      );
    const [all] = await tx
      .select({ starts: count() })
      .from(exampleAccounts)
      .where(gt(exampleAccounts.createdAt, since));
    if (
      Number(mine?.starts) >= settings.perVisitor ||
      Number(all?.starts) >= settings.total
    )
      fail(
        "Too many example months were opened from here. Try again in an hour.",
        {
          errorCode: "example-limit",
          statusCode: 429,
          details: { retryAfterSeconds: 3600 },
        },
      );
    await tx.insert(exampleAccounts).values({
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
      args: [
        userId,
        `${EXAMPLE_PROFILES[person].name} (example)`,
        email,
        now,
        now,
      ],
    });
    await joinExampleOrganization(email);
    await seedExampleMember(person, language, { email, userId });
    return { ticket, person };
  } catch (error) {
    // A failed start leaves nothing behind and does not use up a start.
    const files: string[] = [];
    await removeExampleAccount(userId, files);
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
export async function enterExample(event: H3Event, input: unknown) {
  assertSameSite(event.req.headers);
  const parsed = enterExampleInput.safeParse(input);
  const expired = createError({
    statusCode: 410,
    statusMessage: "This example link expired. Open the example again.",
  });
  if (!parsed.success) throw expired;
  const [account] = await getDb()
    .update(exampleAccounts)
    .set({ ticketHash: null, ticketExpiresAt: null })
    .where(
      and(
        eq(exampleAccounts.ticketHash, hashTicket(parsed.data.ticket)),
        gt(exampleAccounts.ticketExpiresAt, new Date()),
        isNotNull(exampleAccounts.memberId),
      ),
    )
    .returning({
      email: exampleAccounts.email,
      person: exampleAccounts.person,
    });
  if (!account || !isExampleEmail(account.email)) throw expired;
  const session = await createBetterAuthSessionForEmail(account.email);
  if (!session) throw expired;
  await setBetterAuthSessionCookie(event, session.token);
  return { person: account.person };
}

async function exampleAccountFor(actor: MemberActor) {
  if (!isExampleEmail(actor.email)) return null;
  const [account] = await getDb()
    .select()
    .from(exampleAccounts)
    .where(
      and(
        eq(exampleAccounts.userId, actor.userId),
        eq(exampleAccounts.email, actor.email),
      ),
    );
  return account ?? null;
}
export async function requireExampleAccount(
  context: ActionRunContext | undefined,
) {
  const actor = await ownMemberActor(context);
  const account = await exampleAccountFor(actor);
  if (!account)
    throw createError({
      statusCode: 403,
      statusMessage: "This is only for the example.",
    });
  return { actor, account, person: account.person as ExamplePerson };
}

export async function exampleStatus(context: ActionRunContext | undefined) {
  if (!isExampleEmail(context?.userEmail)) return { example: false as const };
  const { person } = await requireExampleAccount(context);
  return { example: true as const, person };
}

export async function exampleMonth(context: ActionRunContext | undefined) {
  const { actor, person } = await requireExampleAccount(context);
  await getMemberRecord(actor);
  const rows = (await listEvidenceRecords(context)) as SavedLine[];
  const months = assessExampleMonths(
    EXAMPLE_PROFILES[person].facts,
    rows,
    today(),
  );
  return {
    person,
    ...months,
    waiting: rows.filter((row) => row.status === "proposed").length,
  };
}

export async function addExampleSample(context: ActionRunContext | undefined) {
  const { person } = await requireExampleAccount(context);
  if (person !== "maria")
    throw createError({
      statusCode: 409,
      statusMessage: "The sample belongs to Maria's example.",
    });
  const bytes = Buffer.from(await exampleSamplePdf(today()));
  // The same save path as any upload, with the same limits.
  return saveDocument(
    { data: bytes.toString("base64"), rotation: 0, acceptQuality: false },
    context,
  );
}

// For actions that a example account must never use, including those open to
// signed-out visitors.
export async function refuseExampleContext(
  context: ActionRunContext | undefined,
) {
  let email = context?.userEmail;
  if (!isExampleEmail(email) && context?.requestHeaders?.get("cookie"))
    email = (
      await getBrowserCookieSession(
        new H3Event(
          new Request("http://localhost/eighty-example-check", {
            headers: context.requestHeaders,
          }),
        ),
      )
    )?.email;
  if (isExampleEmail(email))
    throw createError({
      statusCode: 403,
      statusMessage: "This is not part of the example.",
    });
}
