import { DeterministicCheck, EvidenceInput, RequirementInput } from "@/lib/matching/types";

function validDate(value: string | null) { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))); }

export function dateCheck(requirement: RequirementInput, evidence: EvidenceInput): DeterministicCheck {
  const relevant = requirement.type === "INSURANCE" || requirement.type === "QUALIFICATION" || requirement.type === "DOCUMENT" || requirement.type === "POLICY";
  if (!relevant) return { checkType: "DATE", passed: null, reason: "Expiry comparison is not applicable to this requirement type.", requirementValue: null, evidenceValue: evidence.expiryDate };
  const deadline = requirement.deadline?.slice(0, 10) ?? null;
  if (!evidence.expiryDate) return { checkType: "DATE", passed: null, reason: "Evidence expiry date is missing.", requirementValue: deadline, evidenceValue: null };
  if (!validDate(evidence.expiryDate)) return { checkType: "DATE", passed: null, reason: "Evidence expiry date is invalid or not normalized.", requirementValue: deadline, evidenceValue: evidence.expiryDate };
  if (!deadline) return { checkType: "DATE", passed: null, reason: "Tender deadline is unavailable, so validity through submission cannot be confirmed.", requirementValue: null, evidenceValue: evidence.expiryDate };
  if (!validDate(deadline)) return { checkType: "DATE", passed: null, reason: "Tender deadline is invalid or not normalized.", requirementValue: deadline, evidenceValue: evidence.expiryDate };
  const passed = Date.parse(`${evidence.expiryDate}T23:59:59Z`) >= Date.parse(`${deadline}T23:59:59Z`);
  return { checkType: "DATE", passed, reason: passed ? "Evidence remains valid through the tender deadline." : "Evidence expires before the tender deadline.", requirementValue: deadline, evidenceValue: evidence.expiryDate };
}
