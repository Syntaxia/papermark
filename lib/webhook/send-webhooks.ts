import { Webhook } from "@prisma/client";

import { createWebhookSignature } from "./signature";
import { prepareWebhookPayload } from "./transform";
import { EventDataProps, WebhookPayload, WebhookTrigger } from "./types";

// Send webhooks to multiple webhooks
export const sendWebhooks = async ({
  webhooks,
  trigger,
  data,
}: {
  webhooks: Pick<Webhook, "pId" | "url" | "secret">[];
  trigger: WebhookTrigger;
  data: EventDataProps;
}) => {
  if (webhooks.length === 0) {
    return;
  }

  const payload = prepareWebhookPayload(trigger, data);

  return await Promise.all(
    webhooks.map((webhook) => deliverWebhook({ webhook, payload })),
  );
};

// Deliver webhook with retry logic (replaces QStash)
const deliverWebhook = async ({
  webhook,
  payload,
  maxRetries = 3,
}: {
  webhook: Pick<Webhook, "pId" | "url" | "secret">;
  payload: WebhookPayload;
  maxRetries?: number;
}) => {
  const signature = await createWebhookSignature(webhook.secret, payload);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Papermark-Signature": signature,
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text().catch(() => "");

      // Report delivery status to callback endpoint (matching QStash format)
      const callbackUrl = new URL(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/callback`,
      );
      callbackUrl.searchParams.append("webhookId", webhook.pId);
      callbackUrl.searchParams.append("eventId", payload.id);
      callbackUrl.searchParams.append("event", payload.event);

      await fetch(callbackUrl.href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhook.url,
          status: response.ok ? 200 : response.status,
          body: Buffer.from(responseBody).toString("base64"),
          sourceBody: Buffer.from(JSON.stringify(payload)).toString("base64"),
          sourceMessageId: `self-hosted-${Date.now()}`,
        }),
      }).catch(() => {}); // Don't fail on callback errors

      if (response.ok) {
        return { messageId: `self-hosted-${Date.now()}` };
      }

      // Don't retry on 4xx (client errors)
      if (response.status >= 400 && response.status < 500) {
        console.error(
          `Webhook delivery failed with ${response.status} for ${webhook.url}`,
        );
        return { messageId: null };
      }
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(
          `Webhook delivery failed after ${maxRetries + 1} attempts for ${webhook.url}:`,
          error,
        );
        return { messageId: null };
      }
    }

    // Exponential backoff: 1s, 2s, 4s
    await new Promise((resolve) =>
      setTimeout(resolve, Math.pow(2, attempt) * 1000),
    );
  }

  return { messageId: null };
};
