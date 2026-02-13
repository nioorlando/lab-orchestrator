import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline" | "accent" | "danger";
  size?: "sm" | "md" | "lg";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-ink text-white hover:bg-slateish shadow-panel": variant === "default",
            "bg-transparent text-ink hover:bg-black/5": variant === "ghost",
            "border border-border text-ink hover:bg-black/5": variant === "outline",
            "bg-accent text-white hover:bg-accent/90 shadow-glow": variant === "accent",
            "bg-red-600 text-white hover:bg-red-700": variant === "danger"
          },
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-5 text-base": size === "lg"
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
