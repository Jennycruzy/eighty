import type { PrivateBlobHandle } from "@agent-native/core/private-blob";
import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  timestamp,
  date,
  uniqueIndex,
  index,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";

import type { DuplicateChoice } from "../../shared/evidence-review.ts";
import type { EvidenceFields } from "../../shared/evidence.ts";
import type { ReaderQuestion } from "../../shared/reader.ts";
import type { MemberProfile } from "../../shared/member-profile.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const members = pgTable(
  "eighty_members",
  {
    id: uuid("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    userId: text("user_id").notNull(),
    stateCode: text("state_code"),
    language: text("language").notNull(),
    screener: jsonb("screener").$type<MemberProfile["screener"]>().notNull(),
    renewalDate: date("renewal_date", { mode: "string" }),
    caseNumber: text("case_number"),
    /** The state letter the member saved: its printed date, and when it came if late. */
    noticePrinted: date("notice_printed", { mode: "string" }),
    noticeArrived: date("notice_arrived", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("eighty_members_owner").on(table.ownerEmail),
    uniqueIndex("eighty_members_user").on(table.userId),
  ],
);
export const documents = pgTable(
  "eighty_documents",
  {
    id: uuid("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    handle: jsonb("handle").$type<PrivateBlobHandle>().notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    pages: integer("pages"),
    rotation: integer("rotation").notNull().default(0),
    hash: text("hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("eighty_documents_member_hash").on(table.memberId, table.hash),
    index("eighty_documents_owner").on(table.ownerEmail),
  ],
);
// This row survives until storage confirms deletion, including after a failed request.
export const documentDeletions = pgTable(
  "eighty_document_deletions",
  {
    id: uuid("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    memberId: uuid("member_id").notNull(),
    handle: jsonb("handle").$type<PrivateBlobHandle>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
  },
  (table) => [
    index("eighty_document_deletions_due").on(table.nextAttemptAt),
    index("eighty_document_deletions_owner").on(
      table.memberId,
      table.ownerEmail,
    ),
  ],
);
export const evidence = pgTable(
  "eighty_evidence",
  {
    id: uuid("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    status: text("status", {
      enum: ["proposed", "confirmed", "rejected"],
    }).notNull(),
    fields: jsonb("fields").$type<EvidenceFields>().notNull(),
    confidence: integer("confidence"),
    // Facts the reader was not sure of. Their values stay blank.
    questions: jsonb("questions")
      .$type<ReaderQuestion[]>()
      .notNull()
      .default([]),
    createdBy: text("created_by", {
      enum: ["agent", "member", "navigator"],
    }).notNull(),
    version: integer("version").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("eighty_evidence_member_status").on(table.memberId, table.status),
    index("eighty_evidence_owner").on(table.ownerEmail),
    index("eighty_evidence_document").on(table.documentId),
  ],
);
export const evidenceVersions = pgTable(
  "eighty_evidence_versions",
  {
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    ownerEmail: text("owner_email").notNull(),
    fields: jsonb("fields").$type<EvidenceFields>().notNull(),
    status: text("status", {
      enum: ["proposed", "confirmed", "rejected"],
    }).notNull(),
    createdBy: text("created_by", {
      enum: ["agent", "member", "navigator"],
    }).notNull(),
    duplicateChoice: jsonb("duplicate_choice").$type<DuplicateChoice>(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.evidenceId, table.version] }),
    index("eighty_versions_owner").on(table.ownerEmail),
  ],
);
export const memberEvents = pgTable(
  "eighty_member_events",
  {
    id: uuid("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    kind: text("kind").notNull(),
    targetId: uuid("target_id"),
    details: jsonb("details").$type<DuplicateChoice>(),
    createdAt: createdAt(),
  },
  (table) => [index("eighty_events_owner").on(table.ownerEmail)],
);
// A one-time code a signed-in member uses to link one Telegram chat.
export const telegramCodes = pgTable(
  "eighty_telegram_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    ownerEmail: text("owner_email").notNull(),
    userId: text("user_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("eighty_telegram_codes_member").on(table.memberId)],
);
// One linked Telegram chat per member, and one member per chat.
export const telegramLinks = pgTable(
  "eighty_telegram_links",
  {
    chatId: text("chat_id").primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    ownerEmail: text("owner_email").notNull(),
    userId: text("user_id").notNull(),
    telegramUserId: text("telegram_user_id").notNull(),
    /** The daily check-in; the member turns it off with /checkins off. */
    checkins: boolean("checkins").notNull().default(true),
    lastMessageOn: date("last_message_on", { mode: "string" }),
    monthCheckinOn: date("month_checkin_on", { mode: "string" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("eighty_telegram_links_member_id_key").on(table.memberId),
    index("eighty_telegram_links_owner").on(table.ownerEmail),
  ],
);
export const aiLedger = pgTable(
  "eighty_ai_ledger",
  {
    id: uuid("id").primaryKey(),
    memberId: uuid("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    purpose: text("purpose", {
      enum: ["extraction", "try", "fixed-rule"],
    }).notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: createdAt(),
  },
  (table) => [index("eighty_ai_ledger_day").on(table.createdAt)],
);
