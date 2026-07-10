"use client";

import { useCallback, useEffect, useState } from "react";

import { IndependenceScoreCard } from "@/components/dashboard/independence-score-card";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { CredentialHealthStats } from "@/components/dashboard/credential-health-stats";
import { PayerSummary } from "@/components/dashboard/payer-summary";
import { RoadmapProgress } from "@/components/dashboard/roadmap-progress";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { usePractice } from "@/hooks/usePractice";
import { useCredentials } from "@/hooks/useCredentials";
import { usePayerEnrollments } from "@/hooks/usePayerEnrollments";
import { useIndependenceScore } from "@/hooks/useIndependenceScore";
import { createClient } from "@/lib/supabase/client";
import type { Clinician } from "@/types/practice";

export default function DashboardPage() {
  const { practice, clinician } = usePractice();
  const { credentials, isLoading: credentialsLoading, createCredential } = useCredentials(
    practice?.id
  );
  const {
    payerEnrollments,
    isLoading: payerEnrollmentsLoading,
    refresh: refreshPayerEnrollments,
  } = usePayerEnrollments(practice?.id);
  const { recalculate, isRecalculating } = useIndependenceScore(practice?.id);

  const [clinicians, setClinicians] = useState<Clinician[]>([]);

  const fetchClinicians = useCallback(async () => {
    if (!practice?.id) return;
    const supabase = createClient();
    const { data } = await supabase.from("clinicians").select("*").eq("practice_id", practice.id);
    setClinicians(data ?? []);
  }, [practice?.id]);

  useEffect(() => {
    fetchClinicians();
  }, [fetchClinicians]);

  const caqhNextAttestationDue = clinician?.caqh_next_attestation_due ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{clinician?.first_name ? `, ${clinician.first_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s the state of {practice?.name ?? "your practice"} today.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <IndependenceScoreCard practiceId={practice?.id} />
        </div>
        <div className="lg:col-span-2">
          <AlertsPanel practiceId={practice?.id} credentials={credentials} payerEnrollments={payerEnrollments} />
        </div>
      </div>

      <CredentialHealthStats
        credentials={credentials}
        caqhNextAttestationDue={caqhNextAttestationDue}
        isLoading={credentialsLoading}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PayerSummary payerEnrollments={payerEnrollments} isLoading={payerEnrollmentsLoading} />
        <RoadmapProgress practiceId={practice?.id} />
      </div>

      <QuickActions
        practiceId={practice?.id}
        clinicianId={clinician?.id}
        clinicians={clinicians}
        createCredential={createCredential}
        onPayerAdded={refreshPayerEnrollments}
        onRunAudit={recalculate}
        isRunningAudit={isRecalculating}
      />
    </div>
  );
}
