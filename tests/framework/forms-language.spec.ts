import { expect, it, vi } from "vitest";

vi.mock("@agent-native/core/server", () => ({
  getAppBasePath: () => "",
  getForwardedRequestURL: vi.fn(),
}));
vi.mock("@agent-native/core/server/ssr-handler", () => ({
  resolveSsrCacheHeaders: vi.fn(),
}));
vi.mock("h3", () => ({ getMethod: () => "GET" }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("upstream/templates/forms/server/db/index.js", () => ({
  schema: { forms: { id: "id", slug: "slug" } },
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => [
          {
            id: "synthetic-form",
            slug: "confirmar",
            title: "Confirme las horas",
            status: "published",
            deletedAt: null,
            updatedAt: "2026-11-02",
            fields: JSON.stringify([
              { id: "hours", type: "number", label: "Horas", required: true },
            ]),
            settings: JSON.stringify({
              language: "es-US",
              locale: "es-US",
              submitButtonText: "Enviar",
            }),
          },
        ],
      }),
    }),
  }),
}));

import { renderPublicFormHtml } from "upstream/templates/forms/server/lib/public-form-ssr.ts";

it("a Spanish confirmation form declares Spanish as its page language", async () => {
  const result = await renderPublicFormHtml(
    "https://forms.example.test/f/confirmar?lang=es-US",
  );
  expect(result.status).toBe(200);
  expect(result.html).toContain("Confirme las horas");
  expect(result.html.match(/<html\b[^>]*>/)?.[0]).toMatch(
    /\blang="es(?:-US)?"/,
  );
});
