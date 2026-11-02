import { describe, expect, it, vi } from "vitest";

vi.mock("h3", () => ({
  getHeader: vi.fn(),
  getMethod: vi.fn(),
  getQuery: vi.fn(),
  readRawBody: vi.fn(),
}));
vi.mock("upstream/packages/core/src/action.js", () => ({ fail: vi.fn() }));
vi.mock("upstream/packages/core/src/app-config/index.js", () => ({
  getAppConfig: vi.fn(),
}));
vi.mock("upstream/packages/core/src/server/credential-provider.js", () => ({
  resolveSecret: vi.fn(),
}));
vi.mock("upstream/packages/core/src/server/h3-helpers.js", () => ({
  readBody: vi.fn(),
}));

import { telegramAdapter } from "upstream/packages/core/src/integrations/adapters/telegram.ts";
import { whatsappAdapter } from "upstream/packages/core/src/integrations/adapters/whatsapp.ts";

describe("Incoming documents must reach the reader", () => {
  const telegramMessage = {
    message_id: 1,
    date: 1793628000,
    chat: { id: 1, type: "private" },
    from: { id: 1, first_name: "Test" },
  };

  it("Telegram text reaches the conversation", async () => {
    const event = {
      context: {
        __rawBody: { message: { ...telegramMessage, text: "My hours" } },
      },
    };
    const result = await telegramAdapter().parseIncomingMessage(event as never);
    expect(result?.text).toBe("My hours");
  });

  it.each([
    {
      photo: [{ file_id: "synthetic-photo", width: 600, height: 800 }],
      caption: "My hours",
    },
    {
      document: {
        file_id: "synthetic-document",
        mime_type: "application/pdf",
        file_name: "hours.pdf",
      },
    },
    {
      voice: {
        file_id: "synthetic-voice",
        mime_type: "audio/ogg",
        duration: 3,
      },
    },
  ])(
    "Telegram preserves media or returns an explicit unsupported message: %j",
    async (media) => {
      const event = {
        context: { __rawBody: { message: { ...telegramMessage, ...media } } },
      };
      expect(
        await telegramAdapter().parseIncomingMessage(event as never),
      ).not.toBeNull();
    },
  );

  it.each(["image", "document", "audio"])(
    "WhatsApp does not silently drop %s",
    async (type) => {
      const message = {
        id: "synthetic-message",
        from: "10000000000",
        timestamp: "1793628000",
        type,
        [type]: { id: "synthetic-media", caption: "My hours" },
      };
      const body = {
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: "synthetic-phone" },
                  messages: [message],
                },
              },
            ],
          },
        ],
      };
      const event = { context: { __rawBody: JSON.stringify(body) } };
      expect(
        await whatsappAdapter().parseIncomingMessage(event as never),
      ).not.toBeNull();
    },
  );
});
