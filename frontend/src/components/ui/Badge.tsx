import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "neutral" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-indigo-100 text-indigo-700": variant === "default",
          "border-transparent bg-emerald-100 text-emerald-700": variant === "success",
          "border-transparent bg-orange-100 text-orange-700": variant === "warning",
          "border-transparent bg-red-100 text-red-700": variant === "danger",
          "border-transparent bg-slate-100 text-slate-700": variant === "neutral",
          "text-slate-900 border-slate-200": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
