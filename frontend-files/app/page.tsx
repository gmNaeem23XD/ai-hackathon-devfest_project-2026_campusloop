"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { api } from "@/lib/api";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { homeForRole } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";

type PublicConfig = { demo_mode: boolean; demo_accounts: { name: string; email: string; role: string }[]; demo_password: string | null };

export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    api<PublicConfig>("/public/config").then(setPublicConfig).catch(() => setPublicConfig(null));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (!email.trim() || !password) return setErr("Enter your email and password");
    setBusy(true);
    try {
      const d = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("token", d.access_token);
      r.push(homeForRole(d.role));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <AuthLayout mode="signin">
      <form onSubmit={submit} className="space-y-5">
        <div className="mb-7">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-campus-700">Welcome back to {APP_NAME}</p>
          <h1 className="font-serif text-3xl font-semibold tracking-normal text-ink-900">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-ink-500">Pick up where your class left off.</p>
        </div>
        <label className="block space-y-1.5 text-sm font-semibold text-ink-700">
          <span>Email address</span>
          <span className="relative block"><Mail aria-hidden="true" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><Input autoComplete="email" required aria-invalid={Boolean(err)} aria-describedby={err ? "login-error" : undefined} className="pl-10" type="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} /></span>
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-ink-700">
          <span>Password</span>
          <span className="relative block"><LockKeyhole aria-hidden="true" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><PasswordInput aria-label="Password" autoComplete="current-password" required aria-invalid={Boolean(err)} aria-describedby={err ? "login-error" : undefined} className="pl-10" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} /></span>
        </label>
        {err && <p id="login-error" role="alert" aria-live="assertive" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{err}</p>}
        <p className="text-right text-xs text-ink-500">Need a password reset? Contact your administrator.</p>
        <Button type="submit" disabled={busy} aria-busy={busy} className="w-full">{busy ? "Signing in…" : <>Continue to workspace <ArrowRight size={17} /></>}</Button>
        <div className="relative py-1"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-paper-200" /></div><div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-ink-400">NEW TO {APP_NAME.toUpperCase()}?</span></div></div>
        <Link href="/signup" className="flex min-h-11 items-center justify-center rounded-md border border-campus-200 bg-campus-50 px-4 text-sm font-semibold text-campus-800 transition hover:border-campus-300 hover:bg-campus-100">Create a student account</Link>
        {publicConfig?.demo_mode && publicConfig.demo_accounts.length > 0 && <p className="rounded-md bg-paper-100 px-3 py-2.5 text-xs leading-5 text-ink-500"><span className="font-bold text-ink-700">Demo access</span><br />{publicConfig.demo_accounts.slice(0, 2).map((account) => account.email).join(" · ")}<br />Password: {publicConfig.demo_password}</p>}
        <p className="text-center text-xs text-ink-500">Administrator? <Link href="/admin/login" className="font-semibold text-campus-700 hover:text-campus-900">Admin sign in</Link></p>
      </form>
    </AuthLayout>
  );
}
