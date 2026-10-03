"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { api } from "@/lib/api";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await api<{ access_token: string; role: string }>("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (result.role !== "ADMIN") throw new Error("Administrator access was not granted.");
      localStorage.setItem("token", result.access_token);
      router.replace("/admin");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in as administrator.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout mode="signin">
      <form onSubmit={submit} className="space-y-5">
        <div className="mb-7">
          <span className="mb-4 grid size-10 place-items-center rounded-md bg-campus-100 text-campus-800"><ShieldCheck size={21} /></span>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-campus-700">Restricted access</p>
          <h1 className="font-serif text-3xl font-semibold text-ink-900">Admin sign in</h1>
          <p className="mt-2 text-sm leading-6 text-ink-500">Use the administrator account provisioned for this platform.</p>
        </div>
        <label className="block space-y-1.5 text-sm font-semibold text-ink-700">
          <span>Administrator email</span>
          <span className="relative block"><Mail size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><Input className="pl-10" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></span>
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-ink-700">
          <span>Password</span>
          <span className="relative block"><LockKeyhole size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><PasswordInput aria-label="Password" className="pl-10" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></span>
        </label>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</p>}
        <Button type="submit" disabled={busy} aria-busy={busy} className="w-full">{busy ? "Verifying…" : <>Continue to admin <ArrowRight size={17} /></>}</Button>
        <p className="text-center text-sm text-ink-500">Not an administrator? <Link href="/" className="font-semibold text-campus-700">Return to sign in</Link></p>
      </form>
    </AuthLayout>
  );
}
