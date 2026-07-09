"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { provisionPracticeForUser } from "@/lib/provision-practice";
import { LICENSE_TYPES } from "@/lib/license-types";
import { US_STATES } from "@/lib/us-states";
import type { LicenseType } from "@/types/database";

const onboardingSchema = z.object({
  fullName: z
    .string()
    .min(1, "Enter your full name")
    .refine((v) => v.trim().split(/\s+/).length >= 2, "Enter your first and last name"),
  licenseType: z.custom<LicenseType>((val) => typeof val === "string" && val.length > 0, {
    message: "Select your license type",
  }),
  state: z.string().min(1, "Select the state you practice in"),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema) as Resolver<OnboardingValues>,
    defaultValues: { fullName: "", licenseType: undefined, state: "" },
  });

  async function onSubmit(values: OnboardingValues) {
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsSubmitting(false);
      setError("Your session has expired. Please sign in again.");
      return;
    }

    const result = await provisionPracticeForUser(supabase, user, values);

    setIsSubmitting(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your practice</CardTitle>
        <CardDescription>
          A couple of quick details to finish setting up your PracticeOwn account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" placeholder="Dr. Jane Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="licenseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LICENSE_TYPES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.value}
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
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State of practice</FormLabel>
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
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue to dashboard
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
