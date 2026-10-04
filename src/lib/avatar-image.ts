"use client";

const SIZE = 400;
export const MAX_AVATAR_SOURCE_BYTES = 15 * 1024 * 1024;

/**
 * Square-crops (center) and shrinks a picture to 400×400 JPEG before upload:
 * a profile picture never needs more, and Arweave storage is paid per byte.
 */
export async function prepareAvatar(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Pick an image (JPG, PNG, WebP, GIF).");
  if (file.size > MAX_AVATAR_SOURCE_BYTES) throw new Error("Image too large (max 15 MB).");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read this image.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process this image.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
  if (!blob) throw new Error("Couldn't process this image.");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}
