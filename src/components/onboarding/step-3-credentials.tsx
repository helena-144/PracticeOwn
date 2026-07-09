"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { uploadCredentialDocument } from "@/lib/upload-document";
import { US_STATES } from "@/lib/us-states";
import { CREDENTIAL_TYPE_LABELS } from "@/types/credentials";
import { credentialsStepSchema, type CredentialsStepValues } from "@/types/onboarding";
import type { CredentialType, TablesInsert } from "@/types/database";

import { DocumentUploadField } from "./document-upload-field";
import type { StepProps, WizardData } from "./wizard-types";

function findFirst(credentials: WizardData["credentials"], type: CredentialType) {
  return credentials.find((c) => c.type === type) ?? null;
}

export function Step3Credentials({ data, refresh, onNext, onBack }: StepProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [licenseCredential] = useState(() => findFirst(data.credentials, "license"));
  const [malpracticeCredential] = useState(() => findFirst(data.credentials, "malpractice"));
  const [deaCredential] = useState(() => findFirst(data.credentials, "dea"));
  const [licenseId] = useState(() => licenseCredential?.id ?? crypto.randomUUID());
  const [malpracticeId] = useState(() => malpracticeCredential?.id ?? crypto.randomUUID());
  const [deaId] = useState(() => deaCredential?.id ?? crypto.randomUUID());
  const [additionalExisting] = useState(() => {
    const slotIds = new Set([licenseCredential?.id, malpracticeCredential?.id, deaCredential?.id]);
    return data.credentials.filter((c) => !slotIds.has(c.id));
  });

  const [files, setFiles] = useState<Record<string, File>>({});

  const form = useForm<CredentialsStepValues>({
    resolver: zodResolver(credentialsStepSchema) as Resolver<CredentialsStepValues>,
    defaultValues: {
      license: {
        licenseType: data.clinician.license_type,
        state: licenseCredential?.issuing_body?.replace(" licensing board", "") || data.practice.state,
        licenseNumber: licenseCredential?.credential_number ?? "",
        expiryDate: licenseCredential?.expiry_date ?? "",
      },
      malpractice: {
        carrierName: malpracticeCredential?.name ?? "",
        policyNumber: malpracticeCredential?.credential_number ?? "",
        expiryDate: malpracticeCredential?.expiry_date ?? "",
      },
      hasDea: deaCredential ? "yes" : "no",
      dea: {
        deaNumber: deaCredential?.credential_number ?? "",
        expiryDate: deaCredential?.expiry_date ?? "",
      },
      additionalCredentials: additionalExisting.map((credential) => ({
        id: credential.id,
        type: credential.type,
        name: credential.name,
        issuingBody: credential.issuing_body ?? "",
        credentialNumber: credential.credential_number ?? "",
        issueDate: credential.issue_date ?? "",
        expiryDate: credential.expiry_date ?? "",
      })),
    },
  });

  const hasDea = form.watch("hasDea");
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "additionalCredentials",
  });

  async function onSubmit(values: CredentialsStepValues) {
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

    const userId = user.id;

    async function resolveDocumentPath(
      credentialId: string,
      existingPath: string | null
    ): Promise<string | null> {
      const file = files[credentialId];
      if (!file) return existingPath;

      const result = await uploadCredentialDocument(supabase, {
        practiceId: data.practice.id,
        clinicianId: data.clinician.id,
        credentialId,
        file,
        uploadedBy: userId,
      });

      if ("error" in result) {
        throw new Error(result.error);
      }
      return result.path;
    }

    try {
      const rows: TablesInsert<"credentials">[] = [];

      rows.push({
        id: licenseId,
        clinician_id: data.clinician.id,
        practice_id: data.practice.id,
        type: "license",
        name: `${values.license.licenseType} License — ${values.license.state}`,
        issuing_body: `${values.license.state} licensing board`,
        credential_number: values.license.licenseNumber,
        expiry_date: values.license.expiryDate,
        document_path: await resolveDocumentPath(licenseId, licenseCredential?.document_path ?? null),
      });

      rows.push({
        id: malpracticeId,
        clinician_id: data.clinician.id,
        practice_id: data.practice.id,
        type: "malpractice",
        name: values.malpractice.carrierName,
        issuing_body: values.malpractice.carrierName,
        credential_number: values.malpractice.policyNumber,
        expiry_date: values.malpractice.expiryDate,
        document_path: await resolveDocumentPath(
          malpracticeId,
          malpracticeCredential?.document_path ?? null
        ),
      });

      if (values.hasDea === "yes") {
        rows.push({
          id: deaId,
          clinician_id: data.clinician.id,
          practice_id: data.practice.id,
          type: "dea",
          name: "DEA Registration",
          credential_number: values.dea.deaNumber,
          expiry_date: values.dea.expiryDate,
          document_path: await resolveDocumentPath(deaId, deaCredential?.document_path ?? null),
        });
      } else if (deaCredential) {
        await supabase.from("credentials").delete().eq("id", deaCredential.id);
      }

      for (const additional of values.additionalCredentials) {
        rows.push({
          id: additional.id,
          clinician_id: data.clinician.id,
          practice_id: data.practice.id,
          type: additional.type,
          name: additional.name,
          issuing_body: additional.issuingBody || null,
          credential_number: additional.credentialNumber || null,
          issue_date: additional.issueDate || null,
          expiry_date: additional.expiryDate || null,
          document_path: await resolveDocumentPath(
            additional.id,
            additionalExisting.find((c) => c.id === additional.id)?.document_path ?? null
          ),
        });
      }

      const { error: upsertError } = await supabase.from("credentials").upsert(rows);
      if (upsertError) throw new Error(upsertError.message);

      const { error: practiceError } = await supabase
        .from("practices")
        .update({ onboarding_step: Math.max(data.practice.onboarding_step, 4) })
        .eq("id", data.practice.id);
      if (practiceError) throw new Error(practiceError.message);

      setIsSubmitting(false);
      await refresh();
      onNext();
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : "Something went wrong saving your credentials");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">License</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="license.licenseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License type</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="license.state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Licensing state</FormLabel>
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
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="license.licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="license.expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiration date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DocumentUploadField
              existingFileName={licenseCredential?.document_path ? "Document on file" : null}
              onFileSelected={(file) =>
                setFiles((prev) => (file ? { ...prev, [licenseId]: file } : prev))
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Malpractice insurance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="malpractice.carrierName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier name</FormLabel>
                    <FormControl>
                      <Input placeholder="CPH & Associates" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="malpractice.policyNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="malpractice.expiryDate"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Expiration date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DocumentUploadField
              existingFileName={malpracticeCredential?.document_path ? "Document on file" : null}
              onFileSelected={(file) =>
                setFiles((prev) => (file ? { ...prev, [malpracticeId]: file } : prev))
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">DEA registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="hasDea"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Do you have a DEA registration?</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                      {[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" },
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
            {hasDea === "yes" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="dea.deaNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DEA number</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dea.expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DocumentUploadField
                  existingFileName={deaCredential?.document_path ? "Document on file" : null}
                  onFileSelected={(file) => setFiles((prev) => (file ? { ...prev, [deaId]: file } : prev))}
                />
              </>
            )}
          </CardContent>
        </Card>

        {fields.map((fieldItem, index) => (
          <Card key={fieldItem.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Additional credential</CardTitle>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name={`additionalCredentials.${index}.type`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(CREDENTIAL_TYPE_LABELS).map(([value, label]) => (
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
                  name={`additionalCredentials.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Board Certification" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name={`additionalCredentials.${index}.issuingBody`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issuing body</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`additionalCredentials.${index}.credentialNumber`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credential #</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name={`additionalCredentials.${index}.issueDate`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`additionalCredentials.${index}.expiryDate`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DocumentUploadField
                existingFileName={
                  additionalExisting.find((c) => c.id === fieldItem.id)?.document_path
                    ? "Document on file"
                    : null
                }
                onFileSelected={(file) =>
                  setFiles((prev) => (file ? { ...prev, [fieldItem.id]: file } : prev))
                }
              />
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({
              id: crypto.randomUUID(),
              type: "other",
              name: "",
              issuingBody: "",
              credentialNumber: "",
              issueDate: "",
              expiryDate: "",
            })
          }
        >
          <Plus className="h-4 w-4" />
          Add additional credential
        </Button>

        <Separator />

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
