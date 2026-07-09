import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = {
  title: "Sign in | PracticeOwn",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
