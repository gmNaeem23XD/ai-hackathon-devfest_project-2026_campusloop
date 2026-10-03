import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "blue" | "green" | "neutral" | "amber";
const tones: Record<BadgeTone, string> = {
  blue: "bg-campus-100 text-campus-800 ring-campus-200",
  green: "bg-leaf-100 text-leaf-900 ring-leaf-200",
  neutral: "bg-paper-100 text-ink-600 ring-line",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
};

export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", tones[tone], className)} {...props} />;
}
