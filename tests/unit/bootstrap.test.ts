import { afterEach, describe, expect, it } from "vitest";

import { clientEnv, readClientEnv, readServerEnv } from "@/lib/env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  delete (globalThis as { window?: unknown }).window;
});

describe("Phase 0 bootstrap and environment validation", () => {
  it("parses valid client and server environment variables", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";

    expect(readClientEnv()).toEqual({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test-key",
    });
    expect(clientEnv.appUrl).toBe("http://localhost:3000");
    expect("SUPABASE_SERVICE_ROLE_KEY" in clientEnv).toBe(false);
    expect(readServerEnv().SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-test-key");
  });

  it("fails fast with a readable error when required environment variables are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => readClientEnv()).toThrow(/Client environment is invalid/);

    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => readServerEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("blocks reading server environment variables when window is defined", () => {
    (globalThis as { window?: unknown }).window = {};
    expect(() => readServerEnv()).toThrow("Server environment cannot be read in client code.");
  });
});
