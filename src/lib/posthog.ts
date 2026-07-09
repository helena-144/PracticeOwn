import { PostHog } from "posthog-node";

let posthogNodeClient: PostHog | null = null;

/**
 * Server-side PostHog client for capturing events from Route Handlers,
 * Server Actions, and webhooks. Flushes on every call site's lifecycle via
 * the caller awaiting `shutdown()` in short-lived contexts (e.g. webhooks).
 */
export function getPostHogServerClient(): PostHog {
  if (!posthogNodeClient) {
    posthogNodeClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogNodeClient;
}

export async function captureServerEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}) {
  const client = getPostHogServerClient();
  client.capture({
    distinctId: params.distinctId,
    event: params.event,
    properties: params.properties,
  });
  await client.shutdown();
}
