"use client";

import { ListChecks } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoadmapSteps } from "@/hooks/useRoadmapSteps";
import type { RoadmapPriority } from "@/types/database";

const PRIORITY_ORDER: Record<RoadmapPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function RoadmapProgress({ practiceId }: { practiceId: string | null | undefined }) {
  const { steps, isLoading, error, toggleComplete } = useRoadmapSteps(practiceId);

  const incomplete = steps
    .filter((step) => !step.is_completed)
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.module.localeCompare(b.module) || a.step_number - b.step_number;
    })
    .slice(0, 3);

  async function handleToggle(id: string) {
    const result = await toggleComplete(id, true);
    if (result.error) {
      toast.error(result.error);
    }
  }

  const completedCount = steps.filter((step) => step.is_completed).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Roadmap</CardTitle>
        {steps.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{steps.length} complete
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : incomplete.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ListChecks className="h-6 w-6 text-success" />
            <p className="text-sm text-muted-foreground">
              {steps.length === 0 ? "No roadmap steps yet." : "All roadmap steps complete."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {incomplete.map((step) => (
              <li key={step.id} className="flex items-start gap-3">
                <Checkbox
                  className="mt-0.5"
                  checked={false}
                  onCheckedChange={() => handleToggle(step.id)}
                  aria-label={`Mark "${step.title}" complete`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
