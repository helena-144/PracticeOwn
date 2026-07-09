import { Suspense } from "react";
import type { Metadata } from "next";

import { MfaChallengeForm } from "@/components/forms/mfa-challenge-form";

export const metadata: Metadata = {
  title: "Verify it's you | PracticeOwn",
};

export default function MfaChallengePage() {
  return (
    <Suspense>
      <MfaChallengeForm />
    </Suspense>
  );
}
