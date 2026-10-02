"use client";

import { ChangeEvent, DragEvent, Fragment, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  CheckCircle2,
  CloudUpload,
  FileArchive,
  FileCheck2,
  FileText,
  FolderOpen,
  LockKeyhole,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  X
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { EvidenceFactPanel } from "@/components/EvidenceFactPanel";
import { supabase } from "@/lib/supabase/client";

const EVIDENCE_BUCKET = "evidence-vault";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const categoryOptions = [
  { value: "ACCREDITATIONS", label: "Accreditations" },
  { value: "INSURANCES", label: "Insurances" },
  { value: "FINANCIAL", label: "Financial records" },
  { value: "POLICIES", label: "Policy documents" },
  { value: "OTHER", label: "Other evidence" }
] as const;

const categories = [
  { label: "Accreditations", count: "18 documents", icon: FileCheck2, toneClass: "bg-emerald-400/10 text-emerald-300" },
  { label: "Insurances", count: "09 documents", icon: ShieldAlert, toneClass: "bg-amber-400/10 text-amber-300" },
  { label: "Financial Records", count: "12 documents", icon: FileArchive, toneClass: "bg-sky-400/10 text-sky-300" },
  { label: "Policy Docs", count: "24 documents", icon: FileText, toneClass: "bg-violet-400/10 text-violet-300" }
] as const;

type EvidenceDocument = { id: string; name: string; type: string; category: string; expiry: string; status: "Valid" | "Expiring" | "Expired" };
type AutomaticMatchingSummary = { matchedTenders: number; skippedTenders: number; failedTenders: number; facts: number; pages: number };
type BatchFileState = { file: File; status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED"; message?: string };

function formatExpiry(expiryDate: string | null) {
  if (!expiryDate) return "No expiry";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${expiryDate}T00:00:00Z`));
}

function getStatus(status: string, expiryDate: string | null): EvidenceDocument["status"] {
  if (status === "EXPIRED" || (expiryDate && new Date(`${expiryDate}T23:59:59Z`) < new Date())) return "Expired";
  if (status === "EXPIRING") return "Expiring";
  return "Valid";
}

const statusStyles: Record<string, string> = {
  Valid: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  Expiring: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  Expired: "bg-red-400/10 text-red-300 ring-red-400/20"
};

export default function VaultPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<BatchFileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [category, setCategory] = useState<(typeof categoryOptions)[number]["value"]>("OTHER");

  const loadDocuments = async () => {
    const { data, error } = await supabase.from("evidence_vault").select("id, document_name, document_type, category, expiry_date, status").order("created_at", { ascending: false }).limit(100);
    if (error) {
      setUploadMessage(`Evidence register could not be loaded: ${error.message}`);
      return;
    }
    setDocuments((data ?? []).map((document) => ({ id: document.id, name: document.document_name, type: document.document_type, category: document.category, expiry: formatExpiry(document.expiry_date), status: getStatus(document.status, document.expiry_date) })));
  };

  useEffect(() => { void loadDocuments(); }, []);

  const chooseFiles = (files?: File[]) => {
    if (!files || files.length === 0) return;
    if (files.length > 10) {
      setUploadMessage("Select up to 10 evidence PDFs per batch.");
      return;
    }
    const invalid = files.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
    if (invalid) {
      setUploadMessage(`${invalid.name} is not a PDF. Remove it and try again.`);
      return;
    }
    const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setUploadMessage(`${oversized.name} is larger than 25 MB.`);
      return;
    }
    setSelectedFiles(files.map((file) => ({ file, status: "QUEUED" })));
    setUploadMessage(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    chooseFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    chooseFiles(Array.from(event.target.files ?? []));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadMessage(null);
    const summary = { uploaded: 0, failed: 0, matchedTenders: 0, skippedTenders: 0, failedTenders: 0, facts: 0, pages: 0 };
    const updateFileStatus = (index: number, status: BatchFileState["status"], message?: string) => {
      setSelectedFiles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status, message } : item));
    };

    for (const [index, item] of selectedFiles.entries()) {
      updateFileStatus(index, "PROCESSING");
      try {
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("category", category);
      const uploadResponse = await fetch("/api/evidence/upload", { method: "POST", body: formData });
      const uploadPayload = (await uploadResponse.json()) as { evidenceId?: string; error?: string };
      if (!uploadResponse.ok || !uploadPayload.evidenceId) throw new Error(uploadPayload.error ?? "Upload could not be completed.");

      const processResponse = await fetch(`/api/evidence/${uploadPayload.evidenceId}/process`, { method: "POST" });
      const processPayload = (await processResponse.json()) as { pageCount?: number; status?: string; error?: string; detail?: string };
      if (!processResponse.ok) throw new Error(processPayload.detail ?? processPayload.error ?? "Evidence processing could not be completed.");

      if (processPayload.status !== "READY") {
        throw new Error("Uploaded, but no readable text was detected. OCR review is required before automatic matching.");
      }

      const factsResponse = await fetch(`/api/evidence/${uploadPayload.evidenceId}/extract-facts`, { method: "POST" });
      const factsPayload = (await factsResponse.json()) as { counts?: { extracted: number; needsReview: number }; error?: string; detail?: string };
      if (!factsResponse.ok || !factsPayload.counts) throw new Error(factsPayload.detail ?? factsPayload.error ?? "Evidence facts could not be extracted.");

      const { data: tenders, error: tendersError } = await supabase.from("tenders").select("id").order("created_at", { ascending: false }).limit(100);
      if (tendersError) throw new Error(`Evidence facts saved, but tender matching could not start: ${tendersError.message}`);

      summary.facts += factsPayload.counts.extracted;
      summary.pages += processPayload.pageCount ?? 0;
      for (const tender of tenders ?? []) {
        const matchingResponse = await fetch(`/api/tenders/${tender.id}/match-evidence`, { method: "POST" });
        if (matchingResponse.ok) summary.matchedTenders += 1;
        else if (matchingResponse.status === 422) summary.skippedTenders += 1;
        else summary.failedTenders += 1;
      }
      summary.uploaded += 1;
      updateFileStatus(index, "COMPLETED", `${processPayload.pageCount ?? 0} pages · ${factsPayload.counts.extracted} facts`);
      } catch (uploadError) {
        summary.failed += 1;
        updateFileStatus(index, "FAILED", uploadError instanceof Error ? uploadError.message : "Evidence processing failed.");
      }
    }
    setUploadMessage(`${summary.uploaded} of ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} completed. Read ${summary.pages} pages, extracted ${summary.facts} cited facts, and matched against ${summary.matchedTenders} tender run${summary.matchedTenders === 1 ? "" : "s"}.${summary.skippedTenders > 0 ? ` ${summary.skippedTenders} tender run${summary.skippedTenders === 1 ? "" : "s"} skipped because requirements are not ready.` : ""}${summary.failedTenders > 0 ? ` ${summary.failedTenders} matching run${summary.failedTenders === 1 ? "" : "s"} need retry.` : ""}${summary.failed > 0 ? ` ${summary.failed} file${summary.failed === 1 ? "" : "s"} failed and remain available for retry.` : ""}`);
    await loadDocuments();
    setIsUploading(false);
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-slate-200">
      <Sidebar />
      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-8 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400">Verified Evidence Vault</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">Evidence that stands behind every claim.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Store, classify, and monitor the supplier documents that make your tender responses verifiable.</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400">
              <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400" />
              Organisation-isolated storage
            </div>
          </header>

          <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`group flex min-h-[270px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 text-center transition-all ${isDragging ? "border-emerald-300 bg-emerald-400/10" : "border-white/20 bg-white/[0.035] hover:border-emerald-400/60 hover:bg-emerald-400/[0.04]"}`}
            >
              <input ref={inputRef} type="file" multiple className="hidden" accept="application/pdf,.pdf" onChange={handleFileChange} />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20 transition group-hover:scale-105">
                <CloudUpload aria-hidden="true" className="h-7 w-7" />
                <Sparkles aria-hidden="true" className="absolute -right-2 -top-2 h-4 w-4 text-emerald-200" />
              </div>
              <h2 className="mt-6 text-lg font-semibold text-white">Drop evidence files here</h2>
              <p className="mt-2 text-sm text-slate-400">or click to browse from your device</p>
              <p className="mt-4 text-xs text-slate-600">PDF, DOCX, XLSX up to 25 MB · metadata review required</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300"><UploadCloud aria-hidden="true" className="h-5 w-5" /></div>
                <div><h2 className="text-sm font-semibold text-white">Metadata intake</h2><p className="mt-1 text-xs text-slate-500">Secure storage pre-wired</p></div>
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4">
                {selectedFiles.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><p className="text-sm font-medium text-white">{selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected</p><button aria-label="Remove selected files" onClick={() => setSelectedFiles([])} className="text-slate-500 hover:text-white"><X aria-hidden="true" className="h-4 w-4" /></button></div>
                    <div className="max-h-40 space-y-2 overflow-y-auto">{selectedFiles.map((item) => <div key={`${item.file.name}-${item.file.lastModified}`} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2"><FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" /><div className="min-w-0 flex-1"><p className="truncate text-xs text-white">{item.file.name}</p><p className="text-[10px] text-slate-500">{(item.file.size / 1024 / 1024).toFixed(2)} MB · {item.status === "QUEUED" ? "Queued" : item.status === "PROCESSING" ? "Processing…" : item.status === "COMPLETED" ? item.message : `Failed: ${item.message}`}</p></div></div>)}</div>
                    <p className="text-[11px] text-slate-500">Category: {categoryOptions.find((option) => option.value === category)?.label}</p>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-slate-400">Select a document to prepare its storage path, content type, and review status.</p>
                )}
              </div>
              <label className="mt-4 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Evidence category<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0B0F19] px-3 text-sm normal-case tracking-normal text-slate-200 outline-none focus:border-emerald-300/50"><option value="ACCREDITATIONS">Accreditations</option><option value="INSURANCES">Insurances</option><option value="FINANCIAL">Financial records</option><option value="POLICIES">Policy documents</option><option value="OTHER">Other evidence</option></select></label>
              <button disabled={selectedFiles.length === 0 || isUploading} onClick={handleUpload} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-[#07100d] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
                <UploadCloud aria-hidden="true" className="h-4 w-4" />
                {isUploading ? "Uploading securely…" : "Upload for review"}
              </button>
              {uploadMessage && <p className="mt-3 text-center text-xs text-slate-400">{uploadMessage}</p>}
              <p className="mt-4 text-[11px] leading-5 text-slate-600">Storage bucket: <span className="font-mono text-slate-500">{EVIDENCE_BUCKET}</span>. Files are processed page by page and remain organisation-isolated.</p>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-end justify-between"><div><h2 className="text-base font-semibold text-white">Evidence directory</h2><p className="mt-1 text-xs text-slate-500">Organised by the evidence categories used in your tenders</p></div><button className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200">Manage categories <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></button></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {categories.map(({ label, icon: Icon, toneClass }) => (
                <button key={label} className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneClass}`}><Icon aria-hidden="true" className="h-5 w-5" /></div>
                  <div className="mt-5 flex items-center justify-between"><p className="text-sm font-medium text-white">{label}</p><FolderOpen aria-hidden="true" className="h-4 w-4 text-slate-600 transition group-hover:text-slate-300" /></div>
                  <p className="mt-1 text-xs text-slate-500">{documents.filter((document) => document.category.toLowerCase() === label.toLowerCase().replace("policy docs", "policies").replace("financial records", "financial")).length} documents</p>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/10 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5"><div><h2 className="text-base font-semibold text-white">Document register</h2><p className="mt-1 text-xs text-slate-500">Current verification and expiry status</p></div><Archive aria-hidden="true" className="h-5 w-5 text-slate-500" /></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-slate-500"><tr><th className="px-5 py-4 font-medium">Document name</th><th className="px-4 py-4 font-medium">Type</th><th className="px-4 py-4 font-medium">Expiry date</th><th className="px-4 py-4 font-medium">Status</th></tr></thead><tbody className="divide-y divide-white/[0.07]">{documents.map((document) => <Fragment key={document.id}><tr className="transition hover:bg-white/[0.025]"><td className="px-5 py-5"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-slate-400"><FileText aria-hidden="true" className="h-4 w-4" /></div><span className="font-medium text-white">{document.name}</span></div></td><td className="px-4 py-5 text-xs text-slate-400">{document.type}</td><td className="px-4 py-5 text-xs text-slate-400">{document.expiry}</td><td className="px-4 py-5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${statusStyles[document.status]}`}>{document.status}</span></td></tr><tr><td colSpan={4} className="p-0"><EvidenceFactPanel evidenceId={document.id} documentName={document.name} /></td></tr></Fragment>)}</tbody></table></div>
          </section>
        </div>
      </main>
    </div>
  );
}
