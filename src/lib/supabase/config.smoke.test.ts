import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe("BidShield Supabase configuration", () => {
  it("uses the BidShield production project and accepts the anon key", async () => {
    expect(supabaseUrl).toBe("https://epppjewethjvgidpoiek.supabase.co");
    expect(supabaseAnonKey).toBeTruthy();

    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey as string },
    });

    expect(response.ok).toBe(true);
    const settings = (await response.json()) as { external?: Record<string, unknown> };
    expect(settings).toHaveProperty("external");
  }, 15_000);
});
