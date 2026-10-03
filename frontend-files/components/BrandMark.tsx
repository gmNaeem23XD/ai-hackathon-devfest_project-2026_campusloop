import { BookOpenCheck } from "lucide-react";

export default function BrandMark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return <span aria-hidden="true" className={`grid place-items-center rounded-md bg-campus-700 text-white shadow-sm ${className}`}><BookOpenCheck size={size} strokeWidth={2.2} /></span>;
}
