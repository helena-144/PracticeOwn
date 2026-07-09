"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreGauge } from "@/components/charts/score-gauge";
import { CategoryBarChart, type CategoryBarDatum } from "@/components/charts/category-bar-chart";
import { usePractice } from "@/hooks/usePractice";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { IndependenceScoreBreakdown } from "@/types/database";

const CATEGORY_LABELS: Record<keyof IndependenceScoreBreakdown, string> = {
  individual_npi: "Individual NPI on file",
  caqh_practice_controlled: "CAQH controlled by practice",
  caqh_attestation_current: "CAQH attestation current",
  direct_payer_contracts: "Direct payer contracts",
  license_current: "License current",
  malpractice_current: "Malpractice current",
  no_critical_alerts: "No critical alerts",
};

interface ScoreRecord {
  score: number;
  breakdown: IndependenceScoreBreakdown;
  computedAt: string;
}

export default function IndependenceScorePage() {
  const { practice } = usePractice();
  const [scoreRecord, setScoreRecord] = useState<ScoreRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const fetchScore = useCallback(async () => {
    if (!practice?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("independence_scores")
      .select("*")
      .eq("practice_id", practice.id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      toast.error(error.message);
    } else if (data) {
      setScoreRecord({
        score: data.score,
        breakdown: data.score_breakdown as unknown as IndependenceScoreBreakdown,
        computedAt: data.computed_at,
      });
    } else {
      setScoreRecord(null);
    }

    setIsLoading(false);
  }, [practice?.id]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  async function handleRecalculate() {
    if (!practice?.id) return;
    setIsRecalculating(true);

    const supabase = createClient();
    const { error } = await supabase.rpc("recalculate_independence_score", {
      p_practice_id: practice.id,
    });

    setIsRecalculating(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Independence score updated");
    fetchScore();
  }

  const categoryData: CategoryBarDatum[] = scoreRecord
    ? (Object.entries(scoreRecord.breakdown) as [keyof IndependenceScoreBreakdown, IndependenceScoreBreakdown[keyof IndependenceScoreBreakdown]][]).map(
        ([key, value]) => ({
          label: CATEGORY_LABELS[key] ?? key,
          value: value.points,
          max: value.max,
        })
      )
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Independence Score</h1>
          <p className="text-sm text-muted-foreground">
            A composite measure of how independent your practice is from outside platforms and
            payers.
          </p>
        </div>
        <Button onClick={handleRecalculate} disabled={!practice || isRecalculating}>
          <RefreshCw className={isRecalculating ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Recalculate
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !scoreRecord ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              No score calculated yet. Add credentials and payer enrollments, then recalculate.
            </p>
            <Button onClick={handleRecalculate} disabled={!practice || isRecalculating}>
              Calculate independence score
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="flex flex-col items-center justify-center py-6">
              <ScoreGauge score={scoreRecord.score} label="out of 100" />
              <p className="mt-4 text-xs text-muted-foreground">
                Last calculated {formatDate(scoreRecord.computedAt)}
              </p>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Category breakdown</CardTitle>
                <CardDescription>Points earned toward the overall 100-point score.</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBarChart data={categoryData} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Contributing factors</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {(
                  Object.entries(scoreRecord.breakdown) as [
                    keyof IndependenceScoreBreakdown,
                    IndependenceScoreBreakdown[keyof IndependenceScoreBreakdown],
                  ][]
                ).map(([key, value]) => {
                  const met = "met" in value ? value.met : value.points === value.max;
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-4 border-b pb-3 last:border-0"
                    >
                      <p className="text-sm font-medium">{CATEGORY_LABELS[key]}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {value.points}/{value.max}
                        </span>
                        <Badge variant={met ? "success" : "destructive"}>
                          {met ? "Met" : "Not met"}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
