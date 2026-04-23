"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export const SelectField = ({
  value,
  onValueChange,
  options
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) => (
  <Select.Root value={value} onValueChange={onValueChange}>
    <Select.Trigger className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <Select.Value />
      <ChevronDown className="h-4 w-4" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Content className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-900">
        <Select.Viewport className="p-1">
          {options.map((option) => (
            <Select.Item
              value={option.value}
              key={option.value}
              className="relative flex cursor-pointer items-center rounded-lg px-8 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 data-[highlighted]:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 dark:data-[highlighted]:bg-slate-800"
            >
              <Select.ItemIndicator className="absolute left-2">
                <Check className="h-4 w-4" />
              </Select.ItemIndicator>
              <Select.ItemText>{option.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
);
