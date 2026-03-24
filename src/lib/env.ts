import { z } from "zod";

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters"),

  // Optional with defaults
  GEMINI_API_KEY: z.string().optional().default(""),
  WS_SERVER_PORT: z.coerce.number().optional().default(3001),
  S3_ENDPOINT: z.string().optional().default("http://localhost:9000"),
  S3_ACCESS_KEY: z.string().optional().default("minioadmin"),
  S3_SECRET_KEY: z.string().optional().default("minioadmin"),
  S3_BUCKET: z.string().optional().default("interview-support"),
  S3_REGION: z.string().optional().default("ap-northeast-1"),
  RECALL_API_KEY: z.string().optional().default(""),
  RECALL_API_URL: z.string().optional().default("https://api.recall.ai/api/v1"),
  REDIS_URL: z.string().optional().default("redis://localhost:6379"),

  // SSO (optional)
  SSO_OIDC_CLIENT_ID: z.string().optional(),
  SSO_OIDC_CLIENT_SECRET: z.string().optional(),
  SSO_OIDC_ISSUER: z.string().optional(),
  SSO_SAML_CLIENT_ID: z.string().optional(),
  SSO_SAML_CLIENT_SECRET: z.string().optional(),
  SSO_SAML_ISSUER: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error(`[ENV] Validation failed:\n${errors}`);

    // In development, warn but don't crash
    if (process.env.NODE_ENV === "development") {
      console.warn("[ENV] Running with incomplete environment variables");
      _env = envSchema.parse({
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || "postgresql://localhost:5432/dev",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "dev-secret-minimum-16-chars",
      });
      return _env;
    }

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  _env = result.data;
  return _env;
}
