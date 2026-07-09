import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeClient, planFromPriceId } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendTransactionalEmail, LOOPS_TEMPLATES } from "@/lib/loops";
import type { SubscriptionStatus } from "@/types/database";

export const runtime = "nodejs";

async function getOrganizationIdForCustomer(
  supabase: ReturnType<typeof createServiceRoleClient>,
  customerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  return data?.id ?? null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const supabase = createServiceRoleClient();
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const organizationId =
    subscription.metadata.organization_id ??
    (await getOrganizationIdForCustomer(supabase, customerId));

  if (!organizationId) return;

  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? planFromPriceId(priceId) : null;

  await supabase
    .from("organizations")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_plan: plan,
      subscription_status: subscription.status as SubscriptionStatus,
    })
    .eq("id", organizationId);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, {
      status: 400,
    });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
        await syncSubscription(subscription);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const supabase = createServiceRoleClient();
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const organizationId = await getOrganizationIdForCustomer(supabase, customerId);

      if (organizationId) {
        await supabase
          .from("organizations")
          .update({ subscription_status: "canceled" })
          .eq("id", organizationId);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

      if (customerId) {
        const supabase = createServiceRoleClient();
        const organizationId = await getOrganizationIdForCustomer(supabase, customerId);

        if (organizationId) {
          const { data: org } = await supabase
            .from("organizations")
            .select("owner_id")
            .eq("id", organizationId)
            .single();

          if (org?.owner_id) {
            const { data: owner } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", org.owner_id)
              .single();

            if (owner?.email) {
              await sendTransactionalEmail({
                transactionalId: LOOPS_TEMPLATES.subscriptionPastDue,
                email: owner.email,
              });
            }
          }
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
