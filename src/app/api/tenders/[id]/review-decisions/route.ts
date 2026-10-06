import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

const reviewerStatuses = ["VERIFIED", "SUPPORTED", "PARTIALLY_SUPPORTED", "NEEDS_REVIEW", "UNVERIFIED", "CONTRADICTED"] as const;
type ReviewerStatus = (typeof reviewerStatuses)[number];

function isReviewerStatus(value: unknown): value is ReviewerStatus {
  return typeof value === "string" && reviewerStatuses.includes(value as ReviewerStatus);
}

async function getMembership(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, membership: null, error: "Authentication required." };
  const { data: membership, error } = await supabase.from("users").select("id, organization_id").eq("auth_user_id", user.id).maybeSingle();
  if (error || !membership) return { user, membership: null, error: "Organisation membership required." };
  return { user, membership, error: null };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: tenderId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { membership, error: authError } = await getMembership(supabase);
  if (authError || !membership) return NextResponse.json({ error: authError }, { status: authError === "Authentication required." ? 401 : 403 });

  const { data: tender, error: tenderError } = await supabase.from("tenders").select("id").eq("id", tenderId).eq("organization_id", membership.organization_id).maybeSingle();
  if (tenderError || !tender) return NextResponse.json({ error: "Tender not found in the current organisation." }, { status: 404 });

  const { data, error } = await supabase.from("reviewer_decisions").select("id, requirement_id, verification_result_id, decision, rationale, reviewer_id, created_at").eq("tender_id", tenderId).eq("organization_id", membership.organization_id).order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Reviewer decision history could not be loaded." }, { status: 500 });
  return NextResponse.json({ decisions: data ?? [] });
}

export async function POST(request: Request, context: RouteContext) {
  const { id: tenderId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { membership, error: authError } = await getMembership(supabase);
  if (authError || !membership) return NextResponse.json({ error: authError }, { status: authError === "Authentication required." ? 401 : 403 });

  let body: { requirementId?: unknown; decision?: unknown; rationale?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON reviewer decision is required." }, { status: 400 });
  }
  const requirementId = typeof body.requirementId === "string" ? body.requirementId : null;
  const decision = body.decision;
  const rationale = typeof body.rationale === "string" ? body.rationale.trim() : "";
  if (!requirementId || !isReviewerStatus(decision) || rationale.length < 3) {
    return NextResponse.json({ error: "Requirement, valid reviewer decision, and rationale are required." }, { status: 400 });
  }

  const { data: tender, error: tenderError } = await supabase.from("tenders").select("id, title").eq("id", tenderId).eq("organization_id", membership.organization_id).maybeSingle();
  if (tenderError || !tender) return NextResponse.json({ error: "Tender not found in the current organisation." }, { status: 404 });

  const { data: requirement, error: requirementError } = await supabase.from("requirements").select("id, title").eq("id", requirementId).eq("tender_id", tenderId).eq("organization_id", membership.organization_id).maybeSingle();
  if (requirementError || !requirement) return NextResponse.json({ error: "Requirement not found in the current tender." }, { status: 404 });

  const { data: latestResult, error: resultError } = await supabase.from("verification_results").select("id, system_status").eq("tender_id", tenderId).eq("requirement_id", requirementId).eq("organization_id", membership.organization_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (resultError || !latestResult) return NextResponse.json({ error: "Run deterministic evidence matching before recording a reviewer decision." }, { status: 422 });

  const { data: decisionRow, error: decisionError } = await supabase.from("reviewer_decisions").insert({
    organization_id: membership.organization_id,
    tender_id: tenderId,
    requirement_id: requirementId,
    verification_result_id: latestResult.id,
    decision,
    rationale,
    reviewer_id: membership.id,
    provenance_state: "USER_INPUT",
    provenance_metadata: { system_status: latestResult.system_status, requirement_title: requirement.title, tender_title: tender.title }
  }).select("id, requirement_id, verification_result_id, decision, rationale, reviewer_id, created_at").maybeSingle();
  if (decisionError || !decisionRow) return NextResponse.json({ error: "Reviewer decision could not be recorded.", detail: decisionError?.message }, { status: 500 });

  const { error: projectionError } = await supabase.from("verification_results").update({
    reviewer_decision: decision,
    reviewer_reason: rationale,
    reviewed_by: membership.id,
    reviewed_at: decisionRow.created_at,
    provenance_metadata: { reviewer_decision_id: decisionRow.id, reviewer_decision: decision, system_status: latestResult.system_status }
  }).eq("id", latestResult.id).eq("organization_id", membership.organization_id);
  if (projectionError) return NextResponse.json({ error: "Decision history was recorded, but the current verification projection could not be updated.", detail: projectionError.message, decision: decisionRow }, { status: 500 });

  const { error: auditError } = await supabase.from("audit_events").insert({
    organization_id: membership.organization_id,
    user_id: membership.id,
    event_type: "REVIEWER_DECISION_RECORDED",
    entity_type: "reviewer_decision",
    entity_id: decisionRow.id,
    metadata: { tender_id: tenderId, requirement_id: requirementId, verification_result_id: latestResult.id, system_status: latestResult.system_status, reviewer_decision: decision },
    provenance_state: "USER_INPUT"
  });
  if (auditError) return NextResponse.json({ error: "Decision was recorded, but its audit event could not be written.", detail: auditError.message, decision: decisionRow }, { status: 500 });

  return NextResponse.json({ decision: decisionRow, systemStatus: latestResult.system_status });
}
