"use client";

import { useState } from "react";
import Link from "next/link";
import { DoorOpen, Gauge, Plus, ShieldPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddPayerModal } from "@/components/modals/add-payer-modal";
import { CredentialFormModal } from "@/components/modals/credential-form-modal";
import { cn } from "@/lib/utils";
import type { CredentialFormValues } from "@/types/credentials";
import type { Clinician } from "@/types/practice";

interface QuickActionsProps {
  practiceId: string | null | undefined;
  clinicianId: string | null | undefined;
  clinicians: Clinician[];
  createCredential: (
    practiceId: string,
    values: CredentialFormValues
  ) => Promise<{ error: string | null }>;
  onPayerAdded: () => void;
  onRunAudit: () => Promise<{ error: string | null }>;
  isRunningAudit: boolean;
}

export function QuickActions({
  practiceId,
  clinicianId,
  clinicians,
  createCredential,
  onPayerAdded,
  onRunAudit,
  isRunningAudit,
}: QuickActionsProps) {
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [payerModalOpen, setPayerModalOpen] = useState(false);

  async function handleCreateCredential(values: CredentialFormValues) {
    if (!practiceId) return { error: "No practice loaded" };
    const result = await createCredential(practiceId, values);
    if (!result.error) {
      toast.success("Credential added");
    }
    return result;
  }

  async function handleRunAudit() {
    const result = await onRunAudit();
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Independence score updated");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Button
          variant="outline"
          className="h-auto justify-start gap-2 py-3"
          onClick={() => setCredentialModalOpen(true)}
          disabled={!practiceId || clinicians.length === 0}
        >
          <Plus className="h-4 w-4" />
          Add Credential
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start gap-2 py-3"
          onClick={() => setPayerModalOpen(true)}
          disabled={!practiceId || !clinicianId}
        >
          <ShieldPlus className="h-4 w-4" />
          Add Payer
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start gap-2 py-3"
          onClick={handleRunAudit}
          disabled={!practiceId || isRunningAudit}
        >
          <Gauge className={cn("h-4 w-4", isRunningAudit && "animate-spin")} />
          Run Independence Audit
        </Button>
        <Button variant="outline" className="h-auto justify-start gap-2 py-3" asChild>
          <Link href="/exit-planner">
            <DoorOpen className="h-4 w-4" />
            Start Exit Plan
          </Link>
        </Button>
      </CardContent>

      <CredentialFormModal
        open={credentialModalOpen}
        onOpenChange={setCredentialModalOpen}
        credential={null}
        clinicians={clinicians}
        onSubmit={handleCreateCredential}
      />

      {practiceId && clinicianId && (
        <AddPayerModal
          open={payerModalOpen}
          onOpenChange={setPayerModalOpen}
          practiceId={practiceId}
          clinicianId={clinicianId}
          onAdded={onPayerAdded}
        />
      )}
    </Card>
  );
}
