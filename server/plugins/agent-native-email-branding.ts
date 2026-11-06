import {
  defineAppConfig,
  overrideTransactionalEmail,
} from "@agent-native/core/server";

export default defineAppConfig({
  auth: { requireEmailVerification: true },
  privateBlob: { provider: "hosted-private", publicUploadFallback: false },
  app: {
    id: "eighty",
    slug: "eighty",
    // This name appears in transactional emails. Change it to your product name.
    name: "Eighty",
    // The source template keeps a renamed app from inheriting first-party email branding.
    sourceTemplate: "chat",
    // Keep the template's authenticated entry explicit after renaming the app.
    homePath: "/months",
    // Optional: use your own absolute HTTPS logo URL in transactional emails.
    // logoUrl: "https://example.com/logo.png",
  },
});

overrideTransactionalEmail("core.verify-signup", (_props, message) => ({
  subject: message.subject,
  html: message.html
    .replace(/alt="Eighty"/g, 'alt=""')
    .replace("This link expires in 1 hour.", "This link works for 24 hours."),
  text: message.text.replace(
    "This link expires in 1 hour.",
    "This link works for 24 hours.",
  ),
}));
