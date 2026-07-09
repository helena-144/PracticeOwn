import type { SupabaseClient } from "@supabase/supabase-js";

import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/types/onboarding";
import type { Database } from "@/types/database";

export interface UploadCredentialDocumentParams {
  practiceId: string;
  clinicianId: string;
  credentialId: string;
  file: File;
  uploadedBy: string;
}

/**
 * Uploads a file to the practice-documents storage bucket under
 * `{practiceId}/...` (required by that bucket's RLS policies, see
 * supabase/migrations/001_initial_schema.sql), then records it in the
 * documents table linked to the given credential.
 */
export async function uploadCredentialDocument(
  supabase: SupabaseClient<Database>,
  params: UploadCredentialDocumentParams
): Promise<{ path: string } | { error: string }> {
  const { practiceId, clinicianId, credentialId, file, uploadedBy } = params;

  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "File is too large (50MB max)" };
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return { error: "Unsupported file type. Use PDF, JPG, PNG, DOC, or DOCX." };
  }

  const path = `${practiceId}/credentials/${credentialId}-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("practice-documents")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: docError } = await supabase.from("documents").insert({
    practice_id: practiceId,
    clinician_id: clinicianId,
    credential_id: credentialId,
    file_name: file.name,
    file_path: path,
    file_type: file.type,
    file_size_bytes: file.size,
    uploaded_by: uploadedBy,
  });

  if (docError) {
    return { error: docError.message };
  }

  return { path };
}
