"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Organization, Profile } from "@/types/practice";

interface UsePracticeResult {
  organization: Organization | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateOrganization: (
    updates: Partial<Pick<Organization, "name" | "npi" | "tax_id" | "specialty" | "state">>
  ) => Promise<{ error: string | null }>;
}

export function usePractice(): UsePracticeResult {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setError(profileError.message);
      setIsLoading(false);
      return;
    }

    setProfile(profileData);

    if (profileData.organization_id) {
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", profileData.organization_id)
        .single();

      if (orgError) {
        setError(orgError.message);
      } else {
        setOrganization(orgData);
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchPractice();
  }, [fetchPractice]);

  const updateOrganization = useCallback(
    async (updates: Partial<Pick<Organization, "name" | "npi" | "tax_id" | "specialty" | "state">>) => {
      if (!organization) {
        return { error: "No organization loaded" };
      }

      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("organizations")
        .update(updates)
        .eq("id", organization.id)
        .select("*")
        .single();

      if (updateError) {
        return { error: updateError.message };
      }

      setOrganization(data);
      return { error: null };
    },
    [organization]
  );

  return { organization, profile, isLoading, error, refresh: fetchPractice, updateOrganization };
}
