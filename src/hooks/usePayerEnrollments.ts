"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { PayerEnrollment } from "@/types/practice";

interface UsePayerEnrollmentsResult {
  payerEnrollments: PayerEnrollment[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePayerEnrollments(practiceId: string | null | undefined): UsePayerEnrollmentsResult {
  const [payerEnrollments, setPayerEnrollments] = useState<PayerEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayerEnrollments = useCallback(async () => {
    if (!practiceId) {
      setPayerEnrollments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("payer_enrollments")
      .select("*")
      .eq("practice_id", practiceId)
      .order("payer_name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setPayerEnrollments(data ?? []);
    }

    setIsLoading(false);
  }, [practiceId]);

  useEffect(() => {
    fetchPayerEnrollments();
  }, [fetchPayerEnrollments]);

  return { payerEnrollments, isLoading, error, refresh: fetchPayerEnrollments };
}
