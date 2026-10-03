"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import ConfirmDialog from "@/components/ConfirmDialog";
import AdminUserDialog from "@/components/AdminUserDialog";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import type { ManagedUser, UserProfileUpdate } from "@/components/AdminUserDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Eye, FilePenLine, Search, ShieldCheck, Trash2, UserRoundCheck, UserRoundX } from "lucide-react";

type Role = "STUDENT" | "TEACHER";
type StatusFilter = "all" | "active" | "inactive" | "pending" | "deleted";
type SortField = "name" | "date";
type UserPage = { items: ManagedUser[]; total: number; limit: number; offset: number };
type Department = { id: string; code: string; name: string; is_active: boolean };
type Confirmation = { user: ManagedUser; action: "deactivate" | "delete" } | null;

const PAGE_SIZE = 10;

function statusFor(user: ManagedUser) {
  if (user.is_deleted) return { label: "Deleted", tone: "amber" as const };
  if (!user.is_active) return { label: "Inactive", tone: "neutral" as const };
  if (user.role === "TEACHER" && !user.is_approved) return { label: "Pending approval", tone: "amber" as const };
  return { label: "Active", tone: "green" as const };
}

export default function AdminUserManagement({ role, departments = [], designations = [] }: { role: Role; departments?: Department[]; designations?: string[] }) {
  const notify = useToast();
  const isStudent = role === "STUDENT";
  const title = isStudent ? "Students" : "Teachers";
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortField>("date");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<{ user: ManagedUser; mode: "view" | "edit" } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let current = true;
    const loadUsers = async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        role,
        q: search,
        status,
        sort,
        direction,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      try {
        const page = await api<UserPage>(`/admin/users?${params.toString()}`);
        if (current) { setUsers(page.items); setTotal(page.total); }
      } catch (cause: unknown) {
        if (current) setError(cause instanceof Error ? cause.message : `Unable to load ${title.toLowerCase()}.`);
      } finally {
        if (current) setLoading(false);
      }
    };
    loadUsers();
    return () => { current = false; };
  }, [role, search, status, sort, direction, offset, refreshKey, title]);

  const openUser = async (user: ManagedUser, mode: "view" | "edit") => {
    setBusyId(user.id);
    setError("");
    try {
      const fresh = await api<ManagedUser>(`/admin/users/${user.id}`);
      setSelected({ user: fresh, mode });
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Unable to load this account."); }
    finally { setBusyId(""); }
  };

  const saveUser = async (profile: UserProfileUpdate) => {
    if (!selected) return false;
    setBusyId(selected.user.id);
    setError("");
    try {
      const updated = await api<ManagedUser>(`/admin/users/${selected.user.id}`, {
        method: "PATCH",
        body: JSON.stringify(profile),
      });
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
      setSelected({ user: updated, mode: "view" });
      notify(`${updated.name}'s profile was updated`);
      return true;
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : "Unable to update this account.";
      setError(message);
      return false;
    } finally { setBusyId(""); }
  };

  const runConfirmedAction = async () => {
    if (!confirmation) return;
    const { user, action } = confirmation;
    setBusyId(user.id);
    setError("");
    try {
      if (action === "delete") {
        await api(`/admin/users/${user.id}`, { method: "DELETE" });
        setUsers((current) => current.map((item) => item.id === user.id
          ? { ...item, is_active: false, is_deleted: true, deleted_at: new Date().toISOString() }
          : item));
        notify(`${user.name}'s account was deleted`);
      } else {
        const result = await api<{ is_active: boolean }>(`/admin/users/${user.id}/active`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: false }),
        });
        setUsers((current) => current.map((item) => item.id === user.id ? { ...item, is_active: result.is_active } : item));
        notify(`${user.name}'s account was deactivated`);
      }
      setConfirmation(null);
      setRefreshKey((current) => current + 1);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Unable to update this account."); }
    finally { setBusyId(""); }
  };

  const activateUser = async (user: ManagedUser) => {
    setBusyId(user.id);
    setError("");
    try {
      const result = await api<{ is_active: boolean }>(`/admin/users/${user.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, is_active: result.is_active } : item));
      notify(`${user.name}'s account was activated`);
      setRefreshKey((current) => current + 1);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Unable to activate this account."); }
    finally { setBusyId(""); }
  };

  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="space-y-3" aria-labelledby={`${role.toLowerCase()}-management-heading`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-campus-700">Account management</p><h2 id={`${role.toLowerCase()}-management-heading`} className="mt-1 text-xl font-bold text-ink-900">{title}</h2></div>
        <Badge tone={role === "STUDENT" ? "blue" : "green"}>{total} accounts</Badge>
      </div>
      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-paper-200 bg-white p-4 md:grid-cols-[minmax(12rem,1fr)_auto_auto_auto] md:items-center">
          <label className="relative block min-w-0"><span className="sr-only">Search {title.toLowerCase()}</span><Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><Input className="pl-9" type="search" placeholder="Search name, email, ID" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-600"><span>Status</span><select className="h-10 rounded-md border border-line bg-white px-2 text-sm text-ink-700" value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setOffset(0); }}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>{role === "TEACHER" && <option value="pending">Pending approval</option>}<option value="deleted">Deleted</option></select></label>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-600"><span>Sort</span><select className="h-10 rounded-md border border-line bg-white px-2 text-sm text-ink-700" value={sort} onChange={(event) => setSort(event.target.value as SortField)}><option value="date">Registration date</option><option value="name">Name</option></select></label>
          <Button variant="outline" size="sm" onClick={() => setDirection((current) => current === "asc" ? "desc" : "asc")} aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`} className="w-full md:w-auto">{direction === "asc" ? "Ascending" : "Descending"}</Button>
        </div>

        {error && <p role="alert" className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {loading ? <div className="p-4"><div className="hidden space-y-2 md:block"><div className="h-10 animate-pulse rounded bg-paper-100" /><div className="h-12 animate-pulse rounded bg-paper-100" /><div className="h-12 animate-pulse rounded bg-paper-100" /></div><div className="md:hidden"><LoadingSkeleton rows={2} /></div></div> : users.length === 0 ? <div className="p-8 text-center"><span className="mx-auto grid size-10 place-items-center rounded-md bg-campus-50 text-campus-700"><Search size={18} /></span><p className="mt-3 font-semibold text-ink-800">No {title.toLowerCase()} found</p><p className="mt-1 text-sm text-ink-500">Try another search or status filter.</p></div> : <>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-paper-100 text-[11px] uppercase tracking-widest text-ink-500"><tr><th className="px-4 py-3 font-bold">User</th><th className="px-4 py-3 font-bold">University ID</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 font-bold">Registered</th><th className="px-4 py-3 text-right font-bold">Actions</th></tr></thead><tbody>{users.map((user) => {
            const accountStatus = statusFor(user);
            const isBusy = busyId === user.id;
            return <tr key={user.id} className="border-t border-paper-200 hover:bg-campus-50/40"><td className="px-4 py-3.5"><p className="font-semibold text-ink-900">{user.name}</p><p className="text-xs text-ink-500">{user.email}</p></td><td className="px-4 py-3.5 text-ink-600">{user.university_id || "—"}</td><td className="px-4 py-3.5"><div className="flex flex-wrap gap-1.5"><Badge tone={accountStatus.tone}>{accountStatus.label}</Badge>{user.role === "TEACHER" && user.is_active && !user.is_approved && !user.is_deleted && <Badge tone="amber">Not approved</Badge>}</div></td><td className="px-4 py-3.5 text-ink-600">{user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</td><td className="px-4 py-3.5"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`View ${user.name}`} title="View details" disabled={isBusy} onClick={() => openUser(user, "view")}><Eye size={17} /></Button>{!user.is_deleted && <><Button variant="ghost" size="icon" aria-label={`Edit ${user.name}`} title="Edit profile" disabled={isBusy} onClick={() => openUser(user, "edit")}><FilePenLine size={17} /></Button>{user.is_active ? <Button variant="ghost" size="icon" aria-label={`Deactivate ${user.name}`} title="Deactivate account" disabled={isBusy} onClick={() => setConfirmation({ user, action: "deactivate" })}><UserRoundX size={17} /></Button> : <Button variant="ghost" size="icon" aria-label={`Activate ${user.name}`} title="Activate account" disabled={isBusy} onClick={() => activateUser(user)}><UserRoundCheck size={17} /></Button>}<Button variant="ghost" size="icon" aria-label={`Delete ${user.name}`} title="Delete account" disabled={isBusy} onClick={() => setConfirmation({ user, action: "delete" })} className="text-red-700 hover:bg-red-50 hover:text-red-800"><Trash2 size={17} /></Button></>}</div></td></tr>;
          })}</tbody></table></div>

          <div className="space-y-3 p-3 md:hidden">{users.map((user) => {
            const accountStatus = statusFor(user);
            const isBusy = busyId === user.id;
            return <Card key={user.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="wrap-break-word font-semibold text-ink-900">{user.name}</p><p className="break-all text-sm text-ink-500">{user.email}</p></div><Badge tone={accountStatus.tone}>{accountStatus.label}</Badge></div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-paper-200 pt-3"><span className="text-xs text-ink-500">{user.university_id || "No university ID"}<span className="mx-1.5">·</span>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "Date unknown"}</span><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`View ${user.name}`} disabled={isBusy} onClick={() => openUser(user, "view")}><Eye size={17} /></Button>{!user.is_deleted && <><Button variant="ghost" size="icon" aria-label={`Edit ${user.name}`} disabled={isBusy} onClick={() => openUser(user, "edit")}><FilePenLine size={17} /></Button>{user.is_active ? <Button variant="ghost" size="icon" aria-label={`Deactivate ${user.name}`} disabled={isBusy} onClick={() => setConfirmation({ user, action: "deactivate" })}><UserRoundX size={17} /></Button> : <Button variant="ghost" size="icon" aria-label={`Activate ${user.name}`} disabled={isBusy} onClick={() => activateUser(user)}><UserRoundCheck size={17} /></Button>}<Button variant="ghost" size="icon" aria-label={`Delete ${user.name}`} disabled={isBusy} onClick={() => setConfirmation({ user, action: "delete" })} className="text-red-700"><Trash2 size={17} /></Button></>}</div></div></Card>;
          })}</div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-200 px-4 py-3"><p className="text-xs text-ink-500">Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</p><div className="flex items-center gap-2"><span className="text-xs text-ink-500">Page {pageNumber} of {pageCount}</span><Button variant="outline" size="icon" aria-label="Previous page" disabled={offset === 0 || loading} onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}><ChevronLeft size={17} /></Button><Button variant="outline" size="icon" aria-label="Next page" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset((current) => current + PAGE_SIZE)}><ChevronRight size={17} /></Button></div></div>
        </>}
      </Card>

      <AdminUserDialog
        user={selected?.user || null}
        mode={selected?.mode || "view"}
        busy={Boolean(selected && busyId === selected.user.id)}
        departments={departments}
        designations={designations}
        onClose={() => setSelected(null)}
        onSave={saveUser}
      />
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.action === "delete" ? "Delete this account?" : "Deactivate this account?"}
        message={confirmation?.action === "delete"
          ? `Delete ${confirmation.user.name}'s account? It will be permanently blocked from sign-in and marked deleted; linked course and meeting history will be retained.`
          : `${confirmation?.user.name}'s account will be blocked from signing in. You can activate it again later.`}
        confirmLabel={confirmation?.action === "delete" ? "Delete account" : "Deactivate account"}
        busyLabel={confirmation?.action === "delete" ? "Deleting…" : "Deactivating…"}
        busy={Boolean(confirmation && busyId === confirmation.user.id)}
        onConfirm={runConfirmedAction}
        onClose={() => setConfirmation(null)}
      />
    </section>
  );
}
