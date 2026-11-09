import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "eighty-member-evidence-tables",
      sql: `
 CREATE TABLE IF NOT EXISTS eighty_members (
  id uuid PRIMARY KEY, owner_email text NOT NULL UNIQUE, user_id text NOT NULL UNIQUE,
  state_code text, language text NOT NULL CHECK (language IN ('en-US','es-US')),
  screener jsonb NOT NULL, renewal_date date, case_number text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
 );
 CREATE TABLE IF NOT EXISTS eighty_documents (
  id uuid PRIMARY KEY, owner_email text NOT NULL, member_id uuid NOT NULL REFERENCES eighty_members(id) ON DELETE CASCADE,
  handle jsonb NOT NULL, mime text NOT NULL, bytes integer NOT NULL CHECK (bytes > 0), pages integer,
  hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(member_id,hash),
  CHECK ((handle->'encrypted' = 'true'::jsonb) IS TRUE AND (handle->'opaque' = 'true'::jsonb) IS TRUE)
 );
 CREATE INDEX IF NOT EXISTS eighty_documents_owner ON eighty_documents(owner_email);
 CREATE TABLE IF NOT EXISTS eighty_evidence (
  id uuid PRIMARY KEY, owner_email text NOT NULL, member_id uuid NOT NULL REFERENCES eighty_members(id) ON DELETE CASCADE,
  document_id uuid REFERENCES eighty_documents(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('proposed','confirmed','rejected')), fields jsonb NOT NULL,
  confidence integer CHECK (confidence BETWEEN 0 AND 10000),
  created_by text NOT NULL CHECK (created_by IN ('agent','member','navigator')), version integer NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
 );
 CREATE INDEX IF NOT EXISTS eighty_evidence_member_status ON eighty_evidence(member_id,status);
 CREATE INDEX IF NOT EXISTS eighty_evidence_owner ON eighty_evidence(owner_email);
 CREATE TABLE IF NOT EXISTS eighty_evidence_versions (
  evidence_id uuid NOT NULL REFERENCES eighty_evidence(id) ON DELETE CASCADE, version integer NOT NULL,
  owner_email text NOT NULL, fields jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('proposed','confirmed','rejected')),
  created_by text NOT NULL CHECK (created_by IN ('agent','member','navigator')),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(evidence_id,version)
 );
 CREATE INDEX IF NOT EXISTS eighty_versions_owner ON eighty_evidence_versions(owner_email);
 CREATE TABLE IF NOT EXISTS eighty_member_events (
  id uuid PRIMARY KEY, owner_email text NOT NULL, member_id uuid NOT NULL REFERENCES eighty_members(id) ON DELETE CASCADE,
  actor_id text NOT NULL, kind text NOT NULL, target_id uuid, created_at timestamptz NOT NULL DEFAULT now()
 );
 CREATE INDEX IF NOT EXISTS eighty_events_owner ON eighty_member_events(owner_email);
 CREATE TABLE IF NOT EXISTS eighty_ai_ledger (
  id uuid PRIMARY KEY, member_id uuid REFERENCES eighty_members(id) ON DELETE SET NULL,
  action text NOT NULL, purpose text NOT NULL CHECK (purpose IN ('extraction','try','fixed-rule')),
  input_tokens integer CHECK (input_tokens >= 0), output_tokens integer CHECK (output_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), CHECK (purpose <> 'try' OR member_id IS NULL)
 );
 CREATE INDEX IF NOT EXISTS eighty_ai_ledger_day ON eighty_ai_ledger(created_at);
 `,
    },
    {
      version: 2,
      name: "eighty-separate-evidence-choice",
      sql: `
 ALTER TABLE eighty_evidence_versions ADD COLUMN IF NOT EXISTS duplicate_choice jsonb;
 ALTER TABLE eighty_member_events ADD COLUMN IF NOT EXISTS details jsonb;
 `,
    },
    {
      version: 3,
      name: "eighty-document-rotation",
      sql: `ALTER TABLE eighty_documents ADD COLUMN IF NOT EXISTS rotation integer NOT NULL DEFAULT 0 CHECK (rotation IN (0,90,180,270));`,
    },
    {
      version: 4,
      name: "eighty-file-deletion-retries",
      sql: `CREATE TABLE IF NOT EXISTS eighty_document_deletions (
        id uuid PRIMARY KEY, owner_email text NOT NULL, member_id uuid NOT NULL, handle jsonb NOT NULL,
        attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0), next_attempt_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((handle->'encrypted' = 'true'::jsonb) IS TRUE AND (handle->'opaque' = 'true'::jsonb) IS TRUE)
      );
      CREATE INDEX IF NOT EXISTS eighty_document_deletions_due ON eighty_document_deletions(next_attempt_at);
      CREATE INDEX IF NOT EXISTS eighty_document_deletions_owner ON eighty_document_deletions(member_id,owner_email);`,
    },
    {
      version: 5,
      name: "eighty-reader-questions",
      sql: `ALTER TABLE eighty_evidence ADD COLUMN IF NOT EXISTS questions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(questions) = 'array');
      CREATE INDEX IF NOT EXISTS eighty_evidence_document ON eighty_evidence(document_id);`,
    },
    {
      version: 6,
      name: "eighty-registration-mail",
      sql: `CREATE TABLE IF NOT EXISTS eighty_registration_mail (
        address_hash text PRIMARY KEY, draft text, window_start timestamptz NOT NULL DEFAULT now(),
        sent integer NOT NULL DEFAULT 0 CHECK (sent >= 0), updated_at timestamptz NOT NULL DEFAULT now()
      );`,
    },
    {
      version: 7,
      name: "eighty-telegram-links",
      sql: `CREATE TABLE IF NOT EXISTS eighty_telegram_codes (
        code_hash text PRIMARY KEY, member_id uuid NOT NULL REFERENCES eighty_members(id) ON DELETE CASCADE,
        owner_email text NOT NULL, user_id text NOT NULL, expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS eighty_telegram_codes_member ON eighty_telegram_codes(member_id);
      CREATE TABLE IF NOT EXISTS eighty_telegram_links (
        chat_id text PRIMARY KEY, member_id uuid NOT NULL UNIQUE REFERENCES eighty_members(id) ON DELETE CASCADE,
        owner_email text NOT NULL, user_id text NOT NULL, telegram_user_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS eighty_telegram_links_owner ON eighty_telegram_links(owner_email);`,
    },
    {
      version: 8,
      name: "eighty-checkins-and-notices",
      sql: `ALTER TABLE eighty_telegram_links ADD COLUMN IF NOT EXISTS checkins boolean NOT NULL DEFAULT true;
      ALTER TABLE eighty_telegram_links ADD COLUMN IF NOT EXISTS last_message_on date;
      ALTER TABLE eighty_telegram_links ADD COLUMN IF NOT EXISTS month_checkin_on date;
      ALTER TABLE eighty_members ADD COLUMN IF NOT EXISTS notice_printed date;
      ALTER TABLE eighty_members ADD COLUMN IF NOT EXISTS notice_arrived date;`,
    },
  ],
  { table: "eighty_schema_migrations" },
);
