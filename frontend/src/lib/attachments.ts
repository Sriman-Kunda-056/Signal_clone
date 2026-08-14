/**
 * Attachments are stored as base64 data URLs directly in the messages table
 * (see backend MessageCreate.content) rather than on disk — the deploy
 * target's disk is ephemeral, so a normal file upload would just vanish on
 * the next redeploy. Storing inline means an attachment persists exactly as
 * reliably as every other message, at the cost of DB size, which is why
 * images get compressed and everything has a hard cap before it's ever sent.
 */

const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.8;
// ~1.5MB raw for non-images (no compression available for arbitrary files);
// images get resized/recompressed first so they rarely hit this at all.
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;

export class AttachmentTooLargeError extends Error {}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = dataUrl;
  });
}

/** Resizes to at most MAX_IMAGE_DIMENSION on the longest edge and
 * re-encodes as JPEG, via an offscreen canvas — keeps typical phone photos
 * (often 10MB+) down to a few hundred KB before they ever reach the API. */
async function compressImage(file: File): Promise<string> {
  const original = await readFileAsDataUrl(file);
  const img = await loadImage(original);

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original; // canvas unsupported for some reason — fall back to the raw read

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
}

export interface PreparedAttachment {
  dataUrl: string;
  type: "image" | "file";
}

export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  if (file.type.startsWith("image/")) {
    const dataUrl = await compressImage(file);
    return { dataUrl, type: "image" };
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new AttachmentTooLargeError(`${file.name} is too large (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB).`);
  }
  const dataUrl = await readFileAsDataUrl(file);
  // Non-image data URLs are of the form "data:<mime>;base64,<data>" already;
  // stash the filename in front so the receiving bubble can label the
  // download without a separate column.
  return { dataUrl: `${file.name}|${dataUrl}`, type: "file" };
}
