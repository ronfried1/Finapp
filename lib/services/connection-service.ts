import { ConnectionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptJson, encryptJson } from "@/lib/crypto";

type RawCredentials = {
  username: string;
  password: string;
  institution: string;
};

export async function createConnectionWithCredentials(input: {
  userId: string;
  provider: string;
  displayName: string;
  credentials: RawCredentials;
}) {
  const encrypted = encryptJson(input.credentials);

  return prisma.financialConnection.create({
    data: {
      userId: input.userId,
      provider: input.provider,
      displayName: input.displayName,
      status: ConnectionStatus.ACTIVE,
      encryptedCredential: {
        create: {
          credentialsIv: encrypted.iv,
          credentialsTag: encrypted.tag,
          credentialsCiphertext: encrypted.ciphertext,
          algorithm: encrypted.algorithm,
          keyVersion: encrypted.keyVersion
        }
      }
    }
  });
}

export async function listConnections(userId: string) {
  return prisma.financialConnection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
}

export async function getDecryptedCredentials(connectionId: string): Promise<RawCredentials> {
  const record = await prisma.encryptedCredential.findUnique({ where: { connectionId } });
  if (!record) {
    throw new Error("Missing encrypted credentials");
  }

  return decryptJson<RawCredentials>({
    iv: record.credentialsIv,
    tag: record.credentialsTag,
    ciphertext: record.credentialsCiphertext,
    algorithm: "aes-256-gcm",
    keyVersion: record.keyVersion
  });
}

export async function getSessionBlob(connectionId: string): Promise<unknown | null> {
  const record = await prisma.encryptedCredential.findUnique({ where: { connectionId } });
  if (!record?.sessionCiphertext || !record.sessionIv || !record.sessionTag) {
    return null;
  }

  return decryptJson({
    iv: record.sessionIv,
    tag: record.sessionTag,
    ciphertext: record.sessionCiphertext,
    algorithm: "aes-256-gcm",
    keyVersion: record.keyVersion
  });
}

export async function updateEncryptedSession(connectionId: string, sessionBlob: unknown) {
  const encrypted = encryptJson(sessionBlob);

  await prisma.encryptedCredential.update({
    where: { connectionId },
    data: {
      sessionIv: encrypted.iv,
      sessionTag: encrypted.tag,
      sessionCiphertext: encrypted.ciphertext
    }
  });
}
