"use client";

import { AlertCircle, CheckCircle2, ClipboardCheck, FileSearch, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

type Check = { checkType: string; passed: boolean | null; reason: string; requirementValue: unknown; evidenceValue: unknown };
type Fact = { label: string; value: string | null; numericValue: number | null; currency: string | null; dateValue: string | null; sourcePage: number | null; sourceExcerpt: string | null };
type Match = { requirementId: string; requirementTitle: string; evidenceId: string | null; status: string; matchType: string; reasoning: string; matchedFacts: Fact[]; evidencePage: number | null; evidenceExcerpt: string | null; deterministicChecks: Check[]; candidateScore: number };
type MatchingResponse = { matchingRunId: string; tenderTitle: string; counts: Record<string, number>; matches: Match[]; error?: string; detail?: string };
type ReviewerDecision = { id: string; requirement_id: string; verification_result_id: string | null; decision: string; rationale: string; reviewer_id: string; created_at: string };
type DecisionResponse = { decisions?: ReviewerDecision[]; decision?: ReviewerDecision; systemStatus?: string; error?: string; detail?: string };

const reviewerStatuses = ["VERIFIED", "SUPPORTED", "PARTIALLY_SUPPORTED", "NEEDS_REVIEW", "UNVERIFIED", "CONTRADICTED"];
const statusStyles: Record<string, string> = {
  VERIFIED: "bg-emerald-300/10 text-emerald-200 ring-emerald-300/20",
  SUPPORTED: "bg-sky-300/10 text-sky-200 ring-sky-300/20",
  PARTIALLY_SUPPORTED: "bg-amber-300/10 text-amber-200 ring-amber-300/20",
  NEEDS_REVIEW: "bg-amber-300/10 text-amber-200 ring-amber-300/20",
  UNVERIFIED: "bg-red-300/10 text-red-200 ring-red-300/20",
  CONTRADICTED: "bg-red-300/10 text-red-200 ring-red-300/20"
};

function readableStatus(value: string) { return value.replaceAll("_", " "); }
function renderedFact(fact: Fact) { return fact.dateValue ?? (fact.numericValue !== null ? `${fact.currency ? `${fact.currency} ` : ""}${fact.numericValue}` : fact.value ?? "Unknown"); }
function decisionTime(value: string) { return new Date(value).toLocaleString(); }

export function RequirementEvidencePanel({ tenderId, tenderName }: { tenderId: string | null; tenderName?: string }) {
  const [result, setResult] = useState<MatchingResponse | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewerDecision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [reviewingRequirementId, setReviewingRequirementId] = useState<string | null>(null);
  const [reviewDecision, setReviewDecision] = useState("NEEDS_REVIEW");
  const [reviewRationale, setReviewRationale] = useState("");

  async function loadReviewHistory() {
    if (!tenderId) return;
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/tenders/${tenderId}/review-decisions`);
      const payload = (await response.json()) as DecisionResponse;
      if (!response.ok) throw new Error(payload.detail ?? payload.error ?? "Reviewer history could not be loaded.");
      setReviewHistory(payload.decisions ?? []);
    } catch (requestError) {
      setReviewError(requestError instanceof Error ? requestError.message : "Reviewer history could not be loaded.");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  useEffect(() => {
    setResult(null);
    setReviewHistory([]);
    void loadReviewHistory();
  }, [tenderId]);

  async function runMatching() {
    if (!tenderId) return;
    setIsRunning(true);
    setError(null);
    setReviewError(null);
    try {
      const response = await fetch(`/api/tenders/${tenderId}/match-evidence`, { method: "POST" });
      const payload = (await response.json()) as MatchingResponse;
      if (!response.ok) throw new Error(payload.detail ?? payload.error ?? "Evidence matching could not be completed.");
      setResult(payload);
      await loadReviewHistory();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Evidence matching could not be completed.");
    } finally {
      setIsRunning(false);
    }
  }

  function openReviewerForm(match: Match) {
    const previous = reviewHistory.find((item) => item.requirement_id === match.requirementId);
    setReviewingRequirementId(match.requirementId);
    setReviewDecision(previous?.decision ?? match.status);
    setReviewRationale("");
    setReviewError(null);
  }

  async function recordDecision(requirementId: string) {
    if (!tenderId) return;
    setIsRecording(true);
    setReviewError(null);
    try {
      const response = await fetch(`/api/tenders/${tenderId}/review-decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId, decision: reviewDecision, rationale: reviewRationale })
      });
      const payload = (await response.json()) as DecisionResponse;
      if (!response.ok || !payload.decision) throw new Error(payload.detail ?? payload.error ?? "Reviewer decision could not be recorded.");
      setReviewHistory((current) => [payload.decision as ReviewerDecision, ...current]);
      setReviewingRequirementId(null);
      setReviewRationale("");
    } catch (requestError) {
      setReviewError(requestError instanceof Error ? requestError.message : "Reviewer decision could not be recorded.");
    } finally {
      setIsRecording(false);
    }
  }

  if (!tenderId) return null;

  return (
    <section className="rounded-2xl border border-sky-300/15 bg-[linear-gradient(135deg,rgba(56,189,248,0.07),rgba(255,255,255,0.03))] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-300/10 text-sky-200 ring-1 ring-inset ring-sky-300/20"><ClipboardCheck aria-hidden="true" className="h-5 w-5" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Verification workspace</p><h2 className="mt-2 text-lg font-semibold text-white">Match every requirement to proof.</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">{tenderName ? `${tenderName} · ` : ""}Deterministic checks compare extracted evidence facts. Human decisions are recorded separately and never overwrite prior history.</p></div></div>
        <button type="button" onClick={runMatching} disabled={isRunning} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-300 px-4 text-sm font-semibold text-[#07100d] shadow-lg shadow-sky-950/20 transition hover:bg-sky-200 disabled:cursor-wait disabled:opacity-60">{isRunning ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <FileSearch aria-hidden="true" className="h-4 w-4" />}{isRunning ? "Matching evidence…" : "Run evidence matching"}</button>
      </div>
      {error && <div role="alert" className="mt-5 flex gap-3 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm leading-6 text-red-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" /><div><p className="font-medium">Matching could not run</p><p className="mt-1 text-red-100/70">{error}</p></div></div>}
      {reviewError && <div role="alert" className="mt-5 flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><div><p className="font-medium">Reviewer workflow needs attention</p><p className="mt-1 text-amber-100/70">{reviewError}</p></div></div>}
      {result && <div className="mt-6 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{reviewerStatuses.map((status) => <div key={status} className="rounded-xl border border-white/10 bg-black/15 p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">{readableStatus(status)}</p><p className={`mt-2 text-2xl font-semibold ${status === "VERIFIED" ? "text-emerald-200" : status === "NEEDS_REVIEW" || status === "PARTIALLY_SUPPORTED" ? "text-amber-200" : status === "SUPPORTED" ? "text-sky-200" : "text-red-200"}`}>{result.counts[status] ?? 0}</p></div>)}</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-sky-300" />Source-backed system results</span><span>Engine: matching-v1</span><span>Run: {result.matchingRunId.slice(0, 8)}</span><span>{result.matches.length} requirements evaluated</span>{isLoadingHistory && <span>Loading reviewer history…</span>}</div>
        <div className="space-y-3">{result.matches.map((match) => {
          const latestDecision = reviewHistory.find((item) => item.requirement_id === match.requirementId);
          const isOpen = reviewingRequirementId === match.requirementId;
          return <article key={match.requirementId} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Requirement {match.requirementId.slice(0, 8)}</p><p className="mt-1 text-sm font-medium leading-6 text-white">{match.requirementTitle}</p><p className="mt-1 text-xs leading-5 text-slate-500">{match.reasoning.split(" ").slice(0, 18).join(" ")}{match.reasoning.split(" ").length > 18 ? "…" : ""}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${statusStyles[match.status] ?? statusStyles.NEEDS_REVIEW}`}><ShieldAlert className="h-3.5 w-3.5" />System: {readableStatus(match.status)}</span>{latestDecision && <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${statusStyles[latestDecision.decision] ?? statusStyles.NEEDS_REVIEW}`}><CheckCircle2 className="h-3.5 w-3.5" />Reviewed: {readableStatus(latestDecision.decision)}</span>}</div></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Evidence citation</p><p className="mt-2 text-xs text-slate-300">{match.evidenceId ? `Evidence ${match.evidenceId.slice(0, 8)} · Page ${match.evidencePage ?? "missing"}` : "No evidence document matched"}</p><p className="mt-2 text-[11px] leading-5 text-slate-500">{match.evidenceExcerpt ? `“${match.evidenceExcerpt}”` : "Exact evidence excerpt unavailable."}</p>{match.matchedFacts.length > 0 && <p className="mt-2 text-[11px] text-sky-200">Fact: {match.matchedFacts[0].label} · {renderedFact(match.matchedFacts[0])}</p>}</div><div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Deterministic checks</p><div className="mt-2 space-y-1.5">{match.deterministicChecks.map((check) => <p key={check.checkType} className={`text-[11px] leading-5 ${check.passed === true ? "text-emerald-200" : check.passed === false ? "text-red-200" : "text-amber-200"}`}>{check.passed === true ? "✓" : check.passed === false ? "✕" : "?"} {check.checkType}: {check.reason}</p>)}</div></div></div>
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">Human review</p><p className="mt-1 text-[11px] leading-5 text-slate-400">System status remains immutable. A new reviewer decision will be appended to the history.</p>{latestDecision && <p className="mt-1 text-[11px] text-amber-100/70">Latest rationale: {latestDecision.rationale}</p>}</div><button type="button" onClick={() => openReviewerForm(match)} className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-amber-200/20 px-3 text-xs font-semibold text-amber-100 transition hover:bg-amber-200/10">{latestDecision ? "Record another decision" : "Review result"}</button></div>
            {isOpen && <div className="mt-3 rounded-lg border border-sky-300/15 bg-sky-300/[0.04] p-4"><div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]"><label className="text-xs text-slate-400">Reviewer decision<select value={reviewDecision} onChange={(event) => setReviewDecision(event.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-white/10 bg-[#0B0F19] px-3 text-sm text-white outline-none focus:border-sky-300/40">{reviewerStatuses.map((status) => <option key={status} value={status}>{readableStatus(status)}</option>)}</select></label><label className="text-xs text-slate-400">Rationale required<textarea value={reviewRationale} onChange={(event) => setReviewRationale(event.target.value)} rows={3} placeholder="Explain the evidence-based reason for this decision." className="mt-2 w-full rounded-lg border border-white/10 bg-[#0B0F19] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-300/40" /></label></div><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setReviewingRequirementId(null)} className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white">Cancel</button><button type="button" onClick={() => recordDecision(match.requirementId)} disabled={isRecording || reviewRationale.trim().length < 3} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-sky-300 px-3 py-2 text-xs font-semibold text-[#07100d] transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50">{isRecording && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Record immutable decision</button></div></div>}
            {latestDecision && <div className="mt-3 border-l-2 border-emerald-300/30 pl-3 text-[11px] text-slate-500">Latest decision recorded {decisionTime(latestDecision.created_at)} · prior decisions remain preserved in the audit history.</div>}
          </article>;
        })}</div>
        <div className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Immutable reviewer history</p><p className="mt-1 text-xs text-slate-500">Append-only decisions for this tender</p></div><span className="text-xs text-slate-500">{reviewHistory.length} record{reviewHistory.length === 1 ? "" : "s"}</span></div>{reviewHistory.length > 0 ? <div className="mt-4 space-y-2">{reviewHistory.slice(0, 8).map((decision) => <div key={decision.id} className="flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] p-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-medium text-white">{readableStatus(decision.decision)} · Requirement {decision.requirement_id.slice(0, 8)}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{decision.rationale}</p></div><time className="shrink-0 text-[10px] text-slate-600">{decisionTime(decision.created_at)}</time></div>)}</div> : <p className="mt-4 text-xs leading-5 text-slate-500">No human decisions recorded yet. System results remain clearly separate from reviewer decisions.</p>}</div>
      </div>}
    </section>
  );
}
