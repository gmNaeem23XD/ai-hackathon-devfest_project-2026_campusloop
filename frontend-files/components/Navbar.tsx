"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, ClipboardCheck, LayoutDashboard, LogOut, Settings2, ShieldCheck, UserCircle2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandMark from "@/components/BrandMark";
import { APP_NAME } from "@/lib/config";
export default function Navbar({ name, email, role }: { name?: string; email?: string; role: string }) {
  const r = useRouter();
  const teacher = role.toLowerCase() === "teacher";
  const admin = role.toLowerCase() === "admin";
  const links = admin
    ? [{ href: "#users", label: "Accounts", icon: UsersRound }, { href: "#pending", label: "Teacher approvals", icon: ShieldCheck }, { href: "#departments", label: "Departments", icon: Building2 }]
    : teacher
    ? [{ href: "#meeting", label: "New meeting", icon: ClipboardCheck }, { href: "#progress", label: "Course progress", icon: LayoutDashboard }, { href: "/profile", label: "Profile & settings", icon: UserCircle2 }]
    : [{ href: "#tasks", label: "My tasks", icon: ClipboardCheck }, { href: "#assistant", label: "Task assistant", icon: LayoutDashboard }, { href: "/profile", label: "Profile & settings", icon: UserCircle2 }];

  return (
    <header className="sticky top-0 z-30 border-b border-campus-900/10 bg-white/95 shadow-[0_3px_14px_-12px_rgba(16,35,63,.4)] backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={admin ? "/admin" : teacher ? "/teacher" : "/student"} className="flex shrink-0 items-center gap-2.5 rounded-md">
          <BrandMark size={20} className="size-9" />
          <span className="leading-tight"><span className="block text-sm font-bold text-ink-900 sm:text-base">{APP_NAME}</span><span className="hidden text-[10px] font-semibold uppercase tracking-widest text-ink-400 sm:block">{role} workspace</span></span>
        </Link>
        <nav aria-label="Workspace navigation" className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-campus-50 hover:text-campus-800">
              <Icon size={16} aria-hidden="true" />{label}
            </a>
          ))}
        </nav>
        <details className="group relative shrink-0">
          <summary aria-label="Open account menu" className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-line bg-white p-1 pr-2 text-left transition hover:border-campus-300 hover:bg-paper-100 sm:pr-3">
            <span aria-hidden="true" className="grid size-8 place-items-center rounded bg-leaf-100 text-sm font-bold text-leaf-900">{name?.trim().charAt(0).toUpperCase() || "U"}</span>
            <span className="hidden max-w-36 truncate text-sm font-semibold text-ink-700 sm:block">{name || role}</span>
            <ChevronDown size={15} className="text-ink-400 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-line bg-white p-3 shadow-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Signed in as</p>
            <p className="mt-1 truncate text-sm font-bold text-ink-900">{name || role}</p>
            {email && <p className="truncate text-sm text-ink-500">{email}</p>}
            <div className="my-3 border-t border-paper-200" />
            {!admin && <Link href="/profile" className="flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-ink-700 hover:bg-campus-50 hover:text-campus-800"><Settings2 size={16} />Profile &amp; settings</Link>}
            <Button variant="ghost" className="w-full justify-start" onClick={() => { localStorage.removeItem("token"); r.replace("/"); }}><LogOut size={16} /> Log out</Button>
          </div>
        </details>
      </div>
      <nav aria-label="Workspace navigation" className="flex gap-1 overflow-x-auto border-t border-paper-200 px-3 py-1 md:hidden">
        {links.map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-semibold text-ink-600 hover:bg-campus-50 hover:text-campus-800"><Icon size={15} aria-hidden="true" />{label}</a>
        ))}
      </nav>
    </header>
  );
}
