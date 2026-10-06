import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { matchRequirementToEvidence } from "@/lib/matching/matchRequirementToEvidence";
import { EvidenceFactInput, EvidenceInput, MatchResult, RequirementInput } from "@/lib/matching/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

type RequirementRow = {
  id: string; tender_id: string; title: string; description: string | null; type: string; mandatory: boolean;
  source_page: number | null; source_excerpt: string | null; required_evidence: unknown; deadline: string | null;
  weight: number | null; word_limit: number | null; confidence: number | null; provenance_metadata: Record<string, unknown>;
};
type EvidenceRow = {
  id: string; document_name: string; category: string; issue_date: string | null; expiry_date: string | null;
  status: string; provenance_metadata: Record<string, unknown>;
};

function asStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function asFacts(value: unknown): EvidenceFactInput[] {
  if (!Array.isArray(value)) return [];
  return value.filter((fact): fact is EvidenceFactInput => Boolean(fact && typeof fact === "object" && typeof (fact as EvidenceFactInput).label === "string"));
}
function toRequirement(row: RequirementRow, tenderId: string): RequirementInput {
  return { id: row.id, tenderId, title: row.title, description: row.description, type: row.type, mandatory: row.mandatory, sourcePage: row.source_page, sourceExcerpt: row.source_excerpt, requiredEvidence: asStringArray(row.required_evidence), deadline: row.deadline, weight: row.weight, wordLimit: row.word_limit, confidence: row.confidence, provenanceMetadata: row.provenance_metadata ?? {} };
}
function toEvidence(row: EvidenceRow): EvidenceInput {
  return { id: row.id, documentName: row.document_name, category: row.category, issueDate: row.issue_date, expiryDate: row.expiry_date, status: row.status, provenanceMetadata: row.provenance_metadata ?? {}, facts: asFacts(row.provenance_metadata?.evidence_facts) };
}

