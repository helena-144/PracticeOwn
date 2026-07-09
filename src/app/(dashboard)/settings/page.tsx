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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePractice } from "@/hooks/usePractice";
import { createClient } from "@/lib/supabase/client";

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
});

const organizationSchema = z.object({
  name: z.string().min(1, "Practice name is required"),
  npi: z.string(),
  tax_id: z.string(),
  specialty: z.string(),
  state: z.string(),
});

type ProfileValues = z.infer<typeof profileSchema>;
type OrganizationValues = z.infer<typeof organizationSchema>;

export default function SettingsPage() {
  const { organization, profile, isLoading, updateOrganization, refresh } = usePractice();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "" },
  });

  const organizationForm = useForm<OrganizationValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: "", npi: "", tax_id: "", specialty: "", state: "" },
  });

  useEffect(() => {
    if (profile) {
      profileForm.reset({ full_name: profile.full_name ?? "" });
    }
  }, [profile, profileForm]);

  useEffect(() => {
    if (organization) {
      organizationForm.reset({
        name: organization.name ?? "",
        npi: organization.npi ?? "",
        tax_id: organization.tax_id ?? "",
        specialty: organization.specialty ?? "",
        state: organization.state ?? "",
      });
    }
  }, [organization, organizationForm]);

  async function handleProfileSubmit(values: ProfileValues) {
    if (!profile) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: values.full_name })
      .eq("id", profile.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Profile updated");
    refresh();
  }

  async function handleOrganizationSubmit(values: OrganizationValues) {
    const result = await updateOrganization({
      name: values.name,
      npi: values.npi || null,
      tax_id: values.tax_id || null,
      specialty: values.specialty || null,
      state: values.state || null,
    });

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
          <CardDescription>{profile?.email}</CardDescription>
        </CardHeader>
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)}>
            <CardContent>
              <FormField
                control={profileForm.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                {profileForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
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
        <Form {...organizationForm}>
          <form onSubmit={organizationForm.handleSubmit(handleOrganizationSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={organizationForm.control}
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={organizationForm.control}
                  name="npi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NPI</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={organizationForm.control}
                  name="tax_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={organizationForm.control}
                  name="specialty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialty</FormLabel>
                      <FormControl>
                        <Input placeholder="Family Medicine" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={organizationForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="CA" maxLength={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={organizationForm.formState.isSubmitting}>
                {organizationForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save practice details
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
