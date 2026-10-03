import type { ReactNode } from "react";
import { ArrowUpRight, ClipboardCheck, UsersRound } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";

export default function AuthLayout({ children, mode }: { children: ReactNode; mode: "signin" | "signup" }) {
  const signingIn = mode === "signin";
  return (
    <main className="min-h-dvh bg-paper-100 p-3 sm:p-6 lg:grid lg:place-items-center">
      <div className="mx-auto grid min-h-[min(760px,calc(100dvh-3rem))] w-full max-w-6xl overflow-hidden rounded-xl border border-line bg-white shadow-[0_24px_80px_-38px_rgba(16,35,63,.35)] lg:grid-cols-[1.04fr_.96fr]">
        <aside className="auth-panel campus-grid relative flex min-h-56 flex-col overflow-hidden px-6 py-6 text-white sm:px-10 sm:py-9 lg:min-h-full lg:px-12 lg:py-11">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-24 size-72 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-9 top-36 size-52 rounded-full border border-white/10" />
          <div className="relative flex items-center gap-2.5">
            <BrandMark size={22} className="size-10 bg-white text-campus-800" />
            <span className="text-lg font-bold tracking-normal">{APP_NAME}</span>
            <span className="ml-auto hidden rounded-full border border-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-100 sm:inline-flex">{ORGANIZATION_NAME}</span>
          </div>
          <div className="relative mt-8 max-w-lg sm:mt-10 lg:my-auto lg:mt-0 lg:py-14">
            <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-green-200"><span className="size-1.5 rounded-full bg-green-300" />Meetings, made actionable</p>
            <h2 className="max-w-lg font-serif text-3xl font-semibold leading-[1.08] sm:text-4xl lg:text-5xl">{signingIn ? <>Keep the team<br className="hidden sm:block" /> moving forward.</> : <>Good work starts<br className="hidden sm:block" /> with a clear plan.</>}</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-blue-100 sm:text-base">Turn classroom conversations into shared understanding, focused tasks, and visible progress.</p>
            <ul className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 lg:grid-cols-1">
              <li className="flex items-center gap-3 text-sm font-medium text-white"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/10 text-green-200"><ClipboardCheck size={17} /></span> Clear next steps after every meeting</li>
              <li className="flex items-center gap-3 text-sm font-medium text-white"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/10 text-green-200"><UsersRound size={17} /></span> Shared progress across your course</li>
            </ul>
          </div>
          <div className="relative mt-7 flex items-end justify-between border-t border-white/15 pt-4 text-xs text-blue-100 lg:mt-0">
            <span>Built for curious minds and busy teams.</span>
            <span className="hidden items-center gap-1 font-semibold text-green-200 sm:inline-flex">Learn together <ArrowUpRight size={14} /></span>
          </div>
        </aside>
        <section className="flex items-center justify-center px-5 py-8 sm:px-10 sm:py-10 lg:px-12">
          <div className="enter-up w-full max-w-sm">{children}</div>
        </section>
      </div>
    </main>
  );
}
