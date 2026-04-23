import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = ({ className, ...props }: InputProps) => (
  <input
    className={cn(
      "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-indigo-500 transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
      className
    )}
    {...props}
  />
);
