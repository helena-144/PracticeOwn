import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession, getStripeClient, STRIPE_PRICE_IDS } from "@/lib/stripe";

const bodySchema = z.object({
  plan: z.enum(["solo", "group"]),
});

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
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
    .select("id, stripe_customer_id")
    .eq("id", clinician.practice_id)
    .single();

  if (!practice) {
    return NextResponse.json({ error: "Practice not found" }, { status: 404 });
  }

  let customerId = practice.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await getStripeClient().customers.create({
      email: user.email,
      metadata: { practice_id: practice.id, user_id: user.id },
    });
    customerId = customer.id;

    await supabase
      .from("practices")
      .update({ stripe_customer_id: customerId })
      .eq("id", practice.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await createCheckoutSession({
    customerId,
    priceId: STRIPE_PRICE_IDS[parsed.data.plan],
    practiceId: practice.id,
    successUrl: `${appUrl}/billing?checkout=success`,
    cancelUrl: `${appUrl}/billing?checkout=canceled`,
  });

  return NextResponse.json({ url: session.url });
}
