"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Credential, CredentialFormValues } from "@/types/credentials";

interface UseCredentialsResult {
  credentials: Credential[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCredential: (
    practiceId: string,
    values: CredentialFormValues
  ) => Promise<{ error: string | null }>;
  updateCredential: (
    id: string,
    values: Partial<CredentialFormValues>
  ) => Promise<{ error: string | null }>;
  deleteCredential: (id: string) => Promise<{ error: string | null }>;
}

export function useCredentials(practiceId: string | null | undefined): UseCredentialsResult {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    if (!practiceId) {
      setCredentials([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("credentials")
      .select("*")
      .eq("practice_id", practiceId)
      .order("expiry_date", { ascending: true, nullsFirst: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setCredentials(data ?? []);
    }

    setIsLoading(false);
  }, [practiceId]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const createCredential = useCallback(
    async (practiceIdForInsert: string, values: CredentialFormValues) => {
      const supabase = createClient();

      // status is computed server-side by the set_credential_status trigger
      // based on expiry_date — no client-side status logic needed.
      const { error: insertError } = await supabase.from("credentials").insert({
        practice_id: practiceIdForInsert,
        clinician_id: values.clinician_id,
        type: values.type,
        name: values.name,
        issuing_body: values.issuing_body || null,
        credential_number: values.credential_number || null,
        issue_date: values.issue_date || null,
        expiry_date: values.expiry_date || null,
      });

      if (insertError) {
        return { error: insertError.message };
      }

      await fetchCredentials();
      return { error: null };
    },
    [fetchCredentials]
  );

  const updateCredential = useCallback(
    async (id: string, values: Partial<CredentialFormValues>) => {
      const supabase = createClient();

      const { error: updateError } = await supabase.from("credentials").update(values).eq("id", id);

      if (updateError) {
        return { error: updateError.message };
      }

      await fetchCredentials();
      return { error: null };
    },
    [fetchCredentials]
  );

  const deleteCredential = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("credentials").delete().eq("id", id);

    if (deleteError) {
      return { error: deleteError.message };
    }

    setCredentials((prev) => prev.filter((c) => c.id !== id));
    return { error: null };
  }, []);

  return {
    credentials,
    isLoading,
    error,
    refresh: fetchCredentials,
    createCredential,
    updateCredential,
    deleteCredential,
  };
}
