import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | PracticeOwn",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        This is placeholder content. Replace with PracticeOwn&apos;s actual Privacy Policy
        (including HIPAA Notice of Privacy Practices) before launch.
      </p>
    </div>
  );
}
