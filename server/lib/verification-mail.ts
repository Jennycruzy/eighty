import { getBetterAuth } from "@agent-native/core/server";
import { defineEventHandler, readBody, getRequestURL } from "h3";
import { z } from "zod";
import { assertSameSite, refuseExampleContext } from "./example-accounts.ts";
import { isExampleEmail } from "./example-identity.ts";
import {
  takeVerificationMail,
  renewRegistrationDraft,
  RESEND_MESSAGE,
  registrationStatus,
  registrationEmailFromDraft,
} from "./registration.ts";

const requestInput = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((value) => value.trim().toLowerCase())
    .optional(),
  draft: z.string().min(1).max(4096).optional(),
  language: z.enum(["en", "es"]).default("en"),
});
export default defineEventHandler(async (event) => {
  assertSameSite(event.req.headers);
  await refuseExampleContext({
    caller: "http",
    requestHeaders: event.req.headers,
  });
  const input = requestInput.parse(await readBody(event));
  const response = {
    message:
      input.language === "es"
        ? "Si esa dirección tiene una cuenta pendiente, un nuevo enlace va en camino."
        : RESEND_MESSAGE,
  };
  const email = registrationEmailFromDraft(input.draft) ?? input.email;
  if (!email || !(await registrationStatus()).open || isExampleEmail(email))
    return response;
  const allowed = await takeVerificationMail(email);
  if (!allowed) return response;
  const draft = renewRegistrationDraft(allowed.draft, email);
  const callback = new URL("/check/account", getRequestURL(event).origin);
  callback.searchParams.set("lang", input.language);
  if (draft) callback.searchParams.set("draft", draft);
  // Same authentication instance and mail delivery as account creation
  // (exported through patches/@agent-native__core@0.222.2.patch).
  const auth = await getBetterAuth();
  await auth.handler(
    new Request(
      new URL(
        "/_agent-native/auth/ba/send-verification-email",
        getRequestURL(event).origin,
      ),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: getRequestURL(event).origin,
          "accept-language": input.language === "es" ? "es-US" : "en-US",
        },
        body: JSON.stringify({
          email,
          callbackURL: callback.pathname + callback.search,
        }),
      },
    ),
  );
  return response;
});
