"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setReady(Boolean(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Password updated. Redirecting to sign in…");
    window.setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 900);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F19] px-6 py-12 text-slate-200">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm font-semibold tracking-[0.18em] text-white">BIDSHIELD</p><p className="text-xs text-slate-500">Evidence assurance</p></div></div>
        <h1 className="mt-10 text-2xl font-semibold text-white">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Use a new password for your organisation workspace.</p>
        {!ready ? <p className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-sm text-amber-200">This reset link is missing or expired. Request a new link.</p> : <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-sm text-slate-300">New password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none ring-emerald-400/40 focus:ring-2" /></label>
          <label className="block text-sm text-slate-300">Confirm password<input required minLength={8} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none ring-emerald-400/40 focus:ring-2" /></label>
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-sm text-emerald-200">{message}</p>}
          <button disabled={isSubmitting} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-[#07100d] hover:bg-emerald-300 disabled:opacity-50">{isSubmitting ? "Updating…" : "Update password"}<ArrowRight className="h-4 w-4" /></button>
        </form>}
        <p className="mt-6 text-center text-sm text-slate-500"><Link href="/login" className="text-emerald-300 hover:text-emerald-200">Back to sign in</Link></p>
      </section>
    </main>
  );
}
