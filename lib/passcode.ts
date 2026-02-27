import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE_NAME = "app_passcode_verified";

function signer(): string {
  return `${env.NEXTAUTH_SECRET}:${env.APP_PASSCODE_PEPPER}`;
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", signer()).update(payload).digest("base64url");
}

function makeCookieValue(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function verifyCookieValue(value: string, userId: string): boolean {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = signPayload(payload);
  const [cookieUserId] = payload.split(":");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) && cookieUserId === userId;
}

export async function hashPasscode(passcode: string): Promise<string> {
  return bcrypt.hash(`${passcode}:${env.APP_PASSCODE_PEPPER}`, 12);
}

export async function verifyPasscode(passcode: string, hash: string): Promise<boolean> {
  return bcrypt.compare(`${passcode}:${env.APP_PASSCODE_PEPPER}`, hash);
}

export async function setPasscodeVerifiedCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, makeCookieValue(userId), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/"
  });
}

export async function clearPasscodeVerifiedCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isPasscodeVerified(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return false;
  return verifyCookieValue(value, userId);
}
