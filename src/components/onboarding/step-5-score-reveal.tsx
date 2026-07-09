"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreGauge } from "@/components/charts/score-gauge";
import { createClient } from "@/lib/supabase/client";
import type { IndependenceScoreBreakdown } from "@/types/database";

import type { StepProps } from "./wizard-types";

const CATEGORY_LABELS: Record<keyof IndependenceScoreBreakdown, string> = {
  individual_npi: "Individual NPI on file",
  caqh_practice_controlled: "CAQH controlled by your practice",
  caqh_attestation_current: "CAQH attestation current",
  direct_payer_contracts: "Direct payer contracts",
  license_current: "License current",
  malpractice_current: "Malpractice current",
  no_critical_alerts: "No critical alerts",
};

const ACTION_ITEMS: Record<keyof IndependenceScoreBreakdown, string> = {
  individual_npi:
    "Get an Individual NPI. It's required for nearly every payer credentialing process.",
  caqh_practice_controlled:
    "Take ownership of your CAQH profile instead of leaving it with a platform, so you control your own credentialing data.",
  caqh_attestation_current: "Re-attest your CAQH profile — attestations expire every 120 days.",
  direct_payer_contracts:
    "Pursue direct contracts with payers instead of relying solely on credentialing platforms.",
  license_current: "Renew your license — it's expired or expiring soon.",
  malpractice_current: "Renew your malpractice insurance — it's expired or expiring soon.",
  no_critical_alerts: "Resolve the critical alerts outstanding on your dashboard.",
};

type BreakdownEntry = [keyof IndependenceScoreBreakdown, IndependenceScoreBreakdown[keyof IndependenceScoreBreakdown]];

export function Step5ScoreReveal({ data, refresh }: StepProps) {
  const router = useRouter();
  const [isComputing, setIsComputing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<IndependenceScoreBreakdown | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function computeScore() {
      const supabase = createClient();

      const { error: rpcError } = await supabase.rpc("recalculate_independence_score", {
        p_practice_id: data.practice.id,
      });

      if (rpcError) {
        setError(rpcError.message);
        setIsComputing(false);
        return;
      }

      const { data: scoreRow, error: fetchError } = await supabase
        .from("independence_scores")
        .select("*")
        .eq("practice_id", data.practice.id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError || !scoreRow) {
        setError(fetchError?.message ?? "Couldn't load your score");
        setIsComputing(false);
        return;
      }

      await supabase
        .from("practices")
        .update({ onboarding_completed_at: new Date().toISOString(), onboarding_step: 5 })
        .eq("id", data.practice.id);

      setScore(scoreRow.score);
      setBreakdown(scoreRow.score_breakdown as unknown as IndependenceScoreBreakdown);
      setIsComputing(false);
      await refresh();
    }

    computeScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (score === null) return;

    const durationMs = 1200;
    const startTime = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / durationMs);
      setDisplayScore(Math.round(progress * score!));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const actionItems = breakdown
    ? (Object.entries(breakdown) as BreakdownEntry[])
        .filter(([, value]) => value.points < value.max)
        .sort((a, b) => b[1].max - b[1].points - (a[1].max - a[1].points))
        .slice(0, 3)
        .map(([key]) => ({ key, text: ACTION_ITEMS[key] }))
    : [];

  if (isComputing) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Computing your independence score...</p>
      </div>
    );
  }

  if (error || score === null || !breakdown) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Something went wrong computing your score."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <ScoreGauge score={displayScore} size={200} strokeWidth={16} label="Independence Score" />
        <p className="max-w-md text-sm text-muted-foreground">
          This score reflects how independent {data.practice.name} is from outside platforms and
          payers today. You can improve it any time from your dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {(Object.entries(breakdown) as BreakdownEntry[]).map(([key, value]) => {
              const met = value.points === value.max;
              return (
                <li key={key} className="flex items-center justify-between gap-4 border-b pb-3 last:border-0">
                  <div className="flex items-center gap-2">
                    {met ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{CATEGORY_LABELS[key]}</span>
                  </div>
                  <Badge variant={met ? "success" : "outline"}>
                    {value.points}/{value.max}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {actionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top ways to improve your score</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {actionItems.map((item, index) => (
                <li key={item.key} className="flex gap-3 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  {item.text}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center pt-2">
        <Button size="lg" onClick={() => router.push("/dashboard")}>
          Go to My Dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
