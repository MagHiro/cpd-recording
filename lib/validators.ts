import { z } from "zod";
import { extractGoogleDriveFileId } from "@/lib/drive-file-id";

export const emailSchema = z.string().email().transform((v) => v.trim().toLowerCase());

export const loginRequestSchema = z.object({
  email: emailSchema,
});

export const loginVerifySchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/),
});

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const adminManualRegisterSchema = z.object({
  email: emailSchema,
});

const driveFileIdSchema = z
  .string()
  .min(1)
  .transform((value) => extractGoogleDriveFileId(value) ?? value.trim())
  .refine((value) => /^[a-zA-Z0-9_-]{10,}$/.test(value), {
    message: "Provide a valid Google Drive file ID or Google Drive file link.",
  });

const inboundAssetSchema = z.object({
  assetId: z.string().min(1).optional(),
  title: z.string().min(1),
  kind: z.enum(["VIDEO", "PDF", "ZIP"]),
  googleDriveFileId: driveFileIdSchema,
  mimeType: z.string().min(2).optional(),
  sizeBytes: z.number().int().positive().optional(),
});

const bookedClassInformationSchema = z.object({
  id: z.number().int().positive().optional(),
  class_code: z.string().min(1),
  price: z.number().nonnegative().optional(),
});

const bookedClassItemSchema = z.object({
  class_information: bookedClassInformationSchema,
  title: z.string().min(1),
  class_date: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(),
  recordings: z.array(inboundAssetSchema).default([]),
  materials: z.array(inboundAssetSchema).default([]),
});

export const n8nIngestSchema = z.object({
  email: emailSchema,
  requestId: z.string().min(1).optional(),
  packageTitle: z.string().min(1),
  recordings: z.array(inboundAssetSchema).default([]),
  materials: z.array(inboundAssetSchema).default([]),
});

export const n8nBookedClassIngestSchema = z.object({
  email: emailSchema,
  requestId: z.string().min(1).optional(),
  booked_class: z.array(bookedClassItemSchema).min(1),
});

export const n8nCatalogAssignSchema = z.object({
  email: emailSchema,
  requestId: z.string().min(1).optional(),
  videoIds: z.array(z.string().min(1)).min(1).optional(),
  videoId: z.string().min(1).optional(),
  video_ids: z.array(z.string().min(1)).min(1).optional(),
}).refine((data) => {
  return Boolean(data.videoId) || Boolean(data.videoIds?.length) || Boolean(data.video_ids?.length);
}, {
  message: "Provide at least one video ID in videoId, videoIds, or video_ids.",
});

export const adminAssetSchema = z.object({
  assetId: z.string().min(1).optional(),
  title: z.string().min(1),
  kind: z.enum(["VIDEO", "PDF", "ZIP"]),
  googleDriveFileId: driveFileIdSchema,
  mimeType: z.string().min(2).optional(),
  sizeBytes: z.coerce.number().int().positive().optional(),
});

export const adminCreateEntrySchema = z.object({
  videoId: z.string().min(1),
  classCode: z.string().min(1),
  classTitle: z.string().min(1),
  classDate: z.string().min(1).optional(),
  classPrice: z.coerce.number().nonnegative().optional(),
  recording: adminAssetSchema.extend({
    kind: z.literal("VIDEO"),
  }),
  materials: z
    .array(
      adminAssetSchema.extend({
        kind: z.enum(["PDF", "ZIP"]),
      }),
    )
    .default([]),
});
