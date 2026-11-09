import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().min(1).optional(),
  LLM_API_KEY: z.string().min(1).optional(),
  IMAGE_API_KEY: z.string().min(1).optional(),
  BG_REMOVAL_API_KEY: z.string().min(1).optional(),
  RENDER_WORKER_URL: z.string().url().optional(),
  RENDER_WORKER_SECRET: z.string().min(1).optional(),
  OTP_PROVIDER_KEY: z.string().min(1).optional(),
  EMAIL_PROVIDER_KEY: z.string().min(1).optional(),
  ERROR_TRACKER_DSN: z.string().min(1).optional(),
  ANALYTICS_KEY: z.string().min(1).optional(),
});

function parseEnv<T extends z.ZodType>(schema: T, name: string): z.infer<T> {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`${name} is invalid. Set the required environment variables: ${details}`);
  }

  return result.data;
}

export type ClientEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readClientEnv(): ClientEnv {
  return parseEnv(publicEnvSchema, "Client environment");
}

export function readServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("Server environment cannot be read in client code.");
  }

  return parseEnv(serverEnvSchema, "Server environment");
}

export const clientEnv = {
  get appUrl() {
    return readClientEnv().NEXT_PUBLIC_APP_URL;
  },
  get supabaseUrl() {
    return readClientEnv().NEXT_PUBLIC_SUPABASE_URL;
  },
  get supabaseAnonKey() {
    return readClientEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY;
  },
};

export const serverEnv = {
  get values() {
    return readServerEnv();
  },
};
