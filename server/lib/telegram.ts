import type { ActionRunContext } from "@agent-native/core/action";
import {
  runWithRequestContext,
  resolveSecret,
  telegramAdapter,
  type IncomingMessage,
  type PlatformAdapter,
} from "@agent-native/core/server";
import { readBody, type H3Event } from "h3";

import { MAX_DOCUMENT_BYTES } from "../../shared/document-upload.ts";
import {
  BOT_TEXT,
  SITE,
  lineText,
  monthText,
  type Lang,
  type LineFields,
  type MonthSummary,
} from "../../shared/telegram-words.ts";
import { saveDocumentFor } from "./document-records.ts";
import { exampleAccountForActor, exampleMonth } from "./example-accounts.ts";
import { isExampleEmail } from "./example-identity.ts";
import { extractEvidence } from "./extraction.ts";
import { checkMemberMonth } from "./member-month.ts";
import type { MemberActor } from "./member-identity.ts";
import { getMemberRecord } from "./member-records.ts";
import {
  consumeLinkCode,
  linkForChat,
  normalizeLinkCode,
  unlinkChat,
} from "./telegram-links.ts";
import { transcribeVoiceNote } from "./telegram-voice.ts";
import { reservePublicModelUse } from "./try-reading.ts";


// What Telegram sends for a photo, a file or a voice note. The framework's
// adapter keeps text only, so a member's proof would never arrive; this
// parser keeps the file reference and the rest of the message.
interface TelegramMedia {
  file_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  duration?: number;
}
interface TelegramMessage {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  chat: { id: number | string; type?: string };
  from?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  message_thread_id?: number;
  photo?: TelegramMedia[];
  document?: TelegramMedia;
  voice?: TelegramMedia;
  audio?: TelegramMedia;
  video?: TelegramMedia;
  video_note?: TelegramMedia;
  sticker?: unknown;
  location?: unknown;
  contact?: unknown;
}

function fileReference(
  id: string,
  mimetype: string | undefined,
  media: TelegramMedia,
): NonNullable<IncomingMessage["files"]>[number] {
  return {
    id,
    ...(mimetype ? { mimetype } : {}),
    ...(media.file_name ? { name: media.file_name } : {}),
    ...(typeof media.file_size === "number" ? { size: media.file_size } : {}),
  };
}

export type TelegramFileKind = "photo" | "document" | "voice" | "unsupported";

/** Telegram's update, as a framework message that keeps files. */
export function parseTelegramUpdate(body: unknown): IncomingMessage | null {
  const update = body as {
    message?: TelegramMessage;
    edited_message?: TelegramMessage;
  } | null;
  // Edits are not new proof; reading a changed message twice would only
  // repeat a reply.
  const message = update?.message;
  if (!message?.chat) return null;
  const files: NonNullable<IncomingMessage["files"]> = [];
  let kind: TelegramFileKind | null = null;
  const photo = message.photo?.[message.photo.length - 1];
  if (photo?.file_id) {
    kind = "photo";
    files.push(fileReference(photo.file_id, "image/jpeg", photo));
  } else if (message.document?.file_id) {
    kind = "document";
    files.push(
      fileReference(
        message.document.file_id,
        message.document.mime_type,
        message.document,
      ),
    );
  } else if (message.voice?.file_id || message.audio?.file_id) {
    const audio = (message.voice ?? message.audio)!;
    kind = "voice";
    files.push(
      fileReference(audio.file_id!, audio.mime_type ?? "audio/ogg", audio),
    );
  } else if (
    message.video ||
    message.video_note ||
    message.sticker ||
    message.location ||
    message.contact
  ) {
    kind = "unsupported";
  }
  const text = (message.text ?? message.caption ?? "").trim();
  if (!text && !kind) return null;
  const chat = message.chat;
  const from = message.from;
  const threadId = message.message_thread_id;
  return {
    platform: "telegram",
    ...(from?.id === undefined ? {} : { senderId: String(from.id) }),
    ...(threadId === undefined ? {} : { threadRef: String(threadId) }),
    externalThreadId:
      threadId === undefined
        ? `chat:${String(chat.id)}`
        : `chat:${String(chat.id)}:thread:${String(threadId)}`,
    text,
    files,
    senderName: [from?.first_name, from?.last_name].filter(Boolean).join(" "),
    replyRef: String(message.message_id),
    conversationType: chat.type === "private" ? "dm" : "group_dm",
    platformContext: {
      chatId: chat.id,
      chatType: chat.type,
      messageId: message.message_id,
      messageThreadId: threadId,
      rawText: text,
      fromId: from?.id,
      fromUsername: from?.username,
      languageCode: from?.language_code,
      fileKind: kind,
    },
    timestamp: message.date * 1000,
  };
}

