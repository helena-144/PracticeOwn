"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

import { Input } from "@/components/ui/input";

interface DocumentUploadFieldProps {
  label?: string;
  existingFileName?: string | null;
  onFileSelected: (file: File | null) => void;
}

export function DocumentUploadField({
  label = "Upload document (optional)",
  existingFileName,
  onFileSelected,
}: DocumentUploadFieldProps) {
  const [fileName, setFileName] = useState<string | null>(existingFileName ?? null);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setFileName(file?.name ?? existingFileName ?? null);
            onFileSelected(file);
          }}
          className="max-w-xs"
        />
        {fileName && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span className="max-w-[160px] truncate">{fileName}</span>
          </span>
        )}
      </div>
    </div>
  );
}
