"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(searchParams.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F19] px-6 py-12 text-slate-200">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-semibold tracking-[0.18em] text-white">BIDSHIELD</p><p className="text-xs text-slate-500">Evidence assurance</p></div></div>
        <h1 className="mt-10 text-2xl font-semibold text-white">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Sign in to your organisation workspace.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-sm text-slate-300">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none ring-emerald-400/40 focus:ring-2" /></label>
          <label className="block text-sm text-slate-300">Password<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none ring-emerald-400/40 focus:ring-2" /><span className="mt-2 block text-right"><Link href="/forgot-password" className="text-xs text-emerald-300 hover:text-emerald-200">Forgot password?</Link></span></label>
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}
          <button disabled={isSubmitting} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-[#07100d] hover:bg-emerald-300 disabled:opacity-50">{isSubmitting ? "Signing in…" : "Sign in"}<ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">New to BidShield? <Link href="/signup" className="text-emerald-300 hover:text-emerald-200">Create an account</Link></p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-[#0B0F19] text-sm text-slate-400">Loading sign in…</main>}>
      <LoginForm />
    </Suspense>
  );
}
