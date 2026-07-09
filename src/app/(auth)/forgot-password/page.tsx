import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset password | PracticeOwn",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
