import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
// Loaded only into the disposable account-check container, never the live app.
// Authentication, hashing and verification are real; this captures the email transport.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url === "https://api.resend.com/emails") {
    const request = new Request(input, init);
    if (
      request.headers.get("authorization") !== "Bearer eighty-disposable-email"
    )
      throw new Error("Only the disposable email credential is allowed.");
    const message = await request.json();
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    if (
      !recipients.every(
        (value) => typeof value === "string" && value.endsWith("@example.test"),
      )
    )
      throw new Error("Only synthetic recipients are allowed.");
    await writeFile(
      `/tmp/eighty-account-mail-${randomUUID()}.json`,
      JSON.stringify(message),
      { mode: 0o600 },
    );
    return Response.json({ id: randomUUID() });
  }
  return originalFetch(input, init);
};
