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

const credentialSchema = z.object({
  provider_name: z.string().min(1, "Provider name is required"),
  credential_type: z.custom<CredentialType>((val) => typeof val === "string" && val.length > 0, {
    message: "Select a credential type",
  }),
  issuing_body: z.string(),
  credential_number: z.string(),
  issue_date: z.string(),
  expiration_date: z.string(),
  reminder_days_before: z.coerce.number().int().min(0).max(365),
});

interface CredentialFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential?: Credential | null;
  onSubmit: (values: CredentialFormValues) => Promise<{ error: string | null }>;
}

export function CredentialFormModal({
  open,
  onOpenChange,
  credential,
  onSubmit,
}: CredentialFormModalProps) {
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(credential);

  const form = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialSchema) as Resolver<CredentialFormValues>,
    defaultValues: {
      provider_name: "",
      credential_type: "medical_license",
      issuing_body: "",
      credential_number: "",
      issue_date: "",
      expiration_date: "",
      reminder_days_before: 60,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        provider_name: credential?.provider_name ?? "",
        credential_type: credential?.credential_type ?? "medical_license",
        issuing_body: credential?.issuing_body ?? "",
        credential_number: credential?.credential_number ?? "",
        issue_date: credential?.issue_date ?? "",
        expiration_date: credential?.expiration_date ?? "",
        reminder_days_before: credential?.reminder_days_before ?? 60,
      });
      setError(null);
    }
  }, [open, credential, form]);

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
              name="provider_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider name</FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. Jane Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="credential_type"
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
                      <Input placeholder="State Medical Board" {...field} />
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
                name="expiration_date"
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
            <FormField
              control={form.control}
              name="reminder_days_before"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remind me before expiration (days)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={365} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
