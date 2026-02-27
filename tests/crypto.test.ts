import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "@/lib/crypto";

describe("crypto", () => {
  it("encrypts and decrypts JSON payload", () => {
    const payload = { institution: "Leumi", password: "sensitive", nested: { amount: 123 } };
    const encrypted = encryptJson(payload);

    expect(encrypted.ciphertext).not.toContain("Leumi");

    const decrypted = decryptJson<typeof payload>(encrypted);
    expect(decrypted).toEqual(payload);
  });
});
