import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Field encryption for Aadhaar numbers (AES-256-GCM).
 * The key comes from DATA_KEY. Without it, a key is derived from SETUP_KEY so the demo still works,
 * but every customer copy should set its own DATA_KEY and keep it unchanged.
 */
function key() {
  const k = process.env.DATA_KEY || `setup:${process.env.SETUP_KEY || "hrms-default"}`;
  return createHash("sha256").update(k).digest();
}
export function encrypt(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return "v1." + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}
export function decrypt(blob?: string | null) {
  if (!blob?.startsWith("v1.")) return null;
  try {
    const b = Buffer.from(blob.slice(3), "base64url");
    const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  } catch { return null; }
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const masked = (last4?: string | null) => (last4 ? `•••• •••• ${last4}` : "");
