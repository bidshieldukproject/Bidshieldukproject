"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileText,
  Info,
  LockKeyhole,
  SearchCheck,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

type ClaimStatus = "SUPPORTED" | "PARTIALLY SUPPORTED" | "UNVERIFIED" | "NEEDS REVIEW";

type Claim = {
  id: number;
  text: string;
  status: ClaimStatus;
  requirement: string;
  document: string;
  page: string;
  expiry: string;
  reasoning: string;
};

const claims: Claim[] = [
  {
    id: 1,
    text: "We maintain ISO 9001 certification across all operational sites.",
    status: "SUPPORTED",
    requirement: "Quality management certification",
    document: "ISO 9001 Certificate.pdf",
    page: "Page 1 of 3",
    expiry: "14 Mar 2027 · Valid",
    reasoning: "The certificate number and issuer match the supplier evidence record. The expiry date is in the future and the source document is available."
  },
  {
    id: 2,
    text: "Our mobilisation team has delivered 37 healthcare transitions.",
    status: "UNVERIFIED",
    requirement: "Relevant mobilisation experience",
    document: "Healthcare Case Studies.pdf",
    page: "Pages 4–8",
    expiry: "Not applicable",
    reasoning: "Relevant healthcare case studies were found, but the exact number 37 is not stated or deterministically derivable from the cited evidence."
  },
  {
    id: 3,
    text: "We will provide 24/7 response coverage throughout the contract.",
    status: "PARTIALLY SUPPORTED",
    requirement: "Service continuity and response model",
    document: "Service Delivery Policy.docx",
    page: "Page 7 of 14",
    expiry: "02 Sep 2027 · Valid",
    reasoning: "The policy describes an on-call escalation model, but it does not explicitly evidence continuous 24/7 coverage for this contract."
  }
];

