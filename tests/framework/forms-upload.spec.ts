import { expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  upload: vi.fn(async (_options: Record<string, unknown>) => ({
    url: "https://storage.example.test/synthetic.txt",
    provider: "test",
  })),
}));
vi.mock("@agent-native/core/file-upload", () => ({
  uploadFile: storage.upload,
}));
vi.mock("@agent-native/core/server", () => ({
  isAllowedUploadMimeType: () => true,
  runWithRequestContext: async (_context: unknown, task: () => unknown) =>
    task(),
}));
vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  getRouterParam: () => "synthetic-form",
  getRequestHeader: (_event: unknown, key: string) =>
    key === "content-type" ? "multipart/form-data; boundary=test" : undefined,
  setResponseStatus: vi.fn(),
  readMultipartFormData: async () => [
    { name: "fieldId", data: Buffer.from("proof") },
    {
      name: "file",
      filename: "synthetic.txt",
      type: "text/plain",
      data: Buffer.from("Synthetic test file"),
    },
  ],
}));
vi.mock("upstream/templates/forms/server/db/index.js", () => ({
  getDb: vi.fn(),
}));
vi.mock("upstream/templates/forms/server/lib/form-lookup.js", () => ({
  findFormBySlugOrId: async () => ({
    id: "synthetic-form",
    status: "published",
    ownerEmail: "test@example.test",
    fields: JSON.stringify([
      { id: "proof", type: "file", label: "Proof", required: true },
    ]),
    settings: "{}",
  }),
}));
vi.mock("upstream/templates/forms/server/lib/form-request.js", () => ({
  parseStoredFormSettings: () => ({}),
  setPublicFormCors: vi.fn(),
  isPublicFormOriginAllowed: () => true,
}));
vi.mock("upstream/templates/forms/server/lib/validate-fields.js", () => ({
  assertValidFields: vi.fn(),
}));

import { uploadFormFile } from "upstream/templates/forms/server/handlers/uploads.ts";

it("Forms does not ask storage for a permanent public document URL", async () => {
  const result = await uploadFormFile({} as never);
  expect(result).toHaveProperty("name", "synthetic.txt");
  expect(storage.upload).toHaveBeenCalledOnce();
  expect(storage.upload.mock.calls[0]?.[0]).not.toHaveProperty(
    "stableUrl",
    true,
  );
});
