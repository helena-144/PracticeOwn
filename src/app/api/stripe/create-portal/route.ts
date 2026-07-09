import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createBillingPortalSession } from "@/lib/stripe";

export async function POST() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: clinician } = await supabase
    .from("clinicians")
    .select("practice_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!clinician) {
    return NextResponse.json({ error: "No practice found for user" }, { status: 404 });
  }

  const { data: practice } = await supabase
    .from("practices")
    .select("stripe_customer_id")
    .eq("id", clinician.practice_id)
    .single();

  if (!practice?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found. Subscribe to a plan first." },
      { status: 404 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await createBillingPortalSession({
    customerId: practice.stripe_customer_id,
    returnUrl: `${appUrl}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
