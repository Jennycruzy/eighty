import { randomUUID } from "node:crypto";

import { getRequestContext } from "@agent-native/core/server";
import { and, eq, notLike } from "drizzle-orm";
import { createError } from "h3";

import {
  memberProfile,
  type MemberProfile,
} from "../../shared/member-profile.ts";
import { coverageAnswers } from "../../shared/screener.ts";
import { getDb } from "../db/index.ts";
import { members } from "../db/schema.ts";
import { DEMO_EMAIL_DOMAIN, isDemoEmail } from "./demo-identity.ts";
import { demoAccounts } from "./demo-schema.ts";
import type { MemberActor } from "./member-identity.ts";

// Use in every list, count or lookup of real members. Demo records never match.
export const realMembersOnly = () =>
  notLike(members.ownerEmail, `%@${DEMO_EMAIL_DOMAIN}`);

function assertActorContext(actor: MemberActor) {
  const context = getRequestContext();
  if (
    context?.userEmail !== actor.email ||
    (context.authUserId && context.authUserId !== actor.userId)
  )
    throw createError({
      statusCode: 403,
      statusMessage: "This request belongs to a different account",
    });
}
export async function getMemberRecord(actor: MemberActor) {
  assertActorContext(actor);
  const demo = isDemoEmail(actor.email);
  const [member] = await getDb()
    .select()
    .from(members)
    .where(
      and(
        eq(members.ownerEmail, actor.email),
        eq(members.userId, actor.userId),
        ...(demo ? [] : [realMembersOnly()]),
      ),
    )
    .limit(1);
  if (!member)
    throw createError({
      statusCode: 404,
      statusMessage: "Finish your account setup",
    });
  if (demo) {
    // A demo account reaches only the one made-up record the server made for it.
    const [account] = await getDb()
      .select({ memberId: demoAccounts.memberId })
      .from(demoAccounts)
      .where(
        and(
          eq(demoAccounts.userId, actor.userId),
          eq(demoAccounts.email, actor.email),
        ),
      );
    if (!account || account.memberId !== member.id)
      throw createError({
        statusCode: 404,
        statusMessage: "Finish your account setup",
      });
  }
  return member;
}
export async function saveMemberRecord(
  actor: MemberActor,
  input: MemberProfile,
) {
  assertActorContext(actor);
  const profile = memberProfile.parse(input);
  const values = {
    screener: coverageAnswers(profile.screener),
    language: profile.language,
    stateCode: profile.screener.state || null,
    updatedAt: new Date(),
  };
  const [member] = await getDb()
    .insert(members)
    .values({
      id: randomUUID(),
      ownerEmail: actor.email,
      userId: actor.userId,
      ...values,
    })
    .onConflictDoUpdate({
      target: members.ownerEmail,
      set: values,
      setWhere: eq(members.userId, actor.userId),
    })
    .returning();
  if (!member)
    throw createError({
      statusCode: 403,
      statusMessage: "This account does not own the saved profile",
    });
  return member;
}
