import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-campus-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-campus-700 text-white shadow-sm hover:bg-campus-800 active:bg-campus-900",
        secondary: "bg-leaf-100 text-leaf-900 hover:bg-leaf-200 active:bg-leaf-300",
        outline: "border border-line bg-white text-ink-700 hover:border-campus-300 hover:bg-campus-50",
        ghost: "text-ink-600 hover:bg-campus-50 hover:text-campus-800",
        danger: "bg-red-700 text-white hover:bg-red-800",
      },
      size: {
        default: "min-h-10 px-4 py-2 text-sm",
        sm: "min-h-8 px-3 py-1.5 text-xs",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant = "primary", size = "default", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
