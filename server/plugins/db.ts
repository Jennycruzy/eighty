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
  ],
  { table: "eighty_schema_migrations" },
);
