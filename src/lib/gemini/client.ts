const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [2000, 5000, 15000];

export const GEMINI_POLICY_VERSION = "1.1";
export const GEMINI_PROMPT_VERSION = "requirements-v1";

export type GeminiPage = { pageNumber: number; text: string };
export type GeminiRequirementCandidate = {
  title: string;
  description: string;
  type: "PARTICIPATION" | "EXCLUSION" | "MANDATORY_SUBMISSION" | "TECHNICAL" | "FINANCIAL" | "INSURANCE" | "QUALIFICATION" | "EXPERIENCE" | "AWARD_CRITERIA" | "POLICY" | "CONTRACT" | "DEADLINE" | "WORD_LIMIT" | "DOCUMENT" | "OTHER";
  mandatory: boolean;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  deadline: string | null;
  amount: number | null;
  currency: string | null;
  weight: number | null;
  wordLimit: number | null;
  requiredEvidence: string[];
  confidence: number;
};
export type GeminiExtractionResult = { requirements: GeminiRequirementCandidate[]; model: string; policyVersion: string; promptVersion: string };

const responseSchema = {
  type: "object",
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" }, description: { type: "string" },
          type: { type: "string", enum: ["PARTICIPATION", "EXCLUSION", "MANDATORY_SUBMISSION", "TECHNICAL", "FINANCIAL", "INSURANCE", "QUALIFICATION", "EXPERIENCE", "AWARD_CRITERIA", "POLICY", "CONTRACT", "DEADLINE", "WORD_LIMIT", "DOCUMENT", "OTHER"] },
          mandatory: { type: "boolean" }, sourcePage: { type: ["integer", "null"] }, sourceExcerpt: { type: ["string", "null"] }, deadline: { type: ["string", "null"] }, amount: { type: ["number", "null"] }, currency: { type: ["string", "null"] }, weight: { type: ["number", "null"] }, wordLimit: { type: ["integer", "null"] }, requiredEvidence: { type: "array", items: { type: "string" } }, confidence: { type: "number" }
        },
        required: ["title", "description", "type", "mandatory", "sourcePage", "sourceExcerpt", "deadline", "amount", "currency", "weight", "wordLimit", "requiredEvidence", "confidence"],
        additionalProperties: false
      }
    }
  },
  required: ["requirements"],
  additionalProperties: false
};

function buildPrompt(pages: GeminiPage[]) {
  return `Extract explicit procurement requirements from the page-labelled tender text below.\n\nRules:\n- Extract only requirements stated or directly evidenced in the source text. Do not infer missing obligations.\n- Preserve page numbers and copy a short exact source excerpt for every requirement.\n- Use null for absent dates, amounts, currencies, weights, word limits, or page references.\n- Classify each requirement using the supplied enum.\n- A requirement is mandatory only when the source uses binding language or clearly makes it a condition of participation/submission.\n- Keep dates in ISO 8601 format where unambiguous; otherwise use null.\n- Confidence is extraction confidence from 0 to 1, not a compliance decision.\n- Do not state that a supplier meets a requirement. This is requirement extraction only.\n- Return JSON matching the response schema and nothing else.\n\n${pages.map((page) => `--- PAGE ${page.pageNumber} ---\n${page.text}`).join("\n\n")}`;
}

export async function extractRequirementsWithGemini(pages: GeminiPage[]): Promise<GeminiExtractionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter is not configured for this environment.");
  if (pages.length === 0) throw new Error("No readable tender pages are available for requirement extraction.");

  const body = JSON.stringify({
    model: OPENROUTER_MODEL,
    temperature: 0.1,
    messages: [
      { role: "system", content: "You are BidShield's evidence-grounded procurement extraction engine. Follow policy version 1.1. Never invent facts." },
      { role: "user", content: buildPrompt(pages) }
    ],
    response_format: { type: "json_schema", json_schema: { name: "requirements_extraction", strict: true, schema: responseSchema } }
  });

  let response: Response | null = null;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    response = await fetch(OPENROUTER_API_URL, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://bidshield.app", "X-Title": "BidShield" }, body, cache: "no-store" });
    if (response.ok) break;
    if (!RETRYABLE_STATUS_CODES.has(response.status)) throw new Error(`OpenRouter extraction failed with status ${response.status}. Provider or model configuration requires attention.`);
    if (attempt < RETRY_DELAYS_MS.length - 1) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
  if (!response?.ok) throw new Error(`[RETRYABLE_PROVIDER_ERROR] OpenRouter extraction failed with status ${response?.status ?? 503} after ${RETRY_DELAYS_MS.length} attempts. Please retry later.`);

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned no structured extraction result.");
  try {
    const parsed = JSON.parse(text) as { requirements?: GeminiRequirementCandidate[] };
    return { requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [], model: OPENROUTER_MODEL, policyVersion: GEMINI_POLICY_VERSION, promptVersion: GEMINI_PROMPT_VERSION };
  } catch {
    throw new Error("OpenRouter returned invalid structured JSON.");
  }
}
