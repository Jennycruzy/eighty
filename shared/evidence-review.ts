import { z } from "zod";

export const evidenceReference = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
});
export const duplicateChoice = z.strictObject({
  choice: z.literal("these-are-separate"),
  compared: z
    .array(evidenceReference)
    .min(1)
    .max(1000)
    .refine(
      (lines) => new Set(lines.map((line) => line.id)).size === lines.length,
      "Review each other line once.",
    ),
});
export type DuplicateChoice = z.infer<typeof duplicateChoice>;
export const confirmInput = evidenceReference.extend({
  duplicateChoice: duplicateChoice.optional(),
});
