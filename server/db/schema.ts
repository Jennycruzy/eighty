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
} from "drizzle-orm/pg-core";

import type { EvidenceFields } from "../../shared/evidence.ts";
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
    hash: text("hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("eighty_documents_member_hash").on(table.memberId, table.hash),
    index("eighty_documents_owner").on(table.ownerEmail),
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
    createdAt: createdAt(),
  },
  (table) => [index("eighty_events_owner").on(table.ownerEmail)],
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
