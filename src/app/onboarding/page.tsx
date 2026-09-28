"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [organisationName, setOrganisationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function checkMembership() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: membership } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (membership) router.replace("/dashboard");
    }

    void checkMembership();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: organisation, error: organisationError } = await supabase
      .from("organizations")
      .insert({ name: organisationName.trim(), created_by: user.id })
      .select("id")
      .single();

    if (organisationError || !organisation) {
      setIsSubmitting(false);
      setError(organisationError?.message ?? "Organisation could not be created.");
      return;
    }

    const { error: membershipError } = await supabase.from("users").insert({
      auth_user_id: user.id,
      organization_id: organisation.id,
      role: "owner",
      display_name: user.email ?? "Workspace owner"
    });

    if (membershipError) {
      setIsSubmitting(false);
      setError(membershipError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F19] px-6 py-12 text-slate-200">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-semibold tracking-[0.18em] text-white">BIDSHIELD</p><p className="text-xs text-slate-500">Evidence assurance</p></div></div>
        <div className="mt-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300"><Building2 className="h-6 w-6" /></div>
        <h1 className="mt-6 text-2xl font-semibold text-white">Set up your organisation</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Your organisation is the tenant boundary for tenders, evidence, claims, and audit records.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-sm text-slate-300">Organisation name<input required minLength={2} value={organisationName} onChange={(event) => setOrganisationName(event.target.value)} placeholder="e.g. Northstar Facilities Ltd" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none ring-emerald-400/40 placeholder:text-slate-700 focus:ring-2" /></label>
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}
          <button disabled={isSubmitting} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-[#07100d] hover:bg-emerald-300 disabled:opacity-50">{isSubmitting ? "Creating workspace…" : "Create workspace"}<ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-6 text-xs leading-5 text-slate-600">Your first account becomes the organisation owner. Additional membership and invitation flows can be added after the workspace is created.</p>
      </section>
    </main>
  );
}
