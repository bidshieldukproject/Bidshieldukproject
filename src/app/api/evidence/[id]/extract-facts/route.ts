import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractEvidenceFactsWithGemini, EvidenceFact } from "@/lib/gemini/extractEvidenceFacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type EvidencePage = { page_number: number; text_content: string; character_count: number; content_hash: string };
type EvidenceRow = { id: string; organization_id: string; document_name: string; category: string; provenance_metadata: Record<string, unknown> };

type ValidatedFact = EvidenceFact & { validationIssues: string[] };

function normalize(value: string) { return value.replace(/\s+/g, " ").trim().toLowerCase(); }

function validateFact(fact: EvidenceFact, pages: EvidencePage[]): ValidatedFact {
  const issues: string[] = [];
  const page = fact.sourcePage === null ? undefined : pages.find((item) => item.page_number === fact.sourcePage);
  const confidence = Number.isFinite(fact.confidence) ? Math.min(1, Math.max(0, fact.confidence)) : 0;
  if (!fact.factType.trim() || !fact.label.trim()) issues.push("Fact type or label is missing.");
  if (fact.sourcePage === null || !page) issues.push("Source page is missing or outside the processed evidence pages.");
  if (!fact.sourceExcerpt?.trim()) issues.push("Exact source excerpt is missing.");
  else if (!page || !normalize(page.text_content).includes(normalize(fact.sourceExcerpt))) issues.push("Source excerpt does not match the cited evidence page.");
  if (fact.numericValue !== null && (!Number.isFinite(fact.numericValue) || fact.numericValue < 0)) issues.push("Numeric value must be non-negative.");
  if (fact.dateValue !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(fact.dateValue) || Number.isNaN(Date.parse(fact.dateValue)))) issues.push("Date value is not a valid ISO date.");
  if (fact.numericValue !== null && !fact.currency && /amount|revenue|profit|assets|liabilities|cover/i.test(fact.label)) issues.push("A monetary fact needs an explicit currency.");
  return { ...fact, confidence, validationIssues: issues };
}

export async function POST(_request: Request, context: RouteContext) {
  const { id: evidenceId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase.from("users").select("id, organization_id").eq("auth_user_id", user.id).maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "Organisation membership required." }, { status: 403 });

  const { data: evidence, error: evidenceError } = await supabase.from("evidence_vault").select("id, organization_id, document_name, category, provenance_metadata").eq("id", evidenceId).eq("organization_id", membership.organization_id).maybeSingle();
  if (evidenceError || !evidence) return NextResponse.json({ error: "Evidence document not found." }, { status: 404 });

  const row = evidence as EvidenceRow;
  const storedPages = Array.isArray(row.provenance_metadata.pages) ? row.provenance_metadata.pages as EvidencePage[] : [];
  const readablePages = storedPages.filter((page) => page.text_content?.trim());
  if (readablePages.length === 0) return NextResponse.json({ error: "Process the evidence PDF before extracting facts." }, { status: 422 });

  const extractionRunId = crypto.randomUUID();
  try {
    const extraction = await extractEvidenceFactsWithGemini(row.category, readablePages.map((page) => ({ pageNumber: page.page_number, text: page.text_content })));
    const facts = extraction.facts.map((fact) => validateFact(fact, readablePages));
    const invalidCount = facts.filter((fact) => fact.validationIssues.length > 0).length;
    const metadata = {
      ...row.provenance_metadata,
      evidence_facts: facts,
      facts_extraction: {
        provider: "Google Gemini Flash",
        model: extraction.model,
        policy_version: extraction.policyVersion,
        prompt_version: extraction.promptVersion,
        extraction_run_id: extractionRunId,
        fact_count: facts.length,
        needs_review_count: invalidCount,
        completed_at: new Date().toISOString()
      }
    };

    const { error: updateError } = await supabase.from("evidence_vault").update({ provenance_metadata: metadata, provenance_state: "AI_ESTIMATE", status: invalidCount > 0 ? "PENDING_REVIEW" : "VERIFIED" }).eq("id", row.id).eq("organization_id", membership.organization_id);
    if (updateError) throw updateError;

    const { error: auditError } = await supabase.from("audit_events").insert({
      organization_id: membership.organization_id,
      user_id: membership.id,
      event_type: "EVIDENCE_FACTS_EXTRACTED",
      entity_type: "evidence_vault",
      entity_id: row.id,
      metadata: { document_name: row.document_name, category: row.category, extraction_run_id: extractionRunId, model: extraction.model, policy_version: extraction.policyVersion, fact_count: facts.length, needs_review_count: invalidCount },
      provenance_state: "AI_ESTIMATE"
    });
    if (auditError) throw auditError;

    return NextResponse.json({ evidenceId: row.id, documentName: row.document_name, category: row.category, extractionRunId, model: extraction.model, policyVersion: extraction.policyVersion, counts: { extracted: facts.length, needsReview: invalidCount }, facts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence fact extraction failed.";
    return NextResponse.json({ error: "Evidence fact extraction failed.", detail: message }, { status: 502 });
  }
}
