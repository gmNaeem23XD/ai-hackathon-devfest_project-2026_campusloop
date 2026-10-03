"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

type ToastItem = { id: number; message: string; kind: "success" | "error" };
type ToastContextValue = (message: string, kind?: ToastItem["kind"]) => void;

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast must be used inside ToastProvider");
  return notify;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const notify: ToastContextValue = (message, kind = "success") => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
  };

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-full sm:max-w-sm" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div key={toast.id} role={toast.kind === "error" ? "alert" : "status"} className={`pointer-events-auto flex w-full items-start justify-between gap-4 rounded-md border bg-white p-3 text-sm shadow-lg ${toast.kind === "error" ? "border-red-200 text-red-800" : "border-leaf-200 text-leaf-900"}`}>
            <span className="flex items-start gap-2"><span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${toast.kind === "error" ? "bg-red-100" : "bg-leaf-100"}`}>{toast.kind === "error" ? <X size={13} /> : <Check size={13} />}</span>{toast.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} className="shrink-0 rounded px-1 text-xs font-semibold text-ink-500 hover:bg-paper-100">Dismiss</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}