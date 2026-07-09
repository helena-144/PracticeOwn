"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FileText, Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePractice } from "@/hooks/usePractice";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { Document, QaThread } from "@/types/practice";

const questionSchema = z.object({
  question: z.string().min(5, "Ask a more detailed question"),
});

type QuestionValues = z.infer<typeof questionSchema>;

export default function DocumentationQaPage() {
  const { organization } = usePractice();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [threads, setThreads] = useState<QaThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!organization?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const [{ data: docs, error: docsError }, { data: qa, error: qaError }] = await Promise.all([
      supabase
        .from("documents")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("qa_threads")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
    ]);

    if (docsError) toast.error(docsError.message);
    if (qaError) toast.error(qaError.message);

    setDocuments(docs ?? []);
    setThreads(qa ?? []);
    setIsLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const form = useForm<QuestionValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: { question: "" },
  });

  async function handleAsk(values: QuestionValues) {
    if (!organization?.id) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase.from("qa_threads").insert({
      organization_id: organization.id,
      question: values.question,
      created_by: user.id,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    form.reset();
    toast.success("Question submitted");
    fetchData();
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !organization?.id) return;

    setIsUploading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsUploading(false);
      return;
    }

    const storagePath = `${organization.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file);

    if (uploadError) {
      toast.error(uploadError.message);
      setIsUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      organization_id: organization.id,
      title: file.name,
      storage_path: storagePath,
      uploaded_by: user.id,
    });

    setIsUploading(false);

    if (insertError) {
      toast.error(insertError.message);
      return;
    }

    toast.success("Document uploaded");
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documentation Q&amp;A</h1>
        <p className="text-sm text-muted-foreground">
          Store compliance documents and log questions for your team or advisors.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Policies, bylaws, and compliance files.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!organization || isUploading}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelected}
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : documents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No documents uploaded yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {formatDate(doc.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Ask a question</CardTitle>
            <CardDescription>
              Questions are logged for your compliance team to answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAsk)} className="flex gap-2">
                <FormField
                  control={form.control}
                  name="question"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="e.g. Does our bylaws update need board approval?"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={form.formState.isSubmitting} className="self-start">
                  {form.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </Form>

            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : threads.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No questions asked yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {threads.map((thread) => (
                  <li key={thread.id} className="rounded-md border p-4">
                    <p className="text-sm font-medium">{thread.question}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Asked {formatDate(thread.created_at)}
                    </p>
                    {thread.answer ? (
                      <p className="mt-3 rounded-md bg-muted p-3 text-sm">{thread.answer}</p>
                    ) : (
                      <p className="mt-3 text-xs italic text-muted-foreground">
                        Awaiting a response.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
