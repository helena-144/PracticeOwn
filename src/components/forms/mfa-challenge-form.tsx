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
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/lib/actions/auth";

const codeSchema = z.object({
  code: z
    .string()
    .length(6, "Enter the 6-digit code from your authenticator app")
    .regex(/^\d+$/, "Code must be numeric"),
});

type CodeValues = z.infer<typeof codeSchema>;

export function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    let cancelled = false;

    async function loadFactor() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();

      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
        return;
      }

      const factor = data.totp[0];
      if (!factor) {
        setLoadError("No verified authenticator found on this account.");
        return;
      }

      setFactorId(factor.id);
    }

    loadFactor();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(values: CodeValues) {
    if (!factorId) return;

    setVerifyError(null);
    setIsVerifying(true);

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: values.code,
    });

    setIsVerifying(false);

    if (error) {
      setVerifyError(error.message);
      return;
    }

    const redirectedFrom = searchParams.get("redirectedFrom");
    router.push(
      redirectedFrom && redirectedFrom !== "/mfa-challenge" ? redirectedFrom : "/dashboard"
    );
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Verify it&apos;s you</CardTitle>
        </div>
        <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {loadError && (
              <Alert variant="destructive">
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            )}
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
                      disabled={!factorId}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isVerifying || !factorId}>
              {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify
            </Button>
          </form>
        </Form>
        <form action={signOutAction} className="mt-6 text-center">
          <button
            type="submit"
            className="text-sm text-muted-foreground underline hover:text-primary"
          >
            Not you? Sign out
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
