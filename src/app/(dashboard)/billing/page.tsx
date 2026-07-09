"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePractice } from "@/hooks/usePractice";
import { cn } from "@/lib/utils";
import type { BillingPlanOption } from "@/types/practice";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/database";

const PLANS: BillingPlanOption[] = [
  {
    id: "solo",
    name: "Solo",
    priceId: "solo",
    priceLabel: "$99/mo",
    description: "For independent, single-provider practices.",
    features: [
      "Unlimited credential tracking",
      "Ownership & CPOM audit",
      "Independence score",
      "Email renewal reminders",
    ],
  },
  {
    id: "group",
    name: "Group",
    priceId: "group",
    priceLabel: "$299/mo",
    description: "For multi-provider groups and practices.",
    features: [
      "Everything in Solo",
      "Unlimited providers",
      "Exit planning workspace",
      "Documentation Q&A",
      "Priority support",
    ],
  },
];

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Incomplete (expired)",
  unpaid: "Unpaid",
};

export default function BillingPage() {
  const { organization, isLoading } = usePractice();
  const [pendingPlan, setPendingPlan] = useState<SubscriptionPlan | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  async function handleSubscribe(plan: SubscriptionPlan) {
    setPendingPlan(plan);

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to start checkout");
      }

      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setPendingPlan(null);
    }
  }

  async function handleManageBilling() {
    setIsOpeningPortal(true);

    try {
      const response = await fetch("/api/stripe/create-portal", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to open billing portal");
      }

      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setIsOpeningPortal(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const currentPlan = organization?.subscription_plan ?? null;
  const currentStatus = organization?.subscription_status ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">Manage your PracticeOwn subscription.</p>
      </div>

      {currentPlan && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Current plan</CardTitle>
              <CardDescription className="mt-1 flex items-center gap-2">
                <span className="capitalize">{currentPlan}</span>
                {currentStatus && (
                  <Badge variant={currentStatus === "active" ? "success" : "warning"}>
                    {STATUS_LABEL[currentStatus]}
                  </Badge>
                )}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleManageBilling} disabled={isOpeningPortal}>
              {isOpeningPortal && <Loader2 className="h-4 w-4 animate-spin" />}
              Manage billing
            </Button>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;

          return (
            <Card key={plan.id} className={cn(isCurrent && "border-primary")}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current plan</Badge>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <p className="pt-2 text-2xl font-bold">{plan.priceLabel}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || pendingPlan !== null}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {pendingPlan === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCurrent ? "Current plan" : "Subscribe"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
