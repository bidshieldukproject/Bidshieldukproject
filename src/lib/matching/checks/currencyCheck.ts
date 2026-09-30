import { DeterministicCheck, EvidenceFactInput, RequirementInput } from "@/lib/matching/types";

export function currencyCheck(requirement: RequirementInput, facts: EvidenceFactInput[]): DeterministicCheck {
  const requiredCurrency = typeof requirement.provenanceMetadata.currency === "string" ? requirement.provenanceMetadata.currency.toUpperCase() : null;
  const monetaryFact = facts.find((fact) => fact.numericValue !== null && (/amount|cover|revenue|profit|asset|liabilit|value|turnover/i.test(`${fact.label} ${fact.factType}`)));
  if (!requiredCurrency && !monetaryFact) return { checkType: "CURRENCY", passed: null, reason: "No explicit currency-bearing values are available for comparison.", requirementValue: null, evidenceValue: null };
  if (!requiredCurrency || !monetaryFact?.currency) return { checkType: "CURRENCY", passed: null, reason: "Currency is missing from the requirement or cited evidence fact.", requirementValue: requiredCurrency, evidenceValue: monetaryFact?.currency ?? null };
  return { checkType: "CURRENCY", passed: requiredCurrency === monetaryFact.currency, reason: requiredCurrency === monetaryFact.currency ? "Requirement and evidence currencies match." : "Requirement and evidence currencies differ; automatic conversion is disabled.", requirementValue: requiredCurrency, evidenceValue: monetaryFact.currency };
}
