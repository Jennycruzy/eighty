import { createError } from "h3";

// Demo addresses use a reserved ".invalid" domain: mail to it cannot be
// delivered, so no real person can verify or sign up with one. The server
// makes these addresses; no request can choose or change them.
export const DEMO_EMAIL_DOMAIN = "demo.eighty.invalid";
export const DEMO_ORGANIZATION_ID = "eighty-demo";
export const DEMO_ORGANIZATION_HOST = "demo-host@eighty.invalid";

export function isDemoEmail(email: string | null | undefined): boolean {
  return (
    typeof email === "string" &&
    email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`)
  );
}
export function demoEmail(id: string): string {
  return `demo-${id}@${DEMO_EMAIL_DOMAIN}`;
}
export function refuseDemoEmail(email: string | null | undefined) {
  if (isDemoEmail(email))
    throw createError({
      statusCode: 403,
      statusMessage: "This is not part of the demo.",
    });
}
