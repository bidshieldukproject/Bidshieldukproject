import { DeterministicCheck, EvidenceFactInput, RequirementInput } from "@/lib/matching/types";

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export function certificateCheck(requirement: RequirementInput, facts: EvidenceFactInput[]): DeterministicCheck {
  if (requirement.type !== "QUALIFICATION" && requirement.type !== "ACCREDITATION") return { checkType: "CERTIFICATE", passed: null, reason: "Certificate comparison is not applicable to this requirement type.", requirementValue: null, evidenceValue: null };
  const requirementText = normalize(`${requirement.title} ${requirement.description ?? ""} ${requirement.requiredEvidence.join(" ")}`);
  const nameFacts = facts.filter((fact) => /accredit|certificate|standard|qualification|certification/i.test(`${fact.label} ${fact.factType}`) && fact.value);
  if (nameFacts.length === 0) return { checkType: "CERTIFICATE", passed: null, reason: "No cited accreditation or certificate fact was extracted.", requirementValue: requirementText, evidenceValue: null };
  const match = nameFacts.find((fact) => requirementText.includes(normalize(fact.value as string)) || normalize(fact.value as string).includes(requirementText));
  return { checkType: "CERTIFICATE", passed: Boolean(match), reason: match ? "Evidence contains a cited accreditation or certificate value aligned with the requirement." : "Evidence contains a certificate fact, but its name or standard does not exactly align with the requirement.", requirementValue: requirementText, evidenceValue: nameFacts.map((fact) => fact.value) };
}
