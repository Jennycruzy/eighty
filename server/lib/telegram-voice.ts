import { transcribeWithBuilder } from "@agent-native/core/transcription/builder";

// A voice note about hours is short. Longer audio is not read.
export const MAX_VOICE_BYTES = 5 * 1024 * 1024;

/**
 * What the member said in a voice note, through the framework's transcription
 * on the deployment's Builder connection. Returns null when nothing was heard.
 */
export async function transcribeVoiceNote(
  bytes: Uint8Array,
  options: { mimeType: string; language: "en" | "es" },
): Promise<string | null> {
  if (bytes.length === 0 || bytes.length > MAX_VOICE_BYTES) return null;
  try {
    const result = await transcribeWithBuilder({
      audioBytes: bytes,
      mimeType: options.mimeType,
      language: options.language,
      instructions:
        "A person describes their work, volunteer, school or pay hours for a Medicaid work rule. Keep numbers, dates, days and place names exactly as said.",
      timeoutMs: 30_000,
    });
    const text = result.text?.trim();
    return text ? text.slice(0, 1_000) : null;
  } finally {
    bytes.fill(0);
  }
}
