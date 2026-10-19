export const PG_ERRORS = {
  UNIQUE: "23505",
  FOREIGN_KEY: "23503",
  CHECK: "23514",
  EXCLUSION: "23P01",
} as const;

export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}
