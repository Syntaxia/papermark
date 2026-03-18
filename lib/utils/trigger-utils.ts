import { queue } from "@trigger.dev/sdk/v3";

import { BasePlan } from "../swr/use-billing";

const concurrencyConfig: Record<string, number> = {
  free: 1,
  starter: 1,
  pro: 2,
  business: 10,
  datarooms: 10,
  "datarooms-plus": 10,
  "datarooms-premium": 10,
};

export const conversionQueue = (plan: string) => {
  const planName = plan.split("+")[0] as BasePlan;

  return queue({
    name: `conversion-${planName}`,
    concurrencyLimit: concurrencyConfig[planName] || 10,
  });
};
