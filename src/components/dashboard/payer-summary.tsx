"use client";

import { Building2, Clock, Link2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PayerEnrollment } from "@/types/practice";

const PLATFORM_ENROLLMENT_TYPES = new Set(["headway", "grow_therapy", "alma", "other_platform"]);

interface PayerSummaryProps {
  payerEnrollments: PayerEnrollment[];
  isLoading: boolean;
}

export function PayerSummary({ payerEnrollments, isLoading }: PayerSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const directContracts = payerEnrollments.filter(
    (p) => p.enrollment_type === "direct" && p.status === "active"
  ).length;
  const platformDependent = payerEnrollments.filter((p) =>
    PLATFORM_ENROLLMENT_TYPES.has(p.enrollment_type)
  ).length;
  const pending = payerEnrollments.filter((p) => p.status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payer Enrollment</CardTitle>
      </CardHeader>
      <CardContent>
        {payerEnrollments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No payer enrollments on file yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-success/10">
                <Link2 className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none">{directContracts}</p>
                <p className="text-xs text-muted-foreground">Direct contracts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-warning/10">
                <Building2 className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none">{platformDependent}</p>
                <p className="text-xs text-muted-foreground">Platform-dependent</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none">{pending}</p>
                <p className="text-xs text-muted-foreground">Pending enrollment</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
