import { GEMINI_POLICY_VERSION } from "@/lib/gemini/client";

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const EVIDENCE_FACT_PROMPT_VERSION = "evidence-facts-v1";

type EvidencePage = { pageNumber: number; text: string };
export type EvidenceFact = { factType: string; label: string; value: string | null; numericValue: number | null; currency: string | null; dateValue: string | null; sourcePage: number | null; sourceExcerpt: string | null; confidence: number };
export type EvidenceFactsExtraction = { facts: EvidenceFact[]; model: string; policyVersion: string; promptVersion: string };

const responseSchema = {
  type: "object",
  properties: { facts: { type: "array", items: { type: "object", properties: { factType: { type: "string" }, label: { type: "string" }, value: { type: ["string", "null"] }, numericValue: { type: ["number", "null"] }, currency: { type: ["string", "null"] }, dateValue: { type: ["string", "null"] }, sourcePage: { type: ["integer", "null"] }, sourceExcerpt: { type: ["string", "null"] }, confidence: { type: "number" } }, required: ["factType", "label", "value", "numericValue", "currency", "dateValue", "sourcePage", "sourceExcerpt", "confidence"], additionalProperties: false } } },
  required: ["facts"], additionalProperties: false
};

function buildPrompt(category: string, pages: EvidencePage[]) {
  return `Extract only explicit supplier evidence facts from the page-labelled document below.\n\nDocument category: ${category}\n\nCategory guidance:\n- ACCREDITATIONS: accreditation name, standard, certificate number, issuer, scope, issue and expiry dates.\n- INSURANCES: insurance type, covered entity, insurer, policy/certificate number, cover amount, currency, issue and expiry dates.\n- FINANCIAL: reporting period, revenue, profit/loss, assets, liabilities, currency, auditor or filing date.\n- POLICIES: policy name, version, owner/issuer, effective date, review date, scope.\n- OTHER: extract only clearly labelled factual fields.\n\nRules:\n- Do not decide whether the evidence satisfies a tender requirement.\n- Do not infer or repair missing values. Use null for absent fields and citations.\n- Extract a fact only when the source explicitly supports it.\n- Every fact must include its exact source page and a short verbatim source excerpt, or use null and confidence 0 when citation is unavailable.\n- Keep dateValue in ISO 8601 YYYY-MM-DD format only when unambiguous.\n- Keep numericValue separate from value and include currency only when explicitly stated.\n- Confidence is extraction confidence from 0 to 1, not compliance confidence.\n- Return JSON matching the response schema and nothing else.\n\n${pages.map((page) => `--- PAGE ${page.pageNumber} ---\n${page.text}`).join("\n\n")}`;
}

export async function extractEvidenceFactsWithGemini(category: string, pages: EvidencePage[]): Promise<EvidenceFactsExtraction> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter is not configured for this environment.");
  if (pages.length === 0) throw new Error("No processed evidence pages are available.");

  const response = await fetch(OPENROUTER_API_URL, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://bidshield.app", "X-Title": "BidShield" }, body: JSON.stringify({ model: OPENROUTER_MODEL, temperature: 0.1, messages: [{ role: "system", content: "You are BidShield's evidence fact extraction engine. Follow policy version 1.1. Never invent facts or compliance decisions." }, { role: "user", content: buildPrompt(category, pages) }], response_format: { type: "json_schema", json_schema: { name: "evidence_facts_extraction", strict: true, schema: responseSchema } } }), cache: "no-store" });
  if (!response.ok) throw new Error(`OpenRouter evidence extraction failed with status ${response.status}.`);

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned no evidence facts.");
  try {
    const parsed = JSON.parse(text) as { facts?: EvidenceFact[] };
    return { facts: Array.isArray(parsed.facts) ? parsed.facts : [], model: OPENROUTER_MODEL, policyVersion: GEMINI_POLICY_VERSION, promptVersion: EVIDENCE_FACT_PROMPT_VERSION };
  } catch {
    throw new Error("OpenRouter returned invalid evidence fact JSON.");
  }
}
