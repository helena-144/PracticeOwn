"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePractice } from "@/hooks/usePractice";
import { createClient } from "@/lib/supabase/client";
import { US_STATES } from "@/lib/us-states";

const clinicianSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
});

const practiceSchema = z.object({
  name: z.string().min(1, "Practice name is required"),
  state: z.string().min(1, "Select a state"),
});

type ClinicianValues = z.infer<typeof clinicianSchema>;
type PracticeValues = z.infer<typeof practiceSchema>;

export default function SettingsPage() {
  const { practice, clinician, isLoading, updatePractice, refresh } = usePractice();

  const clinicianForm = useForm<ClinicianValues>({
    resolver: zodResolver(clinicianSchema),
    defaultValues: { first_name: "", last_name: "" },
  });

  const practiceForm = useForm<PracticeValues>({
    resolver: zodResolver(practiceSchema),
    defaultValues: { name: "", state: "" },
  });

  useEffect(() => {
    if (clinician) {
      clinicianForm.reset({ first_name: clinician.first_name, last_name: clinician.last_name });
    }
  }, [clinician, clinicianForm]);

  useEffect(() => {
    if (practice) {
      practiceForm.reset({ name: practice.name, state: practice.state });
    }
  }, [practice, practiceForm]);

  async function handleClinicianSubmit(values: ClinicianValues) {
    if (!clinician) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("clinicians")
      .update({ first_name: values.first_name, last_name: values.last_name })
      .eq("id", clinician.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Profile updated");
    refresh();
  }

  async function handlePracticeSubmit(values: PracticeValues) {
    const result = await updatePractice(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Practice details updated");
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and practice details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>{clinician?.email}</CardDescription>
        </CardHeader>
        <Form {...clinicianForm}>
          <form onSubmit={clinicianForm.handleSubmit(handleClinicianSubmit)}>
            <CardContent className="grid grid-cols-2 gap-4">
              <FormField
                control={clinicianForm.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={clinicianForm.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={clinicianForm.formState.isSubmitting}>
                {clinicianForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save profile
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Practice details</CardTitle>
          <CardDescription>Used across compliance and audit records.</CardDescription>
        </CardHeader>
        <Form {...practiceForm}>
          <form onSubmit={practiceForm.handleSubmit(handlePracticeSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={practiceForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Practice name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={practiceForm.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-64">
                        {US_STATES.map((option) => (
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
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={practiceForm.formState.isSubmitting}>
                {practiceForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save practice details
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
