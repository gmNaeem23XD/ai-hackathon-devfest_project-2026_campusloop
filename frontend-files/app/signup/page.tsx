"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleCheck, GraduationCap, LockKeyhole, Mail, Presentation, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ORGANIZATION_NAME } from "@/lib/config";

type RegistrationRole = "STUDENT" | "TEACHER";
type PublicConfig = { allowed_registration_domains: string[] };

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<RegistrationRole>("STUDENT");
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [createdEmail, setCreatedEmail] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<PublicConfig>("/public/config").then((config) => setAllowedDomains(config.allowed_registration_domains)).catch(() => setAllowedDomains([]));
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErr("");
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setErr("Complete all fields to create your account.");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const result = await api<{ message: string; email: string; approval_required: boolean }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
      setCreatedEmail(result.email);
      setApprovalRequired(result.approval_required);
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Unable to create your account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout mode="signup">
      {createdEmail ? (
        <div className="space-y-5" role="status">
          <div className="grid size-12 place-items-center rounded-md bg-leaf-100 text-leaf-800"><CircleCheck size={26} /></div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-leaf-700">You’re on the list</p>
            <h1 className="font-serif text-3xl font-semibold text-ink-900">Account created</h1>
            <p className="mt-3 text-sm leading-6 text-ink-500">{approvalRequired ? <>Your teacher account for <span className="font-semibold text-ink-800">{createdEmail}</span> is submitted. An administrator must approve it before you can sign in.</> : <>Your student account for <span className="font-semibold text-ink-800">{createdEmail}</span> is ready. Sign in to join your workspace.</>}</p>
          </div>
          <Link href="/" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-campus-700 px-4 text-sm font-semibold text-white transition hover:bg-campus-800">Go to sign in <ArrowRight size={17} /></Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="mb-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-leaf-700">Join the {ORGANIZATION_NAME} learning community</p>
            <h1 className="font-serif text-3xl font-semibold tracking-normal text-ink-900">Create account</h1>
            <p className="mt-2 text-sm leading-6 text-ink-500">Choose your role and set up your university profile.</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink-700">I am joining as a</legend>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={role === "STUDENT"} onClick={() => setRole("STUDENT")} className={`flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${role === "STUDENT" ? "border-campus-600 bg-campus-50 text-campus-800 ring-1 ring-campus-200" : "border-line bg-white text-ink-600 hover:border-campus-300"}`}><GraduationCap size={17} /> Student</button>
              <button type="button" aria-pressed={role === "TEACHER"} onClick={() => setRole("TEACHER")} className={`flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${role === "TEACHER" ? "border-campus-600 bg-campus-50 text-campus-800 ring-1 ring-campus-200" : "border-line bg-white text-ink-600 hover:border-campus-300"}`}><Presentation size={17} /> Teacher</button>
            </div>
            {role === "TEACHER" && <p className="text-xs leading-5 text-ink-500">Teacher access is enabled after an administrator approves your account.</p>}
          </fieldset>
          <label className="block space-y-1 text-sm font-semibold text-ink-700">
            <span>Full name</span>
            <span className="relative block"><UserRound aria-hidden="true" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><Input autoComplete="name" aria-invalid={Boolean(err)} aria-describedby={err ? "signup-error" : undefined} className="pl-10" type="text" placeholder="e.g. Jordan Lee" maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} /></span>
          </label>
          <label className="block space-y-1 text-sm font-semibold text-ink-700">
            <span>Email address</span>
            <span className="relative block"><Mail aria-hidden="true" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><Input autoComplete="email" aria-invalid={Boolean(err)} aria-describedby={err ? "signup-error" : undefined} className="pl-10" type="email" placeholder="you@university.edu" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></span>
          </label>
          <p className="-mt-2 text-xs leading-5 text-ink-500">Allowed domains: {allowedDomains.length ? allowedDomains.map((domain) => `@${domain}`).join(" or ") : "checking organization settings…"}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-semibold text-ink-700">
              <span>Password</span>
              <span className="relative block"><LockKeyhole aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><PasswordInput aria-label="Password" autoComplete="new-password" aria-invalid={Boolean(err)} aria-describedby={err ? "signup-error" : "password-hint"} className="pl-10" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></span>
            </label>
            <label className="block space-y-1 text-sm font-semibold text-ink-700">
              <span>Confirm</span>
              <span className="relative block"><Check aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><PasswordInput aria-label="Confirm password" autoComplete="new-password" aria-invalid={Boolean(err)} aria-describedby={err ? "signup-error" : undefined} className="pl-10" minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></span>
            </label>
          </div>
          <p id="password-hint" className="-mt-2 text-xs text-ink-500">Use at least 8 characters.</p>
          {err && <p id="signup-error" role="alert" aria-live="assertive" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{err}</p>}
          <Button type="submit" disabled={busy} aria-busy={busy} className="w-full">{busy ? "Creating account…" : <>Create {role === "TEACHER" ? "teacher" : "student"} account <ArrowRight size={17} /></>}</Button>
          <p className="pt-1 text-center text-sm text-ink-500">Already a member? <Link href="/" className="font-semibold text-campus-700 hover:text-campus-900">Sign in</Link></p>
        </form>
      )}
    </AuthLayout>
  );
}