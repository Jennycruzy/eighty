import { randomUUID } from "node:crypto";

import { getRequestContext } from "@agent-native/core/server";
import { and, eq } from "drizzle-orm";
import { createError } from "h3";

import {
  memberProfile,
  type MemberProfile,
} from "../../shared/member-profile.ts";
import { getDb } from "../db/index.ts";
import { members } from "../db/schema.ts";
import type { MemberActor } from "./member-identity.ts";

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
  const [member] = await getDb()
    .select()
    .from(members)
    .where(
      and(
        eq(members.ownerEmail, actor.email),
        eq(members.userId, actor.userId),
      ),
    )
    .limit(1);
  if (!member)
    throw createError({
      statusCode: 404,
      statusMessage: "Finish your account setup",
    });
  return member;
}
export async function saveMemberRecord(
  actor: MemberActor,
  input: MemberProfile,
) {
  assertActorContext(actor);
  const profile = memberProfile.parse(input);
  const values = {
    screener: profile.screener,
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
