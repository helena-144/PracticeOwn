"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Alert } from "@/types/practice";

interface UseAlertsResult {
  alerts: Alert[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<{ error: string | null }>;
  markAllAsRead: () => Promise<{ error: string | null }>;
}

export function useAlerts(organizationId: string | null | undefined): UseAlertsResult {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!organizationId) {
      setAlerts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("alerts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setAlerts(data ?? []);
    }

    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    if (!organizationId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`alerts:${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          setAlerts((prev) => [payload.new as Alert, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const markAsRead = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("alerts")
      .update({ is_read: true })
      .eq("id", id);

    if (updateError) {
      return { error: updateError.message };
    }

    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    return { error: null };
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!organizationId) return { error: "No organization loaded" };

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("alerts")
      .update({ is_read: true })
      .eq("organization_id", organizationId)
      .eq("is_read", false);

    if (updateError) {
      return { error: updateError.message };
    }

    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    return { error: null };
  }, [organizationId]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return { alerts, unreadCount, isLoading, error, refresh: fetchAlerts, markAsRead, markAllAsRead };
}
