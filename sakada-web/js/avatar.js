// Profile photos: shown wherever the initials were (Profile, the Home
// greeting, the desktop top bar). A new photo is cut to a square from the
// middle and shrunk to 256 px on the phone before upload, so it's quick on
// slow data. Bucket and rules: sakada-backend 0025.

import { supabase } from "./supabase-client.js";

export const AVATAR_SIZE = 256;
const BUCKET = "avatars";

/** The largest centred square of a w×h picture: where to cut it. */
export function centreSquare(w, h) {
  const size = Math.min(w, h);
  return { sx: Math.round((w - size) / 2), sy: Math.round((h - size) / 2), size };
}

/** Initials as now, or the photo when there is one (initials again if it fails to load). */
export function paintAvatar(el, { url, initials }) {
  el.textContent = initials;
  el.classList.remove("has-photo");
  if (!url) return;
  const img = new Image();
  img.alt = "";
  img.decoding = "async";
  img.onload = () => {
    el.replaceChildren(img);
    el.classList.add("has-photo");
  };
  img.src = url;
}

/** A picked photo as a 256×256 WebP (JPEG where the browser can't make WebP). */
export async function squarePhoto(file, size = AVATAR_SIZE) {
  if (!file || !/^image\//.test(file.type)) throw new Error("not-image");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("unreadable");
  });
  const { sx, sy, size: side } = centreSquare(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();
  const blob = (await toBlob(canvas, "image/webp", 0.85));
  if (blob?.type === "image/webp") return blob;
  return toBlob(canvas, "image/jpeg", 0.85);
}
const toBlob = (canvas, type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

/** Upload to the user's own folder; resolves to the public URL. */
export async function uploadAvatar(userId, blob) {
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Remove an old photo of this user's (best effort: a stray file costs nothing). */
export async function removeAvatarFile(userId, url) {
  const m = new RegExp(`/storage/v1/object/public/${BUCKET}/(${userId}/[^?#]+)`).exec(String(url || ""));
  if (!m) return;
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(m[1])]).catch(() => {});
}
