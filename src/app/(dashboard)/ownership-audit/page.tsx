"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePractice } from "@/hooks/usePractice";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate } from "@/lib/utils";
import { OWNERSHIP_ENTITY_TYPES, type OwnershipRecord } from "@/types/practice";
import type { OwnershipEntityType } from "@/types/database";

const ENTITY_LABELS: Record<OwnershipEntityType, string> = {
  physician: "Physician",
  private_equity: "Private Equity",
  mso: "Management Services Org (MSO)",
  hospital_system: "Hospital System",
  other_investor: "Other Investor",
};

const recordSchema = z.object({
  owner_name: z.string().min(1, "Owner name is required"),
  entity_type: z.custom<OwnershipEntityType>((val) => typeof val === "string" && val.length > 0),
  ownership_percentage: z.coerce.number().min(0).max(100),
  effective_date: z.string().min(1, "Effective date is required"),
  cpom_compliant: z.boolean(),
  notes: z.string(),
});

type RecordFormValues = z.infer<typeof recordSchema>;

export default function OwnershipAuditPage() {
  const { organization } = usePractice();
  const [records, setRecords] = useState<OwnershipRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!organization?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ownership_records")
      .select("*")
      .eq("organization_id", organization.id)
      .order("effective_date", { ascending: false });

    if (error) {
      toast.error(error.message);
    } else {
      setRecords(data ?? []);
    }
    setIsLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema) as Resolver<RecordFormValues>,
    defaultValues: {
      owner_name: "",
      entity_type: "physician",
      ownership_percentage: 0,
      effective_date: "",
      cpom_compliant: true,
      notes: "",
    },
  });

  async function handleSubmit(values: RecordFormValues) {
    if (!organization?.id) return;

    const supabase = createClient();
    const { error } = await supabase.from("ownership_records").insert({
      organization_id: organization.id,
      owner_name: values.owner_name,
      entity_type: values.entity_type,
      ownership_percentage: values.ownership_percentage,
      effective_date: values.effective_date,
      cpom_compliant: values.cpom_compliant,
      notes: values.notes || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Ownership record added");
    form.reset();
    setModalOpen(false);
    fetchRecords();
  }

  const physicianOwnership = records
    .filter((r) => r.entity_type === "physician")
    .reduce((sum, r) => sum + r.ownership_percentage, 0);
  const outsideOwnership = records
    .filter((r) => r.entity_type !== "physician")
    .reduce((sum, r) => sum + r.ownership_percentage, 0);
  const nonCompliantRecords = records.filter((r) => !r.cpom_compliant);
  const isCompliant = nonCompliantRecords.length === 0 && records.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ownership Audit</h1>
          <p className="text-sm text-muted-foreground">
            Monitor ownership structure for Corporate Practice of Medicine (CPOM) compliance.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={!organization}>
          <Plus className="h-4 w-4" />
          Add ownership record
        </Button>
      </div>

      {!isLoading && records.length > 0 && (
        <Alert variant={isCompliant ? "success" : "destructive"}>
          {isCompliant ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          <AlertTitle>{isCompliant ? "CPOM compliant" : "Compliance review needed"}</AlertTitle>
          <AlertDescription>
            {isCompliant
              ? "Your ownership structure currently satisfies corporate practice of medicine requirements."
              : `${nonCompliantRecords.length} ownership record(s) are flagged as non-compliant. Consult healthcare counsel.`}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Physician ownership
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{physicianOwnership.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outside ownership
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outsideOwnership.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ownership records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No ownership records yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Entity type</TableHead>
                  <TableHead>Ownership %</TableHead>
                  <TableHead>Effective date</TableHead>
                  <TableHead>Compliance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.owner_name}</TableCell>
                    <TableCell>{ENTITY_LABELS[record.entity_type]}</TableCell>
                    <TableCell>{record.ownership_percentage}%</TableCell>
                    <TableCell>{formatDate(record.effective_date)}</TableCell>
                    <TableCell>
                      <Badge variant={record.cpom_compliant ? "success" : "destructive"}>
                        {record.cpom_compliant ? "Compliant" : "Flagged"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add ownership record</DialogTitle>
            <DialogDescription>
              Document a stake in your practice for the compliance audit trail.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="owner_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner name</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Jane Smith or MSO name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="entity_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OWNERSHIP_ENTITY_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {ENTITY_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ownership_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ownership %</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={100} step="0.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="effective_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="cpom_compliant"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className={cn("font-normal")}>
                      This ownership stake is CPOM compliant
                    </FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Context for counsel or audit" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add record
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
