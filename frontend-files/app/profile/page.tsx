"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { useToast } from "@/components/ToastProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { homeForRole } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { BookOpen, Camera, Check, ChevronLeft, CircleAlert, LoaderCircle, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";

type Profile = {
  id: string;
  name: string;
  email: string;
  university_id: string | null;
  student_id: string | null;
  teacher_id: string | null;
  phone_number: string | null;
  gender: string | null;
  profile_picture_url: string | null;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  account_status: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string | null;
  teacher?: {
    department_id: string | null;
    department_code: string | null;
    department_name: string | null;
    designation: string | null;
    professional_info: string | null;
    assigned_courses: Array<{
      id: string;
      name: string;
      course_code: string;
      department_name: string | null;
      semester: string | null;
      section: string | null;
      academic_year: string | null;
    }>;
  } | null;
};

type ProfileUpdate = { name: string; phone_number: string | null; gender: string | null };
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const GENDERS = ["Female", "Male", "Non-binary", "Other", "Prefer not to say"];

function statusTone(status: string): "green" | "amber" | "neutral" {
  if (status === "Active") return "green";
  if (status === "Pending approval") return "amber";
  return "neutral";
}

export default function ProfilePage() {
  const router = useRouter();
  const notify = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [preview, setPreview] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pictureBusy, setPictureBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const result = await api<Profile>("/profile");
        if (!active) return;
        if (result.role === "ADMIN") {
          router.replace("/admin");
          return;
        }
        setProfile(result);
        setName(result.name);
        setPhone(result.phone_number || "");
        setGender(result.gender || "");
        setPreview(result.profile_picture_url ? `${API_BASE}${result.profile_picture_url}` : "");
      } catch (cause: unknown) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load your profile.");
      } finally { if (active) setLoading(false); }
    };
    loadProfile();
    return () => { active = false; };
  }, [router]);

  useEffect(() => () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      let updated = profile;
      if (name.trim() !== profile?.name || (phone.trim() || null) !== profile?.phone_number || (gender || null) !== profile?.gender) {
        updated = await api<Profile>("/profile", {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim(), phone_number: phone.trim() || null, gender: gender || null } satisfies ProfileUpdate),
        });
      }
      if (selectedImage) {
        const form = new FormData();
        form.append("image", selectedImage);
        const result = await api<{ profile_picture_url: string }>("/profile/picture", { method: "PUT", body: form });
        if (updated) updated = { ...updated, profile_picture_url: result.profile_picture_url };
      }
      if (updated) {
        setProfile(updated);
        setName(updated.name);
        setPhone(updated.phone_number || "");
        setGender(updated.gender || "");
        setPreview(updated.profile_picture_url ? `${API_BASE}${updated.profile_picture_url}` : "");
      }
      setSelectedImage(null);
      notify("Profile changes saved");
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Unable to save profile changes."); }
    finally { setSaving(false); }
  };

  const choosePicture = (file?: File) => {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile pictures must be 5 MB or smaller.");
      return;
    }
    setSelectedImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const removePicture = async () => {
    setPictureBusy(true); setError("");
    try {
      await api("/profile/picture", { method: "DELETE" });
      setSelectedImage(null);
      setPreview("");
      setProfile((current) => current ? { ...current, profile_picture_url: null } : current);
      notify("Profile picture removed");
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Unable to remove profile picture."); }
    finally { setPictureBusy(false); }
  };

  if (loading) return <div className="min-h-dvh bg-paper-100"><main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8"><LoadingSkeleton rows={3} /></main></div>;
  if (!profile) return <main className="mx-auto max-w-3xl p-4 sm:p-8">{error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}<Button variant="outline" onClick={() => router.replace("/")}><ChevronLeft size={16} /> Back to sign in</Button></main>;

  const isTeacher = profile.role === "TEACHER";
  const protectedId = isTeacher ? profile.teacher_id : profile.student_id;
  const picture = preview || "";

  return (
    <div className="min-h-dvh bg-paper-100">
      <Navbar name={profile.name} email={profile.email} role={isTeacher ? "Teacher" : "Student"} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-campus-700">{APP_NAME} account</p><h1 className="mt-1 font-serif text-3xl font-semibold text-ink-900">Profile &amp; settings</h1><p className="mt-2 text-sm text-ink-500">Manage your personal information and review your account details.</p></div><Button variant="outline" onClick={() => router.push(isTeacher ? "/teacher" : "/student")}><ChevronLeft size={16} /> Back to workspace</Button></div>

        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

        <form onSubmit={saveProfile} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.72fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="border-b border-paper-200"><CardTitle>Personal information</CardTitle><CardDescription>Update the contact information associated with your account.</CardDescription></CardHeader>
              <CardContent className="space-y-4 pt-5">
                <label className="block space-y-1.5 text-sm font-semibold text-ink-700"><span>Full name</span><Input autoComplete="name" maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label className="block space-y-1.5 text-sm font-semibold text-ink-700"><span>Phone number</span><Input autoComplete="tel" type="tel" maxLength={30} placeholder="Add a contact number" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                <label className="block space-y-1.5 text-sm font-semibold text-ink-700"><span>Gender</span><select className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-campus-200" value={gender} onChange={(event) => setGender(event.target.value)}><option value="">Select an option</option>{GENDERS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-paper-200"><CardTitle>Account information</CardTitle><CardDescription>Authentication and role-controlled fields are read-only.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
                <div className="space-y-1.5"><p className="text-sm font-semibold text-ink-700">Email</p><div className="flex h-11 items-center rounded-md border border-line bg-paper-100 px-3 text-sm text-ink-600">{profile.email}</div></div>
                <div className="space-y-1.5"><p className="text-sm font-semibold text-ink-700">{isTeacher ? "Teacher ID" : "Student ID"}</p><div className="flex h-11 items-center rounded-md border border-line bg-paper-100 px-3 text-sm text-ink-600">{protectedId || "Not assigned"}</div></div>
                <div className="space-y-1.5"><p className="text-sm font-semibold text-ink-700">Role</p><div className="flex h-11 items-center"><Badge tone={isTeacher ? "green" : "blue"}>{profile.role}</Badge></div></div>
                <div className="space-y-1.5"><p className="text-sm font-semibold text-ink-700">Account status</p><div className="flex h-11 items-center"><Badge tone={statusTone(profile.account_status)}>{profile.account_status}</Badge></div></div>
              </CardContent>
            </Card>

            {isTeacher && <Card>
              <CardHeader className="border-b border-paper-200"><CardTitle>Teacher information</CardTitle><CardDescription>Academic details and course assignments managed by the university.</CardDescription></CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><p className="text-sm font-semibold text-ink-700">Department</p><div className="flex min-h-11 items-center rounded-md border border-line bg-paper-100 px-3 text-sm text-ink-600">{profile.teacher?.department_name || "Not assigned"}</div></div><div className="space-y-1.5"><p className="text-sm font-semibold text-ink-700">Designation</p><div className="flex min-h-11 items-center rounded-md border border-line bg-paper-100 px-3 text-sm text-ink-600">{profile.teacher?.designation || "Not assigned"}</div></div></div>
                {profile.teacher?.professional_info && <div className="space-y-1.5"><p className="text-sm font-semibold text-ink-700">Academic / professional information</p><p className="rounded-md border border-line bg-paper-100 p-3 text-sm leading-6 text-ink-600">{profile.teacher.professional_info}</p></div>}
                <div><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-ink-800">Assigned courses</h3><Badge tone="blue">{profile.teacher?.assigned_courses.length || 0}</Badge></div>{profile.teacher?.assigned_courses.length ? <div className="space-y-2">{profile.teacher.assigned_courses.map((course) => <div key={course.id} className="flex flex-col gap-1 rounded-md border border-line bg-paper-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-ink-900">{course.course_code}<span className="mx-2 text-line">·</span>{course.name}</p><p className="mt-1 text-xs text-ink-500">{course.department_name || profile.teacher?.department_name || "Department not assigned"}</p></div><p className="text-xs text-ink-500">{[course.semester, course.section && `Section ${course.section}`, course.academic_year].filter(Boolean).join(" · ") || "Term details not set"}</p></div>)}</div> : <p className="rounded-md border border-dashed border-line p-4 text-sm text-ink-500">No courses are assigned to your account yet.</p>}</div>
              </CardContent>
            </Card>}
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader className="border-b border-paper-200"><CardTitle>Profile picture</CardTitle><CardDescription>JPEG, PNG, or WebP up to 5 MB.</CardDescription></CardHeader>
              <CardContent className="flex flex-col items-center gap-4 pt-5">
                <div className="grid size-28 place-items-center overflow-hidden rounded-full border-4 border-campus-100 bg-campus-50 text-campus-700">{picture ? <img src={picture} alt="Profile preview" className="size-full object-cover" /> : <UserRound size={48} />}</div>
                <input ref={fileRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile picture" onChange={(event) => choosePicture(event.target.files?.[0])} />
                <div className="flex w-full flex-wrap justify-center gap-2"><Button type="button" variant="outline" size="sm" disabled={pictureBusy} onClick={() => fileRef.current?.click()}><Camera size={15} />{picture ? "Change picture" : "Upload picture"}</Button>{picture && !selectedImage && <Button type="button" variant="ghost" size="sm" disabled={pictureBusy} onClick={removePicture}><Trash2 size={15} />Remove</Button>}{selectedImage && <Button type="button" variant="ghost" size="sm" disabled={pictureBusy} onClick={() => { setSelectedImage(null); setPreview(profile.profile_picture_url ? `${API_BASE}${profile.profile_picture_url}` : ""); if (fileRef.current) fileRef.current.value = ""; }}>Cancel change</Button>}</div>
                {selectedImage && <p className="max-w-full break-all text-center text-xs text-ink-500">{selectedImage.name} · {(selectedImage.size / 1024 / 1024).toFixed(1)} MB</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-paper-200"><CardTitle>Settings</CardTitle><CardDescription>Available account and security controls.</CardDescription></CardHeader>
              <CardContent className="space-y-3 pt-5"><div className="flex items-start gap-3 rounded-md bg-campus-50 p-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-campus-700" /><p className="text-xs leading-5 text-campus-900">Password and notification settings are not currently supported. Contact an administrator if your sign-in credentials need attention.</p></div><Button type="button" variant="outline" className="w-full" onClick={() => { localStorage.removeItem("token"); router.replace("/"); }}>Sign out</Button></CardContent>
            </Card>

            <Button type="submit" disabled={saving || pictureBusy} aria-busy={saving} className="w-full">{saving ? <><LoaderCircle size={16} className="animate-spin" />Saving changes…</> : <><Save size={16} />Save changes</>}</Button>
          </aside>
        </form>
      </main>
    </div>
  );
}
