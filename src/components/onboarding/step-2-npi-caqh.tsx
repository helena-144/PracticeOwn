"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "@/lib/supabase/client";
import { npiCaqhSchema, type NpiCaqhValues } from "@/types/onboarding";

import { FieldLabelWithTooltip } from "./field-tooltip";
import type { StepProps } from "./wizard-types";

const TOOLTIPS = {
  individualNpi:
    "Your personal 10-digit National Provider Identifier, tied to you individually. Payers use it to identify you as the rendering provider on a claim, separate from your practice.",
  groupNpi:
    "A separate NPI issued to your practice as a billing entity, used when claims are billed under the practice's name (often alongside your individual NPI as the rendering provider).",
  caqh:
    "CAQH ProView is the credentialing database most insurance payers pull from to verify your qualifications. Someone — you or a platform — has to keep it updated and re-attest to its accuracy periodically.",
  caqhId: "Your CAQH Provider ID, assigned when your CAQH ProView profile was created.",
  caqhAttestation:
    "Attestation confirms your CAQH profile is current. If it lapses, payers may flag your enrollment as out of date, which can delay claims or trigger re-credentialing.",
};

export function Step2NpiCaqh({ data, refresh, onNext, onBack }: StepProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NpiCaqhValues>({
    resolver: zodResolver(npiCaqhSchema) as Resolver<NpiCaqhValues>,
    defaultValues: {
      hasIndividualNpi: data.clinician.has_individual_npi ?? undefined,
      individualNpi: data.clinician.npi_individual ?? "",
      hasGroupNpi: data.clinician.has_group_npi ?? undefined,
      groupNpi: data.clinician.npi_group ?? "",
      caqhStatus: data.clinician.caqh_status ?? undefined,
      caqhId: data.clinician.caqh_id ?? "",
      caqhLastAttestedAt: data.clinician.caqh_last_attested_at ?? "",
    },
  });

  const hasIndividualNpi = form.watch("hasIndividualNpi");
  const hasGroupNpi = form.watch("hasGroupNpi");
  const caqhStatus = form.watch("caqhStatus");

  async function onSubmit(values: NpiCaqhValues) {
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("clinicians")
      .update({
        has_individual_npi: values.hasIndividualNpi,
        npi_individual: values.hasIndividualNpi === "yes" ? values.individualNpi || null : null,
        has_group_npi: values.hasGroupNpi,
        npi_group: values.hasGroupNpi === "yes" ? values.groupNpi || null : null,
        caqh_status: values.caqhStatus,
        caqh_id: values.caqhStatus === "practice_controlled" ? values.caqhId || null : null,
        caqh_last_attested_at:
          values.caqhStatus === "practice_controlled" ? values.caqhLastAttestedAt || null : null,
      })
      .eq("id", data.clinician.id);

    if (updateError) {
      setIsSubmitting(false);
      setError(updateError.message);
      return;
    }

    const { error: practiceError } = await supabase
      .from("practices")
      .update({ onboarding_step: Math.max(data.practice.onboarding_step, 3) })
      .eq("id", data.practice.id);

    setIsSubmitting(false);

    if (practiceError) {
      setError(practiceError.message);
      return;
    }

    await refresh();
    onNext();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="hasIndividualNpi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <FieldLabelWithTooltip
                    label="Do you have an Individual NPI?"
                    tooltip={TOOLTIPS.individualNpi}
                  />
                </FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                    {[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                      { value: "unknown", label: "Don't know" },
                    ].map((option) => (
                      <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
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

          {hasIndividualNpi === "yes" && (
            <FormField
              control={form.control}
              name="individualNpi"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Individual NPI number</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" maxLength={10} placeholder="1234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="hasGroupNpi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <FieldLabelWithTooltip label="Do you have a Group NPI?" tooltip={TOOLTIPS.groupNpi} />
                </FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                    {[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                      { value: "not_applicable", label: "Not applicable" },
                    ].map((option) => (
                      <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
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

          {hasGroupNpi === "yes" && (
            <FormField
              control={form.control}
              name="groupNpi"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Group NPI number</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" maxLength={10} placeholder="1234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="caqhStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <FieldLabelWithTooltip label="Do you have a CAQH profile?" tooltip={TOOLTIPS.caqh} />
                </FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="gap-3">
                    {[
                      { value: "practice_controlled", label: "Yes — I control it" },
                      { value: "platform_managed", label: "Yes — my platform manages it" },
                      { value: "no", label: "No" },
                      { value: "unknown", label: "Don't know" },
                    ].map((option) => (
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

          {caqhStatus === "practice_controlled" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="caqhId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <FieldLabelWithTooltip label="CAQH ID" tooltip={TOOLTIPS.caqhId} />
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="caqhLastAttestedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <FieldLabelWithTooltip
                        label="Date of last attestation"
                        tooltip={TOOLTIPS.caqhAttestation}
                      />
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </div>
      </form>
    </Form>
  );
}
