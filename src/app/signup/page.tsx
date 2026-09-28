"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    setMessage("Check your email to confirm your account, then sign in to continue.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F19] px-6 py-12 text-slate-200">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-semibold tracking-[0.18em] text-white">BIDSHIELD</p><p className="text-xs text-slate-500">Evidence assurance</p></div></div>
        <h1 className="mt-10 text-2xl font-semibold text-white">Create your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Start an organisation-isolated BidShield account.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-sm text-slate-300">Work email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none ring-emerald-400/40 focus:ring-2" /></label>
          <label className="block text-sm text-slate-300">Password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none ring-emerald-400/40 focus:ring-2" /><span className="mt-1 block text-xs text-slate-600">Use at least 8 characters.</span></label>
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-sm text-emerald-200">{message}</p>}
          <button disabled={isSubmitting} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-[#07100d] hover:bg-emerald-300 disabled:opacity-50">{isSubmitting ? "Creating account…" : "Create account"}<ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link href="/login" className="text-emerald-300 hover:text-emerald-200">Sign in</Link></p>
      </section>
    </main>
  );
}
