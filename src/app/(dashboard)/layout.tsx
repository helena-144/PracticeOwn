import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/header";
import { Sidebar } from "@/components/dashboard/sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: clinician } = await supabase
    .from("clinicians")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // /dashboard/onboarding lives outside this route group specifically so it
  // doesn't inherit this layout — otherwise a user with no practice yet
  // would hit this redirect the moment onboarding itself tried to render.
  if (!clinician) {
    redirect("/dashboard/onboarding");
  }

  const { data: practice } = await supabase
    .from("practices")
    .select("id, name")
    .eq("id", clinician.practice_id)
    .single();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader
          clinician={clinician}
          practiceName={practice?.name ?? null}
          practiceId={practice?.id ?? null}
        />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