export async function POST(_request: Request, context: RouteContext) {
  const { id: tenderId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase.from("users").select("id, organization_id").eq("auth_user_id", user.id).maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "Organisation membership required." }, { status: 403 });

  const { data: tender, error: tenderError } = await supabase.from("tenders").select("id, organization_id, title, deadline").eq("id", tenderId).eq("organization_id", membership.organization_id).maybeSingle();
  if (tenderError || !tender) return NextResponse.json({ error: "Tender not found in the current organisation." }, { status: 404 });

  const { data: requirementRows, error: requirementError } = await supabase.from("requirements").select("id, tender_id, title, description, type, mandatory, source_page, source_excerpt, required_evidence, deadline, weight, word_limit, confidence, provenance_metadata").eq("tender_id", tenderId).eq("organization_id", membership.organization_id).order("created_at", { ascending: true }).limit(500);
  if (requirementError) return NextResponse.json({ error: "Tender requirements could not be loaded." }, { status: 500 });
  if (!requirementRows || requirementRows.length === 0) return NextResponse.json({ error: "Extract tender requirements before matching evidence." }, { status: 422 });

  const { data: evidenceRows, error: evidenceError } = await supabase.from("evidence_vault").select("id, document_name, category, issue_date, expiry_date, status, provenance_metadata").eq("organization_id", membership.organization_id).order("created_at", { ascending: false }).limit(500);
  if (evidenceError) return NextResponse.json({ error: "Evidence register could not be loaded." }, { status: 500 });

  const matchingRunId = crypto.randomUUID();
  const requirements = (requirementRows as RequirementRow[]).map((row) => {
    const requirement = toRequirement(row, tenderId);
    if (!requirement.deadline && tender.deadline) requirement.deadline = tender.deadline;
    return requirement;
  });
  const evidence = (evidenceRows as EvidenceRow[]).map(toEvidence);
  const matches = requirements.map((requirement) => matchRequirementToEvidence(requirement, evidence));

  try {
    for (const result of matches) {
      const requirement = requirements.find((item) => item.id === result.requirementId);
      if (!requirement) continue;
      const claimPayload = {
        organization_id: membership.organization_id,
        tender_id: tenderId,
        requirement_id: requirement.id,
        response_text: `Requirement coverage: ${requirement.title}`,
        claim_type: "REQUIREMENT_COVERAGE",
        status: result.status,
        verification_reason: result.reasoning,
        source_page: requirement.sourcePage,
        provenance_state: "CALCULATED",
        provenance_metadata: { generated_by: "deterministic_matching_engine", matching_run_id: matchingRunId, engine_version: "matching-v1", requirement_id: requirement.id, evidence_id: result.evidenceId, candidate_score: result.candidateScore, deterministic_checks: result.deterministicChecks },
        extracted_facts: result.matchedFacts,
        created_by: membership.id
      };

      const { data: existingClaim, error: claimLookupError } = await supabase.from("claims").select("id").eq("organization_id", membership.organization_id).eq("tender_id", tenderId).eq("requirement_id", requirement.id).eq("claim_type", "REQUIREMENT_COVERAGE").maybeSingle();
      if (claimLookupError) throw claimLookupError;

      const claimQuery = existingClaim
        ? await supabase.from("claims").update(claimPayload).eq("id", existingClaim.id).eq("organization_id", membership.organization_id).select("id").maybeSingle()
        : await supabase.from("claims").insert(claimPayload).select("id").maybeSingle();
      if (claimQuery.error || !claimQuery.data) throw claimQuery.error ?? new Error("Requirement coverage claim could not be saved.");

      let claimEvidenceId: string | null = null;
      if (result.evidenceId) {
        const evidencePayload = {
          organization_id: membership.organization_id,
          claim_id: claimQuery.data.id,
          evidence_id: result.evidenceId,
          match_type: result.matchType,
          support_level: result.status,
          evidence_page: result.evidencePage,
          reasoning: result.reasoning,
          provenance_state: "CALCULATED",
          provenance_metadata: { matching_run_id: matchingRunId, engine_version: "matching-v1", evidence_excerpt: result.evidenceExcerpt, deterministic_checks: result.deterministicChecks, matched_facts: result.matchedFacts }
        };
        const { data: existingLink, error: linkLookupError } = await supabase.from("claim_evidence").select("id").eq("organization_id", membership.organization_id).eq("claim_id", claimQuery.data.id).eq("evidence_id", result.evidenceId).maybeSingle();
        if (linkLookupError) throw linkLookupError;
        const linkQuery = existingLink
          ? await supabase.from("claim_evidence").update(evidencePayload).eq("id", existingLink.id).eq("organization_id", membership.organization_id).select("id").maybeSingle()
          : await supabase.from("claim_evidence").insert(evidencePayload).select("id").maybeSingle();
        if (linkQuery.error || !linkQuery.data) throw linkQuery.error ?? new Error("Claim evidence link could not be saved.");
        claimEvidenceId = linkQuery.data.id;
      }

      const { error: verificationError } = await supabase.from("verification_results").insert({
        organization_id: membership.organization_id,
        tender_id: tenderId,
        requirement_id: requirement.id,
        claim_id: claimQuery.data.id,
        claim_evidence_id: claimEvidenceId,
        system_status: result.status,
        system_reasoning: result.reasoning,
        deterministic_checks: result.deterministicChecks,
        matched_facts: result.matchedFacts,
        engine_version: "matching-v1",
        matching_run_id: matchingRunId,
        provenance_state: "CALCULATED",
        provenance_metadata: { matching_run_id: matchingRunId, requirement_id: requirement.id, evidence_id: result.evidenceId, candidate_score: result.candidateScore }
      });
      if (verificationError) throw verificationError;

      const { error: submissionCheckError } = await supabase.from("submission_checks").insert({
        organization_id: membership.organization_id,
        tender_id: tenderId,
        check_type: "REQUIREMENT_COVERAGE",
        status: result.status,
        title: `Requirement coverage: ${requirement.title}`,
        detail: result.reasoning,
        entity_type: "requirement",
        entity_id: requirement.id,
        source_page: result.evidencePage ?? requirement.sourcePage,
        source_excerpt: result.evidenceExcerpt ?? requirement.sourceExcerpt,
        provenance_state: "CALCULATED",
        provenance_metadata: { matching_run_id: matchingRunId, engine_version: "matching-v1", mandatory: requirement.mandatory, evidence_id: result.evidenceId }
      });
      if (submissionCheckError) throw submissionCheckError;
    }

    const counts = matches.reduce<Record<string, number>>((summary, match) => { summary[match.status] = (summary[match.status] ?? 0) + 1; return summary; }, {});
    const { error: auditError } = await supabase.from("audit_events").insert({ organization_id: membership.organization_id, user_id: membership.id, event_type: "REQUIREMENT_EVIDENCE_MATCHED", entity_type: "tender", entity_id: tenderId, metadata: { matching_run_id: matchingRunId, tender_title: tender.title, engine_version: "matching-v1", requirement_count: requirements.length, evidence_count: evidence.length, counts }, provenance_state: "CALCULATED" });
    if (auditError) throw auditError;

    return NextResponse.json({ matchingRunId, tenderId, tenderTitle: tender.title, counts, matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence matching failed.";
    return NextResponse.json({ error: "Evidence matching could not be persisted.", detail: message }, { status: 500 });
  }
}
