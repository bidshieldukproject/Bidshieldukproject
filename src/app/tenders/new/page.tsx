"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, FileText, LockKeyhole, ShieldCheck, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { extractTenderPdfPages } from "@/lib/tender/extractPdfText";

const TENDER_BUCKET = "tender-documents";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

async function calculateHash(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function NewTenderPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [deadline, setDeadline] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF tender document.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("Tender PDFs must be 25 MB or smaller.");
      return;
    }
    setError(null);
    setFile(candidate);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setIsSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsSubmitting(false);
      setError("Your session has expired. Please sign in again.");
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from("users")
      .select("id, organization_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (membershipError || !membership) {
      setIsSubmitting(false);
      setError("An organisation membership is required before creating a tender.");
      return;
    }

    const { data: tender, error: tenderError } = await supabase
      .from("tenders")
      .insert({
        organization_id: membership.organization_id,
        title: title.trim(),
        buyer_name: buyerName.trim() || null,
        reference_code: referenceCode.trim() || null,
        deadline: deadline ? new Date(`${deadline}T23:59:59`).toISOString() : null,
        status: "DRAFT",
        provenance_state: "USER_INPUT",
        created_by: membership.id
      })
      .select("id")
      .single();

    if (tenderError || !tender) {
      setIsSubmitting(false);
      setError(tenderError?.message ?? "Tender could not be created.");
      return;
    }

    if (!file) {
      router.push(`/dashboard?tender=${tender.id}`);
      router.refresh();
      return;
    }

    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
    const storagePath = `${membership.organization_id}/${tender.id}/${crypto.randomUUID()}-${safeName}`;
    const contentHash = await calculateHash(file);
    const { error: uploadError } = await supabase.storage.from(TENDER_BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: false
    });

    if (uploadError) {
      await supabase.from("tenders").delete().eq("id", tender.id);
      setIsSubmitting(false);
      setError("Tender was not saved because the PDF upload failed. Please retry.");
      return;
    }

    const { data: document, error: documentError } = await supabase.from("tender_documents").insert({
      organization_id: membership.organization_id,
      tender_id: tender.id,
      document_name: file.name,
      document_type: "application/pdf",
      storage_path: storagePath,
      content_hash: contentHash,
      version: "1",
      provenance_state: "SOURCE",
      uploaded_by: membership.id
    })
      .select("id")
      .single();

    if (documentError || !document) {
      await supabase.storage.from(TENDER_BUCKET).remove([storagePath]);
      await supabase.from("tenders").delete().eq("id", tender.id);
      setIsSubmitting(false);
      setError("Tender metadata could not be saved. No incomplete tender was kept.");
      return;
    }

    await supabase.from("tender_documents").update({ processing_status: "PROCESSING", processing_error: null }).eq("id", document.id);

    try {
      const extraction = await extractTenderPdfPages(file);
      const { error: pagesError } = await supabase.from("tender_document_pages").insert(
        extraction.pages.map((page) => ({
          organization_id: membership.organization_id,
          tender_id: tender.id,
          tender_document_id: document.id,
          page_number: page.pageNumber,
          text_content: page.textContent,
          character_count: page.characterCount,
          content_hash: page.contentHash,
          provenance_state: "NORMALIZED",
          provenance_metadata: { extraction_method: "pdfjs", source_document_hash: contentHash }
        }))
      );

      if (pagesError) throw pagesError;
      await supabase.from("tender_documents").update({
        page_count: extraction.pageCount,
        processing_status: extraction.status,
        processing_error: extraction.status === "OCR_REQUIRED" ? "No readable text was detected; OCR is required." : null,
        provenance_state: "NORMALIZED",
        provenance_metadata: { extraction_method: "pdfjs", source_document_hash: contentHash }
      }).eq("id", document.id);
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : "PDF text extraction failed.";
      await supabase.from("tender_documents").update({ processing_status: "FAILED", processing_error: message }).eq("id", document.id);
      setIsSubmitting(false);
      setError("The tender was uploaded, but text extraction failed. You can retry processing later.");
      return;
    }

    router.push(`/dashboard?tender=${tender.id}`);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#0B0F19] px-5 py-6 text-slate-200 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-white"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to Command Center</Link>
        <div className="mt-8 flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20"><ShieldCheck aria-hidden="true" className="h-6 w-6" /></div><div><p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400">Tender intake</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Create a tender workspace.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Capture the tender identity and upload its source PDF. Requirements extraction will use this page-aware source document next.</p></div></div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-7">
            <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300"><FileText aria-hidden="true" className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold text-white">Tender details</h2><p className="mt-1 text-xs text-slate-500">Required identity and submission context</p></div></div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block text-sm text-slate-300 sm:col-span-2">Tender title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Hard FM Services — North Region" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none ring-emerald-400/40 placeholder:text-slate-700 focus:ring-2" /></label>
              <label className="block text-sm text-slate-300">Buyer / authority<input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder="e.g. Example Borough Council" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none ring-emerald-400/40 placeholder:text-slate-700 focus:ring-2" /></label>
              <label className="block text-sm text-slate-300">Reference code<input value={referenceCode} onChange={(event) => setReferenceCode(event.target.value)} placeholder="e.g. PROC-2026-001" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none ring-emerald-400/40 placeholder:text-slate-700 focus:ring-2" /></label>
              <label className="block text-sm text-slate-300 sm:col-span-2">Submission deadline<div className="relative mt-2"><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input required type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-3 text-sm text-white outline-none ring-emerald-400/40 focus:ring-2" /></div></label>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-7">
            <div className="flex items-center justify-between gap-4"><div><h2 className="text-sm font-semibold text-white">Tender source PDF</h2><p className="mt-1 text-xs text-slate-500">Private, organisation-isolated storage</p></div><LockKeyhole aria-hidden="true" className="h-5 w-5 text-emerald-300" /></div>
            <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); chooseFile(event.dataTransfer.files?.[0]); }} className={`mt-6 flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition ${isDragging ? "border-emerald-300 bg-emerald-400/10" : "border-white/20 bg-black/10 hover:border-emerald-400/60"}`}>
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileChange} />
              {file ? <><div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-left"><CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" /><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{file.name}</p><p className="mt-1 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB · ready for secure upload</p></div><button type="button" aria-label="Remove tender PDF" onClick={(event) => { event.stopPropagation(); setFile(null); }} className="ml-2 text-slate-500 hover:text-white"><X aria-hidden="true" className="h-4 w-4" /></button></div></> : <><UploadCloud aria-hidden="true" className="h-8 w-8 text-emerald-300" /><p className="mt-4 text-sm font-medium text-white">Choose the tender PDF</p><p className="mt-1 text-xs text-slate-500">Tap to browse or drag and drop · maximum 25 MB</p></>}
            </div>
          </section>

          {error && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm leading-6 text-red-200">{error}</p>}
          <button type="submit" disabled={isSubmitting || !title.trim() || !deadline} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-[#07100d] shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">{isSubmitting ? "Saving tender securely…" : "Create tender workspace"}</button>
          <p className="text-center text-xs leading-5 text-slate-600">You can create the tender without a PDF, but requirement extraction needs a source document.</p>
        </form>
      </div>
    </main>
  );
}
