import { DeterministicCheck, EvidenceInput, RequirementInput } from "@/lib/matching/types";

const allowed: Record<string, string[]> = { INSURANCE: ["INSURANCES"], FINANCIAL: ["FINANCIAL"], QUALIFICATION: ["ACCREDITATIONS"], POLICY: ["POLICIES"], DOCUMENT: ["ACCREDITATIONS", "INSURANCES", "FINANCIAL", "POLICIES", "OTHER"], EXPERIENCE: ["OTHER", "FINANCIAL"] };

export function documentTypeCheck(requirement: RequirementInput, evidence: EvidenceInput): DeterministicCheck {
  const categories = allowed[requirement.type] ?? ["OTHER"];
  const passed = categories.includes(evidence.category);
  return { checkType: "DOCUMENT_TYPE", passed, reason: passed ? `Evidence category ${evidence.category} aligns with requirement type ${requirement.type}.` : `Evidence category ${evidence.category} does not align with requirement type ${requirement.type}.`, requirementValue: { type: requirement.type, allowedCategories: categories }, evidenceValue: evidence.category };
}
