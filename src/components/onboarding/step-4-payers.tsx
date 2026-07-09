"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { ENROLLMENT_TYPE_LABELS, payerEnrollmentsStepSchema, type PayerEnrollmentsStepValues } from "@/types/onboarding";
import type { PayerEnrollmentStatus, TablesInsert } from "@/types/database";

import { PayerCombobox } from "./payer-combobox";
import type { StepProps } from "./wizard-types";

const STATUS_OPTIONS: { value: PayerEnrollmentStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Inactive" },
];

export function Step4Payers({ data, refresh, onNext, onBack }: StepProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const form = useForm<PayerEnrollmentsStepValues>({
    resolver: zodResolver(payerEnrollmentsStepSchema) as Resolver<PayerEnrollmentsStepValues>,
    defaultValues: {
      enrollments: data.payerEnrollments.map((enrollment) => ({
        id: enrollment.id,
        payerName: enrollment.payer_name,
        enrollmentType: enrollment.enrollment_type,
        status: (["active", "pending", "inactive"] as const).includes(
          enrollment.status as "active" | "pending" | "inactive"
        )
          ? (enrollment.status as "active" | "pending" | "inactive")
          : "pending",
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "enrollments",
  });

  async function persist(enrollments: PayerEnrollmentsStepValues["enrollments"]) {
    const supabase = createClient();

    if (removedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("payer_enrollments")
        .delete()
        .in("id", removedIds);
      if (deleteError) throw new Error(deleteError.message);
    }

    if (enrollments.length > 0) {
      const rows: TablesInsert<"payer_enrollments">[] = enrollments.map((enrollment) => ({
        id: enrollment.id,
        clinician_id: data.clinician.id,
        practice_id: data.practice.id,
        payer_name: enrollment.payerName,
        enrollment_type: enrollment.enrollmentType,
        status: enrollment.status,
      }));

      const { error: upsertError } = await supabase.from("payer_enrollments").upsert(rows);
      if (upsertError) throw new Error(upsertError.message);
    }

    const { error: practiceError } = await supabase
      .from("practices")
      .update({ onboarding_step: Math.max(data.practice.onboarding_step, 5) })
      .eq("id", data.practice.id);
    if (practiceError) throw new Error(practiceError.message);
  }

  async function onSubmit(values: PayerEnrollmentsStepValues) {
    setError(null);
    setIsSubmitting(true);

    try {
      await persist(values.enrollments);
      setIsSubmitting(false);
      await refresh();
      onNext();
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : "Something went wrong saving your payer enrollments");
    }
  }

  async function handleSkip() {
    setError(null);
    setIsSubmitting(true);

    try {
      await persist(form.getValues("enrollments"));
      setIsSubmitting(false);
      await refresh();
      onNext();
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleRemove(index: number) {
    const target = fields[index];
    if (data.payerEnrollments.some((e) => e.id === target.id)) {
      setRemovedIds((prev) => [...prev, target.id]);
    }
    remove(index);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <h3 className="text-base font-medium">Which insurance panels are you currently on?</h3>
          <p className="text-sm text-muted-foreground">
            Add each payer you&apos;re enrolled with. You can always add more later.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {fields.length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No payers added yet.
          </p>
        )}

        {fields.map((fieldItem, index) => (
          <Card key={fieldItem.id}>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start">
              <FormField
                control={form.control}
                name={`enrollments.${index}.payerName`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payer</FormLabel>
                    <FormControl>
                      <PayerCombobox value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`enrollments.${index}.enrollmentType`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enrollment type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ENROLLMENT_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`enrollments.${index}.status`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-6 sm:mt-6"
                onClick={() => handleRemove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({ id: crypto.randomUUID(), payerName: "", enrollmentType: "direct", status: "active" })
          }
        >
          <Plus className="h-4 w-4" />
          Add payer
        </Button>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <div className="text-right sm:text-left">
              <Button type="button" variant="ghost" onClick={handleSkip} disabled={isSubmitting}>
                Skip for now
              </Button>
              <p className="mt-1 text-xs text-muted-foreground sm:mt-0.5">
                You can add payer enrollments any time from Credentials.
              </p>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
