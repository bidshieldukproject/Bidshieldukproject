"use client";

import { AlertCircle, CheckCircle2, ClipboardCheck, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";

type QaCheck = { checkType: string; status: string; severity: string; title: string; detail: string; entityType: string | null; entityId: string | null };
type QaResponse = { readiness?: { status: string; checks: QaCheck[]; counts: { total: number; pass: number; blocked: number; needsReview: number; unknown: number } }; error?: string; detail?: string };

const statusStyle: Record<string, string> = { READY: "bg-emerald-300/10 text-emerald-200 ring-emerald-300/20", NOT_READY: "bg-red-300/10 text-red-200 ring-red-300/20", NEEDS_REVIEW: "bg-amber-300/10 text-amber-200 ring-amber-300/20", UNKNOWN: "bg-slate-300/10 text-slate-200 ring-slate-300/20" };

export function FinalQaPanel({ tenderId, tenderName }: { tenderId: string | null; tenderName?: string }) {
  const [result, setResult] = useState<QaResponse["readiness"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function runQa() {
    if (!tenderId) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/tenders/${tenderId}/final-qa`, { method: "POST" });
      const payload = (await response.json()) as QaResponse;
      if (!response.ok || !payload.readiness) throw new Error(payload.detail ?? payload.error ?? "Final QA could not be completed.");
      setResult(payload.readiness);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Final QA could not be completed.");
    } finally {
      setRunning(false);
    }
  }

  if (!tenderId) return null;
  return <section className="rounded-2xl border border-emerald-300/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.07),rgba(255,255,255,0.03))] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-6">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10 text-emerald-200 ring-1 ring-inset ring-emerald-300/20"><ClipboardCheck className="h-5 w-5" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Final bid QA</p><h2 className="mt-2 text-lg font-semibold text-white">Submission gate for {tenderName ?? "selected tender"}.</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">Checks requirements, current evidence, response claims, deterministic verification, and reviewer decisions before marking a tender ready.</p></div></div><button type="button" onClick={runQa} disabled={running} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-[#07100d] shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-60">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}{running ? "Running final QA…" : "Run final QA"}</button></div>
    {error && <div role="alert" className="mt-5 flex gap-3 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" /><span>{error}</span></div>}
    {result && <div className="mt-6 space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Defined checks result</p><span className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${statusStyle[result.status] ?? statusStyle.UNKNOWN}`}>{result.status === "READY" ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}{result.status === "READY" ? "Submission ready" : result.status.replaceAll("_", " ")}</span></div><div className="grid grid-cols-4 gap-2 text-center text-xs"><div className="rounded-lg bg-black/15 px-3 py-2"><p className="text-lg font-semibold text-emerald-200">{result.counts.pass}</p><p className="text-slate-500">Pass</p></div><div className="rounded-lg bg-black/15 px-3 py-2"><p className="text-lg font-semibold text-red-200">{result.counts.blocked}</p><p className="text-slate-500">Blocked</p></div><div className="rounded-lg bg-black/15 px-3 py-2"><p className="text-lg font-semibold text-amber-200">{result.counts.needsReview}</p><p className="text-slate-500">Review</p></div><div className="rounded-lg bg-black/15 px-3 py-2"><p className="text-lg font-semibold text-slate-200">{result.counts.unknown}</p><p className="text-slate-500">Unknown</p></div></div></div><div className="space-y-2">{result.checks.map((check, index) => <div key={`${check.checkType}-${check.entityId ?? "tender"}-${index}`} className="flex gap-3 rounded-lg border border-white/[0.08] bg-black/10 p-3"><span className={`mt-0.5 text-sm ${check.status === "PASS" ? "text-emerald-200" : check.status === "BLOCKED" ? "text-red-200" : check.status === "NEEDS_REVIEW" ? "text-amber-200" : "text-slate-300"}`}>{check.status === "PASS" ? "✓" : check.status === "BLOCKED" ? "✕" : "?"}</span><div className="min-w-0"><p className="text-xs font-medium text-white">{check.title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{check.detail}</p></div><span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.12em] text-slate-600">{check.checkType.replaceAll("_", " ")}</span></div>)}</div><p className="border-t border-white/10 pt-4 text-[11px] leading-5 text-slate-500">“Submission ready” means BidShield’s defined checks have passed. It is not a legal guarantee or a guarantee of contract award.</p></div>}
  </section>;
}
