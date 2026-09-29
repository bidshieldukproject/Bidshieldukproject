const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const GEMINI_POLICY_VERSION = "1.1";
export const GEMINI_PROMPT_VERSION = "requirements-v1";

export type GeminiPage = {
  pageNumber: number;
  text: string;
};

export type GeminiRequirementCandidate = {
  title: string;
  description: string;
  type:
    | "PARTICIPATION"
    | "EXCLUSION"
    | "MANDATORY_SUBMISSION"
    | "TECHNICAL"
    | "FINANCIAL"
    | "INSURANCE"
    | "QUALIFICATION"
    | "EXPERIENCE"
    | "AWARD_CRITERIA"
    | "POLICY"
    | "CONTRACT"
    | "DEADLINE"
    | "WORD_LIMIT"
    | "DOCUMENT"
    | "OTHER";
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

export type GeminiExtractionResult = {
  requirements: GeminiRequirementCandidate[];
  model: string;
  policyVersion: string;
  promptVersion: string;
};

const responseSchema = {
  type: "OBJECT",
  properties: {
    requirements: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          type: {
            type: "STRING",
            enum: [
              "PARTICIPATION",
              "EXCLUSION",
              "MANDATORY_SUBMISSION",
              "TECHNICAL",
              "FINANCIAL",
              "INSURANCE",
              "QUALIFICATION",
              "EXPERIENCE",
              "AWARD_CRITERIA",
              "POLICY",
              "CONTRACT",
              "DEADLINE",
              "WORD_LIMIT",
              "DOCUMENT",
              "OTHER"
            ]
          },
          mandatory: { type: "BOOLEAN" },
          sourcePage: { type: "INTEGER", nullable: true },
          sourceExcerpt: { type: "STRING", nullable: true },
          deadline: { type: "STRING", nullable: true },
          amount: { type: "NUMBER", nullable: true },
          currency: { type: "STRING", nullable: true },
          weight: { type: "NUMBER", nullable: true },
          wordLimit: { type: "INTEGER", nullable: true },
          requiredEvidence: { type: "ARRAY", items: { type: "STRING" } },
          confidence: { type: "NUMBER" }
        },
        required: [
          "title",
          "description",
          "type",
          "mandatory",
          "sourcePage",
          "sourceExcerpt",
          "deadline",
          "amount",
          "currency",
          "weight",
          "wordLimit",
          "requiredEvidence",
          "confidence"
        ]
      }
    }
  },
  required: ["requirements"]
};

function buildPrompt(pages: GeminiPage[]) {
  const pageText = pages
    .map((page) => `--- PAGE ${page.pageNumber} ---\n${page.text}`)
    .join("\n\n");

  return `Extract explicit procurement requirements from the page-labelled tender text below.

Rules:
- Extract only requirements stated or directly evidenced in the source text. Do not infer missing obligations.
- Preserve page numbers and copy a short exact source excerpt for every requirement.
- Use null for absent dates, amounts, currencies, weights, word limits, or page references.
- Classify each requirement using the supplied enum. Use OTHER only when no more specific class applies.
- A requirement is mandatory only when the source uses binding language or clearly makes it a condition of participation/submission.
- Keep dates in ISO 8601 format where unambiguous; otherwise use null.
- Confidence is an extraction confidence from 0 to 1, not a compliance decision.
- Do not state that a supplier meets a requirement. This is requirement extraction only.
- Return JSON matching the response schema and nothing else.

${pageText}`;
}

export async function extractRequirementsWithGemini(pages: GeminiPage[]): Promise<GeminiExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini is not configured for this environment.");
  }
  if (pages.length === 0) {
    throw new Error("No readable tender pages are available for requirement extraction.");
  }

  const response = await fetch(`${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: "You are BidShield's evidence-grounded procurement extraction engine. Follow policy version 1.1. Never invent facts." }]
      },
      contents: [{ role: "user", parts: [{ text: buildPrompt(pages) }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Gemini extraction failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    throw new Error("Gemini returned no structured extraction result.");
  }

  let parsed: { requirements?: GeminiRequirementCandidate[] };
  try {
    parsed = JSON.parse(text) as { requirements?: GeminiRequirementCandidate[] };
  } catch {
    throw new Error("Gemini returned invalid structured JSON.");
  }

  return {
    requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
    model: GEMINI_MODEL,
    policyVersion: GEMINI_POLICY_VERSION,
    promptVersion: GEMINI_PROMPT_VERSION
  };
}
