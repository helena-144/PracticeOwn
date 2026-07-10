"use client";

import { AlertCircle, BadgeCheck, Clock, ShieldQuestion } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { daysUntilExpiration } from "@/types/credentials";
import { cn } from "@/lib/utils";
import type { Credential } from "@/types/practice";

interface CredentialHealthStatsProps {
  credentials: Credential[];
  caqhNextAttestationDue: string | null;
  isLoading: boolean;
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "destructive";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "destructive" && "text-destructive",
            tone === "warning" && "text-warning",
            tone === "default" && "text-muted-foreground"
          )}
        />
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold",
            tone === "destructive" && "text-destructive",
            tone === "warning" && "text-warning"
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export function CredentialHealthStats({
  credentials,
  caqhNextAttestationDue,
  isLoading,
}: CredentialHealthStatsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const total = credentials.length;

  const expiringWithin30 = credentials.filter((c) => {
    const days = daysUntilExpiration(c.expiry_date);
    return days !== null && days >= 0 && days <= 30;
  }).length;

  const expired = credentials.filter((c) => {
    const days = daysUntilExpiration(c.expiry_date);
    return days !== null && days < 0;
  }).length;

  const caqhDays = caqhNextAttestationDue ? daysUntilExpiration(caqhNextAttestationDue) : null;
  const caqhValue = caqhDays === null ? "Not on file" : `${caqhDays}`;
  const caqhTone = caqhDays !== null && caqhDays < 30 ? "destructive" : "default";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total credentials" value={String(total)} icon={BadgeCheck} />
      <StatCard
        title="Expiring within 30 days"
        value={String(expiringWithin30)}
        icon={Clock}
        tone={expiringWithin30 > 0 ? "warning" : "default"}
      />
      <StatCard
        title="Expired"
        value={String(expired)}
        icon={AlertCircle}
        tone={expired > 0 ? "destructive" : "default"}
      />
      <StatCard
        title="CAQH days to re-attest"
        value={caqhValue}
        icon={ShieldQuestion}
        tone={caqhTone}
      />
    </div>
  );
}
