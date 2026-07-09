"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Clinician, Practice } from "@/types/practice";

interface UsePracticeResult {
  practice: Practice | null;
  clinician: Clinician | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updatePractice: (
    updates: Partial<Pick<Practice, "name" | "state">>
  ) => Promise<{ error: string | null }>;
}

export function usePractice(): UsePracticeResult {
  const [practice, setPractice] = useState<Practice | null>(null);
  const [clinician, setClinician] = useState<Clinician | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPractice = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      return;
    }

    const { data: clinicianData, error: clinicianError } = await supabase
      .from("clinicians")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (clinicianError) {
      setError(clinicianError.message);
      setIsLoading(false);
      return;
    }

    setClinician(clinicianData);

    if (clinicianData) {
      const { data: practiceData, error: practiceError } = await supabase
        .from("practices")
        .select("*")
        .eq("id", clinicianData.practice_id)
        .single();

      if (practiceError) {
        setError(practiceError.message);
      } else {
        setPractice(practiceData);
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchPractice();
  }, [fetchPractice]);

  const updatePractice = useCallback(
    async (updates: Partial<Pick<Practice, "name" | "state">>) => {
      if (!practice) {
        return { error: "No practice loaded" };
      }

      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("practices")
        .update(updates)
        .eq("id", practice.id)
        .select("*")
        .single();

      if (updateError) {
        return { error: updateError.message };
      }

      setPractice(data);
      return { error: null };
    },
    [practice]
  );

  return { practice, clinician, isLoading, error, refresh: fetchPractice, updatePractice };
}
