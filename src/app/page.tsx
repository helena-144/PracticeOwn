import Link from "next/link";
import { ArrowRight, BadgeCheck, DoorOpen, Gauge, Scale, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: BadgeCheck,
    title: "Credential tracking",
    description: "Never miss a license, DEA, or malpractice insurance renewal again.",
  },
  {
    icon: Scale,
    title: "Ownership audit",
    description: "Stay ahead of Corporate Practice of Medicine compliance requirements.",
  },
  {
    icon: Gauge,
    title: "Independence score",
    description: "Understand how independent your practice really is, in one number.",
  },
  {
    icon: DoorOpen,
    title: "Exit planning",
    description: "Build a readiness checklist for a sale, succession, or retirement.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          PracticeOwn
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Own your practice&apos;s independence.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            PracticeOwn helps independent medical practices track credentials, audit ownership
            compliance, and plan their exit — all in one HIPAA-compliant workspace.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start free trial <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="h-6 w-6 text-primary" />
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {feature.description}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PracticeOwn. HIPAA-compliant infrastructure.
      </footer>
    </div>
  );
}
