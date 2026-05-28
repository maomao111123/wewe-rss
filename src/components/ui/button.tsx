import * as React from "react";

import { cn } from "@/lib/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm";
};

const variantClassMap: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-blue-600 text-white hover:bg-blue-500 disabled:bg-blue-300",
  outline:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
  destructive:
    "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-300",
};

const sizeClassMap: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-10 px-4 py-2 text-sm",
  sm: "h-9 px-3 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed",
          variantClassMap[variant],
          sizeClassMap[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
