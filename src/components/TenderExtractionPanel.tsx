"use client";

import { AlertCircle, CheckCircle2, FileSearch, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";

type RequirementResult = {
  id: string;
  title: string;
  type: string;
  mandatory: boolean;
  source_page: number | null;
  status: string;
  confidence: number | null;
  provenance_metadata?: {
    deterministic_issues?: string[];
    source_excerpt?: string | null;
  };
};

type ExtractionResponse = {
  extractionRunId: string;
  model: string;
  policyVersion: string;
  counts: { extracted: number; accepted: number; needsReview: number };
  requirements: RequirementResult[];
};

export function TenderExtractionPanel({ tenderId, tenderName }: { tenderId: string | null; tenderName?: string }) {
  const [result, setResult] = useState<ExtractionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runExtraction() {
    if (!tenderId) return;
    setError(null);
    setResult(null);
    setIsRunning(true);

    try {
      const response = await fetch(`/api/tenders/${tenderId}/extract`, { method: "POST" });
      const payload = (await response.json()) as ExtractionResponse & { error?: string; detail?: string };
      if (!response.ok) throw new Error(payload.detail || payload.error || "Extraction could not be completed.");
      setResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Extraction could not be completed.");
    } finally {
      setIsRunning(false);
    }
  }

  if (!tenderId) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/10 backdrop-blur-xl">
        <div className="flex items-center gap-3"><FileSearch aria-hidden="true" className="h-5 w-5 text-emerald-300" /><h2 className="text-base font-semibold text-white">Requirement intelligence</h2></div>
        <p className="mt-3 text-sm leading-6 text-slate-500">Create a tender with a readable source PDF to run evidence-grounded requirement extraction.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-300/15 bg-[linear-gradient(135deg,rgba(52,211,153,0.08),rgba(255,255,255,0.03))] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200 ring-1 ring-inset ring-emerald-300/20"><Sparkles aria-hidden="true" className="h-5 w-5" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Evidence map</p><h2 className="mt-2 text-lg font-semibold text-white">Read this tender with proof attached.</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">{tenderName ? `${tenderName} · ` : ""}Gemini extracts requirements; deterministic gates verify citations before anything is marked ready.</p></div></div>
        <button type="button" onClick={runExtraction} disabled={isRunning} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-[#07100d] shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-60">{isRunning ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <FileSearch aria-hidden="true" className="h-4 w-4" />}{isRunning ? "Reading source…" : "Run verification"}</button>
      </div>

      {error && <div role="alert" className="mt-5 flex gap-3 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm leading-6 text-red-100"><AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" /><div><p className="font-medium">Verification could not run</p><p className="mt-1 text-red-100/70">{error}</p></div></div>}

      {result && <div className="mt-6 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/15 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Extracted</p><p className="mt-2 text-2xl font-semibold text-white">{result.counts.extracted}</p></div>
          <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/70">Citations accepted</p><p className="mt-2 text-2xl font-semibold text-emerald-200">{result.counts.accepted}</p></div>
          <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-amber-200/70">Needs review</p><p className="mt-2 text-2xl font-semibold text-amber-200">{result.counts.needsReview}</p></div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1.5"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />Source-cited output</span><span>Model: {result.model}</span><span>Policy: v{result.policyVersion}</span><span>Run: {result.extractionRunId.slice(0, 8)}</span></div>

        <div className="overflow-hidden rounded-xl border border-white/10"><div className="border-b border-white/10 bg-black/10 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Requirement register</p></div><div className="divide-y divide-white/[0.07]">{result.requirements.map((requirement) => { const issues = requirement.provenance_metadata?.deterministic_issues ?? []; const review = requirement.status === "NEEDS_REVIEW"; return <article key={requirement.id} className="p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium text-white">{requirement.title}</h3><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-400">{requirement.type}</span>{requirement.mandatory && <span className="rounded-full bg-sky-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-sky-200">Mandatory</span>}</div><p className="mt-2 text-xs leading-5 text-slate-500">{requirement.source_page ? `Page ${requirement.source_page}` : "Page citation missing"}{requirement.provenance_metadata?.source_excerpt ? ` · “${requirement.provenance_metadata.source_excerpt}”` : " · Exact excerpt missing"}</p></div><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${review ? "bg-amber-300/10 text-amber-200 ring-amber-300/20" : "bg-emerald-300/10 text-emerald-200 ring-emerald-300/20"}`}>{review ? <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" /> : <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />}{review ? "Needs review" : "Citation accepted"}</span></div>{issues.length > 0 && <p className="mt-3 rounded-lg bg-amber-300/[0.06] px-3 py-2 text-xs leading-5 text-amber-100/80">{issues.join(" ")}</p>}</article>; })}</div></div>
      </div>}
    </section>
  );
}
