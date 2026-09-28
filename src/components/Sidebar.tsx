"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardPlus, FileCheck2, LayoutDashboard, ScanSearch, ShieldCheck } from "lucide-react";

const navigation = [
  { label: "Command Center", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tender Intake", href: "/tenders/new", icon: ClipboardPlus },
  { label: "Evidence Vault", href: "/vault", icon: FileCheck2 },
  { label: "Shield Scanner", href: "/scanner", icon: ScanSearch }
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-72 flex-col border-r border-white/10 bg-[#0B0F19] px-4 py-6 text-slate-300">
      <div className="flex items-center gap-3 px-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-white">BIDSHIELD</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Evidence assurance</p>
        </div>
      </div>

      <div className="mt-10 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
        <nav aria-label="Primary navigation" className="mt-3 space-y-1">
          {navigation.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                  isActive
                    ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current organisation</p>
        <p className="mt-2 truncate text-sm font-medium text-white">Your organisation</p>
        <p className="mt-1 text-xs text-slate-500">Tenant-isolated workspace</p>
      </div>
    </aside>
  );
}
