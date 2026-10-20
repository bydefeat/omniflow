type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack, cause: serialize(value.cause) };
  }
  return value;
}

function write(level: Level, message: string, fields: Fields = {}) {
  const entries = Object.entries(fields).map(([key, value]) => [key, serialize(value)] as const);
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  if (process.env.NODE_ENV === "production") {
    sink(JSON.stringify({ time: new Date().toISOString(), level, message, ...Object.fromEntries(entries) }));
  } else {
    sink(`[${level}] ${message}`, ...(entries.length ? [Object.fromEntries(entries)] : []));
  }
}

export const logger = {
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
