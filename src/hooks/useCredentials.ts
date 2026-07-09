"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { computeCredentialStatus, type Credential, type CredentialFormValues } from "@/types/credentials";

interface UseCredentialsResult {
  credentials: Credential[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCredential: (
    organizationId: string,
    values: CredentialFormValues
  ) => Promise<{ error: string | null }>;
  updateCredential: (
    id: string,
    values: Partial<CredentialFormValues>
  ) => Promise<{ error: string | null }>;
  deleteCredential: (id: string) => Promise<{ error: string | null }>;
}

export function useCredentials(organizationId: string | null | undefined): UseCredentialsResult {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    if (!organizationId) {
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
      .eq("organization_id", organizationId)
      .order("expiration_date", { ascending: true, nullsFirst: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setCredentials(data ?? []);
    }

    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const createCredential = useCallback(
    async (orgId: string, values: CredentialFormValues) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return { error: "Not authenticated" };

      const { error: insertError } = await supabase.from("credentials").insert({
        organization_id: orgId,
        provider_name: values.provider_name,
        credential_type: values.credential_type,
        issuing_body: values.issuing_body || null,
        credential_number: values.credential_number || null,
        issue_date: values.issue_date || null,
        expiration_date: values.expiration_date || null,
        status: computeCredentialStatus(values.expiration_date || null),
        reminder_days_before: values.reminder_days_before,
        created_by: user.id,
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

      const updates: Partial<CredentialFormValues> & { status?: ReturnType<typeof computeCredentialStatus> } = {
        ...values,
      };
      if (values.expiration_date !== undefined) {
        updates.status = computeCredentialStatus(values.expiration_date || null);
      }

      const { error: updateError } = await supabase
        .from("credentials")
        .update(updates)
        .eq("id", id);

      if (updateError) {
        return { error: updateError.message };
      }

      await fetchCredentials();
      return { error: null };
    },
    [fetchCredentials]
  );

  const deleteCredential = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error: deleteError } = await supabase.from("credentials").delete().eq("id", id);

      if (deleteError) {
        return { error: deleteError.message };
      }

      setCredentials((prev) => prev.filter((c) => c.id !== id));
      return { error: null };
    },
    []
  );

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
