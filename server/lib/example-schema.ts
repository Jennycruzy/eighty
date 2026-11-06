import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Keep these table names: renaming live rows needs a data migration.
// Only server code writes these rows. No action input names a column here.
export const exampleAccounts = pgTable(
  "eighty_demo_accounts",
  {
    userId: text("user_id").primaryKey(),
    email: text("email").notNull().unique(),
    memberId: uuid("member_id").unique(),
    person: text("person", { enum: ["maria", "daniel", "rosa"] }).notNull(),
    visitor: text("visitor").notNull(),
    ticketHash: text("ticket_hash"),
    ticketExpiresAt: timestamp("ticket_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("eighty_demo_accounts_visitor").on(table.visitor, table.createdAt),
    index("eighty_demo_accounts_created").on(table.createdAt),
  ],
);
export const exampleResets = pgTable("eighty_demo_resets", {
  id: uuid("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status", {
    enum: ["running", "completed", "failed"],
  }).notNull(),
  accountsRemoved: integer("accounts_removed").notNull().default(0),
  documentsQueued: integer("documents_queued").notNull().default(0),
  errors: text("errors"),
});
