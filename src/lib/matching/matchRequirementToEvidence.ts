import { amountCheck } from "@/lib/matching/checks/amountCheck";
import { certificateCheck } from "@/lib/matching/checks/certificateCheck";
import { currencyCheck } from "@/lib/matching/checks/currencyCheck";
import { dateCheck } from "@/lib/matching/checks/dateCheck";
import { documentTypeCheck } from "@/lib/matching/checks/documentTypeCheck";
import { evidenceCompletenessCheck } from "@/lib/matching/checks/evidenceCompletenessCheck";
import { findEvidenceCandidates } from "@/lib/matching/findEvidenceCandidates";
import { normalizeEvidence, normalizeRequirement } from "@/lib/matching/normalizeMatchingInputs";
import { EvidenceCandidate, EvidenceInput, MatchResult, MatchingStatus, RequirementInput } from "@/lib/matching/types";

function statusForChecks(checks: MatchResult["deterministicChecks"], candidate: EvidenceCandidate): MatchingStatus {
  if (checks.some((check) => check.passed === false && ["AMOUNT", "DATE", "CURRENCY", "DOCUMENT_TYPE", "CERTIFICATE"].includes(check.checkType))) return "CONTRADICTED";
  if (checks.some((check) => check.passed === null)) return "NEEDS_REVIEW";
  const passed = checks.filter((check) => check.passed === true).length;
  if (passed === 0) return "UNVERIFIED";
  if (passed === checks.length && candidate.score >= 0.65) return "VERIFIED";
  return "SUPPORTED";
}

function matchedFacts(evidence: EvidenceInput) {
  return evidence.facts.filter((fact) => fact.sourcePage !== null && Boolean(fact.sourceExcerpt));
}

export function matchRequirementToEvidence(requirementInput: RequirementInput, evidenceInputs: EvidenceInput[]): MatchResult {
  const requirement = normalizeRequirement(requirementInput);
  const evidence = evidenceInputs.map(normalizeEvidence);
  const candidates = findEvidenceCandidates(requirement, evidence);
  const candidate = candidates[0];

  if (!candidate) {
    return { requirementId: requirement.id, evidenceId: null, status: "UNVERIFIED", matchType: "NO_CANDIDATE", reasoning: "No organisation-scoped evidence document matched the requirement type or explicit evidence terms.", matchedFacts: [], evidencePage: null, evidenceExcerpt: null, deterministicChecks: [], candidateScore: 0 };
  }

  const selected = candidate.evidence;
  const facts = matchedFacts(selected);
  const checks = [
    documentTypeCheck(requirement, selected),
    evidenceCompletenessCheck(requirement, selected),
    amountCheck(requirement, facts),
    currencyCheck(requirement, facts),
    dateCheck(requirement, selected),
    certificateCheck(requirement, facts)
  ].filter((check) => check.passed !== null || ["AMOUNT", "CURRENCY", "DATE", "CERTIFICATE"].includes(check.checkType));
  const status = statusForChecks(checks, candidate);
  const citation = facts[0] ?? null;
  const checkSummary = checks.map((check) => `${check.checkType}: ${check.reason}`).join(" ");
  const reasoning = `${candidate.reasons.join(" ")} ${checkSummary}`.trim();

  return {
    requirementId: requirement.id,
    evidenceId: selected.id,
    status,
    matchType: candidate.reasons[0] ?? "CANDIDATE_MATCH",
    reasoning,
    matchedFacts: facts,
    evidencePage: citation?.sourcePage ?? null,
    evidenceExcerpt: citation?.sourceExcerpt ?? null,
    deterministicChecks: checks,
    candidateScore: candidate.score
  };
}
