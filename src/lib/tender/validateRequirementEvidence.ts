import { GeminiRequirementCandidate } from "@/lib/gemini/client";

export type RequirementValidation = {
  accepted: boolean;
  status: "OPEN" | "NEEDS_REVIEW";
  issues: string[];
  normalized: GeminiRequirementCandidate;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/;
const SUPPORTED_CURRENCIES = new Set(["GBP", "EUR", "USD"]);

function normalizeExcerpt(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function excerptAppearsOnPage(excerpt: string, pageText: string) {
  const needle = normalizeExcerpt(excerpt);
  const haystack = normalizeExcerpt(pageText);
  return needle.length >= 12 && haystack.includes(needle);
}

export function validateRequirementEvidence(
  candidate: GeminiRequirementCandidate,
  pages: Array<{ page_number: number; text_content: string }>
): RequirementValidation {
  const issues: string[] = [];
  const pageNumbers = new Set(pages.map((page) => page.page_number));
  const normalized: GeminiRequirementCandidate = {
    ...candidate,
    title: candidate.title.trim(),
    description: candidate.description.trim(),
    sourceExcerpt: candidate.sourceExcerpt?.trim() || null,
    currency: candidate.currency?.trim().toUpperCase() || null,
    requiredEvidence: Array.from(new Set((candidate.requiredEvidence ?? []).map((item) => item.trim()).filter(Boolean))),
    confidence: Number.isFinite(candidate.confidence) ? Math.min(1, Math.max(0, candidate.confidence)) : 0
  };

  if (normalized.title.length < 3) issues.push("Requirement title is missing or too short.");
  if (!normalized.description) issues.push("Requirement description is missing.");
  if (normalized.sourcePage === null || !pageNumbers.has(normalized.sourcePage)) {
    issues.push("Source page is missing or outside the stored tender pages.");
  }

  if (normalized.sourcePage !== null && normalized.sourceExcerpt) {
    const page = pages.find((item) => item.page_number === normalized.sourcePage);
    if (!page || !excerptAppearsOnPage(normalized.sourceExcerpt, page.text_content)) {
      issues.push("Source excerpt does not match the stored text for the cited page.");
    }
  } else {
    issues.push("An exact source excerpt is required for auditability.");
  }

  if (normalized.deadline !== null && (!ISO_DATE.test(normalized.deadline) || Number.isNaN(Date.parse(normalized.deadline)))) {
    issues.push("Deadline is not a valid ISO date.");
  }
  if (normalized.amount !== null && (!Number.isFinite(normalized.amount) || normalized.amount < 0)) {
    issues.push("Amount must be a non-negative number.");
  }
  if (normalized.amount !== null && (!normalized.currency || !SUPPORTED_CURRENCIES.has(normalized.currency))) {
    issues.push("Amounts must include a supported currency code (GBP, EUR, or USD).");
  }
  if (normalized.weight !== null && (!Number.isFinite(normalized.weight) || normalized.weight < 0 || normalized.weight > 100)) {
    issues.push("Weight must be between 0 and 100.");
  }
  if (normalized.wordLimit !== null && (!Number.isInteger(normalized.wordLimit) || normalized.wordLimit <= 0)) {
    issues.push("Word limit must be a positive whole number.");
  }
  if (normalized.mandatory && normalized.requiredEvidence.length === 0 && ["DOCUMENT", "INSURANCE", "FINANCIAL", "QUALIFICATION", "EXPERIENCE"].includes(normalized.type)) {
    issues.push("Mandatory evidence-bearing requirements must identify the expected evidence type.");
  }

  return {
    accepted: issues.length === 0,
    status: issues.length === 0 ? "OPEN" : "NEEDS_REVIEW",
    issues,
    normalized
  };
}
