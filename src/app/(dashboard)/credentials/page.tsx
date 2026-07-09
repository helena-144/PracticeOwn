"use client";

import { useCallback, useEffect, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CredentialFormModal } from "@/components/modals/credential-form-modal";
import { ConfirmDialog } from "@/components/modals/confirm-dialog";
import { useCredentials } from "@/hooks/useCredentials";
import { usePractice } from "@/hooks/usePractice";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { CREDENTIAL_STATUS_LABELS, CREDENTIAL_TYPE_LABELS, type Credential } from "@/types/credentials";
import type { CredentialStatus } from "@/types/database";
import type { Clinician } from "@/types/practice";

const STATUS_VARIANT: Record<CredentialStatus, "default" | "success" | "warning" | "destructive"> = {
  active: "success",
  expiring_soon: "warning",
  expired: "destructive",
  pending: "default",
  unknown: "default",
};

export default function CredentialsPage() {
  const { practice } = usePractice();
  const { credentials, isLoading, createCredential, updateCredential, deleteCredential } =
    useCredentials(practice?.id);

  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null);

  const fetchClinicians = useCallback(async () => {
    if (!practice?.id) return;
    const supabase = createClient();
    const { data } = await supabase.from("clinicians").select("*").eq("practice_id", practice.id);
    setClinicians(data ?? []);
  }, [practice?.id]);

  useEffect(() => {
    fetchClinicians();
  }, [fetchClinicians]);

  function clinicianName(clinicianId: string): string {
    const clinician = clinicians.find((c) => c.id === clinicianId);
    return clinician ? `${clinician.first_name} ${clinician.last_name}` : "—";
  }

  function openCreateModal() {
    setEditingCredential(null);
    setModalOpen(true);
  }

  function openEditModal(credential: Credential) {
    setEditingCredential(credential);
    setModalOpen(true);
  }

  async function handleSubmit(values: Parameters<typeof createCredential>[1]) {
    if (!practice) return { error: "No practice loaded" };

    const result = editingCredential
      ? await updateCredential(editingCredential.id, values)
      : await createCredential(practice.id, values);

    if (!result.error) {
      toast.success(editingCredential ? "Credential updated" : "Credential added");
    }

    return result;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteCredential(deleteTarget.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Credential deleted");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credentials</h1>
          <p className="text-sm text-muted-foreground">
            Track licenses, certifications, and insurance for every clinician.
          </p>
        </div>
        <Button onClick={openCreateModal} disabled={!practice || clinicians.length === 0}>
          <Plus className="h-4 w-4" />
          Add credential
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : credentials.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No credentials yet. Add your first one to start tracking renewals.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinician</TableHead>
                  <TableHead>Credential</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Issuing body</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((credential) => (
                  <TableRow key={credential.id}>
                    <TableCell className="font-medium">
                      {clinicianName(credential.clinician_id)}
                    </TableCell>
                    <TableCell>{credential.name}</TableCell>
                    <TableCell>{CREDENTIAL_TYPE_LABELS[credential.type]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {credential.issuing_body ?? "—"}
                    </TableCell>
                    <TableCell>
                      {credential.expiry_date ? formatDate(credential.expiry_date) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[credential.status]}>
                        {CREDENTIAL_STATUS_LABELS[credential.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(credential)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(credential)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CredentialFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        credential={editingCredential}
        clinicians={clinicians}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete credential?"
        description={`This will permanently remove "${deleteTarget?.name ?? ""}" from your records.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
