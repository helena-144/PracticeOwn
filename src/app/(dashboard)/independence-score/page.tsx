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
import {
  parseIndependenceCategoryScores,
  type IndependenceFactor,
  type IndependenceScoreDetail,
} from "@/types/practice";
import type { Json } from "@/types/database";

const CATEGORY_LABELS: Record<string, string> = {
  financialControl: "Financial Control",
  clinicalAutonomy: "Clinical Autonomy",
  operationalControl: "Operational Control",
  contractualObligations: "Contractual Obligations",
  ownershipStructure: "Ownership Structure",
};

export default function IndependenceScorePage() {
  const { organization } = usePractice();
  const [scoreDetail, setScoreDetail] = useState<IndependenceScoreDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const fetchScore = useCallback(async () => {
    if (!organization?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("independence_scores")
      .select("*")
      .eq("organization_id", organization.id)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      toast.error(error.message);
    } else if (data) {
      setScoreDetail({
        ...data,
        category_scores: parseIndependenceCategoryScores(data.category_scores),
        factors: (data.factors as unknown as IndependenceFactor[]) ?? [],
      });
    } else {
      setScoreDetail(null);
    }

    setIsLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  async function handleRecalculate() {
    if (!organization?.id) return;
    setIsRecalculating(true);

    const supabase = createClient();
    const { data: ownershipRecords, error: ownershipError } = await supabase
      .from("ownership_records")
      .select("*")
      .eq("organization_id", organization.id);

    if (ownershipError) {
      toast.error(ownershipError.message);
      setIsRecalculating(false);
      return;
    }

    const outsideOwnership = (ownershipRecords ?? [])
      .filter((r) => r.entity_type !== "physician")
      .reduce((sum, r) => sum + r.ownership_percentage, 0);
    const nonCompliantCount = (ownershipRecords ?? []).filter((r) => !r.cpom_compliant).length;
    const hasHospitalSystemStake = (ownershipRecords ?? []).some(
      (r) => r.entity_type === "hospital_system" && r.ownership_percentage > 0
    );

    const categoryScores = {
      financialControl: Math.max(0, Math.round(100 - outsideOwnership)),
      clinicalAutonomy: hasHospitalSystemStake ? 55 : 85,
      operationalControl: 75,
      contractualObligations: nonCompliantCount > 0 ? 45 : 80,
      ownershipStructure: nonCompliantCount > 0 ? 40 : 90,
    };

    const overallScore = Math.round(
      Object.values(categoryScores).reduce((sum, v) => sum + v, 0) /
        Object.values(categoryScores).length
    );

    const factors: IndependenceFactor[] = [
      {
        category: "financialControl",
        label: "Outside capital ownership",
        impact: outsideOwnership > 25 ? "negative" : "positive",
        weight: 1,
        description: `${outsideOwnership.toFixed(1)}% of ownership held by non-physician entities.`,
      },
      {
        category: "ownershipStructure",
        label: "CPOM compliance",
        impact: nonCompliantCount > 0 ? "negative" : "positive",
        weight: 1,
        description:
          nonCompliantCount > 0
            ? `${nonCompliantCount} ownership record(s) flagged as non-compliant.`
            : "All ownership records are CPOM compliant.",
      },
      {
        category: "clinicalAutonomy",
        label: "Hospital system involvement",
        impact: hasHospitalSystemStake ? "negative" : "neutral",
        weight: 1,
        description: hasHospitalSystemStake
          ? "A hospital system holds an equity stake, which may constrain clinical autonomy."
          : "No hospital system ownership detected.",
      },
    ];

    const { error: insertError } = await supabase.from("independence_scores").insert({
      organization_id: organization.id,
      score: overallScore,
      category_scores: categoryScores,
      factors: factors as unknown as Json,
    });

    setIsRecalculating(false);

    if (insertError) {
      toast.error(insertError.message);
      return;
    }

    toast.success("Independence score updated");
    fetchScore();
  }

  const categoryData: CategoryBarDatum[] = scoreDetail
    ? Object.entries(scoreDetail.category_scores).map(([key, value]) => ({
        label: CATEGORY_LABELS[key] ?? key,
        value,
      }))
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Independence Score</h1>
          <p className="text-sm text-muted-foreground">
            A composite measure of how independent your practice is from outside control.
          </p>
        </div>
        <Button onClick={handleRecalculate} disabled={!organization || isRecalculating}>
          <RefreshCw className={isRecalculating ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Recalculate
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !scoreDetail ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              No score calculated yet. Add ownership records, then recalculate.
            </p>
            <Button onClick={handleRecalculate} disabled={!organization || isRecalculating}>
              Calculate independence score
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="flex flex-col items-center justify-center py-6">
              <ScoreGauge score={scoreDetail.score} label="out of 100" />
              <p className="mt-4 text-xs text-muted-foreground">
                Last calculated {formatDate(scoreDetail.calculated_at)}
              </p>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Category breakdown</CardTitle>
                <CardDescription>Each category is weighted equally in the overall score.</CardDescription>
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
              {scoreDetail.factors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No factors recorded.</p>
              ) : (
                <ul className="space-y-3">
                  {scoreDetail.factors.map((factor, index) => (
                    <li key={index} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{factor.label}</p>
                        <p className="text-xs text-muted-foreground">{factor.description}</p>
                      </div>
                      <Badge
                        variant={
                          factor.impact === "positive"
                            ? "success"
                            : factor.impact === "negative"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {factor.impact}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
