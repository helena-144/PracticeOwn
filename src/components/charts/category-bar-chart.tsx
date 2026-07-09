"use client";

import { cn } from "@/lib/utils";

export interface CategoryBarDatum {
  label: string;
  value: number;
  max?: number;
}

function barColor(ratio: number): string {
  if (ratio >= 0.75) return "bg-success";
  if (ratio >= 0.5) return "bg-warning";
  return "bg-destructive";
}

export function CategoryBarChart({
  data,
  className,
}: {
  data: CategoryBarDatum[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {data.map((datum) => {
        const max = datum.max ?? 100;
        const ratio = max > 0 ? Math.max(0, Math.min(1, datum.value / max)) : 0;

        return (
          <div key={datum.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{datum.label}</span>
              <span className="font-medium tabular-nums">
                {Math.round(datum.value)}/{max}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-500", barColor(ratio))}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
