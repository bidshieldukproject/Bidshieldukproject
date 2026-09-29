"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, CheckCircle2, FileCheck2, FileText, LockKeyhole, ShieldCheck, Sparkles, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { extractTenderPdfPages } from "@/lib/tender/extractPdfText";
import { Sidebar } from "@/components/Sidebar";

const TENDER_BUCKET = "tender-documents";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

async function calculateHash(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const inputClass = "mt-2 h-12 w-full rounded-xl border border-white/[0.12] bg-[#090d16]/75 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/60 focus:bg-[#090d16] focus:ring-2 focus:ring-emerald-300/10";

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
    }).select("id").single();

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
      const { error: pagesError } = await supabase.from("tender_document_pages").insert(extraction.pages.map((page) => ({
        organization_id: membership.organization_id,
        tender_id: tender.id,
        tender_document_id: document.id,
        page_number: page.pageNumber,
        text_content: page.textContent,
        character_count: page.characterCount,
        content_hash: page.contentHash,
        provenance_state: "NORMALIZED",
        provenance_metadata: { extraction_method: "pdfjs", source_document_hash: contentHash }
      })));

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
    <div className="flex min-h-screen bg-[#090d16] text-slate-200">
      <div className="hidden xl:flex"><Sidebar /></div>
      <main className="min-w-0 flex-1 bg-[radial-gradient(circle_at_80%_0%,rgba(72,211,158,0.08),transparent_27rem)] px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-white"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to Command Center</Link>
            <span className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-[11px] font-medium text-emerald-200 sm:inline-flex"><LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />Private workspace</span>
          </div>

          <header className="mt-9 flex flex-col justify-between gap-6 border-b border-white/[0.09] pb-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300"><Sparkles aria-hidden="true" className="h-3.5 w-3.5" />Tender intake</div><h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Bring a tender into focus.</h1><p className="mt-3 text-sm leading-6 text-slate-400">Set up the workspace once. BidShield will preserve the source document, extract its pages, and prepare the evidence map.</p></div>
            <div className="flex items-center gap-2 text-xs text-slate-500"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-[11px] font-bold text-[#07100d]">1</span><span className="text-slate-300">Workspace details</span><span className="mx-1 h-px w-6 bg-white/15" /><span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15">2</span><span>Source document</span></div>
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="rounded-3xl border border-white/[0.1] bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
                <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-200 ring-1 ring-inset ring-sky-300/15"><FileText aria-hidden="true" className="h-5 w-5" /></div><div><h2 className="text-base font-semibold text-white">Tender identity</h2><p className="mt-1 text-xs leading-5 text-slate-500">The context your team will see across every compliance check.</p></div></div><span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">Required</span></div>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300 sm:col-span-2"><span className="flex items-center justify-between">Tender title <span className="text-[11px] text-emerald-300">Required</span></span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Hard FM Services — North Region" className={inputClass} /></label>
                  <label className="block text-sm text-slate-300">Buyer / authority<input value={buyerName} onChange={(event) => setBuyerName(event.target.value)} placeholder="e.g. Example Borough Council" className={inputClass} /></label>
                  <label className="block text-sm text-slate-300">Reference code<input value={referenceCode} onChange={(event) => setReferenceCode(event.target.value)} placeholder="e.g. EBC-FM-2026-014" className={inputClass} /></label>
                  <label className="block text-sm text-slate-300 sm:col-span-2"><span className="flex items-center justify-between">Submission deadline <span className="text-[11px] text-emerald-300">Required</span></span><div className="relative"><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" /><input required type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={`${inputClass} pl-10`} /></div></label>
                </div>
              </section>

              <section className="rounded-3xl border border-white/[0.1] bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
                <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200 ring-1 ring-inset ring-emerald-300/15"><FileCheck2 aria-hidden="true" className="h-5 w-5" /></div><div><h2 className="text-base font-semibold text-white">Source document</h2><p className="mt-1 text-xs leading-5 text-slate-500">Your tender PDF becomes the auditable source of truth.</p></div></div><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-300/[0.07] px-2.5 py-1 text-[10px] font-medium text-emerald-200"><LockKeyhole aria-hidden="true" className="h-3 w-3" />Encrypted storage</span></div>
                <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); chooseFile(event.dataTransfer.files?.[0]); }} className={`mt-7 flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition ${isDragging ? "border-emerald-300 bg-emerald-300/10" : file ? "border-emerald-300/35 bg-emerald-300/[0.035]" : "border-white/[0.17] bg-[#090d16]/50 hover:border-emerald-300/50 hover:bg-emerald-300/[0.025]"}`}>
                  <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileChange} />
                  {file ? <div className="w-full max-w-md"><div className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-3.5 text-left"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300/15 text-emerald-200"><Check aria-hidden="true" className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{file.name}</p><p className="mt-1 text-xs text-emerald-100/55">{(file.size / 1024 / 1024).toFixed(2)} MB · ready for secure upload</p></div><button type="button" aria-label="Remove tender PDF" onClick={(event) => { event.stopPropagation(); setFile(null); }} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/10 hover:text-white"><X aria-hidden="true" className="h-4 w-4" /></button></div><p className="mt-3 text-xs text-slate-500">Tap to replace this document</p></div> : <><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200 ring-1 ring-inset ring-emerald-300/20"><UploadCloud aria-hidden="true" className="h-6 w-6" /></div><p className="mt-4 text-sm font-medium text-white">Drop the tender PDF here</p><p className="mt-1 text-xs text-slate-500">or tap to browse your device · PDF up to 25 MB</p></>}
                </div>
              </section>

              {error && <p role="alert" className="rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm leading-6 text-red-100">{error}</p>}
              <button type="submit" disabled={isSubmitting || !title.trim() || !deadline} className="group flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 text-sm font-semibold text-[#07100d] shadow-xl shadow-emerald-950/30 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40">{isSubmitting ? "Securing and reading tender…" : "Create tender workspace"}<ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></button>
              <p className="text-center text-xs leading-5 text-slate-600">Your source file remains private to this organisation. You can start without a PDF and add evidence later.</p>
            </form>

            <aside className="space-y-4">
              <section className="rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.045] p-5 shadow-2xl shadow-black/10"><div className="flex items-center gap-2 text-emerald-200"><ShieldCheck aria-hidden="true" className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-[0.18em]">Evidence assurance</p></div><h2 className="mt-4 text-lg font-semibold tracking-tight text-white">A cleaner route from tender to proof.</h2><p className="mt-2 text-sm leading-6 text-slate-400">BidShield keeps every extracted requirement tied to its original page, so your team can review before trusting an answer.</p><div className="mt-5 space-y-3 border-t border-white/10 pt-5"><div className="flex gap-3 text-xs text-slate-400"><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />Page-aware source citations</div><div className="flex gap-3 text-xs text-slate-400"><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />Organisation-isolated storage</div><div className="flex gap-3 text-xs text-slate-400"><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />Human review before verification</div></div></section>
              <section className="rounded-3xl border border-white/[0.1] bg-white/[0.025] p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">After upload</p><span className="text-[10px] text-slate-600">AUTOMATED</span></div><div className="mt-5 space-y-4"><div className="flex items-start gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-[11px] font-bold text-[#07100d]">1</span><div><p className="text-sm font-medium text-slate-200">Source secured</p><p className="mt-1 text-xs leading-5 text-slate-600">Private file path and integrity hash.</p></div></div><div className="ml-3 h-4 border-l border-dashed border-white/15" /><div className="flex items-start gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-[11px] text-slate-400">2</span><div><p className="text-sm font-medium text-slate-400">Pages extracted</p><p className="mt-1 text-xs leading-5 text-slate-600">Text and citations prepared for review.</p></div></div><div className="ml-3 h-4 border-l border-dashed border-white/15" /><div className="flex items-start gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-[11px] text-slate-400">3</span><div><p className="text-sm font-medium text-slate-400">Requirements mapped</p><p className="mt-1 text-xs leading-5 text-slate-600">Ready for evidence-grounded analysis.</p></div></div></div></section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
