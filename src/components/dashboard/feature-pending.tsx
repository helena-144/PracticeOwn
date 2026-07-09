import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function FeaturePending({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Construction className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">This module is being rebuilt</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            A recent database migration changed the data model this page depended on. It&apos;s
            being redesigned against the new schema and isn&apos;t available yet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
