import { z } from "zod";

export const avatarRequestSchema = z.object({
  creatorId: z.string().trim().min(1).max(80),
  filename: z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
  imageBase64: z.string().min(1),
  aspect: z.enum(["1:1", "4:5"]).default("1:1")
}).strict();

export type AvatarRequest = z.infer<typeof avatarRequestSchema>;

export type AvatarPlan = {
  creatorId: string;
  filename: string;
  bytes: Uint8Array;
  dataUrl: string;
  aspect: "1:1" | "4:5";
  operationKey: string;
};

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export function planAvatar(input: unknown): AvatarPlan {
  const body = avatarRequestSchema.parse(input);
  const bytes = Buffer.from(body.imageBase64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_SOURCE_BYTES) {
    throw new Error("Avatar source must decode to between 1 byte and 8 MiB");
  }

  const operationKey = `avatar:${body.creatorId}:${body.filename}:${bytes.length}`;
  return {
    creatorId: body.creatorId,
    filename: body.filename,
    bytes,
    dataUrl: `data:image/jpeg;base64,${body.imageBase64}`,
    aspect: body.aspect,
    operationKey
  };
}
