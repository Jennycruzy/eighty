import { z } from "zod";
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_REQUEST_BYTES =
  Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
// Standard base64 with "=" or "==" only at the end. A plain character class
// is matched in one pass, so a 15 MB string cannot overflow the stack.
export function isBase64(value: string): boolean {
  return value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}
export const documentUpload = z.strictObject({
  data: z
    .string()
    .min(4)
    .max(Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4)
    .refine(isBase64, { message: "Use base64 data" }),
  rotation: z
    .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
    .default(0),
  acceptQuality: z.boolean().default(false),
});
export const documentReference = z.strictObject({ id: z.uuid() });
