import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "ghost" | "danger" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
};

export const Button = ({ className, variant = "primary", size = "default", asChild = false, ...props }: ButtonProps) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        size === "default" && "px-4 py-2.5",
        size === "sm" && "h-8 rounded-lg px-3 text-xs",
        size === "lg" && "h-11 px-8",
        size === "icon" && "h-9 w-9",
        variant === "primary" && "bg-indigo-600 text-white shadow-card hover:scale-[1.01] hover:bg-indigo-500",
        variant === "ghost" && "bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
        variant === "danger" && "bg-rose-600 text-white hover:scale-[1.01] hover:bg-rose-500",
        variant === "outline" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
        className
      )}
      {...props}
    />
  );
};
