import { createHash, randomInt } from "node:crypto";

import { and, eq, gt, lt } from "drizzle-orm";

import { getDb } from "../db/index.ts";
import { telegramCodes, telegramLinks } from "../db/schema.ts";
import type { MemberActor } from "./member-identity.ts";

// No 0/O or 1/I/L, so a code read aloud or typed on a phone stays exact.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LINK_CODE_LENGTH = 8;
export const LINK_CODE_MINUTES = 15;

const hashCode = (code: string) =>
  createHash("sha256").update(`eighty-telegram:${code}`).digest("hex");

/** A code typed by hand or sent through t.me/<bot>?start=<code>. */
export function normalizeLinkCode(value: string): string | null {
  const code = value.trim().toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== LINK_CODE_LENGTH) return null;
  for (const character of code)
    if (!CODE_ALPHABET.includes(character)) return null;
  return code;
}

/**
 * A new one-time code for this member. Only the hash is kept. Older codes for
 * the member stop working, so only the newest code on screen links.
 */
export async function createLinkCode(
  actor: MemberActor,
  memberId: string,
  now = new Date(),
) {
  let code = "";
  for (let i = 0; i < LINK_CODE_LENGTH; i++)
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  const expiresAt = new Date(now.getTime() + LINK_CODE_MINUTES * 60_000);
  await getDb().transaction(async (tx) => {
    await tx.delete(telegramCodes).where(eq(telegramCodes.memberId, memberId));
    await tx.delete(telegramCodes).where(lt(telegramCodes.expiresAt, now));
    await tx.insert(telegramCodes).values({
      codeHash: hashCode(code),
      memberId,
      ownerEmail: actor.email,
      userId: actor.userId,
      expiresAt,
    });
  });
  return { code, expiresAt: expiresAt.toISOString() };
}

/**
 * Spends a code and links the chat to the code's member. A chat links to one
 * member; a member keeps one chat, so linking a new chat replaces the old one.
 */
export async function consumeLinkCode(
  rawCode: string,
  chatId: string,
  telegramUserId: string,
  now = new Date(),
): Promise<{ ownerEmail: string; memberId: string } | null> {
  const code = normalizeLinkCode(rawCode);
  if (!code) return null;
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .delete(telegramCodes)
      .where(
        and(
          eq(telegramCodes.codeHash, hashCode(code)),
          gt(telegramCodes.expiresAt, now),
        ),
      )
      .returning();
    if (!row) return null;
    await tx.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId));
    await tx
      .delete(telegramLinks)
      .where(eq(telegramLinks.memberId, row.memberId));
    await tx.insert(telegramLinks).values({
      chatId,
      memberId: row.memberId,
      ownerEmail: row.ownerEmail,
      userId: row.userId,
      telegramUserId,
    });
    return { ownerEmail: row.ownerEmail, memberId: row.memberId };
  });
}

/** The member a chat is linked to, or null. */
export async function linkForChat(chatId: string) {
  const [row] = await getDb()
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.chatId, chatId));
  return row ?? null;
}

/** The member behind a message run, only when this exact chat is linked to them. */
export async function linkedTelegramActor(
  email: string,
  chatId: string,
): Promise<MemberActor | null> {
  const row = await linkForChat(chatId);
  if (!row || row.ownerEmail !== email) return null;
  return { email: row.ownerEmail, userId: row.userId };
}

export async function linkForMember(memberId: string) {
  const [row] = await getDb()
    .select({ createdAt: telegramLinks.createdAt })
    .from(telegramLinks)
    .where(eq(telegramLinks.memberId, memberId));
  return row ?? null;
}

export async function unlinkChat(chatId: string) {
  await getDb().delete(telegramLinks).where(eq(telegramLinks.chatId, chatId));
}

export async function unlinkMember(memberId: string) {
  await getDb().transaction(async (tx) => {
    await tx.delete(telegramLinks).where(eq(telegramLinks.memberId, memberId));
    await tx.delete(telegramCodes).where(eq(telegramCodes.memberId, memberId));
  });
}
