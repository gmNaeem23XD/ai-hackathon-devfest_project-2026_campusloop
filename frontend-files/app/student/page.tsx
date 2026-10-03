"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import StatusBadge from "@/components/StatusBadge";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { useToast } from "@/components/ToastProvider";
import { homeForRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCheck, CircleHelp, ClipboardList, Clock3, Leaf, Send, Sparkles } from "lucide-react";

const QUICK = ["What do I need to finish this week?", "Show me my overdue tasks", "Which assignment is due first?", "Which course has the most pending work?"];

export default function Student() {
  const r = useRouter();
  const [me, setMe] = useState<any>(null); const [tasks, setTasks] = useState<any[]>([]);
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(""); const [asking, setAsking] = useState(false);
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [updatingTask, setUpdatingTask] = useState("");
  const notify = useToast();
  const completedCount = tasks.filter((task) => task.status === "COMPLETED").length;
  const openCount = tasks.length - completedCount;
  const overdueCount = tasks.filter((task) => task.status === "OVERDUE").length;

  const load = async () => {
    try {
      const u = await api("/me");
      if (u.role !== "STUDENT") return r.replace(homeForRole(u.role));
      setMe(u); setTasks(await api("/student/tasks")); setErr("");
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    setUpdatingTask(id); setErr("");
    try {
      const updated = await api<{ status: string }>(`/student/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setTasks((current) => current.map((task) => task.id === id ? { ...task, status: updated.status } : task));
      notify("Task status updated");
    } catch (e: any) { setErr(e.message); }
    finally { setUpdatingTask(""); }
  };
  const ask = async (text: string) => {
    if (!text.trim() || asking) return;
    setAsking(true);
    try { const x = await api("/ai/student-assistant", { method: "POST", body: JSON.stringify({ question: text }) }); setChat((c) => [...c, { q: text, a: x.answer }]); setQ(""); }
    catch (e: any) { setChat((c) => [...c, { q: text, a: "⚠ " + e.message }]); } finally { setAsking(false); }
  };

  return (
    <div className="min-h-dvh bg-paper-100">
      <Navbar name={me?.name} email={me?.email} role="Student" />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="campus-grid enter-up relative overflow-hidden rounded-xl px-5 py-6 text-white sm:px-8 sm:py-8 lg:flex lg:items-end lg:justify-between">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full border border-white/10" />
          <div className="relative max-w-2xl">
            <Badge tone="green" className="mb-4 border border-white/10"><span className="size-1.5 rounded-full bg-leaf-600" />Student workspace</Badge>
            <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">Your next chapter starts <span className="text-green-300">here.</span></h1>
            <p className="mt-2 text-sm text-blue-100 sm:text-base">Stay on top of your course commitments{me?.name ? `, ${me.name.split(" ")[0]}` : ""}.</p>
          </div>
          <div className="relative mt-6 inline-flex items-center gap-2 border-t border-white/15 pt-4 text-sm text-blue-100 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <Sparkles size={17} className="text-green-300" /> Small steps add up. Keep your momentum.
          </div>
        </section>

        {err && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>}

        <section aria-label="Task overview" className="grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-4 p-4 sm:p-5"><span className="grid size-11 place-items-center rounded-md bg-campus-100 text-campus-800"><ClipboardList size={21} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-ink-500">To work on</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{loading ? "—" : openCount}</p></div></Card>
          <Card className="flex items-center gap-4 p-4 sm:p-5"><span className="grid size-11 place-items-center rounded-md bg-leaf-100 text-leaf-800"><CheckCheck size={21} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Completed</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{loading ? "—" : completedCount}</p></div></Card>
          <Card className="flex items-center gap-4 p-4 sm:p-5"><span className="grid size-11 place-items-center rounded-md bg-amber-50 text-amber-800"><Clock3 size={21} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Overdue</p><p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{loading ? "—" : overdueCount}</p></div></Card>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.8fr)]">
          <section id="tasks" className="scroll-mt-28 space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.16em] text-campus-700">Your course work</p><h2 className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">My tasks</h2></div>
              {!loading && <Badge tone="blue">{tasks.length} total</Badge>}
            </div>
            {loading ? <LoadingSkeleton rows={3} /> : tasks.length === 0 ? <Card className="surface-dots p-6 sm:p-8"><span className="mb-4 grid size-11 place-items-center rounded-md bg-leaf-100 text-leaf-800"><Leaf size={22} /></span><h3 className="text-lg font-semibold text-ink-900">A clear desk, a clear mind.</h3><p className="mt-1 max-w-md text-sm leading-6 text-ink-500">No approved tasks yet. When your teacher shares the next steps, they’ll be ready for you here.</p></Card> : (
              <ul className="space-y-3">
                {tasks.map((task) => (
                  <li key={task.id}><Card className="overflow-hidden transition hover:border-campus-200 hover:shadow-card"><div className="flex gap-4 p-4 sm:p-5">
                    <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-md ${task.status === "COMPLETED" ? "bg-leaf-100 text-leaf-800" : "bg-campus-50 text-campus-700"}`}><ClipboardList size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="wrap-break-word font-semibold leading-6 text-ink-900">{task.title}</h3><StatusBadge status={task.status} /></div>
                      <p className="mt-1 text-sm text-ink-500">{task.course}<span className="mx-2 text-line">·</span>{task.deadline ? `Due ${task.deadline}` : "No deadline"}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-3"><label htmlFor={`status-${task.id}`} className="text-xs font-semibold text-ink-500">Update status</label>
                        <select id={`status-${task.id}`} className="h-9 max-w-full rounded-md border border-line bg-paper-50 px-3 text-sm font-medium text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-campus-300 disabled:opacity-60" disabled={updatingTask === task.id} value={task.status === "OVERDUE" ? "PENDING" : task.status} onChange={(event) => setStatus(task.id, event.target.value)}>
                          <option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option>
                        </select>
                        {updatingTask === task.id && <span className="text-xs text-campus-700" role="status">Saving…</span>}
                      </div>
                    </div>
                  </div></Card></li>
                ))}
              </ul>
            )}
          </section>

          <section id="assistant" className="scroll-mt-28 space-y-4">
            <div><p className="text-xs font-bold uppercase tracking-[.16em] text-leaf-700">A little help, right on time</p><h2 className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">Task assistant</h2></div>
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-paper-200 bg-paper-50">
                <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-campus-700 text-white"><Sparkles size={18} /></span><div><CardTitle>Ask about your workload</CardTitle><CardDescription>Answers use only your approved tasks.</CardDescription></div></div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="mb-4 flex flex-wrap gap-2">
                  {QUICK.map((question) => <Button key={question} variant="outline" size="sm" disabled={asking} onClick={() => ask(question)} className="h-auto min-h-8 whitespace-normal text-left leading-4">{question}</Button>)}
                </div>
                <div className="mb-4 max-h-80 min-h-24 space-y-3 overflow-y-auto rounded-md bg-paper-50 p-3" aria-live="polite" aria-relevant="additions">
                  {chat.length === 0 && !asking && <div className="flex h-24 flex-col items-center justify-center text-center"><CircleHelp size={21} className="text-campus-500" /><p className="mt-2 text-xs text-ink-500">Try a suggested question or ask your own.</p></div>}
                  {chat.map((entry, index) => <div key={`${entry.q}-${index}`} className="space-y-1.5 text-sm"><p className="font-semibold text-ink-800">{entry.q}</p><p className="whitespace-pre-wrap rounded-md border border-line bg-white p-3 leading-5 text-ink-600">{entry.a}</p></div>)}
                  {asking && <p className="flex items-center gap-2 text-sm text-campus-700" role="status"><span className="size-2 animate-pulse rounded-full bg-leaf-500" />Looking through your tasks…</p>}
                </div>
                <form onSubmit={(event) => { event.preventDefault(); ask(q); }} className="flex gap-2">
                  <label htmlFor="assistant-question" className="sr-only">Ask a question about your tasks</label>
                  <input id="assistant-question" className="h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-sm placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-campus-200" maxLength={500} placeholder="Ask a question…" value={q} onChange={(event) => setQ(event.target.value)} />
                  <Button type="submit" disabled={asking || !q.trim()} aria-label="Send question" size="icon" className="shrink-0"><Send size={17} /></Button>
                </form>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
