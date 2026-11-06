// Test setup for the example: an in-memory PostgreSQL (PGlite) with the real app,
// example and framework migrations. Import this module before any server code.
// These three lines run only in the test process, before server code loads.
process.env.NODE_ENV = "test"; // guard:allow-env-mutation — test process only: selects test mode
process.env.DATABASE_URL = "pglite:memory://"; // guard:allow-env-mutation — test process only: in-memory database
// guard:allow-env-mutation — test process only: throwaway signing key
process.env.BETTER_AUTH_SECRET = "throwaway-test-key-0123456789abcdef";

// Example settings are passed in directly, never read from the environment here.
export const defaultSettings = { enabled: true, perVisitor: 5, total: 120 };

export const stored = new Map();
export const storage = { failDeletes: false, deletes: 0 };

export async function prepareDatabase() {
  const { getDbExec, runMigrations } = await import("@agent-native/core/db");
  const { runBetterAuthMigrations } = await import("@agent-native/core/server");
  const { registerPrivateBlobProvider } =
    await import("@agent-native/core/private-blob");
  const appMigrations = (await import("../../server/plugins/db.ts")).default;
  const { DEMO_MIGRATIONS } =
    await import("../../server/lib/demo-migrations.ts");
  await appMigrations({ hooks: { hook() {} } });
  await runMigrations(DEMO_MIGRATIONS, {
    table: "eighty_demo_schema_migrations",
  })({ hooks: { hook() {} } });
  await runBetterAuthMigrations();
  // A storage transport for tests only; the app code above it runs unchanged.
  registerPrivateBlobProvider({
    id: "eighty-example-test-storage",
    name: "Test storage",
    isConfigured: () => true,
    put: async (input) => {
      const id = `${input.filename}-${stored.size}`;
      stored.set(id, Buffer.from(input.data));
      return {
        id,
        provider: "eighty-example-test-storage",
        opaque: true,
        encrypted: true,
        mimeType: input.mimeType,
      };
    },
    read: async (handle) => ({
      data: stored.get(handle.id),
      handle,
    }),
    delete: async (handle) => {
      storage.deletes++;
      if (storage.failDeletes) throw new Error("Test storage is down");
      stored.delete(handle.id);
      return { deleted: true, provider: "eighty-example-test-storage" };
    },
  });
  return getDbExec();
}

export const siteHeaders = (ip = "203.0.113.10", extra = {}) =>
  new Headers({
    origin: "http://localhost:3000",
    host: "localhost:3000",
    "sec-fetch-site": "same-origin",
    "x-forwarded-for": ip,
    ...extra,
  });

// Returns the cookie a browser would hold after an H3 response.
export function cookieFrom(event) {
  return event.res.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

// Opens a example the way the landing page does: start_example, then the one-time
// ticket. Returns a browser context for the new account.
export async function openExample(
  person = "maria",
  ip = "203.0.113.10",
  settings = defaultSettings,
) {
  const { H3Event } = await import("h3");
  const { startExample, enterExample } =
    await import("../../server/lib/example-accounts.ts");
  const { getBrowserCookieSession } = await import("@agent-native/core/server");
  const started = await startExample(
    { person },
    { caller: "http", requestHeaders: siteHeaders(ip) },
    settings,
  );
  const event = new H3Event(
    new Request("http://localhost:3000/enter-example", {
      method: "POST",
      headers: siteHeaders(ip),
    }),
  );
  await enterExample(event, { ticket: started.ticket });
  const cookie = cookieFrom(event);
  const session = await getBrowserCookieSession(
    new H3Event(new Request("http://localhost/", { headers: { cookie } })),
  );
  return {
    ticket: started.ticket,
    cookie,
    email: session.email,
    userId: session.authUserId,
    context: {
      caller: "frontend",
      userEmail: session.email,
      requestHeaders: new Headers({ cookie }),
    },
  };
}

// A real (non-example) verified member, made through the same session code.
export async function realMember(email = "real.member@example.test") {
  const { randomUUID } = await import("node:crypto");
  const { H3Event } = await import("h3");
  const { getDbExec } = await import("@agent-native/core/db");
  const server = await import("@agent-native/core/server");
  const { saveMemberRecord } =
    await import("../../server/lib/member-records.ts");
  const userId = randomUUID();
  const now = new Date().toISOString();
  await getDbExec().execute({
    sql: 'INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, true, ?, ?)',
    args: [userId, "Real member", email, now, now],
  });
  const session = await server.createBetterAuthSessionForEmail(email);
  const event = new H3Event(new Request("http://localhost/"));
  await server.setBetterAuthSessionCookie(event, session.token);
  const cookie = cookieFrom(event);
  const member = await server.runWithRequestContext(
    { userEmail: email, authUserId: userId },
    () =>
      saveMemberRecord(
        { email, userId },
        { language: "en-US", screener: { state: "NE" } },
      ),
  );
  return {
    email,
    userId,
    member,
    cookie,
    context: {
      caller: "frontend",
      userEmail: email,
      requestHeaders: new Headers({ cookie }),
    },
  };
}

export async function as(account, fn) {
  const { runWithRequestContext } = await import("@agent-native/core/server");
  return runWithRequestContext(
    { userEmail: account.email, authUserId: account.userId },
    fn,
  );
}
