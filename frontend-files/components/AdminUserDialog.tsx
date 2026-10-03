"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "TEACHER";
  university_id: string | null;
  phone_number: string | null;
  gender: string | null;
  is_active: boolean;
  is_approved: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string | null;
  department_id?: string | null;
  department_code?: string | null;
  department_name?: string | null;
  designation?: string | null;
  professional_info?: string | null;
  assigned_courses?: Array<{ id: string; name: string; course_code: string; department_name: string | null; semester: string | null; section: string | null; academic_year: string | null }>;
};

export type UserProfileUpdate = Pick<ManagedUser, "name" | "email" | "university_id"> & Partial<Pick<ManagedUser, "department_id" | "designation" | "professional_info">>;
type Department = { id: string; code: string; name: string; is_active: boolean };

type Props = {
  user: ManagedUser | null;
  mode: "view" | "edit";
  busy?: boolean;
  departments?: Department[];
  designations?: string[];
  onClose: () => void;
  onSave: (value: UserProfileUpdate) => Promise<boolean>;
};

function accountStatus(user: ManagedUser) {
  if (user.is_deleted) return { label: "Deleted", tone: "amber" as const };
  if (!user.is_active) return { label: "Inactive", tone: "neutral" as const };
  if (user.role === "TEACHER" && !user.is_approved) return { label: "Pending approval", tone: "amber" as const };
  return { label: "Active", tone: "green" as const };
}

export default function AdminUserDialog({ user, mode, busy = false, departments = [], designations = [], onClose, onSave }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designation, setDesignation] = useState("");
  const [professionalInfo, setProfessionalInfo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (user && dialog && !dialog.open) dialog.showModal();
    if (!user && dialog?.open) dialog.close();
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setUniversityId(user.university_id || "");
      setDepartmentId(user.department_id || "");
      setDesignation(user.designation || "");
      setProfessionalInfo(user.professional_info || "");
      setError("");
    }
  }, [user, mode]);

  if (!user) return <dialog ref={dialogRef} />;

  const status = accountStatus(user);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const saved = await onSave({
      name: name.trim(),
      email: email.trim(),
      university_id: universityId.trim() || null,
      ...(user.role === "TEACHER" ? {
        department_id: departmentId || null,
        designation: designation || null,
        professional_info: professionalInfo.trim() || null,
      } : {}),
    });
    if (!saved) setError("Could not save these changes. Review the message and try again.");
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="managed-user-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === dialogRef.current && !busy) onClose(); }}
      className="w-[calc(100%-2rem)] max-w-lg rounded-lg border border-line bg-paper-100 p-0 text-ink-900 shadow-xl backdrop:bg-campus-900/40"
    >
      <div className="border-b border-line bg-white px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-campus-700">{mode === "edit" ? "Account maintenance" : "Account profile"}</p>
        <h2 id="managed-user-title" className="mt-1 text-xl font-bold">{mode === "edit" ? "Edit user information" : user.name}</h2>
        <p className="mt-1 text-sm text-ink-500">{user.role === "TEACHER" ? "Teacher account" : "Student account"}</p>
      </div>
      {mode === "view" ? (
        <div className="space-y-3 p-5 sm:p-6">
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-500">Account status</span><Badge tone={status.tone}>{status.label}</Badge></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-500">Name</span><span className="text-right text-sm font-semibold text-ink-800">{user.name}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-500">Email</span><span className="break-all text-right text-sm font-semibold text-ink-800">{user.email}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-500">University ID</span><span className="text-right text-sm font-semibold text-ink-800">{user.university_id || "Not provided"}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-500">Phone</span><span className="text-right text-sm font-semibold text-ink-800">{user.phone_number || "Not provided"}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-500">Gender</span><span className="text-right text-sm font-semibold text-ink-800">{user.gender || "Not provided"}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-500">Registered</span><span className="text-right text-sm font-semibold text-ink-800">{user.created_at ? new Date(user.created_at).toLocaleString() : "Unknown"}</span></div>
            {user.role === "TEACHER" && <>
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-500">Department</span><span className="text-right text-sm font-semibold text-ink-800">{user.department_name || "Not assigned"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-500">Designation</span><span className="text-right text-sm font-semibold text-ink-800">{user.designation || "Not assigned"}</span></div>
              <div className="space-y-2 border-t border-paper-200 pt-3"><p className="text-sm font-semibold text-ink-700">Assigned courses</p>{user.assigned_courses?.length ? user.assigned_courses.map((course) => <div key={course.id} className="rounded-md bg-paper-100 p-2"><p className="text-sm font-semibold text-ink-800">{course.course_code} · {course.name}</p><p className="mt-1 text-xs text-ink-500">{[course.department_name, course.semester, course.section && `Section ${course.section}`, course.academic_year].filter(Boolean).join(" · ")}</p></div>) : <p className="text-sm text-ink-500">No courses assigned</p>}</div>
            </>}
            {user.deleted_at && <div className="flex items-center justify-between gap-3"><span className="text-sm text-ink-500">Deleted</span><span className="text-right text-sm font-semibold text-ink-800">{new Date(user.deleted_at).toLocaleString()}</span></div>}
          </Card>
          <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
          <label className="block space-y-1.5 text-sm font-semibold text-ink-700"><span>Name</span><Input autoComplete="off" maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="block space-y-1.5 text-sm font-semibold text-ink-700"><span>Email</span><Input type="email" autoComplete="off" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="block space-y-1.5 text-sm font-semibold text-ink-700"><span>University ID <span className="font-normal text-ink-400">(optional)</span></span><Input autoComplete="off" maxLength={80} value={universityId} onChange={(event) => setUniversityId(event.target.value)} /></label>
          {user.role === "TEACHER" && <div className="space-y-4 rounded-md border border-line bg-paper-50 p-4"><p className="text-xs font-bold uppercase tracking-widest text-campus-700">Teacher information</p><label className="block space-y-1.5 text-sm font-semibold text-ink-700"><span>Department</span><select className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink-900" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">No department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}{department.is_active ? "" : " (inactive)"}</option>)}</select></label><label className="block space-y-1.5 text-sm font-semibold text-ink-700"><span>Designation</span><select className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink-900" value={designation} onChange={(event) => setDesignation(event.target.value)}><option value="">Not set</option>{designation && !designations.includes(designation) && <option value={designation}>{designation}</option>}{designations.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="block space-y-1.5 text-sm font-semibold text-ink-700"><span>Academic / professional information</span><textarea className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm leading-5 text-ink-900" maxLength={4000} value={professionalInfo} onChange={(event) => setProfessionalInfo(event.target.value)} /></label></div>}
          <p className="rounded-md bg-campus-50 p-3 text-xs leading-5 text-campus-900">Passwords and account roles can’t be changed from this form.</p>
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving…" : "Save changes"}</Button></div>
        </form>
      )}
    </dialog>
  );
}
