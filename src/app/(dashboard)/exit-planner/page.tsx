"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePractice } from "@/hooks/usePractice";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import {
  EXIT_TYPES,
  parseExitMilestones,
  type ExitMilestone,
  type ExitPlanDetail,
} from "@/types/practice";
import type { ExitType, Json } from "@/types/database";

const EXIT_TYPE_LABELS: Record<ExitType, string> = {
  sale: "Sale to third party",
  succession: "Internal succession",
  merger: "Merger",
  retirement: "Retirement / wind-down",
  recapitalization: "Recapitalization",
};

const planSchema = z.object({
  exit_type: z.custom<ExitType>((val) => typeof val === "string" && val.length > 0),
  target_exit_date: z.string(),
  valuation_estimate: z.coerce.number().min(0),
  notes: z.string(),
});

type PlanFormValues = z.infer<typeof planSchema>;

const DEFAULT_MILESTONES: Omit<ExitMilestone, "id">[] = [
  { label: "Get a practice valuation", completed: false, dueDate: null },
  { label: "Clean up financial statements", completed: false, dueDate: null },
  { label: "Resolve ownership compliance issues", completed: false, dueDate: null },
  { label: "Identify successor or buyer", completed: false, dueDate: null },
  { label: "Engage healthcare transaction counsel", completed: false, dueDate: null },
];

export default function ExitPlannerPage() {
  const { organization } = usePractice();
  const [plan, setPlan] = useState<ExitPlanDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newMilestoneLabel, setNewMilestoneLabel] = useState("");

  const fetchPlan = useCallback(async () => {
    if (!organization?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("exit_plans")
      .select("*")
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (error) {
      toast.error(error.message);
    } else if (data) {
      setPlan({ ...data, milestones: parseExitMilestones(data.milestones) });
    } else {
      setPlan(null);
    }

    setIsLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema) as Resolver<PlanFormValues>,
    defaultValues: { exit_type: "sale", target_exit_date: "", valuation_estimate: 0, notes: "" },
  });

  async function handleCreatePlan(values: PlanFormValues) {
    if (!organization?.id) return;

    const milestones: ExitMilestone[] = DEFAULT_MILESTONES.map((m, i) => ({
      ...m,
      id: `milestone-${i}`,
    }));

    const supabase = createClient();
    const { error } = await supabase.from("exit_plans").insert({
      organization_id: organization.id,
      exit_type: values.exit_type,
      target_exit_date: values.target_exit_date || null,
      valuation_estimate_cents: Math.round(values.valuation_estimate * 100),
      notes: values.notes || null,
      milestones: milestones as unknown as Json,
      readiness_score: 0,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Exit plan created");
    fetchPlan();
  }

  async function toggleMilestone(milestone: ExitMilestone) {
    if (!plan) return;

    const updatedMilestones = plan.milestones.map((m) =>
      m.id === milestone.id ? { ...m, completed: !m.completed } : m
    );
    const readinessScore = Math.round(
      (updatedMilestones.filter((m) => m.completed).length / updatedMilestones.length) * 100
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("exit_plans")
      .update({ milestones: updatedMilestones as unknown as Json, readiness_score: readinessScore })
      .eq("id", plan.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPlan({ ...plan, milestones: updatedMilestones, readiness_score: readinessScore });
  }

  async function addMilestone() {
    if (!plan || !newMilestoneLabel.trim()) return;

    const updatedMilestones = [
      ...plan.milestones,
      { id: crypto.randomUUID(), label: newMilestoneLabel.trim(), completed: false, dueDate: null },
    ];

    const supabase = createClient();
    const { error } = await supabase
      .from("exit_plans")
      .update({ milestones: updatedMilestones as unknown as Json })
      .eq("id", plan.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPlan({ ...plan, milestones: updatedMilestones });
    setNewMilestoneLabel("");
  }

  async function removeMilestone(milestone: ExitMilestone) {
    if (!plan) return;

    const updatedMilestones = plan.milestones.filter((m) => m.id !== milestone.id);
    const readinessScore =
      updatedMilestones.length > 0
        ? Math.round(
            (updatedMilestones.filter((m) => m.completed).length / updatedMilestones.length) * 100
          )
        : 0;

    const supabase = createClient();
    const { error } = await supabase
      .from("exit_plans")
      .update({ milestones: updatedMilestones as unknown as Json, readiness_score: readinessScore })
      .eq("id", plan.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPlan({ ...plan, milestones: updatedMilestones, readiness_score: readinessScore });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exit Planner</h1>
        <p className="text-sm text-muted-foreground">
          Plan and track your path to a sale, succession, or retirement.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !plan ? (
        <Card>
          <CardHeader>
            <CardTitle>Create your exit plan</CardTitle>
            <CardDescription>Set a target and we&apos;ll track your readiness.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreatePlan)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="exit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exit type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EXIT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {EXIT_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="target_exit_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target exit date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valuation_estimate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated valuation ($)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step="1000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="Context for your exit strategy" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create plan
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Exit type</CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold">
                {EXIT_TYPE_LABELS[plan.exit_type]}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Est. valuation
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold">
                {plan.valuation_estimate_cents ? formatCurrency(plan.valuation_estimate_cents) : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Target date
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold">
                {plan.target_exit_date ?? "Not set"}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Readiness</CardTitle>
              <CardDescription>{plan.readiness_score}% of milestones complete</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={plan.readiness_score} />
              <ul className="space-y-2">
                {plan.milestones.map((milestone) => (
                  <li key={milestone.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={milestone.completed}
                      onCheckedChange={() => toggleMilestone(milestone)}
                    />
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        milestone.completed && "text-muted-foreground line-through"
                      )}
                    >
                      {milestone.label}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeMilestone(milestone)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="Add a milestone"
                  value={newMilestoneLabel}
                  onChange={(e) => setNewMilestoneLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMilestone()}
                />
                <Button type="button" variant="outline" onClick={addMilestone}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {plan.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{plan.notes}</CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
