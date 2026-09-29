import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractTenderRequirements } from "@/lib/tender/extractRequirements";
import { validateRequirementEvidence } from "@/lib/tender/validateRequirementEvidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type TenderPageRow = {
  page_number: number;
  text_content: string;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id: tenderId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Organisation membership required." }, { status: 403 });
  }

  const { data: tender, error: tenderError } = await supabase
    .from("tenders")
    .select("id, organization_id, title")
    .eq("id", tenderId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  if (tenderError || !tender) {
    return NextResponse.json({ error: "Tender not found in the current organisation." }, { status: 404 });
  }

  const { data: document, error: documentError } = await supabase
    .from("tender_documents")
    .select("id, document_name, page_count, processing_status")
    .eq("tender_id", tenderId)
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (documentError || !document) {
    return NextResponse.json({ error: "No tender source document is available." }, { status: 422 });
  }

  const { data: pageRows, error: pagesError } = await supabase
    .from("tender_document_pages")
    .select("page_number, text_content")
    .eq("tender_id", tenderId)
    .eq("tender_document_id", document.id)
    .eq("organization_id", membership.organization_id)
    .order("page_number", { ascending: true });

  if (pagesError) {
    return NextResponse.json({ error: "Tender pages could not be loaded." }, { status: 500 });
  }

  const pages = (pageRows ?? []) as TenderPageRow[];
  if (pages.length === 0 || pages.every((page) => !page.text_content.trim())) {
    return NextResponse.json({ error: "No readable tender text is available. Run PDF extraction first." }, { status: 422 });
  }

  const extractionRunId = crypto.randomUUID();
  await supabase.from("tender_documents").update({
    processing_status: "PROCESSING",
    processing_error: null
  }).eq("id", document.id).eq("organization_id", membership.organization_id);

  try {
    const extraction = await extractTenderRequirements(pages);
    const validations = extraction.requirements.map((candidate) => validateRequirementEvidence(candidate, pages));
    const requirementRows = validations.map(({ normalized, status, issues }) => ({
      organization_id: membership.organization_id,
      tender_id: tenderId,
      title: normalized.title,
      description: normalized.description,
      type: normalized.type,
      mandatory: normalized.mandatory,
      source_document_id: document.id,
      source_page: normalized.sourcePage,
      source_excerpt: normalized.sourceExcerpt,
      deadline: normalized.deadline,
      weight: normalized.weight,
      word_limit: normalized.wordLimit,
      required_evidence: normalized.requiredEvidence,
      status,
      confidence: normalized.confidence,
      provenance_state: "AI_ESTIMATE",
      provenance_metadata: {
        provider: "Google Gemini Flash",
        model: extraction.model,
        policy_version: extraction.policyVersion,
        prompt_version: extraction.promptVersion,
        extraction_run_id: extractionRunId,
        deterministic_issues: issues,
        source_document_id: document.id,
        source_page: normalized.sourcePage,
        source_excerpt: normalized.sourceExcerpt
      }
    }));

    const { data: savedRequirements, error: insertError } = requirementRows.length > 0
      ? await supabase.from("requirements").insert(requirementRows).select("id, title, type, mandatory, source_page, status, confidence, provenance_metadata")
      : { data: [], error: null };

    if (insertError) throw insertError;

    const { error: auditError } = await supabase.from("audit_events").insert({
      organization_id: membership.organization_id,
      user_id: membership.id,
      event_type: "TENDER_REQUIREMENTS_EXTRACTED",
      entity_type: "tender",
      entity_id: tenderId,
      metadata: {
        extraction_run_id: extractionRunId,
        tender_title: tender.title,
        source_document_id: document.id,
        source_document_name: document.document_name,
        provider: "Google Gemini Flash",
        model: extraction.model,
        policy_version: extraction.policyVersion,
        prompt_version: extraction.promptVersion,
        page_count: pages.length,
        requirement_count: requirementRows.length,
        needs_review_count: validations.filter((result) => result.status === "NEEDS_REVIEW").length
      },
      provenance_state: "CALCULATED"
    });

    if (auditError) throw auditError;

    await supabase.from("tender_documents").update({
      processing_status: "READY",
      processing_error: null,
      provenance_metadata: {
        extraction_method: "pdfjs",
        requirement_extraction: {
          provider: "Google Gemini Flash",
          model: extraction.model,
          extraction_run_id: extractionRunId,
          policy_version: extraction.policyVersion,
          prompt_version: extraction.promptVersion,
          completed_at: new Date().toISOString()
        }
      }
    }).eq("id", document.id).eq("organization_id", membership.organization_id);

    return NextResponse.json({
      extractionRunId,
      tenderId,
      documentId: document.id,
      model: extraction.model,
      policyVersion: extraction.policyVersion,
      counts: {
        extracted: requirementRows.length,
        accepted: validations.filter((result) => result.accepted).length,
        needsReview: validations.filter((result) => !result.accepted).length
      },
      requirements: savedRequirements ?? []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Requirement extraction failed.";
    await supabase.from("tender_documents").update({
      processing_status: "FAILED",
      processing_error: message.slice(0, 500)
    }).eq("id", document.id).eq("organization_id", membership.organization_id);

    return NextResponse.json({ error: "Requirement extraction failed.", detail: message }, { status: 502 });
  }
}
