import { z } from "zod";
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_REQUEST_BYTES =
  Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const documentUpload = z.strictObject({
  data: z
    .string()
    .min(4)
    .max(Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  rotation: z
    .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
    .default(0),
  acceptQuality: z.boolean().default(false),
});
export const documentReference = z.strictObject({ id: z.uuid() });
