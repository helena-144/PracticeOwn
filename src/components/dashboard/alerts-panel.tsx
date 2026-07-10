"use client";

import Link from "next/link";
import { ArrowRight, CheckCheck, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlerts } from "@/hooks/useAlerts";
import { formatDate } from "@/lib/utils";
import type { AlertSeverity, AlertType } from "@/types/database";
import type { Credential, PayerEnrollment } from "@/types/practice";

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEVERITY_BADGE: Record<AlertSeverity, BadgeProps["variant"]> = {
  critical: "destructive",
  high: "warning",
  medium: "secondary",
  low: "outline",
};

const ALERT_ACTION_HREF: Record<AlertType, string> = {
  caqh_attestation: "/credentials",
  license_expiry: "/credentials",
  malpractice_expiry: "/credentials",
  dea_expiry: "/credentials",
  payer_reattestion: "/credentials",
  document_missing: "/documentation-qa",
  score_drop: "/independence-score",
  other: "/dashboard",
};

interface AlertsPanelProps {
  practiceId: string | null | undefined;
  credentials: Credential[];
  payerEnrollments: PayerEnrollment[];
}

export function AlertsPanel({ practiceId, credentials, payerEnrollments }: AlertsPanelProps) {
  const { alerts, isLoading, error, dismissAlert } = useAlerts(practiceId);

  const activeAlerts = alerts
    .filter((alert) => !alert.is_dismissed)
    .sort((a, b) => {
      const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severityDiff !== 0) return severityDiff;

      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;

      return b.created_at.localeCompare(a.created_at);
    });

  async function handleDismiss(id: string) {
    const result = await dismissAlert(id);
    if (result.error) {
      toast.error(result.error);
    }
  }

  function linkedName(alert: (typeof alerts)[number]): string | null {
    if (alert.credential_id) {
      return credentials.find((c) => c.id === alert.credential_id)?.name ?? null;
    }
    if (alert.payer_enrollment_id) {
      return payerEnrollments.find((p) => p.id === alert.payer_enrollment_id)?.payer_name ?? null;
    }
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCheck className="h-6 w-6 text-success" />
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {activeAlerts.map((alert) => {
              const name = linkedName(alert);
              return (
                <li key={alert.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <ShieldAlert
                        className={
                          alert.severity === "critical" || alert.severity === "high"
                            ? "mt-0.5 h-4 w-4 shrink-0 text-destructive"
                            : "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        }
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={SEVERITY_BADGE[alert.severity]} className="capitalize">
                            {alert.severity}
                          </Badge>
                          <span className="text-sm font-medium">{alert.title}</span>
                        </div>
                        {name && <p className="mt-1 text-xs text-muted-foreground">{name}</p>}
                        {alert.due_date && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Due {formatDate(alert.due_date)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleDismiss(alert.id)}
                      aria-label="Dismiss alert"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button variant="link" size="sm" asChild className="mt-1 h-auto p-0">
                    <Link href={ALERT_ACTION_HREF[alert.type]}>
                      Fix this <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
