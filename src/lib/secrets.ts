import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1";

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if ((!raw || raw.length < 32) && process.env.NODE_ENV === "production") {
    throw new Error("TOKEN_ENCRYPTION_KEY must be set in production (>=32 chars)");
  }
  return createHash("sha256").update(raw || "dev-only-socialflow-token-encryption-key").digest();
}

export function encryptSecret(value: string): string {
  if (!value || value === "demo-token" || value.startsWith(`${PREFIX}:`)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptSecret(value: string): string {
  if (!value || value === "demo-token" || !value.startsWith(`${PREFIX}:`)) return value;
  const parts = value.split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Encrypted secret format is invalid");
  }
  const iv = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const ciphertext = Buffer.from(parts[4], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