/**
 * The framework's Telegram adapter with a parser that keeps photos, files and
 * voice notes. Signature checks and replies stay the framework's own.
 */
export function eightyTelegramAdapter(): PlatformAdapter {
  const base = telegramAdapter();
  return {
    ...base,
    async parseIncomingMessage(event: H3Event) {
      const body =
        (event.context as { __rawBody?: unknown }).__rawBody ??
        (await readBody(event));
      return parseTelegramUpdate(body);
    },
  };
}

// ---- Acting for the linked member ---------------------------------------

/**
 * Runs Eighty's own server code as the linked member: the same identity
 * checks the web uses, with the account the member linked from their own
 * verified browser session.
 */
function asMember<T>(actor: MemberActor, fn: (context: ActionRunContext) => T) {
  return runWithRequestContext(
    { userEmail: actor.email, authUserId: actor.userId },
    () => fn({ caller: "tool", userEmail: actor.email }),
  ) as Promise<Awaited<T>>;
}

async function currentMonth(
  actor: MemberActor,
  context: ActionRunContext,
): Promise<MonthSummary> {
  if (isExampleEmail(actor.email)) return (await exampleMonth(context)).thisMonth;
  const result = await checkMemberMonth(undefined, context);
  return result.months[0]!;
}

async function telegramFile(fileId: string) {
  const token = await resolveSecret("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("Telegram is not configured");
  const info = (await (
    await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(15_000) },
    )
  ).json()) as { ok?: boolean; result?: { file_path?: string; file_size?: number } };
  const path = info.ok ? info.result?.file_path : undefined;
  if (!path) throw new Error("Telegram did not return the file");
  if ((info.result?.file_size ?? 0) > MAX_DOCUMENT_BYTES)
    throw new TooBigError();
  const response = await fetch(
    `https://api.telegram.org/file/bot${token}/${path}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!response.ok) throw new Error(`Telegram file HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new TooBigError();
  return bytes;
}
class TooBigError extends Error {}

async function readProof(
  actor: MemberActor,
  fileId: string,
  lang: Lang,
): Promise<string> {
  const words = BOT_TEXT[lang];
  let bytes: Uint8Array;
  try {
    bytes = await telegramFile(fileId);
  } catch (error) {
    return error instanceof TooBigError ? words.tooBig : words.fileFailed;
  }
  return asMember(actor, async (context) => {
    let saved;
    try {
      saved = await saveDocumentFor(
        {
          data: Buffer.from(bytes).toString("base64"),
          rotation: 0,
          acceptQuality: false,
        },
        actor,
      );
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 422) return words.retake;
      if (status === 413) return words.tooBig;
      if (status === 415 || status === 400) return words.unsupported;
      throw error;
    } finally {
      bytes.fill(0);
    }
    const reading = await extractEvidence({ documentId: saved.id }, context);
    const month = await currentMonth(actor, context);
    const head =
      reading.outcome === "budget-used"
        ? words.budget
        : reading.outcome === "not-us-document"
          ? words.notDocument
          : reading.outcome === "nothing-found"
            ? words.nothingFound
            : reading.outcome === "unreadable"
              ? words.unreadable
              : reading.outcome === "unavailable"
                ? words.unavailable
                : reading.created || !saved.existing
                  ? words.read(reading.lines.length)
                  : words.alreadyRead;
    const lines = reading.lines.map(
      (line) => `• ${lineText(line.fields as LineFields, lang)}`,
    );
    const review = reading.lines.length
      ? [`${words.check}: ${SITE}/review`]
      : [];
    return [head, ...lines, ...review, "", monthText(month, lang)].join("\n");
  });
}

const languageOf = (memberLanguage: string | undefined, incoming: IncomingMessage): Lang =>
  memberLanguage === "es-US"
    ? "es"
    : memberLanguage === "en-US"
      ? "en"
      : String(incoming.platformContext.languageCode ?? "").startsWith("es")
        ? "es"
        : "en";

const chatOf = (incoming: IncomingMessage) =>
  String(incoming.platformContext.chatId);

/**
 * Handles what needs no model: linking, commands, files and refusals. A text
 * or a voice note from a linked member goes on to the member's helper, with
 * the voice note replaced by what was said.
 */
