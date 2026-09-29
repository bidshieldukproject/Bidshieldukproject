import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVIDENCE_BUCKET = "evidence-vault";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_CATEGORIES = new Set(["ACCREDITATIONS", "INSURANCES", "FINANCIAL", "POLICIES", "OTHER"]);

async function calculateHash(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const categoryInput = String(formData.get("category") ?? "OTHER").toUpperCase();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A PDF evidence file is required." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Evidence ingestion currently supports PDF files only." }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Evidence PDFs must be between 1 byte and 25 MB." }, { status: 413 });
  }
  const category = ALLOWED_CATEGORIES.has(categoryInput) ? categoryInput : "OTHER";

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "Organisation membership required." }, { status: 403 });

  const buffer = await file.arrayBuffer();
  const contentHash = await calculateHash(buffer);
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
  const storagePath = `${membership.organization_id}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(storagePath, buffer, {
    cacheControl: "3600",
    contentType: "application/pdf",
    upsert: false
  });

  if (uploadError) return NextResponse.json({ error: "Evidence upload could not be completed." }, { status: 502 });

  const { data: evidence, error: metadataError } = await supabase.from("evidence_vault").insert({
    organization_id: membership.organization_id,
    document_name: file.name,
    document_type: "application/pdf",
    category,
    storage_path: storagePath,
    content_hash: contentHash,
    status: "PENDING_REVIEW",
    provenance_state: "SOURCE",
    provenance_metadata: { ingestion_method: "server_upload", source_hash: contentHash },
    uploaded_by: membership.id
  }).select("id, document_name, category").maybeSingle();

  if (metadataError || !evidence) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "Evidence metadata could not be saved." }, { status: 500 });
  }

  await supabase.from("audit_events").insert({
    organization_id: membership.organization_id,
    user_id: membership.id,
    event_type: "EVIDENCE_UPLOADED",
    entity_type: "evidence_vault",
    entity_id: evidence.id,
    metadata: { document_name: file.name, category, content_hash: contentHash },
    provenance_state: "SOURCE"
  });

  return NextResponse.json({ evidenceId: evidence.id, documentName: file.name, category, contentHash }, { status: 201 });
}
