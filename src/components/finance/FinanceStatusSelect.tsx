import { useState } from "react";
import Badge from "@/components/ui/Badge";
import type { FinanceStatus } from "@/lib/finance/types";
import { getStatusLabel, getStatusTone } from "@/lib/finance/utils";

const statusOptions: FinanceStatus[] = ["pending", "cancelled"];

interface FinanceStatusSelectProps {
  status: FinanceStatus;
  onChange?: (status: FinanceStatus) => void;
  disabled?: boolean;
}

export default function FinanceStatusSelect({
  status,
  onChange,
  disabled,
}: FinanceStatusSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className="rounded-full"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
      >
        <Badge tone={getStatusTone(status)} label={getStatusLabel(status)} />
      </button>

      {open ? (
        <div className="absolute left-0 top-9 z-30 min-w-[180px] rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
          {statusOptions.map((option) => {
            const dotClass = option === "cancelled" ? "bg-rose-500" : "bg-amber-500";

            return (
              <button
                key={option}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  onChange?.(option);
                  setOpen(false);
                }}
              >
                <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                {getStatusLabel(option)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
