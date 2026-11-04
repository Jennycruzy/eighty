// Kept apart from server/plugins/db.ts so its version numbers never collide
// with other member tables. These tables have no link to eighty_members rows;
// the reset removes them in code, limited to demo addresses in each query.
export const DEMO_MIGRATIONS = [
  {
    version: 1,
    name: "eighty-demo-accounts-and-resets",
    sql: `
 CREATE TABLE IF NOT EXISTS eighty_demo_accounts (
  user_id text PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email ~ '^demo-[0-9a-f-]{36}@demo\\.eighty\\.invalid$'),
  member_id uuid UNIQUE,
  person text NOT NULL CHECK (person IN ('maria','daniel','rosa')),
  visitor text NOT NULL,
  ticket_hash text,
  ticket_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
 );
 CREATE INDEX IF NOT EXISTS eighty_demo_accounts_visitor ON eighty_demo_accounts(visitor, created_at);
 CREATE INDEX IF NOT EXISTS eighty_demo_accounts_created ON eighty_demo_accounts(created_at);
 CREATE TABLE IF NOT EXISTS eighty_demo_resets (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running','completed','failed')),
  accounts_removed integer NOT NULL DEFAULT 0 CHECK (accounts_removed >= 0),
  documents_queued integer NOT NULL DEFAULT 0 CHECK (documents_queued >= 0),
  errors text,
  CHECK (status = 'running' OR finished_at IS NOT NULL),
  CHECK (status <> 'failed' OR errors IS NOT NULL)
 );
 CREATE INDEX IF NOT EXISTS eighty_demo_resets_started ON eighty_demo_resets(started_at);
 `,
  },
];