export async function beforeTelegramMessage(
  incoming: IncomingMessage,
): Promise<{ handled: true; responseText?: string } | { handled: false }> {
  if (incoming.platform !== "telegram") return { handled: false };
  const guess = languageOf(undefined, incoming);
  if (incoming.platformContext.chatType !== "private")
    return { handled: true, responseText: BOT_TEXT[guess].groups };
  const chatId = chatOf(incoming);
  const raw = String(incoming.platformContext.rawText ?? "").trim();
  const command = raw.match(/^\/(\w+)(?:@\w+)?\s*(.*)$/s);
  const name = command?.[1]?.toLowerCase();
  const argument = command?.[2]?.trim() ?? "";
  const possibleCode =
    name === "start" ? argument : !command ? normalizeLinkCode(raw) : null;
  if (possibleCode) {
    const linked = await consumeLinkCode(
      possibleCode,
      chatId,
      incoming.senderId ?? chatId,
    );
    if (!linked) return { handled: true, responseText: BOT_TEXT[guess].badCode };
    const link = await linkForChat(chatId);
    const actor = { email: link!.ownerEmail, userId: link!.userId };
    const { lang, who } = await asMember(actor, async () => {
      const member = await getMemberRecord(actor);
      const account = isExampleEmail(actor.email)
        ? await exampleAccountForActor(actor)
        : null;
      const lang = languageOf(member.language, incoming);
      const who = account
        ? (account.person as string).replace(/^./, (c) => c.toUpperCase()) +
          (lang === "es" ? " (ejemplo)" : " (example)")
        : lang === "es"
          ? "tu mes"
          : "your month";
      return { lang, who };
    });
    return { handled: true, responseText: BOT_TEXT[lang].linked(who) };
  }
  const link = await linkForChat(chatId);
  if (!link) {
    return {
      handled: true,
      responseText:
        name === "start" ? BOT_TEXT[guess].welcome : BOT_TEXT[guess].unlinked,
    };
  }
  const actor = { email: link.ownerEmail, userId: link.userId };
  const member = await asMember(actor, () => getMemberRecord(actor));
  const lang = languageOf(member.language, incoming);
  const words = BOT_TEXT[lang];
  if (name === "stop") {
    await unlinkChat(chatId);
    return { handled: true, responseText: words.stopped };
  }
  if (name === "help" || name === "start")
    return { handled: true, responseText: words.help };
  if (name === "status")
    return {
      handled: true,
      responseText: await asMember(actor, async (context) =>
        monthText(await currentMonth(actor, context), lang),
      ),
    };
  const kind = incoming.platformContext.fileKind as TelegramFileKind | null;
  if (kind === "unsupported")
    return { handled: true, responseText: words.unsupported };
  const file = incoming.files?.[0];
  if ((kind === "photo" || kind === "document") && file)
    return {
      handled: true,
      responseText: await readProof(actor, file.id, lang),
    };
  // Text and voice go to the member's helper, which uses a model. The example
  // shares the public daily limit.
  if (isExampleEmail(actor.email)) {
    const account = await asMember(actor, () => exampleAccountForActor(actor));
    const reserved = await reservePublicModelUse(
      undefined,
      "telegram_message",
      account?.visitor,
    );
    if (!reserved) return { handled: true, responseText: words.rest };
  }
  if (kind === "voice" && file) {
    let said: string | null = null;
    try {
      said = await transcribeVoiceNote(await telegramFile(file.id), {
        mimeType: file.mimetype ?? "audio/ogg",
        language: lang,
      });
    } catch (error) {
      if (error instanceof TooBigError)
        return { handled: true, responseText: words.tooBig };
      console.error("[eighty] voice note failed", error);
    }
    if (!said) return { handled: true, responseText: words.voiceFailed };
    incoming.text = `[Voice note] ${said}`;
    incoming.platformContext.voiceTranscript = said;
  }
  return { handled: false };
}

/**
 * The account a chat's helper runs as. The framework asks before the link
 * code is read, so an unlinked chat gets a service identity with no member
 * behind it: beforeTelegramMessage answers every unlinked message itself, and
 * no Eighty action accepts that identity.
 */
export async function telegramExecutionContext(incoming: IncomingMessage) {
  const link = await linkForChat(chatOf(incoming));
  if (!link)
    return {
      ownerEmail: "integration@telegram",
      orgId: null,
      principalType: "service" as const,
    };
  return {
    ownerEmail: link.ownerEmail,
    orgId: null,
    principalType: "user" as const,
  };
}
