"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, DoorOpen, Gauge, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePractice } from "@/hooks/usePractice";
import { useCredentials } from "@/hooks/useCredentials";
import { useAlerts } from "@/hooks/useAlerts";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { organization, profile, isLoading: practiceLoading } = usePractice();
  const { credentials, isLoading: credentialsLoading } = useCredentials(organization?.id);
  const { alerts, isLoading: alertsLoading } = useAlerts(organization?.id);

  const expiringSoon = credentials.filter((c) => c.status === "expiring_soon");
  const expired = credentials.filter((c) => c.status === "expired");
  const isLoading = practiceLoading || credentialsLoading || alertsLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s the state of {organization?.name ?? "your practice"} today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Credentials"
          value={isLoading ? null : credentials.length}
          icon={BadgeCheck}
          href="/credentials"
          footer={
            expired.length > 0
              ? `${expired.length} expired`
              : expiringSoon.length > 0
                ? `${expiringSoon.length} expiring soon`
                : "All current"
          }
          tone={expired.length > 0 ? "destructive" : expiringSoon.length > 0 ? "warning" : "default"}
        />
        <SummaryCard
          title="Ownership Audit"
          value={null}
          icon={Scale}
          href="/ownership-audit"
          footer="Review CPOM compliance"
        />
        <SummaryCard
          title="Independence Score"
          value={null}
          icon={Gauge}
          href="/independence-score"
          footer="See your latest score"
        />
        <SummaryCard
          title="Exit Planner"
          value={null}
          icon={DoorOpen}
          href="/exit-planner"
          footer="Track exit readiness"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Credentials needing attention</CardTitle>
            <CardDescription>Licenses and certifications expiring within 60 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {credentialsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : expiringSoon.length === 0 && expired.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing needs attention right now.
              </p>
            ) : (
              <ul className="divide-y">
                {[...expired, ...expiringSoon].slice(0, 6).map((credential) => (
                  <li key={credential.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{credential.provider_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {credential.expiration_date
                          ? `Expires ${formatDate(credential.expiration_date)}`
                          : "No expiration set"}
                      </p>
                    </div>
                    <Badge variant={credential.status === "expired" ? "destructive" : "warning"}>
                      {credential.status === "expired" ? "Expired" : "Expiring soon"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" size="sm" asChild className="mt-2">
              <Link href="/credentials">
                View all credentials <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent alerts</CardTitle>
            <CardDescription>Latest notifications for your practice.</CardDescription>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <AlertTriangle className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No alerts yet.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {alerts.slice(0, 5).map((alert) => (
                  <li key={alert.id} className="text-sm">
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  href,
  footer,
  tone = "default",
}: {
  title: string;
  value: number | null;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  footer: string;
  tone?: "default" | "warning" | "destructive";
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {value !== null && <div className="text-2xl font-bold">{value}</div>}
          <p
            className={
              tone === "destructive"
                ? "text-xs text-destructive"
                : tone === "warning"
                  ? "text-xs text-warning"
                  : "text-xs text-muted-foreground"
            }
          >
            {footer}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
