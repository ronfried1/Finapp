import crypto from "crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function keyFromEnv(): Buffer {
  const key = Buffer.from(env.APP_ENCRYPTION_KEY_BASE64, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes");
  }
  return key;
}

export type EncryptedPayload = {
  iv: string;
  tag: string;
  ciphertext: string;
  algorithm: "aes-256-gcm";
  keyVersion: number;
};

export function encryptJson(value: unknown): EncryptedPayload {
  const key = keyFromEnv();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    algorithm: "aes-256-gcm",
    keyVersion: 1
  };
}

export function decryptJson<T>(payload: EncryptedPayload): T {
  const key = keyFromEnv();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
