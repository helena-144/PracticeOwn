"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORMS, PRACTICE_TYPES } from "@/lib/platforms";
import { createClient } from "@/lib/supabase/client";
import { US_STATES } from "@/lib/us-states";
import { practiceSetupSchema, type PracticeSetupValues } from "@/types/onboarding";
import type { PlatformSlug } from "@/types/database";

import type { StepProps } from "./wizard-types";

export function Step1Practice({ data, refresh, onNext }: StepProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PracticeSetupValues>({
    resolver: zodResolver(practiceSetupSchema) as Resolver<PracticeSetupValues>,
    defaultValues: {
      practiceName: data.practice.name,
      state: data.practice.state,
      practiceType: data.practice.practice_type ?? undefined,
      yearsInPractice: data.practice.years_in_practice ?? undefined,
      platforms: data.practice.current_platforms ?? [],
      platformsOtherDetail: data.practice.platforms_other_detail ?? "",
    },
  });

  const selectedPlatforms = form.watch("platforms");

  function togglePlatform(value: PlatformSlug, checked: boolean) {
    const current = form.getValues("platforms");

    if (value === "none" && checked) {
      form.setValue("platforms", ["none"], { shouldValidate: true });
      return;
    }

    let next = checked ? [...current, value] : current.filter((v) => v !== value);
    if (value !== "none") {
      next = next.filter((v) => v !== "none");
    }
    form.setValue("platforms", next, { shouldValidate: true });
  }

  async function onSubmit(values: PracticeSetupValues) {
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("practices")
      .update({
        name: values.practiceName,
        state: values.state,
        practice_type: values.practiceType,
        years_in_practice: values.yearsInPractice,
        current_platforms: values.platforms,
        platforms_other_detail: values.platforms.includes("other")
          ? values.platformsOtherDetail || null
          : null,
        onboarding_step: Math.max(data.practice.onboarding_step, 2),
      })
      .eq("id", data.practice.id);

    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await refresh();
    onNext();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="practiceName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Practice name</FormLabel>
              <FormControl>
                <Input placeholder="Smith Family Therapy" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Primary state of practice</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a state" />
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

        <FormField
          control={form.control}
          name="practiceType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Practice type</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value} className="gap-3">
                  {PRACTICE_TYPES.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value={option.value} />
                      {option.label}
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="yearsInPractice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Years in practice</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={70} className="max-w-[160px]" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="platforms"
          render={() => (
            <FormItem>
              <FormLabel>Current platforms used</FormLabel>
              <p className="text-sm text-muted-foreground">
                Select any credentialing or scheduling platforms you currently use.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PLATFORMS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  >
                    <Checkbox
                      checked={selectedPlatforms?.includes(option.value)}
                      onCheckedChange={(checked) => togglePlatform(option.value, checked === true)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedPlatforms?.includes("other") && (
          <FormField
            control={form.control}
            name="platformsOtherDetail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Which other platform?</FormLabel>
                <FormControl>
                  <Input placeholder="Platform name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </div>
      </form>
    </Form>
  );
}
