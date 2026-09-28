"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
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
import { supabase } from "@/lib/supabase/client";

const EVIDENCE_BUCKET = "evidence-vault";

const categories = [
  { label: "Accreditations", count: "18 documents", icon: FileCheck2, toneClass: "bg-emerald-400/10 text-emerald-300" },
  { label: "Insurances", count: "09 documents", icon: ShieldAlert, toneClass: "bg-amber-400/10 text-amber-300" },
  { label: "Financial Records", count: "12 documents", icon: FileArchive, toneClass: "bg-sky-400/10 text-sky-300" },
  { label: "Policy Docs", count: "24 documents", icon: FileText, toneClass: "bg-violet-400/10 text-violet-300" }
] as const;

const documents = [
  { name: "ISO 9001 Certificate.pdf", type: "Accreditation", expiry: "14 Mar 2027", status: "Valid" },
  { name: "Public Liability Insurance.pdf", type: "Insurance", expiry: "18 Nov 2026", status: "Expiring" },
  { name: "Audited Accounts FY26.pdf", type: "Financial record", expiry: "No expiry", status: "Valid" },
  { name: "Carbon Reduction Plan.docx", type: "Policy", expiry: "02 Sep 2026", status: "Expired" }
] as const;

const statusStyles: Record<string, string> = {
  Valid: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  Expiring: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  Expired: "bg-red-400/10 text-red-300 ring-red-400/20"
};

export default function VaultPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const chooseFile = (file?: File) => {
    if (!file) return;
    setSelectedFile(file);
    setUploadMessage(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    chooseFile(event.target.files?.[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadMessage(null);
    const safeName = selectedFile.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
    const storagePath = `pending-review/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(storagePath, selectedFile, {
      cacheControl: "3600",
      contentType: selectedFile.type || "application/octet-stream",
      upsert: false
    });

    setIsUploading(false);
    setUploadMessage(error ? "Upload could not be completed. Please retry." : "Uploaded for metadata review.");
    if (!error) setSelectedFile(null);
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
              <input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileChange} />
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
                {selectedFile ? (
                  <div className="flex items-start gap-3">
                    <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm text-white">{selectedFile.name}</p><p className="mt-1 text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · pending metadata</p></div>
                    <button aria-label="Remove selected file" onClick={() => setSelectedFile(null)} className="text-slate-500 hover:text-white"><X aria-hidden="true" className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-slate-400">Select a document to prepare its storage path, content type, and review status.</p>
                )}
              </div>
              <button disabled={!selectedFile || isUploading} onClick={handleUpload} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-[#07100d] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
                <UploadCloud aria-hidden="true" className="h-4 w-4" />
                {isUploading ? "Uploading securely…" : "Upload for review"}
              </button>
              {uploadMessage && <p className="mt-3 text-center text-xs text-slate-400">{uploadMessage}</p>}
              <p className="mt-4 text-[11px] leading-5 text-slate-600">Storage bucket: <span className="font-mono text-slate-500">{EVIDENCE_BUCKET}</span>. Signed viewing URLs will be generated only after verification.</p>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-end justify-between"><div><h2 className="text-base font-semibold text-white">Evidence directory</h2><p className="mt-1 text-xs text-slate-500">Organised by the evidence categories used in your tenders</p></div><button className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200">Manage categories <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></button></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {categories.map(({ label, count, icon: Icon, toneClass }) => (
                <button key={label} className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneClass}`}><Icon aria-hidden="true" className="h-5 w-5" /></div>
                  <div className="mt-5 flex items-center justify-between"><p className="text-sm font-medium text-white">{label}</p><FolderOpen aria-hidden="true" className="h-4 w-4 text-slate-600 transition group-hover:text-slate-300" /></div>
                  <p className="mt-1 text-xs text-slate-500">{count}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/10 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5"><div><h2 className="text-base font-semibold text-white">Document register</h2><p className="mt-1 text-xs text-slate-500">Current verification and expiry status</p></div><Archive aria-hidden="true" className="h-5 w-5 text-slate-500" /></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-slate-500"><tr><th className="px-5 py-4 font-medium">Document name</th><th className="px-4 py-4 font-medium">Type</th><th className="px-4 py-4 font-medium">Expiry date</th><th className="px-4 py-4 font-medium">Status</th></tr></thead><tbody className="divide-y divide-white/[0.07]">{documents.map((document) => <tr key={document.name} className="transition hover:bg-white/[0.025]"><td className="px-5 py-5"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-slate-400"><FileText aria-hidden="true" className="h-4 w-4" /></div><span className="font-medium text-white">{document.name}</span></div></td><td className="px-4 py-5 text-xs text-slate-400">{document.type}</td><td className="px-4 py-5 text-xs text-slate-400">{document.expiry}</td><td className="px-4 py-5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${statusStyles[document.status]}`}>{document.status}</span></td></tr>)}</tbody></table></div>
          </section>
        </div>
      </main>
    </div>
  );
}
