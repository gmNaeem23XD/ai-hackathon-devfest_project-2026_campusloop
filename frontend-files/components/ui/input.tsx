"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const inputStyles = "flex h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink-900 shadow-sm transition placeholder:text-ink-400 hover:border-campus-300 focus-visible:border-campus-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-campus-200 disabled:cursor-not-allowed disabled:bg-paper-100";

function InputBase({ className, ...props }: InputProps) {
  return <input className={cn(inputStyles, className)} {...props} />;
}

export function PasswordInput({ className, ...props }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative block">
      <InputBase {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-0 top-0 size-11 text-ink-500 hover:text-campus-800"
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </Button>
    </span>
  );
}

export function Input({ type, ...props }: InputProps) {
  if (type === "password") return <PasswordInput {...props} />;
  return <InputBase type={type} {...props} />;
}
