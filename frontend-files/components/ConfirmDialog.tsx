"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmDialog({ open, title, message, confirmLabel, busyLabel = "Removing…", busy = false, onConfirm, onClose }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-dialog-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === dialogRef.current && !busy) onClose(); }}
      className="w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-white p-0 text-ink-900 shadow-xl backdrop:bg-campus-900/40"
    >
      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 id="confirm-dialog-title" className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-600">{message}</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}