import { createError } from "h3";

// Keep the reserved address domain and prefix: live rows use them.
export const EXAMPLE_EMAIL_DOMAIN = "demo.eighty.invalid";
export const EXAMPLE_ORGANIZATION_ID = "eighty-example";
export const EXAMPLE_ORGANIZATION_HOST = "example-host@eighty.invalid";

export function isExampleEmail(email: string | null | undefined): boolean {
  return (
    typeof email === "string" &&
    email.trim().toLowerCase().endsWith(`@${EXAMPLE_EMAIL_DOMAIN}`)
  );
}
export function exampleEmail(id: string): string {
  return `demo-${id}@${EXAMPLE_EMAIL_DOMAIN}`;
}
export function refuseExampleEmail(email: string | null | undefined) {
  if (isExampleEmail(email))
    throw createError({
      statusCode: 403,
      statusMessage: "This is not part of the example.",
    });
}
