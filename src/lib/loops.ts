import { LoopsClient } from "loops";

let client: LoopsClient | null = null;

function getLoopsClient(): LoopsClient {
  if (!client) {
    client = new LoopsClient(process.env.LOOPS_API_KEY!);
  }
  return client;
}

/**
 * Transactional email IDs configured in the Loops dashboard.
 * Replace with the real template IDs before going live.
 */
export const LOOPS_TEMPLATES = {
  welcome: "welcome-email",
  credentialExpiringSoon: "credential-expiring-soon",
  credentialExpired: "credential-expired",
  independenceScoreAlert: "independence-score-alert",
  subscriptionReceipt: "subscription-receipt",
  subscriptionPastDue: "subscription-past-due",
  passwordReset: "password-reset",
} as const;

export type LoopsTemplateId = (typeof LOOPS_TEMPLATES)[keyof typeof LOOPS_TEMPLATES];

export async function sendTransactionalEmail(params: {
  transactionalId: LoopsTemplateId;
  email: string;
  dataVariables?: Record<string, string | number>;
}) {
  const loops = getLoopsClient();
  return loops.sendTransactionalEmail({
    transactionalId: params.transactionalId,
    email: params.email,
    dataVariables: params.dataVariables,
  });
}

export async function upsertLoopsContact(params: {
  email: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  plan?: string;
}) {
  const loops = getLoopsClient();
  return loops.updateContact({
    email: params.email,
    userId: params.userId,
    properties: {
      firstName: params.firstName ?? null,
      lastName: params.lastName ?? null,
      organizationName: params.organizationName ?? null,
      plan: params.plan ?? null,
      source: "practiceown",
    },
  });
}

export async function notifyCredentialExpiring(params: {
  email: string;
  providerName: string;
  credentialType: string;
  expirationDate: string;
  daysRemaining: number;
}) {
  return sendTransactionalEmail({
    transactionalId: LOOPS_TEMPLATES.credentialExpiringSoon,
    email: params.email,
    dataVariables: {
      providerName: params.providerName,
      credentialType: params.credentialType,
      expirationDate: params.expirationDate,
      daysRemaining: params.daysRemaining,
    },
  });
}
