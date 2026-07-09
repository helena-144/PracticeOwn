import { Suspense } from "react";
import type { Metadata } from "next";

import { MfaSetupForm } from "@/components/forms/mfa-setup-form";

export const metadata: Metadata = {
  title: "Set up two-factor authentication | PracticeOwn",
};

export default function MfaSetupPage() {
  return (
    <Suspense>
      <MfaSetupForm />
    </Suspense>
  );
}
