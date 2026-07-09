"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CREDENTIAL_TYPE_LABELS, type Credential, type CredentialFormValues } from "@/types/credentials";
import type { CredentialType } from "@/types/database";
import type { Clinician } from "@/types/practice";

const credentialSchema = z.object({
  clinician_id: z.string().min(1, "Select a clinician"),
  type: z.custom<CredentialType>((val) => typeof val === "string" && val.length > 0, {
    message: "Select a credential type",
  }),
  name: z.string().min(1, "Credential name is required"),
  issuing_body: z.string(),
  credential_number: z.string(),
  issue_date: z.string(),
  expiry_date: z.string(),
});

interface CredentialFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential?: Credential | null;
  clinicians: Clinician[];
  onSubmit: (values: CredentialFormValues) => Promise<{ error: string | null }>;
}

export function CredentialFormModal({
  open,
  onOpenChange,
  credential,
  clinicians,
  onSubmit,
}: CredentialFormModalProps) {
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(credential);

  const form = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialSchema) as Resolver<CredentialFormValues>,
    defaultValues: {
      clinician_id: "",
      type: "license",
      name: "",
      issuing_body: "",
      credential_number: "",
      issue_date: "",
      expiry_date: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        clinician_id: credential?.clinician_id ?? clinicians[0]?.id ?? "",
        type: credential?.type ?? "license",
        name: credential?.name ?? "",
        issuing_body: credential?.issuing_body ?? "",
        credential_number: credential?.credential_number ?? "",
        issue_date: credential?.issue_date ?? "",
        expiry_date: credential?.expiry_date ?? "",
      });
      setError(null);
    }
  }, [open, credential, clinicians, form]);

  async function handleSubmit(values: CredentialFormValues) {
    setError(null);
    const result = await onSubmit(values);

    if (result.error) {
      setError(result.error);
      return;
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit credential" : "Add credential"}</DialogTitle>
          <DialogDescription>
            Track licenses, certifications, and insurance to stay ahead of renewals.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="clinician_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinician</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a clinician" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clinicians.map((clinician) => (
                        <SelectItem key={clinician.id} value={clinician.id}>
                          {clinician.first_name} {clinician.last_name}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credential name</FormLabel>
                  <FormControl>
                    <Input placeholder="California LCSW License" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credential type</FormLabel>
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issuing_body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuing body</FormLabel>
                    <FormControl>
                      <Input placeholder="State licensing board" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="credential_number"
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
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issue_date"
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
                name="expiry_date"
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? "Save changes" : "Add credential"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
