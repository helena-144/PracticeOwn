"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PayerCombobox } from "@/components/onboarding/payer-combobox";
import { createClient } from "@/lib/supabase/client";
import { ENROLLMENT_TYPE_LABELS } from "@/types/onboarding";
import type { PayerEnrollmentStatus, PayerEnrollmentType } from "@/types/database";

const addPayerSchema = z.object({
  payerName: z.string().min(1, "Select or enter a payer"),
  enrollmentType: z.custom<PayerEnrollmentType>((val) => typeof val === "string" && val.length > 0, {
    message: "Select an enrollment type",
  }),
  status: z.enum(["active", "pending", "inactive"], { message: "Select a status" }),
});

type AddPayerValues = z.infer<typeof addPayerSchema>;

const STATUS_OPTIONS: { value: PayerEnrollmentStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Inactive" },
];

interface AddPayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string;
  clinicianId: string;
  onAdded: () => void;
}

export function AddPayerModal({ open, onOpenChange, practiceId, clinicianId, onAdded }: AddPayerModalProps) {
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AddPayerValues>({
    resolver: zodResolver(addPayerSchema) as Resolver<AddPayerValues>,
    defaultValues: { payerName: "", enrollmentType: "direct", status: "active" },
  });

  async function onSubmit(values: AddPayerValues) {
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("payer_enrollments").insert({
      practice_id: practiceId,
      clinician_id: clinicianId,
      payer_name: values.payerName,
      enrollment_type: values.enrollmentType,
      status: values.status,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    form.reset({ payerName: "", enrollmentType: "direct", status: "active" });
    onOpenChange(false);
    onAdded();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add payer enrollment</DialogTitle>
          <DialogDescription>Track a new insurance panel you&apos;re enrolled with.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="payerName"
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
              name="enrollmentType"
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
              name="status"
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Add payer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
