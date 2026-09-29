import { GEMINI_POLICY_VERSION } from "@/lib/gemini/client";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const EVIDENCE_FACT_PROMPT_VERSION = "evidence-facts-v1";

export type EvidenceFact = {
  factType: string;
  label: string;
  value: string | null;
  numericValue: number | null;
  currency: string | null;
  dateValue: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  confidence: number;
};

export type EvidenceFactsExtraction = {
  facts: EvidenceFact[];
  model: string;
  policyVersion: string;
  promptVersion: string;
};

type EvidencePage = { pageNumber: number; text: string };

const responseSchema = {
  type: "OBJECT",
  properties: {
    facts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          factType: { type: "STRING" },
          label: { type: "STRING" },
          value: { type: "STRING", nullable: true },
          numericValue: { type: "NUMBER", nullable: true },
          currency: { type: "STRING", nullable: true },
          dateValue: { type: "STRING", nullable: true },
          sourcePage: { type: "INTEGER", nullable: true },
          sourceExcerpt: { type: "STRING", nullable: true },
          confidence: { type: "NUMBER" }
        },
        required: ["factType", "label", "value", "numericValue", "currency", "dateValue", "sourcePage", "sourceExcerpt", "confidence"]
      }
    }
  },
  required: ["facts"]
};

function buildPrompt(category: string, pages: EvidencePage[]) {
  const pageText = pages.map((page) => `--- PAGE ${page.pageNumber} ---\n${page.text}`).join("\n\n");
  return `Extract only explicit supplier evidence facts from the page-labelled document below.

Document category: ${category}

Category guidance:
- ACCREDITATIONS: accreditation name, standard, certificate number, issuer, scope, issue and expiry dates.
- INSURANCES: insurance type, covered entity, insurer, policy/certificate number, cover amount, currency, issue and expiry dates.
- FINANCIAL: reporting period, revenue, profit/loss, assets, liabilities, currency, auditor or filing date.
- POLICIES: policy name, version, owner/issuer, effective date, review date, scope.
- OTHER: extract only clearly labelled factual fields.

Rules:
- Do not decide whether the evidence satisfies a tender requirement.
- Do not infer or repair missing values. Use null for absent fields and citations.
- Extract a fact only when the source explicitly supports it.
- Every fact must include its exact source page and a short verbatim source excerpt, or use null and confidence 0 when citation is unavailable.
- Keep dateValue in ISO 8601 YYYY-MM-DD format only when unambiguous.
- Keep numericValue separate from value and include currency only when explicitly stated.
- Confidence is extraction confidence from 0 to 1, not compliance confidence.
- Return JSON matching the response schema and nothing else.

${pageText}`;
}

export async function extractEvidenceFactsWithGemini(category: string, pages: EvidencePage[]): Promise<EvidenceFactsExtraction> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini is not configured for this environment.");
  if (pages.length === 0) throw new Error("No processed evidence pages are available.");

  const response = await fetch(`${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "You are BidShield's evidence fact extraction engine. Follow policy version 1.1. Never invent facts or compliance decisions." }] },
      contents: [{ role: "user", parts: [{ text: buildPrompt(category, pages) }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema }
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Gemini evidence extraction failed with status ${response.status}.`);

  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned no evidence facts.");

  let parsed: { facts?: EvidenceFact[] };
  try {
    parsed = JSON.parse(text) as { facts?: EvidenceFact[] };
  } catch {
    throw new Error("Gemini returned invalid evidence fact JSON.");
  }

  return {
    facts: Array.isArray(parsed.facts) ? parsed.facts : [],
    model: GEMINI_MODEL,
    policyVersion: GEMINI_POLICY_VERSION,
    promptVersion: EVIDENCE_FACT_PROMPT_VERSION
  };
}
