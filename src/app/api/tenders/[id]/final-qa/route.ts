import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { evaluateSubmissionReadiness } from "@/lib/qa/evaluateSubmissionReadiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

async function membershipFor(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { membership: null, error: "Authentication required." };
  const { data, error } = await supabase.from("users").select("id, organization_id").eq("auth_user_id", user.id).maybeSingle();
  if (error || !data) return { membership: null, error: "Organisation membership required." };
  return { membership: data, error: null };
}

export async function POST(_request: Request, context: RouteContext) {
  const { id: tenderId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { membership, error: authError } = await membershipFor(supabase);
  if (authError || !membership) return NextResponse.json({ error: authError }, { status: authError === "Authentication required." ? 401 : 403 });

  const [tenderResult, requirementsResult, evidenceResult, claimsResult, verificationResult, reviewerResult] = await Promise.all([
    supabase.from("tenders").select("id, title, deadline").eq("id", tenderId).eq("organization_id", membership.organization_id).maybeSingle(),
    supabase.from("requirements").select("id, title, mandatory, status, source_page, source_excerpt").eq("tender_id", tenderId).eq("organization_id", membership.organization_id).limit(1000),
    supabase.from("evidence_vault").select("id, document_name, status, expiry_date").eq("organization_id", membership.organization_id).limit(1000),
    supabase.from("claims").select("id, response_text, status, source_page").eq("tender_id", tenderId).eq("organization_id", membership.organization_id).limit(1000),
    supabase.from("verification_results").select("id, requirement_id, system_status, reviewer_decision, reviewer_reason, created_at").eq("tender_id", tenderId).eq("organization_id", membership.organization_id).order("created_at", { ascending: false }).limit(1000),
    supabase.from("reviewer_decisions").select("id, requirement_id, decision, rationale, created_at").eq("tender_id", tenderId).eq("organization_id", membership.organization_id).order("created_at", { ascending: false }).limit(1000)
  ]);
  const queryError = tenderResult.error ?? requirementsResult.error ?? evidenceResult.error ?? claimsResult.error ?? verificationResult.error ?? reviewerResult.error;
  if (queryError) return NextResponse.json({ error: "Final QA data could not be loaded.", detail: queryError.message }, { status: 500 });
  if (!tenderResult.data) return NextResponse.json({ error: "Tender not found in the current organisation." }, { status: 404 });

  const evaluation = evaluateSubmissionReadiness({
    requirements: requirementsResult.data ?? [],
    evidence: evidenceResult.data ?? [],
    claims: claimsResult.data ?? [],
    verificationResults: verificationResult.data ?? [],
    reviewerDecisions: reviewerResult.data ?? []
  });
  const now = new Date().toISOString();

  const checkRows = evaluation.checks.map((check) => ({
    organization_id: membership.organization_id,
    tender_id: tenderId,
    check_type: check.checkType,
    status: check.status,
    severity: check.severity,
    title: check.title,
    detail: check.detail,
    entity_type: check.entityType,
    entity_id: check.entityId,
    source_page: check.sourcePage ?? null,
    source_excerpt: check.sourceExcerpt ?? null,
    provenance_state: "CALCULATED",
    provenance_metadata: { ...check.provenanceMetadata, qa_run_at: now, readiness_status: evaluation.status }
  }));
  const { error: checkError } = await supabase.from("submission_checks").insert(checkRows);
  if (checkError) return NextResponse.json({ error: "Final QA checks could not be persisted.", detail: checkError.message }, { status: 500 });

  const blocked = evaluation.checks.filter((check) => check.status === "BLOCKED");
  const needsReview = evaluation.checks.filter((check) => check.status === "NEEDS_REVIEW");
  const alertRows = [...blocked.map((check) => ({ alert_type: "FINAL_QA_BLOCKER", severity: "CRITICAL", title: check.title, detail: check.detail, entity_type: check.entityType, entity_id: check.entityId })), ...needsReview.map((check) => ({ alert_type: "FINAL_QA_REVIEW", severity: "WARNING", title: check.title, detail: check.detail, entity_type: check.entityType, entity_id: check.entityId }))].map((alert) => ({ ...alert, organization_id: membership.organization_id, tender_id: tenderId, status: "OPEN", provenance_state: "CALCULATED", provenance_metadata: { qa_run_at: now, readiness_status: evaluation.status } }));
  if (alertRows.length) {
    const { error: alertError } = await supabase.from("alerts").insert(alertRows);
    if (alertError) return NextResponse.json({ error: "Final QA was recorded, but alerts could not be persisted.", detail: alertError.message, evaluation }, { status: 500 });
  }

  const tenderStatus = evaluation.status === "READY" ? "READY" : evaluation.status === "NOT_READY" || evaluation.status === "NEEDS_REVIEW" ? "REVIEW" : "DRAFT";
  const { error: tenderUpdateError } = await supabase.from("tenders").update({ status: tenderStatus, provenance_state: "CALCULATED", provenance_metadata: { final_qa_status: evaluation.status, final_qa_run_at: now, final_qa_counts: evaluation.counts } }).eq("id", tenderId).eq("organization_id", membership.organization_id);
  if (tenderUpdateError) return NextResponse.json({ error: "Final QA was recorded, but tender readiness status could not be updated.", detail: tenderUpdateError.message, evaluation }, { status: 500 });

  const { error: auditError } = await supabase.from("audit_events").insert({ organization_id: membership.organization_id, user_id: membership.id, event_type: "FINAL_QA_COMPLETED", entity_type: "tender", entity_id: tenderId, metadata: { readiness_status: evaluation.status, counts: evaluation.counts, blocker_count: blocked.length, review_count: needsReview.length }, provenance_state: "CALCULATED" });
  if (auditError) return NextResponse.json({ error: "Final QA completed, but the audit event could not be written.", detail: auditError.message, evaluation }, { status: 500 });

  return NextResponse.json({ tender: tenderResult.data, readiness: evaluation, executedAt: now });
}
