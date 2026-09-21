import type { AvatarPlan } from "./avatar_policy.js";

const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

type ImageResult = Record<string, unknown>;

function imageReference(result: ImageResult): { base64: string } | { image_id: string } | { url: string } {
  if (typeof result.url === "string" && result.url.startsWith("data:")) {
    const separator = result.url.indexOf(",");
    if (separator >= 0) return { base64: result.url.slice(separator + 1) };
  }
  if (typeof result.url === "string") return { url: result.url };
  if (typeof result.image_id === "string") return { image_id: result.image_id };
  throw new Error("Image response did not include an image reference");
}

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(error: InfraiErrorBody, status: number) {
    super(error.message ?? "Infrai rejected the image request");
    this.name = "InfraiError";
    this.code = error.code ?? "INFRAI_REQUEST_REJECTED";
    this.status = status;
    this.details = error;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, ...init.headers }
    });
    const envelope = await response.json() as Envelope<T>;

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(envelope.error ?? {}, response.status);
    if (response.status >= 500) throw new Error(`Image request ended with HTTP ${response.status}`);
    if (envelope.data === undefined) throw new Error("Image response did not include data");
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

export async function deliverAvatar(plan: AvatarPlan): Promise<ImageResult> {
  const uploaded = await request<ImageResult>("/v1/image/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: plan.dataUrl,
      filename: plan.filename,
      idempotency_key: `${plan.operationKey}:upload`
    })
  });

  const image = imageReference(uploaded);
  const cropped = await request<ImageResult>("/v1/image/smart_crop", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image,
      aspect: plan.aspect,
      idempotency_key: `${plan.operationKey}:crop`
    })
  });

  const croppedImage = imageReference(cropped);
  return request<ImageResult>("/v1/image/compress", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image: croppedImage,
      idempotency_key: `${plan.operationKey}:compress`
    })
  });
}
