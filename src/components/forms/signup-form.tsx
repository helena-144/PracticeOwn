"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";

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

const signupSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Enter your full name")
      .refine((v) => v.trim().split(/\s+/).length >= 2, "Enter your first and last name"),
    licenseType: z.custom<LicenseType>((val) => typeof val === "string" && val.length > 0, {
      message: "Select your license type",
    }),
    state: z.string().min(1, "Select the state you practice in"),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    agreeToTerms: z.boolean().refine((v) => v === true, "You must accept the Terms of Service"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema) as Resolver<SignupValues>,
    defaultValues: {
      fullName: "",
      licenseType: undefined,
      state: "",
      email: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
    },
  });

  async function onSubmit(values: SignupValues) {
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: {
          full_name: values.fullName,
          license_type: values.licenseType,
          state: values.state,
        },
      },
    });

    if (signUpError) {
      setIsSubmitting(false);
      setError(signUpError.message);
      return;
    }

    if (!data.user) {
      setIsSubmitting(false);
      setError("Something went wrong creating your account. Please try again.");
      return;
    }

    // Email confirmations disabled on this project: signUp() already
    // returned a live session, so we can provision immediately instead of
    // waiting for /auth/callback (which only fires when confirmation is
    // required).
    if (data.session) {
      const result = await provisionPracticeForUser(supabase, data.user, {
        fullName: values.fullName,
        licenseType: values.licenseType,
        state: values.state,
      });

      setIsSubmitting(false);

      if ("error" in result) {
        setError(result.error);
        return;
      }

      router.push("/dashboard");
      router.refresh();
      return;
    }

    setIsSubmitting(false);
    setConfirmationSent(true);
  }

  if (confirmationSent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            We sent a confirmation link to finish setting up your account. Once confirmed,
            we&apos;ll ask you to set up multi-factor authentication before you can access your
            dashboard.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start tracking your practice&apos;s independence.</CardDescription>
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
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" placeholder="you@practice.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="agreeToTerms"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-row items-start gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal leading-snug">
                      I agree to the{" "}
                      <Link href="/terms" className="underline hover:text-primary">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="underline hover:text-primary">
                        Privacy Policy
                      </Link>
                      .
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
