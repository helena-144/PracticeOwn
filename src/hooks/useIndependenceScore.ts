"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { IndependenceScoreBreakdown } from "@/types/database";

export interface IndependenceScoreSnapshot {
  score: number;
  breakdown: IndependenceScoreBreakdown;
  computedAt: string;
}

interface UseIndependenceScoreResult {
  current: IndependenceScoreSnapshot | null;
  /** Difference vs. the closest score computed 7+ days ago. Null if there's no prior score to compare against. */
  changeSinceLastWeek: number | null;
  isLoading: boolean;
  error: string | null;
  isRecalculating: boolean;
  refresh: () => Promise<void>;
  recalculate: () => Promise<{ error: string | null }>;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function useIndependenceScore(practiceId: string | null | undefined): UseIndependenceScoreResult {
  const [current, setCurrent] = useState<IndependenceScoreSnapshot | null>(null);
  const [changeSinceLastWeek, setChangeSinceLastWeek] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScore = useCallback(async () => {
    if (!practiceId) {
      setCurrent(null);
      setChangeSinceLastWeek(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    const { data: latest, error: latestError } = await supabase
      .from("independence_scores")
      .select("*")
      .eq("practice_id", practiceId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      setError(latestError.message);
      setIsLoading(false);
      return;
    }

    if (!latest) {
      setCurrent(null);
      setChangeSinceLastWeek(null);
      setIsLoading(false);
      return;
    }

    setCurrent({
      score: latest.score,
      breakdown: latest.score_breakdown as unknown as IndependenceScoreBreakdown,
      computedAt: latest.computed_at,
    });

    const weekAgoIso = new Date(Date.now() - WEEK_MS).toISOString();
    const { data: priorScore, error: priorError } = await supabase
      .from("independence_scores")
      .select("score")
      .eq("practice_id", practiceId)
      .lte("computed_at", weekAgoIso)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (priorError) {
      // Non-fatal — we still have the current score, just no trend.
      setChangeSinceLastWeek(null);
    } else {
      setChangeSinceLastWeek(priorScore ? latest.score - priorScore.score : null);
    }

    setIsLoading(false);
  }, [practiceId]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  const recalculate = useCallback(async () => {
    if (!practiceId) return { error: "No practice loaded" };

    setIsRecalculating(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("recalculate_independence_score", {
      p_practice_id: practiceId,
    });
    setIsRecalculating(false);

    if (rpcError) {
      return { error: rpcError.message };
    }

    await fetchScore();
    return { error: null };
  }, [practiceId, fetchScore]);

  return {
    current,
    changeSinceLastWeek,
    isLoading,
    error,
    isRecalculating,
    refresh: fetchScore,
    recalculate,
  };
}
