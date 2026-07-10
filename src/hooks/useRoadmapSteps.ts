"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { RoadmapStep } from "@/types/practice";

interface UseRoadmapStepsResult {
  steps: RoadmapStep[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleComplete: (id: string, isCompleted: boolean) => Promise<{ error: string | null }>;
}

export function useRoadmapSteps(practiceId: string | null | undefined): UseRoadmapStepsResult {
  const [steps, setSteps] = useState<RoadmapStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSteps = useCallback(async () => {
    if (!practiceId) {
      setSteps([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("roadmap_steps")
      .select("*")
      .eq("practice_id", practiceId)
      .order("module", { ascending: true })
      .order("step_number", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setSteps(data ?? []);
    }

    setIsLoading(false);
  }, [practiceId]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  const toggleComplete = useCallback(async (id: string, isCompleted: boolean) => {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("roadmap_steps")
      .update({ is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null })
      .eq("id", id);

    if (updateError) {
      return { error: updateError.message };
    }

    setSteps((prev) =>
      prev.map((step) =>
        step.id === id
          ? { ...step, is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null }
          : step
      )
    );
    return { error: null };
  }, []);

  return { steps, isLoading, error, refresh: fetchSteps, toggleComplete };
}
