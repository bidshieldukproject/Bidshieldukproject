"use client";

import { AlertCircle, CheckCircle2, FileSearch, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";

type Fact = {
  factType: string;
  label: string;
  value: string | null;
  numericValue: number | null;
  currency: string | null;
  dateValue: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  confidence: number;
  validationIssues: string[];
};

type FactResponse = { model: string; policyVersion: string; counts: { extracted: number; needsReview: number }; facts: Fact[]; error?: string; detail?: string };

export function EvidenceFactPanel({ evidenceId, documentName }: { evidenceId: string; documentName: string }) {
  const [result, setResult] = useState<FactResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function extractFacts() {
    setIsRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/evidence/${evidenceId}/extract-facts`, { method: "POST" });
      const payload = (await response.json()) as FactResponse;
      if (!response.ok) throw new Error(payload.detail ?? payload.error ?? "Fact extraction could not be completed.");
      setResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Fact extraction could not be completed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="border-t border-white/[0.07] bg-black/10 px-5 py-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-medium text-slate-300">Evidence facts</p><p className="mt-1 text-[11px] text-slate-600">Gemini extraction for {documentName}</p></div><button type="button" onClick={extractFacts} disabled={isRunning} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] px-3 text-xs font-medium text-emerald-200 transition hover:bg-emerald-300/[0.12] disabled:cursor-wait disabled:opacity-60">{isRunning ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <FileSearch aria-hidden="true" className="h-3.5 w-3.5" />}{isRunning ? "Extracting…" : "Extract facts"}</button></div>
      {error && <div role="alert" className="mt-3 flex gap-2 rounded-lg border border-red-300/15 bg-red-300/[0.05] p-3 text-xs leading-5 text-red-100"><AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />{error}</div>}
      {result && <div className="mt-4 space-y-3"><div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500"><span>{result.counts.extracted} facts</span><span className="text-amber-200">{result.counts.needsReview} need review</span><span>Gemini {result.model}</span><span>Policy v{result.policyVersion}</span></div>{result.facts.map((fact, index) => { const review = fact.validationIssues.length > 0; const renderedValue = fact.dateValue ?? (fact.numericValue !== null ? `${fact.currency ? `${fact.currency} ` : ""}${fact.numericValue}` : fact.value ?? "Unknown"); return <article key={`${fact.label}-${index}`} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-white">{fact.label}</p><p className="mt-1 text-sm text-slate-300">{renderedValue}</p></div><span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] ring-1 ring-inset ${review ? "bg-amber-300/10 text-amber-200 ring-amber-300/20" : "bg-emerald-300/10 text-emerald-200 ring-emerald-300/20"}`}>{review ? <ShieldAlert aria-hidden="true" className="h-3 w-3" /> : <CheckCircle2 aria-hidden="true" className="h-3 w-3" />}{review ? "Review" : "Cited"}</span></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{fact.sourcePage ? `Page ${fact.sourcePage}` : "Page missing"}{fact.sourceExcerpt ? ` · “${fact.sourceExcerpt}”` : " · Exact excerpt missing"}</p>{review && <p className="mt-2 text-[11px] leading-5 text-amber-100/75">{fact.validationIssues.join(" ")}</p>}</article>; })}</div>}
    </div>
  );
}
