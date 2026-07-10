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
  dismissAlert: (id: string) => Promise<{ error: string | null }>;
}

export function useAlerts(practiceId: string | null | undefined): UseAlertsResult {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!practiceId) {
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
      .eq("practice_id", practiceId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setAlerts(data ?? []);
    }

    setIsLoading(false);
  }, [practiceId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Subscribes to every change (not just INSERT) so a dismiss/read from
  // another tab, or an alert a scheduled job creates or updates server-side,
  // shows up here without a manual refresh.
  useEffect(() => {
    if (!practiceId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`alerts:${practiceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `practice_id=eq.${practiceId}`,
        },
        (payload) => {
          setAlerts((prev) => [payload.new as Alert, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "alerts",
          filter: `practice_id=eq.${practiceId}`,
        },
        (payload) => {
          const updated = payload.new as Alert;
          setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "alerts",
          filter: `practice_id=eq.${practiceId}`,
        },
        (payload) => {
          const deletedId = (payload.old as Partial<Alert>).id;
          setAlerts((prev) => prev.filter((a) => a.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId]);

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
    if (!practiceId) return { error: "No practice loaded" };

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("alerts")
      .update({ is_read: true })
      .eq("practice_id", practiceId)
      .eq("is_read", false);

    if (updateError) {
      return { error: updateError.message };
    }

    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    return { error: null };
  }, [practiceId]);

  const dismissAlert = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("alerts")
      .update({ is_dismissed: true, is_read: true })
      .eq("id", id);

    if (updateError) {
      return { error: updateError.message };
    }

    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_dismissed: true, is_read: true } : a))
    );
    return { error: null };
  }, []);

  const unreadCount = alerts.filter((a) => !a.is_read && !a.is_dismissed).length;

  return {
    alerts,
    unreadCount,
    isLoading,
    error,
    refresh: fetchAlerts,
    markAsRead,
    markAllAsRead,
    dismissAlert,
  };
}
