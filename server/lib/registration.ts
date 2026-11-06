import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type { ActionRunContext } from "@agent-native/core/action";
import {
  encryptSecretValue,
  decryptSecretValue,
} from "@agent-native/core/secrets/crypto";
import {
  getEmailReadiness,
  readDeployCredentialEnv,
} from "@agent-native/core/server";
import { getDbExec } from "@agent-native/core/db";
import { and, eq } from "drizzle-orm";
import { createError } from "h3";
import { z } from "zod";

import { coverageAnswers } from "../../shared/screener.ts";
import { memberProfile } from "../../shared/member-profile.ts";
import { getDb } from "../db/index.ts";
import { members } from "../db/schema.ts";
import { refuseExampleEmail } from "./example-identity.ts";
import { reviewedMemberActor } from "./member-identity.ts";

export async function registrationStatus() {
  // Enable only after account email has been checked on the real domain.
  if (readDeployCredentialEnv("EIGHTY_REGISTRATION_ENABLED") !== "1")
    return { open: false };
  return { open: (await getEmailReadiness()).status === "ready" };
}
export const registrationInput = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
  consent: z.literal(true),
  profile: memberProfile,
});
const draftPayload = registrationInput.extend({
  purpose: z.literal("screener-account"),
  expires: z.number().int().positive(),
});
export const finishRegistrationInput = z.strictObject({
  draft: z.string().min(1).max(4096),
});
export async function prepareMemberAccount(
  input: z.infer<typeof registrationInput>,
  headers: Headers | undefined,
) {
  if (!(await registrationStatus()).open)
    throw createError({
      statusCode: 503,
      statusMessage: "Account creation is closed while email is being set up.",
    });
  const body = registrationInput.parse(input);
  refuseExampleEmail(body.email);
  let origin: URL;
  try {
    origin = new URL(headers?.get("origin") || "");
  } catch {
    throw createError({
      statusCode: 403,
      statusMessage: "Create your account from this site.",
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
      statusMessage: "Create your account from this site.",
    });
  const draft = encryptSecretValue(
    JSON.stringify({
      ...body,
      purpose: "screener-account",
      expires: Date.now() + 24 * 60 * 60 * 1000,
    }),
  );
  await getDbExec().execute({
    sql: "INSERT INTO eighty_registration_mail (address_hash, draft) VALUES (?, ?) ON CONFLICT (address_hash) DO UPDATE SET draft = excluded.draft, updated_at = now()",
    args: [registrationAddressHash(body.email), draft],
  });
  const callback = new URL("/check/account", origin.origin);
  callback.searchParams.set("draft", draft);
  return { callbackURL: callback.pathname + callback.search };
}
export async function finishMemberAccount(
  input: z.infer<typeof finishRegistrationInput>,
  context: ActionRunContext | undefined,
) {
  const body = finishRegistrationInput.parse(input);
  if (!(await registrationStatus()).open)
    throw createError({
      statusCode: 503,
      statusMessage: "Account creation is closed while email is being set up.",
    });
  const actor = await reviewedMemberActor(context);
  refuseExampleEmail(actor.email);
  let payload: z.infer<typeof draftPayload>;
  try {
    payload = draftPayload.parse(JSON.parse(decryptSecretValue(body.draft)));
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage:
        "This link could not be read. Return to your screener and try again.",
    });
  }
  if (payload.expires < Date.now())
    throw createError({
      statusCode: 410,
      statusMessage:
        "This link expired. Return to your screener and try again.",
    });
  if (payload.email !== actor.email)
    throw createError({
      statusCode: 403,
      statusMessage: "This link belongs to a different account.",
    });
  const [created] = await getDb()
    .insert(members)
    .values({
      id: randomUUID(),
      ownerEmail: actor.email,
      userId: actor.userId,
      stateCode: payload.profile.screener.state || null,
      language: payload.profile.language,
      screener: coverageAnswers(payload.profile.screener),
    })
    .onConflictDoNothing()
    .returning({ id: members.id });
  if (created) return { saved: true };
  const [existing] = await getDb()
    .select({
      id: members.id,
      screener: members.screener,
      language: members.language,
    })
    .from(members)
    .where(
      and(
        eq(members.ownerEmail, actor.email),
        eq(members.userId, actor.userId),
      ),
    )
    .limit(1);
  if (!existing)
    throw createError({
      statusCode: 403,
      statusMessage: "This account does not own the saved profile.",
    });
  return {
    saved:
      isDeepStrictEqual(existing.screener, payload.profile.screener) &&
      existing.language === payload.profile.language,
  };
}

export const registrationAddressHash = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
export const RESEND_MESSAGE =
  "If that address has an account waiting, a new link is on its way.";
export async function takeVerificationMail(email: string) {
  const result = await getDbExec().execute({
    sql: `INSERT INTO eighty_registration_mail (address_hash, sent) VALUES (?, 1)
      ON CONFLICT (address_hash) DO UPDATE SET
      sent = CASE WHEN eighty_registration_mail.window_start <= now() - interval '1 hour' THEN 1 ELSE eighty_registration_mail.sent + 1 END,
      window_start = CASE WHEN eighty_registration_mail.window_start <= now() - interval '1 hour' THEN now() ELSE eighty_registration_mail.window_start END
      WHERE eighty_registration_mail.sent < 3 OR eighty_registration_mail.window_start <= now() - interval '1 hour'
      RETURNING draft`,
    args: [registrationAddressHash(email)],
  });
  return result.rows[0] as { draft: string | null } | undefined;
}
export function renewRegistrationDraft(
  draft: string | null | undefined,
  email: string,
) {
  if (!draft) return null;
  try {
    const payload = draftPayload.parse(JSON.parse(decryptSecretValue(draft)));
    if (payload.email !== email) return null;
    return encryptSecretValue(
      JSON.stringify({ ...payload, expires: Date.now() + 24 * 60 * 60 * 1000 }),
    );
  } catch {
    return null;
  }
}

export function registrationEmailFromDraft(
  draft: string | undefined,
): string | null {
  if (!draft) return null;
  try {
    return draftPayload.parse(JSON.parse(decryptSecretValue(draft))).email;
  } catch {
    return null;
  }
}
