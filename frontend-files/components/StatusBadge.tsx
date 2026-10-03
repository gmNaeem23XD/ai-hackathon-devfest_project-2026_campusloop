import { Badge } from "@/components/ui/badge";
import { CircleCheck, Clock3, CircleDashed, TriangleAlert } from "lucide-react";

const styles: Record<string, string> = {
  PENDING: "neutral",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
  OVERDUE: "amber",
};

const icons: Record<string, typeof CircleDashed> = {
  PENDING: CircleDashed,
  IN_PROGRESS: Clock3,
  COMPLETED: CircleCheck,
  OVERDUE: TriangleAlert,
};

export default function StatusBadge({ status }: { status: string }) {
  const Icon = icons[status] || CircleDashed;
  return <Badge tone={(styles[status] || "neutral") as "blue" | "green" | "neutral" | "amber"} className="uppercase tracking-wide"><Icon size={13} aria-hidden="true" />{status.replace("_", " ").toLowerCase()}</Badge>;
}
