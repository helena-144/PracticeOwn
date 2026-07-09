import Stripe from "stripe";

import type { SubscriptionPlan } from "@/types/database";

let stripeClient: Stripe | null = null;

/**
 * Lazily constructs the Stripe client so that importing this module doesn't
 * throw during build-time page data collection, when env vars are unset.
 */
export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
      appInfo: {
        name: "PracticeOwn",
      },
    });
  }
  return stripeClient;
}

export const STRIPE_PRICE_IDS: Record<SubscriptionPlan, string> = {
  solo: process.env.STRIPE_SOLO_PRICE_ID!,
  group: process.env.STRIPE_GROUP_PRICE_ID!,
};

export function planFromPriceId(priceId: string): SubscriptionPlan | null {
  if (priceId === STRIPE_PRICE_IDS.solo) return "solo";
  if (priceId === STRIPE_PRICE_IDS.group) return "group";
  return null;
}

export async function createCheckoutSession(params: {
  customerId?: string;
  customerEmail?: string;
  priceId: string;
  organizationId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return getStripeClient().checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    customer_email: params.customerId ? undefined : params.customerEmail,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: {
      metadata: { organization_id: params.organizationId },
    },
    metadata: { organization_id: params.organizationId },
    client_reference_id: params.organizationId,
    allow_promotion_codes: true,
  });
}

export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  return getStripeClient().billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}
