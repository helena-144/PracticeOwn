"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

const codeSchema = z.object({
  code: z
    .string()
    .length(6, "Enter the 6-digit code from your authenticator app")
    .regex(/^\d+$/, "Code must be numeric"),
});

type CodeValues = z.infer<typeof codeSchema>;

interface EnrollmentData {
  factorId: string;
  qrCode: string;
  secret: string;
}

export function MfaSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    let cancelled = false;

    async function enroll() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "PracticeOwn",
      });

      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
        return;
      }

      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    }

    enroll();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(values: CodeValues) {
    if (!enrollment) return;

    setVerifyError(null);
    setIsVerifying(true);

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: values.code,
    });

    setIsVerifying(false);

    if (error) {
      setVerifyError(error.message);
      return;
    }

    const redirectedFrom = searchParams.get("redirectedFrom");
    router.push(redirectedFrom && redirectedFrom !== "/mfa-setup" ? redirectedFrom : "/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Set up multi-factor authentication</CardTitle>
        </div>
        <CardDescription>
          PracticeOwn requires MFA on every account to protect patient and practice data. Scan
          the QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.)
          and enter the 6-digit code to finish setup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {!enrollment && !loadError && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Skeleton className="h-48 w-48" />
            <p className="text-sm text-muted-foreground">Generating your setup code...</p>
          </div>
        )}

        {enrollment && (
          <>
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enrollment.qrCode}
                alt="Scan this QR code with your authenticator app"
                className="h-48 w-48 rounded-md border bg-white p-2"
              />
              <div className="text-center text-xs text-muted-foreground">
                <p>Can&apos;t scan it? Enter this code manually:</p>
                <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-sm">
                  {enrollment.secret}
                </code>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {verifyError && (
                  <Alert variant="destructive">
                    <AlertDescription>{verifyError}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>6-digit code</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          maxLength={6}
                          autoComplete="one-time-code"
                          placeholder="123456"
                          className="text-center text-lg tracking-[0.5em]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isVerifying}>
                  {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
                  Verify and continue
                </Button>
              </form>
            </Form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
