import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileWarning,
  Plus,
  ShieldCheck
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

const metrics = [
  { label: "Active tenders", value: "08", detail: "+2 this month", icon: FileWarning, tone: "text-emerald-300" },
  { label: "Requiring action", value: "03", detail: "1 critical issue", icon: AlertTriangle, tone: "text-amber-300" },
  { label: "Evidence expiring", value: "05", detail: "Next 30 days", icon: Clock3, tone: "text-orange-300" },
  { label: "Readiness checks", value: "92%", detail: "Across active bids", icon: ShieldCheck, tone: "text-sky-300" }
] as const;

const tenders = [
  { name: "Birmingham Facilities Management", buyer: "Birmingham City Council", deadline: "18 Oct 2026", requirements: "42 / 42", issues: "1 critical", evidence: "37 verified", status: "Review" },
  { name: "North West Estates Services", buyer: "NHS Procurement", deadline: "26 Oct 2026", requirements: "28 / 31", issues: "2 open", evidence: "24 verified", status: "In progress" },
  { name: "Civic Digital Support Framework", buyer: "Crown Commercial Service", deadline: "04 Nov 2026", requirements: "19 / 19", issues: "None", evidence: "Ready", status: "Submission ready" }
] as const;

const alerts = [
  { title: "Mandatory evidence missing", detail: "Birmingham Facilities Management · Insurance schedule", tone: "critical" },
  { title: "Certificate expires in 24 days", detail: "North West Estates Services · ISO 14001", tone: "warning" },
  { title: "Unsupported response claim detected", detail: "Civic Digital Support Framework · Criterion 3", tone: "action" }
] as const;

const statusStyles: Record<string, string> = {
  Review: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  "In progress": "bg-sky-400/10 text-sky-300 ring-sky-400/20",
  "Submission ready": "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
};

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-slate-200">
      <Sidebar />
      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-8 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-400">Command Center</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">Submission readiness at a glance.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Track requirements, evidence gaps, and verification actions across your active public-sector bids.</p>
            </div>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#07100d] shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add tender
            </button>
          </header>

          <section aria-label="Workspace metrics" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
                  <Icon aria-hidden="true" className={`h-5 w-5 ${tone}`} />
                </div>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-white">{value}</p>
                <p className="mt-2 text-xs text-slate-500">{detail}</p>
              </div>
            ))}
          </section>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/10 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
                <div>
                  <h2 className="text-base font-semibold text-white">Active tenders</h2>
                  <p className="mt-1 text-xs text-slate-500">Requirement and evidence coverage by bid</p>
                </div>
                <button className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200">
                  View all <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-5 py-4 font-medium">Tender</th>
                      <th className="px-4 py-4 font-medium">Deadline</th>
                      <th className="px-4 py-4 font-medium">Requirements</th>
                      <th className="px-4 py-4 font-medium">Evidence</th>
                      <th className="px-4 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {tenders.map((tender) => (
                      <tr key={tender.name} className="transition hover:bg-white/[0.025]">
                        <td className="px-5 py-5">
                          <p className="font-medium text-white">{tender.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{tender.buyer}</p>
                          <p className="mt-2 text-xs text-amber-300">{tender.issues}</p>
                        </td>
                        <td className="px-4 py-5 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />{tender.deadline}</span></td>
                        <td className="px-4 py-5 text-xs text-slate-300">{tender.requirements}</td>
                        <td className="px-4 py-5 text-xs text-slate-300">{tender.evidence}</td>
                        <td className="px-4 py-5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${statusStyles[tender.status]}`}>{tender.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Attention needed</h2>
                  <p className="mt-1 text-xs text-slate-500">Resolve before submission gate</p>
                </div>
                <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-300" />
              </div>
              <div className="mt-6 space-y-5">
                {alerts.map((alert) => (
                  <div key={alert.title} className="flex gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${alert.tone === "critical" ? "bg-red-400/10 text-red-300" : alert.tone === "warning" ? "bg-amber-400/10 text-amber-300" : "bg-sky-400/10 text-sky-300"}`}>
                      {alert.tone === "critical" ? <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /> : alert.tone === "warning" ? <Clock3 aria-hidden="true" className="h-3.5 w-3.5" /> : <FileWarning aria-hidden="true" className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{alert.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{alert.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-400"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-400" /> 12 checks passed today</div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