const statusStyles: Record<ClaimStatus, { text: string; badge: string; icon: typeof Check }> = {
  SUPPORTED: { text: "text-emerald-300 underline decoration-emerald-400/70 decoration-2 underline-offset-4", badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20", icon: Check },
  "PARTIALLY SUPPORTED": { text: "text-amber-200 underline decoration-amber-400/70 decoration-2 underline-offset-4", badge: "bg-amber-400/10 text-amber-300 ring-amber-400/20", icon: Info },
  UNVERIFIED: { text: "text-red-300 underline decoration-red-400/80 decoration-2 underline-offset-4", badge: "bg-red-400/10 text-red-300 ring-red-400/20", icon: AlertTriangle },
  "NEEDS REVIEW": { text: "text-sky-300 underline decoration-sky-400/70 decoration-2 underline-offset-4", badge: "bg-sky-400/10 text-sky-300 ring-sky-400/20", icon: Info }
};

export default function ScannerPage() {
  const [selectedClaimId, setSelectedClaimId] = useState(1);
  const selectedClaim = claims.find((claim) => claim.id === selectedClaimId) ?? claims[0];
  const selectedStatus = statusStyles[selectedClaim.status];
  const SelectedIcon = selectedStatus.icon;

  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-slate-200">
      <Sidebar />
      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400">Shield Scanner</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">Verify every claim against evidence.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Paste a drafted response, then inspect the deterministic evidence trail before it reaches the submission gate.</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-xs text-emerald-300"><LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" /> Evidence-grounded verification</div>
          </header>

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100"><ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p><span className="font-semibold">Unsupported claims are flagged, never silently accepted.</span> Semantic matching is a retrieval signal—not proof of factual truth.</p></div>

          <div className="mt-6 grid min-h-[650px] gap-5 xl:grid-cols-2">
            <section className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/10 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Draft response</h2><p className="mt-1 text-xs text-slate-500">Birmingham Facilities Management · Methodology response</p></div><span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">1,184 / 1,500 words</span></div>
              <div className="border-b border-white/10 px-5 py-3"><div className="flex items-center gap-1 text-xs text-slate-500"><button className="rounded px-2 py-1 font-semibold text-slate-300 hover:bg-white/[0.06]">B</button><button className="rounded px-2 py-1 italic text-slate-300 hover:bg-white/[0.06]">I</button><span className="mx-1 h-4 w-px bg-white/10" /><span className="rounded px-2 py-1">Body</span><span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-emerald-400">Scanner active</span></div></div>
              <div className="flex-1 p-5">
                <textarea
                  aria-label="Draft bid response"
                  defaultValue={`Our mobilisation approach is designed to provide a controlled transition with clear governance from day one. We maintain ISO 9001 certification across all operational sites.\n\nOur mobilisation team has delivered 37 healthcare transitions. We will provide 24/7 response coverage throughout the contract, supported by an experienced escalation team.\n\nThe programme will be managed through weekly readiness reviews, a live risk register, and named workstream owners. Evidence and decisions will be recorded against each buyer requirement.`}
                  className="h-56 w-full resize-none border-0 bg-transparent text-sm leading-7 text-slate-300 outline-none placeholder:text-slate-600"
                />
                <div className="mt-6 rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Detected claims</p><span className="text-[10px] text-slate-600">Select to inspect evidence</span></div><div className="mt-3 space-y-2">{claims.map((claim) => { const styles = statusStyles[claim.status]; const Icon = styles.icon; const isSelected = selectedClaim.id === claim.id; return <button key={claim.id} onClick={() => setSelectedClaimId(claim.id)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${isSelected ? "border-emerald-400/30 bg-emerald-400/[0.06]" : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${styles.badge.split(" ").slice(0, 2).join(" ")}`}><Icon aria-hidden="true" className="h-3 w-3" /></span><span className="min-w-0 flex-1"><span className={`block text-sm leading-6 ${styles.text}`}>{claim.text}</span><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] ring-1 ring-inset ${styles.badge}`}>{claim.status}</span></span><ChevronRight aria-hidden="true" className={`mt-1 h-4 w-4 shrink-0 ${isSelected ? "text-emerald-300" : "text-slate-700"}`} /></button>; })}</div></div>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-5 py-4"><p className="text-xs text-slate-500">3 claims detected · 1 requires immediate review</p><button className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-semibold text-[#07100d] hover:bg-emerald-300"><SearchCheck aria-hidden="true" className="h-3.5 w-3.5" /> Run verification</button></div>
            </section>

            <section className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/10 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Evidence verification</h2><p className="mt-1 text-xs text-slate-500">Requirement → Response → Evidence</p></div><span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Deterministic check</span></div>
              <div className="flex-1 p-5">
                <div className={`rounded-2xl border p-5 ${selectedClaim.status === "UNVERIFIED" ? "border-red-400/30 bg-red-400/[0.06]" : selectedClaim.status === "SUPPORTED" ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-amber-400/20 bg-amber-400/[0.04]"}`}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected claim</p><p className={`mt-3 text-lg font-medium leading-8 ${selectedStatus.text}`}>“{selectedClaim.text}”</p></div><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selectedStatus.badge.split(" ").slice(0, 2).join(" ")}`}><SelectedIcon aria-hidden="true" className="h-5 w-5" /></div></div><div className={`mt-5 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.08em] ring-1 ring-inset ${selectedStatus.badge}`}>{selectedClaim.status}</div></div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Matched requirement</p><p className="mt-2 text-sm font-medium text-white">{selectedClaim.requirement}</p></div><div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Evidence document</p><p className="mt-2 flex items-center gap-2 text-sm font-medium text-white"><FileText aria-hidden="true" className="h-4 w-4 text-emerald-300" />{selectedClaim.document}</p></div><div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Source citation</p><p className="mt-2 flex items-center gap-2 text-sm font-medium text-white"><FileCheck2 aria-hidden="true" className="h-4 w-4 text-sky-300" />{selectedClaim.page}</p></div><div className="rounded-xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Expiry log</p><p className="mt-2 text-sm font-medium text-white">{selectedClaim.expiry}</p></div></div>
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center gap-2"><Sparkles aria-hidden="true" className="h-4 w-4 text-emerald-300" /><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Verification reasoning</p></div><p className="mt-4 text-sm leading-7 text-slate-400">{selectedClaim.reasoning}</p>{selectedClaim.status === "UNVERIFIED" && <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-xs leading-5 text-red-200"><AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />Hallucination risk: revise or attach precise evidence before treating this claim as supported.</div>}</div>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-5 py-4"><div className="flex items-center gap-2 text-xs text-slate-500"><Info aria-hidden="true" className="h-3.5 w-3.5" />Human review remains required for ambiguous evidence.</div><button className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.06]"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" /> Mark reviewed</button></div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
