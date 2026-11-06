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
import { EXAMPLE_EMAIL_DOMAIN, isExampleEmail } from "./example-identity.ts";
import { exampleAccounts } from "./example-schema.ts";
import type { MemberActor } from "./member-identity.ts";

// Use in every list, count or lookup of real members. Example records never match.
export const realMembersOnly = () =>
  notLike(members.ownerEmail, `%@${EXAMPLE_EMAIL_DOMAIN}`);

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
  const example = isExampleEmail(actor.email);
  const [member] = await getDb()
    .select()
    .from(members)
    .where(
      and(
        eq(members.ownerEmail, actor.email),
        eq(members.userId, actor.userId),
        ...(example ? [] : [realMembersOnly()]),
      ),
    )
    .limit(1);
  if (!member)
    throw createError({
      statusCode: 404,
      statusMessage: "Finish your account setup",
    });
  if (example) {
    // A example account reaches only the one made-up record the server made for it.
    const [account] = await getDb()
      .select({ memberId: exampleAccounts.memberId })
      .from(exampleAccounts)
      .where(
        and(
          eq(exampleAccounts.userId, actor.userId),
          eq(exampleAccounts.email, actor.email),
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
