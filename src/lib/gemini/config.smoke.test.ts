import { describe, expect, it } from "vitest";

describe("OpenRouter configuration", () => {
  it("accepts the configured OpenRouter API key", async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey as string}`, Accept: "application/json" }
    });

    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { data?: unknown[] };
    expect(Array.isArray(payload.data)).toBe(true);
  }, 15_000);
});
