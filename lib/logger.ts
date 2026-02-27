const redactionPatterns: RegExp[] = [
  /(password|passcode|otp|token|secret)\s*[:=]\s*[^,\s]+/gi,
  /("password"|"passcode"|"otp"|"token"|"secret")\s*:\s*"[^"]+"/gi
];

export function redact(value: string): string {
  let redacted = value;
  for (const pattern of redactionPatterns) {
    redacted = redacted.replace(pattern, (match) => {
      const parts = match.split(/[:=]/);
      return `${parts[0]}=[REDACTED]`;
    });
  }
  return redacted;
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  const payload = context ? ` ${redact(JSON.stringify(context))}` : "";
  console.info(`[INFO] ${message}${payload}`);
}

export function logError(message: string, error?: unknown, context?: Record<string, unknown>) {
  const safeError = error instanceof Error ? redact(error.message) : "unknown_error";
  const payload = context ? ` ${redact(JSON.stringify(context))}` : "";
  console.error(`[ERROR] ${message} error=${safeError}${payload}`);
}
