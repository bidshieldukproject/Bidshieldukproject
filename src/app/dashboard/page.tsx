import { AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, FileWarning, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { TenderExtractionPanel } from "@/components/TenderExtractionPanel";
import { getDashboardData } from "@/lib/data/dashboard";

const metricConfig = [
  { key: "activeTenders", label: "Active tenders", detail: "Organisation workspace", icon: FileWarning, tone: "text-emerald-300" },
  { key: "requiringAction", label: "Requiring action", detail: "Open requirements or claims", icon: AlertTriangle, tone: "text-amber-300" },
  { key: "evidenceExpiring", label: "Evidence expiring", detail: "Next 30 days", icon: Clock3, tone: "text-orange-300" },
  { key: "readinessPercent", label: "Readiness checks", detail: "Deterministic checks passed", icon: ShieldCheck, tone: "text-sky-300" }
] as const;

const statusStyles: Record<string, string> = {
  Review: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  "In progress": "bg-sky-400/10 text-sky-300 ring-sky-400/20",
  "Submission ready": "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
};

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<{ tender?: string }> }) {
  const dashboard = await getDashboardData();
  const params = searchParams ? await searchParams : {};
  const selectedTenderId = params.tender ?? dashboard.tenders[0]?.id ?? null;
  const selectedTender = dashboard.tenders.find((tender) => tender.id === selectedTenderId);
  const metricValues = { ...dashboard.metrics, readinessPercent: `${dashboard.metrics.readinessPercent}%` };

  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-slate-200">
      <Sidebar />
      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-8 md:flex-row md:items-end">
            <div><p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400">Command Center</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">Submission readiness at a glance.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Live organisation-scoped tender, evidence, and claim signals from your BidShield workspace.</p></div>
            <Link href="/tenders/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#07100d] shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300"><Plus aria-hidden="true" className="h-4 w-4" />Add tender</Link>
          </header>

          {dashboard.error && <div role="alert" className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">Dashboard data could not be loaded: {dashboard.error}</div>}

          <section aria-label="Workspace metrics" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricConfig.map(({ key, label, detail, icon: Icon, tone }) => <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl"><div className="flex items-start justify-between"><p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p><Icon aria-hidden="true" className={`h-5 w-5 ${tone}`} /></div><p className="mt-5 text-3xl font-semibold tracking-tight text-white">{metricValues[key]}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>)}
          </section>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/10 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-5"><div><h2 className="text-base font-semibold text-white">Active tenders</h2><p className="mt-1 text-xs text-slate-500">Live requirement and evidence coverage</p></div><button className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200">View all <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></button></div>
              {dashboard.tenders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-slate-500"><tr><th className="px-5 py-4 font-medium">Tender</th><th className="px-4 py-4 font-medium">Deadline</th><th className="px-4 py-4 font-medium">Requirements</th><th className="px-4 py-4 font-medium">Evidence</th><th className="px-4 py-4 font-medium">Status</th></tr></thead><tbody className="divide-y divide-white/[0.07]">{dashboard.tenders.map((tender) => <tr key={tender.id} className={`transition hover:bg-white/[0.025] ${selectedTenderId === tender.id ? "bg-emerald-300/[0.035]" : ""}`}><td className="px-5 py-5"><Link href={`/dashboard?tender=${tender.id}`} className="block"><p className="font-medium text-white hover:text-emerald-200">{tender.name}</p><p className="mt-1 text-xs text-slate-500">{tender.buyer}</p><p className="mt-2 text-xs text-amber-300">{tender.issues}</p></Link></td><td className="px-4 py-5 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />{tender.deadline}</span></td><td className="px-4 py-5 text-xs text-slate-300">{tender.requirements}</td><td className="px-4 py-5 text-xs text-slate-300">{tender.evidence}</td><td className="px-4 py-5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${statusStyles[tender.status] ?? statusStyles["In progress"]}`}>{tender.status}</span></td></tr>)}</tbody></table></div> : <div className="px-6 py-16 text-center"><ShieldCheck aria-hidden="true" className="mx-auto h-9 w-9 text-slate-600" /><h3 className="mt-4 text-sm font-semibold text-white">No tenders yet</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Create your first tender to start mapping requirements, evidence, and submission readiness.</p></div>}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-white">Attention needed</h2><p className="mt-1 text-xs text-slate-500">Derived from live records</p></div><AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-300" /></div>{dashboard.alerts.length ? <div className="mt-6 space-y-5">{dashboard.alerts.map((alert) => <div key={alert.title} className="flex gap-3"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${alert.tone === "critical" ? "bg-red-400/10 text-red-300" : alert.tone === "warning" ? "bg-amber-400/10 text-amber-300" : "bg-sky-400/10 text-sky-300"}`}><AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /></div><div><p className="text-sm font-medium text-slate-200">{alert.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{alert.detail}</p></div></div>)}</div> : <div className="py-10 text-center"><CheckCircle2 aria-hidden="true" className="mx-auto h-8 w-8 text-emerald-400" /><p className="mt-3 text-sm font-medium text-white">No actions required</p><p className="mt-1 text-xs leading-5 text-slate-500">Live records currently show no unresolved alerts.</p></div>}<div className="mt-7 flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-400"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-400" /> RLS-scoped workspace data</div></section>
          </div>

          <div className="mt-6"><TenderExtractionPanel tenderId={selectedTenderId} tenderName={selectedTender?.name} /></div>
        </div>
      </main>
    </div>
  );
}
