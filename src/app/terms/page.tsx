import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | PracticeOwn",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        This is placeholder content. Replace with PracticeOwn&apos;s actual Terms of Service
        before launch.
      </p>
    </div>
  );
}
