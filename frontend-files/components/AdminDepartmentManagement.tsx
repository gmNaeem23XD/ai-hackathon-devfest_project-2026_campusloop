"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { Building2, Check, Pencil, Plus, ToggleLeft, ToggleRight, X } from "lucide-react";

type Department = { id: string; code: string; name: string; is_active: boolean };

export default function AdminDepartmentManagement() {
  const notify = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try { setDepartments(await api<Department[]>("/admin/departments")); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Unable to load departments."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const created = await api<Department>("/admin/departments", { method: "POST", body: JSON.stringify({ code, name }) });
      setDepartments((current) => [...current, created].sort((left, right) => left.code.localeCompare(right.code)));
      setCode(""); setName(""); notify("Department added");
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Unable to add department."); }
    finally { setBusy(false); }
  };

  const toggleDepartment = async (department: Department) => {
    setBusyId(department.id); setError("");
    try {
      const updated = await api<Department>(`/admin/departments/${department.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !department.is_active }) });
      setDepartments((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify(updated.is_active ? "Department activated" : "Department deactivated");
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Unable to update department."); }
    finally { setBusyId(""); }
  };

  const beginEdit = (department: Department) => {
    setEditingId(department.id);
    setEditCode(department.code);
    setEditName(department.name);
    setError("");
  };

  const saveDepartment = async (department: Department) => {
    setBusyId(department.id); setError("");
    try {
      const updated = await api<Department>(`/admin/departments/${department.id}`, {
        method: "PATCH",
        body: JSON.stringify({ code: editCode, name: editName }),
      });
      setDepartments((current) => current.map((item) => item.id === updated.id ? updated : item).sort((left, right) => left.code.localeCompare(right.code)));
      setEditingId("");
      notify("Department updated");
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Unable to update department."); }
    finally { setBusyId(""); }
  };

  return (
    <section id="departments" className="scroll-mt-28 space-y-3" aria-labelledby="departments-heading">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-campus-700">Academic directory</p><h2 id="departments-heading" className="mt-1 text-xl font-bold text-ink-900">Departments</h2></div><Badge tone="blue">{departments.length} configured</Badge></div>
      <Card className="overflow-hidden">
        <form onSubmit={addDepartment} className="grid gap-3 border-b border-paper-200 bg-white p-4 sm:grid-cols-[minmax(8rem,.45fr)_minmax(12rem,1fr)_auto] sm:items-end">
          <label className="block space-y-1.5 text-xs font-semibold text-ink-600"><span>Department code</span><Input required maxLength={24} placeholder="e.g. CSE" value={code} onChange={(event) => setCode(event.target.value)} /></label>
          <label className="block space-y-1.5 text-xs font-semibold text-ink-600"><span>Department name</span><Input required maxLength={160} placeholder="e.g. Department of CSE" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <Button type="submit" disabled={busy} aria-busy={busy} className="w-full sm:w-auto">{busy ? "Adding…" : <><Plus size={16} />Add department</>}</Button>
        </form>
        {error && <p role="alert" className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {loading ? <div className="p-4"><LoadingSkeleton rows={2} /></div> : departments.length === 0 ? <p className="p-5 text-sm text-ink-500">No departments configured yet.</p> : <div className="divide-y divide-paper-200">{departments.map((department) => <div key={department.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">{editingId === department.id ? <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[9rem_minmax(12rem,1fr)]"><label className="sr-only" htmlFor={`department-code-${department.id}`}>Department code</label><Input id={`department-code-${department.id}`} className="h-10" maxLength={24} value={editCode} onChange={(event) => setEditCode(event.target.value)} /><label className="sr-only" htmlFor={`department-name-${department.id}`}>Department name</label><Input id={`department-name-${department.id}`} className="h-10" maxLength={160} value={editName} onChange={(event) => setEditName(event.target.value)} /></div> : <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-campus-50 text-campus-700"><Building2 size={17} /></span><div className="min-w-0"><p className="truncate font-semibold text-ink-900">{department.name}</p><p className="text-xs font-medium tracking-wide text-ink-500">{department.code}</p></div><Badge tone={department.is_active ? "green" : "neutral"}>{department.is_active ? "Active" : "Inactive"}</Badge></div>}<div className="flex flex-wrap gap-2 sm:shrink-0">{editingId === department.id ? <><Button size="sm" disabled={busyId === department.id || !editCode.trim() || !editName.trim()} onClick={() => saveDepartment(department)}>{busyId === department.id ? "Saving…" : <><Check size={15} />Save</>}</Button><Button variant="outline" size="sm" disabled={busyId === department.id} onClick={() => setEditingId("")}><X size={15} />Cancel</Button></> : <><Button variant="outline" size="sm" onClick={() => beginEdit(department)}><Pencil size={15} />Edit</Button><Button variant="outline" size="sm" disabled={busyId === department.id} onClick={() => toggleDepartment(department)}>{department.is_active ? <><ToggleRight size={16} />Deactivate</> : <><ToggleLeft size={16} />Activate</>}</Button></>}</div></div>)}</div>}
      </Card>
    </section>
  );
}
