import Link from "next/link";
import { ShieldCheck } from "lucide-react";

/**
 * Deliberately separate from src/app/(dashboard)/layout.tsx — this wraps
 * routes (currently just /dashboard/onboarding) that must render for an
 * authenticated user who does NOT have a practice yet, so it can't inherit
 * the practice-requiring dashboard shell.
 */
export default function StandaloneDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/30 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <ShieldCheck className="h-6 w-6 text-primary" />
        PracticeOwn
      </Link>
      <div className="w-full max-w-3xl">{children}</div>
    </div>
  );
}
