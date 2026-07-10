"use client";

import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreGauge } from "@/components/charts/score-gauge";
import { useIndependenceScore } from "@/hooks/useIndependenceScore";
import { getScoreLabel } from "@/lib/independence-score";
import { cn } from "@/lib/utils";

const BADGE_VARIANT: Record<ReturnType<typeof getScoreLabel>["tone"], BadgeProps["variant"]> = {
  destructive: "destructive",
  warning: "warning",
  default: "secondary",
  success: "success",
};

export function IndependenceScoreCard({ practiceId }: { practiceId: string | null | undefined }) {
  const { current, changeSinceLastWeek, isLoading, error, isRecalculating, recalculate } =
    useIndependenceScore(practiceId);

  async function handleRecalculate() {
    const result = await recalculate();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Independence score updated");
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          <Skeleton className="h-44 w-44 rounded-full" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-36" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Independence Score</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Independence Score</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No score calculated yet. Add credentials and payer enrollments, then run your first
            audit.
          </p>
          <Button onClick={handleRecalculate} disabled={!practiceId || isRecalculating}>
            <RefreshCw className={cn("h-4 w-4", isRecalculating && "animate-spin")} />
            Calculate my score
          </Button>
        </CardContent>
      </Card>
    );
  }

  const scoreInfo = getScoreLabel(current.score);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Independence Score</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRecalculate}
          disabled={isRecalculating}
          aria-label="Recalculate score"
        >
          <RefreshCw className={cn("h-4 w-4", isRecalculating && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
        <ScoreGauge score={current.score} size={188} strokeWidth={16} />
        <Badge variant={BADGE_VARIANT[scoreInfo.tone]} className="text-sm">
          {scoreInfo.label}
        </Badge>
        <p className="max-w-xs text-xs text-muted-foreground">{scoreInfo.description}</p>
        {changeSinceLastWeek !== null && changeSinceLastWeek !== 0 && (
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              changeSinceLastWeek > 0 ? "text-success" : "text-destructive"
            )}
          >
            {changeSinceLastWeek > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {changeSinceLastWeek > 0 ? `+${changeSinceLastWeek}` : changeSinceLastWeek} points
            since last week
          </div>
        )}
        {changeSinceLastWeek === 0 && (
          <p className="text-sm text-muted-foreground">No change since last week</p>
        )}
      </CardContent>
    </Card>
  );
}
