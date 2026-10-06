export type QaStatus = "PASS" | "BLOCKED" | "NEEDS_REVIEW" | "UNKNOWN";
export type ReadinessStatus = "READY" | "NOT_READY" | "NEEDS_REVIEW" | "UNKNOWN";

export type QaCheck = {
  checkType: string;
  status: QaStatus;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  detail: string;
  entityType: string | null;
  entityId: string | null;
  sourcePage?: number | null;
  sourceExcerpt?: string | null;
  provenanceMetadata?: Record<string, unknown>;
};

export type QaInput = {
  requirements: Array<{ id: string; title: string; mandatory: boolean; status: string; source_page: number | null; source_excerpt: string | null }>;
  evidence: Array<{ id: string; document_name: string; status: string; expiry_date: string | null }>;
  claims: Array<{ id: string; response_text: string; status: string; source_page: number | null }>;
  verificationResults: Array<{ id: string; requirement_id: string | null; system_status: string; reviewer_decision: string | null; reviewer_reason: string | null; source_page?: number | null; source_excerpt?: string | null }>;
  reviewerDecisions: Array<{ id: string; requirement_id: string | null; decision: string; rationale: string; created_at: string }>;
};

function latestBy<T extends { requirement_id: string | null }>(rows: T[]) {
  const result = new Map<string, T>();
  for (const row of rows) if (row.requirement_id && !result.has(row.requirement_id)) result.set(row.requirement_id, row);
  return result;
}

function requirementChecks(input: QaInput): QaCheck[] {
  if (input.requirements.length === 0) return [{ checkType: "REQUIREMENTS_IDENTIFIED", status: "UNKNOWN", severity: "CRITICAL", title: "Requirements identified", detail: "No tender requirements are available for final QA.", entityType: "tender", entityId: null }];
  const results = latestBy(input.verificationResults);
  const decisions = latestBy(input.reviewerDecisions);
  const checks: QaCheck[] = [{ checkType: "REQUIREMENTS_IDENTIFIED", status: "PASS", severity: "INFO", title: "Requirements identified", detail: `${input.requirements.length} requirement(s) are registered for this tender.`, entityType: "tender", entityId: null }];
  for (const requirement of input.requirements) {
    if (!requirement.mandatory) continue;
    const result = results.get(requirement.id);
    const decision = decisions.get(requirement.id);
    const effective = decision?.decision ?? result?.reviewer_decision ?? result?.system_status ?? requirement.status;
    let status: QaStatus = "NEEDS_REVIEW";
    let severity: QaCheck["severity"] = "CRITICAL";
    let detail = "Mandatory requirement has not completed evidence verification and human review.";
    if (!result) {
      status = "BLOCKED";
      detail = "Mandatory requirement has no stored verification result.";
    } else if (effective === "VERIFIED" || effective === "SUPPORTED") {
      status = "PASS";
      detail = decision ? `Reviewer accepted the requirement: ${decision.rationale}` : "Stored verification result supports this requirement.";
      severity = "INFO";
    } else if (effective === "UNVERIFIED" || effective === "CONTRADICTED") {
      status = "BLOCKED";
      detail = decision?.rationale ?? result.reviewer_reason ?? `Requirement remains ${effective.toLowerCase().replaceAll("_", " ")}.`;
    } else if (effective === "NEEDS_REVIEW" || effective === "PARTIALLY_SUPPORTED") {
      status = "NEEDS_REVIEW";
      detail = decision?.rationale ?? result.reviewer_reason ?? `Requirement remains ${effective.toLowerCase().replaceAll("_", " ")}.`;
    }
    checks.push({ checkType: "MANDATORY_REQUIREMENT", status, severity, title: requirement.title, detail, entityType: "requirement", entityId: requirement.id, sourcePage: result?.source_page ?? requirement.source_page, sourceExcerpt: result?.source_excerpt ?? requirement.source_excerpt, provenanceMetadata: { mandatory: true, system_status: result?.system_status ?? null, reviewer_decision: decision?.decision ?? result?.reviewer_decision ?? null } });
  }
  return checks;
}

function evidenceChecks(input: QaInput): QaCheck[] {
  if (input.evidence.length === 0) return [{ checkType: "EVIDENCE_AVAILABLE", status: "NEEDS_REVIEW", severity: "CRITICAL", title: "Evidence available", detail: "No evidence documents are available for final QA.", entityType: "tender", entityId: null }];
  return input.evidence.map((evidence) => {
    if (["MISSING", "EXPIRED", "REJECTED"].includes(evidence.status)) return { checkType: "EVIDENCE_CURRENT", status: "BLOCKED", severity: "CRITICAL", title: evidence.document_name, detail: `Evidence is ${evidence.status.toLowerCase()}.`, entityType: "evidence", entityId: evidence.id, provenanceMetadata: { evidence_status: evidence.status } };
    if (["EXPIRING", "PENDING_REVIEW", "UNKNOWN"].includes(evidence.status)) return { checkType: "EVIDENCE_CURRENT", status: "NEEDS_REVIEW", severity: "WARNING", title: evidence.document_name, detail: `Evidence status is ${evidence.status.toLowerCase().replaceAll("_", " ")}.`, entityType: "evidence", entityId: evidence.id, provenanceMetadata: { evidence_status: evidence.status, expiry_date: evidence.expiry_date } };
    return { checkType: "EVIDENCE_CURRENT", status: "PASS", severity: "INFO", title: evidence.document_name, detail: "Evidence is marked verified and current.", entityType: "evidence", entityId: evidence.id, provenanceMetadata: { evidence_status: evidence.status, expiry_date: evidence.expiry_date } };
  });
}

function claimChecks(input: QaInput): QaCheck[] {
  return input.claims.map((claim) => {
    if (["UNVERIFIED", "CONTRADICTED"].includes(claim.status)) return { checkType: "CLAIM_SUPPORT", status: "BLOCKED", severity: "CRITICAL", title: "Unsupported response claim", detail: `Claim is ${claim.status.toLowerCase()}.`, entityType: "claim", entityId: claim.id, sourcePage: claim.source_page };
    if (["NEEDS_REVIEW", "PARTIALLY_SUPPORTED"].includes(claim.status)) return { checkType: "CLAIM_SUPPORT", status: "NEEDS_REVIEW", severity: "WARNING", title: "Response claim requires review", detail: `Claim is ${claim.status.toLowerCase().replaceAll("_", " ")}.`, entityType: "claim", entityId: claim.id, sourcePage: claim.source_page };
    return { checkType: "CLAIM_SUPPORT", status: "PASS", severity: "INFO", title: "Supported response claim", detail: "Claim is supported by the stored verification state.", entityType: "claim", entityId: claim.id, sourcePage: claim.source_page };
  });
}

export function evaluateSubmissionReadiness(input: QaInput) {
  const checks = [...requirementChecks(input), ...evidenceChecks(input), ...claimChecks(input)];
  const blocked = checks.filter((check) => check.status === "BLOCKED");
  const needsReview = checks.filter((check) => check.status === "NEEDS_REVIEW");
  const unknown = checks.filter((check) => check.status === "UNKNOWN");
  const status: ReadinessStatus = unknown.length > 0 ? "UNKNOWN" : blocked.length > 0 ? "NOT_READY" : needsReview.length > 0 ? "NEEDS_REVIEW" : "READY";
  return { status, checks, counts: { total: checks.length, pass: checks.filter((check) => check.status === "PASS").length, blocked: blocked.length, needsReview: needsReview.length, unknown: unknown.length } };
}
