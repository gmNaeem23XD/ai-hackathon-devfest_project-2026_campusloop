import os, re, json, datetime as dt, httpx
from typing import Optional
from pydantic import BaseModel, Field, ValidationError

class Cand(BaseModel):  # every AI task must pass this before touching the database
    assignee_name: Optional[str] = None
    task_title: str = Field(min_length=3, max_length=200)
    description: str = ""
    deadline: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    is_explicit: bool = False
    confidence: float = Field(default=0.5, ge=0, le=1)

def llm(system, user, max_tokens=1000):
    key = os.getenv("AI_API_KEY")
    if not key: return None
    r = httpx.post("https://api.anthropic.com/v1/messages",
        headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
        json={"model": os.getenv("AI_MODEL", "claude-sonnet-4-6"), "max_tokens": max_tokens,
              "system": system, "messages": [{"role": "user", "content": user}]}, timeout=60)
    r.raise_for_status()
    return r.json()["content"][0]["text"]

def transcribe(path):
    key = os.getenv("STT_API_KEY")
    if not key: raise RuntimeError("STT_API_KEY is not set")
    with open(path, "rb") as f:
        r = httpx.post("https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {key}"}, files={"file": f}, data={"model": "whisper-1"}, timeout=300)
    r.raise_for_status()
    return r.json()["text"]

PROMPT = """Extract action items from this university meeting transcript. Today is {today}. Known participants: {names}.
Return ONLY JSON: {"tasks":[{"assignee_name":string|null,"task_title":string,"description":string,"deadline":"YYYY-MM-DD"|null,"is_explicit":boolean,"confidence":0..1}]}
Rules: NEVER guess an assignee - use null unless a participant is clearly named. Set a deadline only if stated or clearly relative (resolve using today), else null. is_explicit=false whenever the assignee or deadline is inferred."""

ACTION = re.compile(r"\b(will|should|needs? to|must|has to|have to|prepare|submit|write|finish|complete|send|review|create|present|upload)\b", re.I)
STRONG = re.compile(r"\b(will|needs? to|must|has to|have to)\b", re.I)
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

def parse_deadline(s):
    today, s = dt.date.today(), s.lower()
    m = re.search(r"\d{4}-\d{2}-\d{2}", s)
    if m:
        try: dt.date.fromisoformat(m.group()); return m.group()
        except ValueError: return None
    if "tomorrow" in s: return str(today + dt.timedelta(days=1))
    if "next week" in s: return str(today + dt.timedelta(days=7))
    for i, d in enumerate(DAYS):
        if d in s: return str(today + dt.timedelta(days=(i - today.weekday()) % 7 or 7))
    return None

def heuristic(text, names):  # offline fallback so the demo never breaks
    out = []
    for s in re.split(r"(?<=[.!?])\s+|\n+", text):
        s = s.strip()
        if len(s) < 12 or not ACTION.search(s): continue
        who = next((n for n in names if re.search(rf"\b{re.escape(n.split()[0])}\b", s, re.I)), None)
        dl = parse_deadline(s)
        out.append(Cand(assignee_name=who, task_title=s.rstrip(".!?")[:120], description=s, deadline=dl,
                        is_explicit=bool(who and STRONG.search(s)), confidence=round(0.5 + (0.2 if who else 0) + (0.15 if dl else 0), 2)))
    return out

def extract_tasks(text, names):
    try:
        out = llm(PROMPT.replace("{today}", str(dt.date.today())).replace("{names}", ", ".join(names)), text)
        if out:
            data = json.loads(re.sub(r"^```(?:json)?|```$", "", out.strip(), flags=re.M).strip())
            res = []
            for t in data["tasks"]:
                try: res.append(Cand(**t))
                except ValidationError: pass  # drop invalid items
            return res, "llm"
    except Exception as e:
        print("LLM extraction failed, using fallback:", e)
    return heuristic(text, names), "heuristic"

def fmt(ts):
    return "\n".join(f"• {t['title']} ({t['course']}) - due {t['deadline'] or 'no deadline'} [{t['status']}]" for t in ts)

def answer(q, ts):  # ts = ONLY this student's tasks
    ql, today = q.lower(), dt.date.today()
    open_ = [t for t in ts if t["status"] != "COMPLETED"]
    if "overdue" in ql: sel, head = [t for t in ts if t["status"] == "OVERDUE"], "Your overdue tasks:"
    elif "week" in ql:
        end = str(today + dt.timedelta(days=7))
        sel, head = [t for t in open_ if t["deadline"] and t["deadline"] <= end], "Due within 7 days (overdue included):"
    elif any(k in ql for k in ["incomplete", "pending", "unfinished", "left", "remaining"]): sel, head = open_, "Your unfinished tasks:"
    elif "first" in ql or "next" in ql:
        sel, head = sorted([t for t in open_ if t["deadline"]], key=lambda t: t["deadline"])[:1], "Your earliest deadline:"
    elif "course" in ql and "most" in ql:
        counts = {}
        for t in open_: counts[t["course"]] = counts.get(t["course"], 0) + 1
        if not counts: return "You have no pending work. 🎉"
        c = max(counts, key=counts.get)
        return f"{c} has the most pending work ({counts[c]} task(s))."
    else:
        try:
            r = llm("You are a student's task assistant. Answer ONLY from the JSON task list. If it can't be answered from it, say so. Be brief.",
                    f"Tasks: {json.dumps(ts)}\nToday: {today}\nQuestion: {q}", 500)
            if r: return r
        except Exception as e: print("assistant LLM failed:", e)
        return "I can answer: what's due this week, overdue tasks, unfinished tasks, my earliest deadline, and which course has the most pending work."
    return f"{head}\n{fmt(sel)}" if sel else "Nothing matches - you're all caught up. ✅"
