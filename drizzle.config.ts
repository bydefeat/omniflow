import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/**/*.schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL!,
  },
  strict: true,
});
