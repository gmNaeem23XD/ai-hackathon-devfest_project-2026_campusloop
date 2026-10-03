"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import StatusBadge from "@/components/StatusBadge";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { homeForRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, CheckCheck, CircleAlert, ClipboardCheck, FileAudio2, FileText, Sparkles, UsersRound } from "lucide-react";

export default function Teacher() {
  const r = useRouter();
  const [me, setMe] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]); const [cid, setCid] = useState("");
  const [students, setStudents] = useState<any[]>([]); const [progress, setProgress] = useState<any[]>([]);
  const [title, setTitle] = useState(""); const [text, setText] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [cands, setCands] = useState<any[]>([]); const [busy, setBusy] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(true); const [progressLoading, setProgressLoading] = useState(true);
  const [hasProcessedMeeting, setHasProcessedMeeting] = useState(false);
  const [busyTask, setBusyTask] = useState(""); const [pendingDelete, setPendingDelete] = useState<any>(null);
  const [err, setErr] = useState("");
  const notify = useToast();
  const completedCount = progress.filter((task) => task.status === "COMPLETED").length;
  const inProgressCount = progress.filter((task) => task.status === "IN_PROGRESS").length;

  useEffect(() => {
    (async () => {
      try {
        const u = await api("/me");
        if (u.role !== "TEACHER") return r.replace(homeForRole(u.role));
        setMe(u); const c = await api("/teacher/courses"); setCourses(c); if (c[0]) setCid(c[0].id);
      } catch (e: any) { setErr(e.message); }
      finally { setCoursesLoading(false); }
    })();
  }, []);

  const refresh = async () => {
    if (!cid) { setStudents([]); setProgress([]); setProgressLoading(false); return; }
    setProgressLoading(true);
    try {
      const [nextStudents, nextProgress] = await Promise.all([api(`/courses/${cid}/students`), api(`/courses/${cid}/tasks`)]);
      setStudents(nextStudents); setProgress(nextProgress);
    } finally { setProgressLoading(false); }
  };
  useEffect(() => { setCands([]); refresh().catch((e) => setErr(e.message)); }, [cid]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (!title.trim()) return setErr("Meeting title is required");
    if (!text.trim() && !file) return setErr("Paste a transcript or choose an audio file");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("course_id", cid); fd.append("title", title); fd.append("transcript", text);
      if (file) fd.append("audio", file);
      const mt = await api("/teacher/meetings", { method: "POST", body: fd });
      const p = await api(`/teacher/meetings/${mt.id}/process`, { method: "POST" });
      setCands(await api(`/teacher/meetings/${mt.id}/ai-tasks`));
      setHasProcessedMeeting(true);
      notify(`Found ${p.count} candidate task(s) using ${p.source === "llm" ? "the AI model" : "the rule-based fallback"}.`);
      setTitle(""); setText(""); setFile(null); setFileInputKey((key) => key + 1);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const edit = (id: string, patch: any) => setCands((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const approve = async (t: any) => {
    setErr(""); setBusyTask(t.id);
    try {
      await api("/teacher/tasks/approve", { method: "POST", body: JSON.stringify({ task_id: t.id, title: t.title, assigned_to: t.assignee_id || null, deadline: t.deadline || null }) });
      setCands((cs) => cs.filter((c) => c.id !== t.id));
      notify("Task approved and added to course progress");
      await refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBusyTask(""); }
  };
  const discard = async () => {
    if (!pendingDelete) return;
    const task = pendingDelete;
    setErr(""); setBusyTask(task.id);
    try {
      await api(`/teacher/tasks/${task.id}`, { method: "DELETE" });
      setCands((cs) => cs.filter((candidate) => candidate.id !== task.id));
      setPendingDelete(null);
      notify("Candidate task discarded");
    } catch (e: any) { setErr(e.message); }
    finally { setBusyTask(""); }
  };
  const input = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="min-h-dvh bg-paper-100">
      <Navbar name={me?.name} email={me?.email} role="Teacher" />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="campus-grid enter-up relative overflow-hidden rounded-xl px-5 py-6 text-white sm:px-8 sm:py-8 lg:flex lg:items-end lg:justify-between">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 size-80 rounded-full border border-white/10" />
          <div className="relative max-w-2xl">
            <Badge tone="green" className="mb-4 border border-white/10"><span className="size-1.5 rounded-full bg-leaf-600" />Teacher workspace</Badge>
            <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Make every meeting <span className="text-green-300">count.</span></h1>
            <p className="mt-2 text-sm text-blue-100 sm:text-base">Turn shared ideas into clear course progress{me?.name ? `, ${me.name.split(" ")[1] || me.name}` : ""}.</p>
          </div>
          {!coursesLoading && courses.length > 0 && <label className="relative mt-6 block min-w-0 lg:mt-0 lg:w-80">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-blue-100">Current course</span>
            <select aria-label="Course" className="h-11 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-green-300 [&>option]:text-ink-900" value={cid} onChange={(event) => setCid(event.target.value)}>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.course_code} · {course.name}{course.semester ? ` · ${course.semester}` : ""}{course.section ? ` · Sec ${course.section}` : ""}{course.academic_year ? ` · ${course.academic_year}` : ""}</option>)}
            </select>
          </label>}
        </section>

        {err && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>}

        {coursesLoading ? <LoadingSkeleton rows={1} /> : courses.length === 0 ? <Card className="p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-md bg-campus-50 text-campus-700"><BookOpen size={20} /></span><div><h2 className="font-semibold text-ink-900">No courses assigned</h2><p className="mt-1 text-sm text-ink-500">A course must be assigned to your teacher account before you can create meetings.</p></div></div></Card> : (
          <>
            <section aria-label="Course overview" className="grid gap-3 sm:grid-cols-3">
              <Card className="flex items-center gap-4 p-4 sm:p-5"><span className="grid size-11 place-items-center rounded-md bg-campus-100 text-campus-800"><UsersRound size={21} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Students</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{students.length}</p></div></Card>
              <Card className="flex items-center gap-4 p-4 sm:p-5"><span className="grid size-11 place-items-center rounded-md bg-leaf-100 text-leaf-800"><CheckCheck size={21} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Completed</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{progressLoading ? "—" : completedCount}</p></div></Card>
              <Card className="flex items-center gap-4 p-4 sm:p-5"><span className="grid size-11 place-items-center rounded-md bg-amber-50 text-amber-800"><CircleAlert size={21} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Needs review</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{cands.length}</p></div></Card>
            </section>

            <section id="meeting" className="scroll-mt-28">
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-paper-200 bg-white sm:flex sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                  <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-md bg-campus-700 text-white"><ClipboardCheck size={20} /></span><div><CardTitle>New meeting</CardTitle><CardDescription>Share a transcript or recording to identify next steps.</CardDescription></div></div>
                  <Badge tone="green" className="mt-3 w-fit sm:mt-0"><Sparkles size={13} /> Task extraction</Badge>
                </CardHeader>
                <CardContent className="pt-5">
                  <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block space-y-1.5 text-sm font-semibold text-ink-700" htmlFor="meeting-title"><span>Meeting title</span><input id="meeting-title" required maxLength={200} className={input + " h-11 bg-paper-50 px-3 font-normal"} placeholder="e.g. Weekly project meeting" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
                      <div className="space-y-1.5"><label className="block text-sm font-semibold text-ink-700" htmlFor="meeting-audio">Meeting recording <span className="font-normal text-ink-400">(optional)</span></label><div className="flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-line bg-paper-50 px-3"><FileAudio2 className="shrink-0 text-campus-600" size={17} /><input key={fileInputKey} id="meeting-audio" type="file" accept=".mp3,.wav,.m4a,.webm,.ogg" className="min-w-0 flex-1 text-xs text-ink-600 file:mr-2 file:rounded file:border-0 file:bg-campus-100 file:px-2 file:py-1.5 file:font-semibold file:text-campus-800" onChange={(event) => setFile(event.target.files?.[0] || null)} /></div></div>
                    </div>
                    <label className="block space-y-1.5 text-sm font-semibold text-ink-700" htmlFor="meeting-transcript"><span className="inline-flex items-center gap-2"><FileText size={16} className="text-campus-600" />Transcript</span><textarea id="meeting-transcript" className={input + " min-h-32 resize-y bg-paper-50 px-3 py-2.5 font-normal leading-6"} placeholder="Paste the meeting transcript here…" value={text} onChange={(event) => setText(event.target.value)} /></label>
                    <div className="flex flex-col gap-3 border-t border-paper-200 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-ink-500">Audio transcription needs <code className="rounded bg-paper-100 px-1">STT_API_KEY</code>. Text transcripts work without AI credentials.</p><Button type="submit" disabled={busy || !cid} aria-busy={busy} className="w-full sm:w-auto">{busy ? <><span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Analyzing meeting…</> : <><Sparkles size={16} />Extract tasks</>}</Button></div>
                  </form>
                </CardContent>
              </Card>
            </section>

            {cands.length > 0 && <section className="space-y-4" aria-labelledby="review-heading">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-leaf-700">Human in the loop</p><h2 id="review-heading" className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">Review suggested tasks</h2></div><Badge tone="amber">{cands.length} awaiting approval</Badge></div>
              <div className="grid gap-3 lg:grid-cols-2">
                {cands.map((task) => {
                  const needsReview = !task.assignee_id || !task.is_explicit;
                  return <Card key={task.id} className="overflow-hidden"><div className={`h-1 ${!task.assignee_id ? "bg-amber-400" : "bg-leaf-500"}`} /><CardContent className="space-y-4 pt-4">
                    <div className="flex flex-wrap items-center gap-2">{!task.assignee_id && <Badge tone="amber">Unassigned task</Badge>}{task.assignee_id && needsReview && <Badge tone="amber">Needs review</Badge>}{!needsReview && <Badge tone="green">Ready to assign</Badge>}<span className="ml-auto text-xs font-medium text-ink-500">{Math.round((task.confidence || 0) * 100)}% confidence</span></div>
                    <label className="block space-y-1.5 text-xs font-semibold text-ink-600" htmlFor={`task-title-${task.id}`}><span>Task title</span><input id={`task-title-${task.id}`} className={input + " h-10 px-3 font-semibold"} value={task.title} onChange={(event) => edit(task.id, { title: event.target.value })} /></label>
                    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-semibold text-ink-600" htmlFor={`task-assignee-${task.id}`}><span className="block">Assignee</span><select id={`task-assignee-${task.id}`} className={input + " h-10 px-2 font-normal"} value={task.assignee_id || ""} onChange={(event) => edit(task.id, { assignee_id: event.target.value || null })}><option value="">Assign to student…</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label className="space-y-1.5 text-xs font-semibold text-ink-600" htmlFor={`task-deadline-${task.id}`}><span className="block">Deadline</span><input id={`task-deadline-${task.id}`} type="date" className={input + " h-10 px-2 font-normal"} value={task.deadline || ""} onChange={(event) => edit(task.id, { deadline: event.target.value || null })} /></label></div>
                    <div className="flex flex-wrap gap-2 border-t border-paper-200 pt-3"><Button disabled={Boolean(busyTask)} onClick={() => approve(task)} size="sm"><CheckCheck size={15} />{busyTask === task.id ? "Saving…" : "Approve task"}</Button><Button variant="outline" disabled={Boolean(busyTask)} onClick={() => setPendingDelete(task)} size="sm">Discard</Button></div>
                  </CardContent></Card>;
                })}
              </div>
            </section>}
            {hasProcessedMeeting && cands.length === 0 && <Card className="flex items-start gap-3 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-leaf-100 text-leaf-800"><CheckCheck size={18} /></span><div><h3 className="font-semibold text-ink-900">Review queue is clear</h3><p className="mt-1 text-sm text-ink-500">No candidate tasks need review from the latest meeting.</p></div></Card>}

            <section id="progress" className="scroll-mt-28 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-campus-700">Course activity</p><h2 className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">Student progress</h2></div>{!progressLoading && progress.length > 0 && <Badge tone="blue">{inProgressCount} in progress</Badge>}</div>
              {progressLoading ? <LoadingSkeleton rows={2} /> : progress.length === 0 ? <Card className="surface-dots p-6"><h3 className="font-semibold text-ink-900">Nothing assigned yet</h3><p className="mt-1 text-sm text-ink-500">Approve a suggested task to begin tracking progress for this course.</p></Card> : <Card className="overflow-hidden">
                <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-paper-100 text-[11px] uppercase tracking-widest text-ink-500"><tr><th className="px-4 py-3 font-bold sm:px-5">Task</th><th className="px-4 py-3 font-bold sm:px-5">Student</th><th className="px-4 py-3 font-bold sm:px-5">Deadline</th><th className="px-4 py-3 font-bold sm:px-5">Status</th></tr></thead><tbody>{progress.map((task) => <tr key={task.id} className="border-t border-paper-200 transition-colors hover:bg-campus-50/50"><td className="max-w-sm px-4 py-3.5 font-semibold text-ink-800 sm:px-5">{task.title}</td><td className="px-4 py-3.5 text-ink-600 sm:px-5">{task.assignee || <span className="text-ink-400">Unassigned</span>}</td><td className="px-4 py-3.5 tabular-nums text-ink-600 sm:px-5">{task.deadline || "—"}</td><td className="px-4 py-3.5 sm:px-5"><StatusBadge status={task.status} /></td></tr>)}</tbody></table></div>
              </Card>}
            </section>
          </>
        )}
      </main>
      <ConfirmDialog open={Boolean(pendingDelete)} title="Discard candidate task?" message={pendingDelete ? `“${pendingDelete.title}” will be permanently removed from this meeting’s review list.` : "This task will be permanently removed."} confirmLabel="Discard task" busy={Boolean(busyTask)} onConfirm={discard} onClose={() => setPendingDelete(null)} />
    </div>
  );
}
