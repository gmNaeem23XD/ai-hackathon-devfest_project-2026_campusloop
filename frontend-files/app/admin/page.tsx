"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { homeForRole } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { useToast } from "@/components/ToastProvider";
import AdminUserManagement from "@/components/AdminUserManagement";
import AdminDepartmentManagement from "@/components/AdminDepartmentManagement";
import type { ManagedUser } from "@/components/AdminUserDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCheck, CircleAlert, GraduationCap, ShieldCheck, UsersRound } from "lucide-react";

type Summary = { users: number; students: number; teachers: number; admins: number; pending_teachers: number; courses: number; meetings: number };
type Department = { id: string; code: string; name: string; is_active: boolean };
type PublicConfiguration = { teacher_designations: string[] };

export default function AdminDashboard() {
  const router = useRouter();
  const notify = useToast();
  const [admin, setAdmin] = useState<{ id: string; name: string; email: string } | null>(null);
  const [pendingTeachers, setPendingTeachers] = useState<ManagedUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const current = await api<{ id: string; name: string; email: string; role: string }>("/me");
        if (!active) return;
        if (current.role !== "ADMIN") {
          router.replace(homeForRole(current.role));
          return;
        }
        setAdmin(current);
        const [overview, accounts, departmentList, publicConfig] = await Promise.all([
          api<Summary>("/admin/summary"),
          api<{ items: ManagedUser[] }>("/admin/users?role=TEACHER&status=pending&limit=100&offset=0"),
          api<Department[]>("/admin/departments"),
          api<PublicConfiguration>("/public/config"),
        ]);
        if (active) {
          setSummary(overview);
          setPendingTeachers(accounts.items);
          setDepartments(departmentList);
          setDesignations(publicConfig.teacher_designations);
        }
      } catch (cause: unknown) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load administrator workspace.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [router]);

  const approveTeacher = async (user: ManagedUser) => {
    setBusyId(user.id); setError("");
    try {
      await api(`/admin/teachers/${user.id}/approve`, { method: "POST" });
      setPendingTeachers((current) => current.filter((item) => item.id !== user.id));
      setSummary((current) => current ? { ...current, pending_teachers: Math.max(0, current.pending_teachers - 1) } : current);
      notify(`${user.name} can now sign in as a teacher`);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Unable to approve this teacher."); }
    finally { setBusyId(""); }
  };

  return (
    <div className="min-h-dvh bg-paper-100">
      <Navbar name={admin?.name} email={admin?.email} role="Admin" />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="campus-grid enter-up relative overflow-hidden rounded-xl px-5 py-6 text-white sm:px-8 sm:py-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-24 size-72 rounded-full border border-white/10" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div><Badge tone="green" className="mb-4 border border-white/10"><ShieldCheck size={13} />Restricted administrator area</Badge><h1 className="font-serif text-3xl font-semibold sm:text-4xl">Platform overview</h1><p className="mt-2 text-sm text-blue-100">Manage account access and DIU teacher approvals.</p></div>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-100">Administrator: {admin?.name || "Verifying access…"}</span>
          </div>
        </section>

        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {loading ? <LoadingSkeleton rows={3} /> : <>
          <section aria-label="Platform totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="flex items-center gap-4 p-4"><span className="grid size-10 place-items-center rounded-md bg-campus-100 text-campus-800"><UsersRound size={20} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Accounts</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{summary?.users ?? 0}</p></div></Card>
            <Card className="flex items-center gap-4 p-4"><span className="grid size-10 place-items-center rounded-md bg-leaf-100 text-leaf-800"><GraduationCap size={20} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Students</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{summary?.students ?? 0}</p></div></Card>
            <Card className="flex items-center gap-4 p-4"><span className="grid size-10 place-items-center rounded-md bg-campus-50 text-campus-700"><CheckCheck size={20} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Teachers</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{summary?.teachers ?? 0}</p></div></Card>
            <Card className="flex items-center gap-4 p-4"><span className="grid size-10 place-items-center rounded-md bg-amber-50 text-amber-800"><CircleAlert size={20} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Awaiting approval</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{summary?.pending_teachers ?? 0}</p></div></Card>
          </section>

          <section id="pending" className="scroll-mt-28 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-leaf-700">Access review</p><h2 className="mt-1 text-xl font-bold text-ink-900">Teacher approvals</h2></div><Badge tone={pendingTeachers.length ? "amber" : "green"}>{pendingTeachers.length ? `${pendingTeachers.length} pending` : "All clear"}</Badge></div>
            {pendingTeachers.length === 0 ? <Card className="p-5 text-sm text-ink-500">New teacher accounts appear here until approved.</Card> : <div className="grid gap-3 lg:grid-cols-2">{pendingTeachers.map((user) => <Card key={user.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-semibold text-ink-900">{user.name}</p><p className="truncate text-sm text-ink-500">{user.email}</p><p className="mt-1 text-xs text-amber-800">Teacher access is pending review</p></div><Button disabled={busyId === user.id} onClick={() => approveTeacher(user)} size="sm" className="shrink-0"><CheckCheck size={15} />{busyId === user.id ? "Approving…" : "Approve teacher"}</Button></Card>)}</div>}
          </section>

          <AdminDepartmentManagement />
          <AdminUserManagement role="STUDENT" departments={departments} designations={designations} />
          <AdminUserManagement role="TEACHER" departments={departments} designations={designations} />
        </>}
      </main>
    </div>
  );
}
