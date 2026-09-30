import { DeterministicCheck, EvidenceFactInput, RequirementInput } from "@/lib/matching/types";

export function amountCheck(requirement: RequirementInput, facts: EvidenceFactInput[]): DeterministicCheck {
  if (requirement.type !== "INSURANCE" && requirement.type !== "FINANCIAL" && requirement.type !== "CONTRACT") {
    return { checkType: "AMOUNT", passed: null, reason: "Amount comparison is not applicable to this requirement type.", requirementValue: requirement.type, evidenceValue: null };
  }
  const amountFact = facts.find((fact) => fact.numericValue !== null && /amount|cover|revenue|profit|asset|liabilit|value|turnover/i.test(`${fact.label} ${fact.factType}`));
  if (requirement.provenanceMetadata.amount === undefined && !/£|€|\$|amount|million|revenue|cover|turnover/i.test(`${requirement.title} ${requirement.description ?? ""}`)) {
    return { checkType: "AMOUNT", passed: null, reason: "No explicit monetary threshold was identified in the requirement.", requirementValue: null, evidenceValue: amountFact?.numericValue ?? null };
  }
  const requiredAmount = typeof requirement.provenanceMetadata.amount === "number" ? requirement.provenanceMetadata.amount : null;
  const requiredCurrency = typeof requirement.provenanceMetadata.currency === "string" ? requirement.provenanceMetadata.currency.toUpperCase() : null;
  if (requiredAmount === null) return { checkType: "AMOUNT", passed: null, reason: "A monetary requirement was detected, but its normalized threshold is unavailable.", requirementValue: null, evidenceValue: amountFact?.numericValue ?? null };
  if (!amountFact) return { checkType: "AMOUNT", passed: null, reason: "Evidence does not contain a cited numeric amount.", requirementValue: requiredAmount, evidenceValue: null };
  if (!requiredCurrency || !amountFact.currency) return { checkType: "AMOUNT", passed: null, reason: "Both requirement and evidence currencies must be explicit before comparing amounts.", requirementValue: { amount: requiredAmount, currency: requiredCurrency }, evidenceValue: { amount: amountFact.numericValue, currency: amountFact.currency } };
  if (requiredCurrency !== amountFact.currency) return { checkType: "AMOUNT", passed: null, reason: "Currencies differ; no automatic conversion is permitted.", requirementValue: { amount: requiredAmount, currency: requiredCurrency }, evidenceValue: { amount: amountFact.numericValue, currency: amountFact.currency } };
  return { checkType: "AMOUNT", passed: (amountFact.numericValue as number) >= requiredAmount, reason: (amountFact.numericValue as number) >= requiredAmount ? "Evidence amount meets or exceeds the requirement." : "Evidence amount is below the required threshold.", requirementValue: { amount: requiredAmount, currency: requiredCurrency }, evidenceValue: { amount: amountFact.numericValue, currency: amountFact.currency } };
}
