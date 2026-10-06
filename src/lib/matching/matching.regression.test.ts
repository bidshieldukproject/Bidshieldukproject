import assert from "node:assert/strict";
import { matchRequirementToEvidence } from "@/lib/matching/matchRequirementToEvidence";
import { EvidenceInput, RequirementInput } from "@/lib/matching/types";

const baseRequirement: RequirementInput = {
  id: "requirement-1",
  tenderId: "tender-1",
  title: "Current modern slavery policy",
  description: "Provide the organisation's current modern slavery policy.",
  type: "POLICY",
  mandatory: true,
  sourcePage: 4,
  sourceExcerpt: "A current modern slavery policy must be provided.",
  requiredEvidence: ["modern slavery policy"],
  deadline: "2026-12-31T23:59:59Z",
  weight: null,
  wordLimit: null,
  confidence: 0.98,
  provenanceMetadata: {}
};

const citedFact = {
  factType: "POLICY_NAME",
  label: "Policy name",
  value: "Modern Slavery Policy",
  numericValue: null,
  currency: null,
  dateValue: null,
  sourcePage: 2,
  sourceExcerpt: "Modern Slavery Policy — approved 2026.",
  confidence: 0.99,
  validationIssues: []
};

function evidence(overrides: Partial<EvidenceInput> = {}): EvidenceInput {
  return {
    id: "evidence-1",
    documentName: "Modern Slavery Policy.pdf",
    category: "POLICIES",
    issueDate: "2026-01-01",
    expiryDate: "2027-01-31",
    status: "VERIFIED",
    provenanceMetadata: {},
    facts: [citedFact],
    ...overrides
  };
}

function requirement(overrides: Partial<RequirementInput> = {}): RequirementInput {
  return { ...baseRequirement, ...overrides };
}

const verified = matchRequirementToEvidence(requirement(), [evidence()]);
assert.equal(verified.status, "VERIFIED");
assert.equal(verified.evidenceId, "evidence-1");
assert.equal(verified.evidencePage, 2);
assert.ok(verified.deterministicChecks.some((check) => check.checkType === "EVIDENCE_COMPLETENESS" && check.passed === true));

const noCandidate = matchRequirementToEvidence(requirement({ type: "FINANCIAL", title: "Audited annual accounts", requiredEvidence: [] }), [evidence({ category: "OTHER", documentName: "Unrelated document.pdf", facts: [] })]);
assert.equal(noCandidate.status, "UNVERIFIED");
assert.equal(noCandidate.evidenceId, null);

const contradictory = matchRequirementToEvidence(
  requirement({ type: "INSURANCE", title: "Employers liability insurance" }),
  [evidence({ category: "FINANCIAL", documentName: "Annual accounts.pdf" })]
);
assert.equal(contradictory.status, "CONTRADICTED");
assert.ok(contradictory.deterministicChecks.some((check) => check.checkType === "DOCUMENT_TYPE" && check.passed === false));

const needsReview = matchRequirementToEvidence(
  requirement({ type: "POLICY", title: "Current safeguarding policy" }),
  [evidence({ facts: [{ ...citedFact, sourcePage: null, sourceExcerpt: null }] })]
);
assert.equal(needsReview.status, "NEEDS_REVIEW");
assert.ok(needsReview.deterministicChecks.some((check) => check.checkType === "EVIDENCE_COMPLETENESS" && check.passed === null));

console.log("matching regression fixtures passed: VERIFIED, UNVERIFIED, CONTRADICTED, NEEDS_REVIEW");
