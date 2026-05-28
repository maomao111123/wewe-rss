import { z } from "zod";

const rawEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL 必填"),
  AUTH_CODE: z.string().optional().default(""),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  SERVER_ORIGIN_URL: z.string().optional().default(""),
  FEED_MODE: z.enum(["", "fulltext"]).optional().default(""),
  CRON_EXPRESSION: z.string().default("35 5,17 * * *"),
  MAX_REQUEST_PER_MINUTE: z.coerce.number().int().positive().default(60),
  UPDATE_DELAY_TIME: z.coerce.number().int().positive().default(60),
  ENABLE_CLEAN_HTML: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === "true")
    .default(false),
  PLATFORM_URL: z.string().default("https://weread.111965.xyz"),
});

export type AppEnv = z.infer<typeof rawEnvSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = rawEnvSchema.parse(process.env);
  return cachedEnv;
}

export function isAuthEnabled() {
  return Boolean(getEnv().AUTH_CODE);
}

export function resolveServerOriginUrl(input?: string | URL) {
  const envUrl = getEnv().SERVER_ORIGIN_URL.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (!input) {
    return `http://localhost:${getEnv().PORT}`;
  }

  const url = typeof input === "string" ? new URL(input) : input;
  return url.origin.replace(/\/$/, "");
}
