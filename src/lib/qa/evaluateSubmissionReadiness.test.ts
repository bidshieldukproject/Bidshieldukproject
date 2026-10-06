import assert from "node:assert/strict";
import { evaluateSubmissionReadiness } from "@/lib/qa/evaluateSubmissionReadiness";

const base = {
  requirements: [{ id: "r1", title: "Insurance certificate", mandatory: true, status: "OPEN", source_page: 2, source_excerpt: "Provide insurance." }],
  evidence: [{ id: "e1", document_name: "Insurance.pdf", status: "VERIFIED", expiry_date: "2027-01-01" }],
  claims: [{ id: "c1", response_text: "We provide 24/7 cover.", status: "SUPPORTED", source_page: 5 }],
  verificationResults: [{ id: "v1", requirement_id: "r1", system_status: "VERIFIED", reviewer_decision: "VERIFIED", reviewer_reason: "Cited and current.", source_page: 2, source_excerpt: "Insurance certificate." }],
  reviewerDecisions: [{ id: "d1", requirement_id: "r1", decision: "VERIFIED", rationale: "Cited and current.", created_at: "2026-10-06T00:00:00Z" }]
};

assert.equal(evaluateSubmissionReadiness(base).status, "READY");
assert.equal(evaluateSubmissionReadiness({ ...base, verificationResults: [{ ...base.verificationResults[0], system_status: "CONTRADICTED", reviewer_decision: "CONTRADICTED" }], reviewerDecisions: [{ ...base.reviewerDecisions[0], decision: "CONTRADICTED" }] }).status, "NOT_READY");
assert.equal(evaluateSubmissionReadiness({ ...base, reviewerDecisions: [{ ...base.reviewerDecisions[0], decision: "NEEDS_REVIEW" }], verificationResults: [{ ...base.verificationResults[0], system_status: "NEEDS_REVIEW", reviewer_decision: "NEEDS_REVIEW" }] }).status, "NEEDS_REVIEW");
assert.equal(evaluateSubmissionReadiness({ ...base, requirements: [] }).status, "UNKNOWN");
console.log("submission readiness fixtures passed: READY, NOT_READY, NEEDS_REVIEW, UNKNOWN");
