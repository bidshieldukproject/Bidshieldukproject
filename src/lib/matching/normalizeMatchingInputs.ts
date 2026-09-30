import { EvidenceFactInput, EvidenceInput, RequirementInput } from "@/lib/matching/types";

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function confidence(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value as number)) : 0;
}

function normalizeFact(fact: EvidenceFactInput): EvidenceFactInput {
  return {
    factType: fact.factType.trim().toUpperCase(),
    label: fact.label.trim(),
    value: clean(fact.value),
    numericValue: Number.isFinite(fact.numericValue) ? fact.numericValue : null,
    currency: clean(fact.currency)?.toUpperCase() ?? null,
    dateValue: clean(fact.dateValue),
    sourcePage: Number.isInteger(fact.sourcePage) && (fact.sourcePage as number) > 0 ? fact.sourcePage : null,
    sourceExcerpt: clean(fact.sourceExcerpt),
    confidence: confidence(fact.confidence),
    validationIssues: Array.from(new Set((fact.validationIssues ?? []).map((issue) => issue.trim()).filter(Boolean)))
  };
}

export function normalizeRequirement(input: RequirementInput): RequirementInput {
  return {
    ...input,
    title: input.title.trim(),
    description: clean(input.description),
    type: input.type.trim().toUpperCase(),
    sourceExcerpt: clean(input.sourceExcerpt),
    requiredEvidence: Array.from(new Set((input.requiredEvidence ?? []).map((item) => item.trim().toUpperCase()).filter(Boolean))),
    confidence: confidence(input.confidence)
  };
}

export function normalizeEvidence(input: EvidenceInput): EvidenceInput {
  const facts = (input.facts ?? []).map(normalizeFact).filter((fact) => fact.label.length > 0);
  return {
    ...input,
    documentName: input.documentName.trim(),
    category: input.category.trim().toUpperCase(),
    issueDate: clean(input.issueDate),
    expiryDate: clean(input.expiryDate),
    status: input.status.trim().toUpperCase(),
    facts
  };
}
