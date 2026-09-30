import { DeterministicCheck, EvidenceInput, RequirementInput } from "@/lib/matching/types";

export function evidenceCompletenessCheck(requirement: RequirementInput, evidence: EvidenceInput): DeterministicCheck {
  if (evidence.facts.length === 0) return { checkType: "EVIDENCE_COMPLETENESS", passed: null, reason: "Evidence has no extracted facts available for verification.", requirementValue: requirement.requiredEvidence, evidenceValue: evidence.documentName };
  const citedFacts = evidence.facts.filter((fact) => fact.sourcePage !== null && Boolean(fact.sourceExcerpt));
  if (citedFacts.length === 0) return { checkType: "EVIDENCE_COMPLETENESS", passed: null, reason: "Evidence facts do not contain page citations and exact excerpts.", requirementValue: requirement.requiredEvidence, evidenceValue: evidence.documentName };
  const issueCount = evidence.facts.reduce((count, fact) => count + fact.validationIssues.length, 0);
  if (issueCount > 0) return { checkType: "EVIDENCE_COMPLETENESS", passed: null, reason: `${issueCount} evidence fact validation issue(s) remain unresolved.`, requirementValue: requirement.requiredEvidence, evidenceValue: { document: evidence.documentName, issueCount } };
  return { checkType: "EVIDENCE_COMPLETENESS", passed: true, reason: "Evidence contains cited facts without unresolved extraction issues.", requirementValue: requirement.requiredEvidence, evidenceValue: citedFacts.length };
}
