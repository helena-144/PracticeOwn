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

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "No organization found for user" }, { status: 404 });
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, stripe_customer_id")
    .eq("id", profile.organization_id)
    .single();

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  let customerId = organization.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await getStripeClient().customers.create({
      email: user.email,
      metadata: { organization_id: organization.id, user_id: user.id },
    });
    customerId = customer.id;

    await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", organization.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await createCheckoutSession({
    customerId,
    priceId: STRIPE_PRICE_IDS[parsed.data.plan],
    organizationId: organization.id,
    successUrl: `${appUrl}/billing?checkout=success`,
    cancelUrl: `${appUrl}/billing?checkout=canceled`,
  });

  return NextResponse.json({ url: session.url });
}
