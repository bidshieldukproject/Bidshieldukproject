import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractEvidencePdf } from "@/lib/evidence/extractEvidencePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVIDENCE_BUCKET = "evidence-vault";
type RouteContext = { params: Promise<{ id: string }> };

type EvidenceRow = {
  id: string;
  organization_id: string;
  document_name: string;
  storage_path: string;
  content_hash: string | null;
  provenance_metadata: Record<string, unknown>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id: evidenceId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "Organisation membership required." }, { status: 403 });

  const { data: evidence, error: evidenceError } = await supabase
    .from("evidence_vault")
    .select("id, organization_id, document_name, storage_path, content_hash, provenance_metadata")
    .eq("id", evidenceId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (evidenceError || !evidence) return NextResponse.json({ error: "Evidence document not found." }, { status: 404 });

  const row = evidence as EvidenceRow;
  await supabase.from("evidence_vault").update({
    status: "PENDING_REVIEW",
    provenance_metadata: { ...row.provenance_metadata, processing_status: "PROCESSING" }
  }).eq("id", row.id).eq("organization_id", membership.organization_id);

  try {
    const { data: file, error: downloadError } = await supabase.storage.from(EVIDENCE_BUCKET).download(row.storage_path);
    if (downloadError || !file) throw new Error("Evidence file could not be downloaded from private storage.");

    const extraction = await extractEvidencePdf(await file.arrayBuffer());
    const pages = extraction.pages.map((page) => ({
      page_number: page.pageNumber,
      text_content: page.textContent,
      character_count: page.characterCount,
      content_hash: page.contentHash
    }));
    const metadata = {
      ...row.provenance_metadata,
      processing_status: extraction.status,
      extraction_method: "pdfjs-server",
      page_count: extraction.pageCount,
      source_document_hash: row.content_hash,
      pages,
      processed_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase.from("evidence_vault").update({
      status: extraction.status === "READY" ? "PENDING_REVIEW" : "UNKNOWN",
      provenance_state: "NORMALIZED",
      provenance_metadata: metadata
    }).eq("id", row.id).eq("organization_id", membership.organization_id);
    if (updateError) throw updateError;

    await supabase.from("audit_events").insert({
      organization_id: membership.organization_id,
      user_id: membership.id,
      event_type: "EVIDENCE_PAGES_EXTRACTED",
      entity_type: "evidence_vault",
      entity_id: row.id,
      metadata: { document_name: row.document_name, page_count: extraction.pageCount, status: extraction.status },
      provenance_state: "NORMALIZED"
    });

    return NextResponse.json({ evidenceId: row.id, documentName: row.document_name, pageCount: extraction.pageCount, status: extraction.status, pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence processing failed.";
    await supabase.from("evidence_vault").update({
      status: "UNKNOWN",
      provenance_metadata: { ...row.provenance_metadata, processing_status: "FAILED", processing_error: message.slice(0, 500) }
    }).eq("id", row.id).eq("organization_id", membership.organization_id);
    return NextResponse.json({ error: "Evidence processing failed.", detail: message }, { status: 502 });
  }
}
