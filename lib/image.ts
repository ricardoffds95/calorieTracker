import { AI_MAX_IMAGE_BASE64_LENGTH } from "./schemas";

/** Longest side sent to the AI; retried once smaller if the result is still too big. */
export const AI_IMAGE_MAX_SIDES = [1024, 768] as const;
const JPEG_QUALITY = 0.7;
/** Original files above this are refused before decoding (iPhone photos are ~2-8 MB). */
export const MAX_INPUT_IMAGE_BYTES = 30 * 1024 * 1024;

export type ImageErrorKind = "unreadable" | "too_large";

export const IMAGE_ERROR_MESSAGES: Record<ImageErrorKind, string> = {
  unreadable: "Can't open this image",
  too_large: "Image too large",
};

export class ImageError extends Error {
  constructor(readonly kind: ImageErrorKind) {
    super(IMAGE_ERROR_MESSAGES[kind]);
    this.name = "ImageError";
  }
}

export interface AiImage {
  /** Base64 without the data URL prefix, as `aiRequestSchema` expects. */
  image: string;
  mimeType: "image/jpeg";
}

/** Scales (width, height) to fit within `max` on the longest side, keeping the ratio and never upscaling. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (!(width > 0 && height > 0 && max > 0)) throw new RangeError("Dimensions must be positive");
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Strips the `data:<type>;base64,` prefix. */
export function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? "" : dataUrl.slice(comma + 1);
}

/** Browser only: decodes a photo (incl. HEIC on Safari), resizes it and re-encodes it as JPEG for the AI. */
export async function prepareImageForAi(file: Blob): Promise<AiImage> {
  if (file.size > MAX_INPUT_IMAGE_BYTES) throw new ImageError("too_large");
  if (file.type && !file.type.startsWith("image/")) throw new ImageError("unreadable");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("unreadable");
  }

  try {
    for (const max of AI_IMAGE_MAX_SIDES) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new ImageError("unreadable");
      context.drawImage(bitmap, 0, 0, width, height);
      const image = dataUrlToBase64(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      if (!image) throw new ImageError("unreadable");
      if (image.length <= AI_MAX_IMAGE_BASE64_LENGTH) return { image, mimeType: "image/jpeg" };
    }
    throw new ImageError("too_large");
  } finally {
    bitmap.close();
  }
}
