import cron from "node-cron";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

async function callCronEndpoint(path: string) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) {
      console.error(`Cron ${path} failed with status ${response.status}`);
    }
  } catch (error) {
    console.error(`Cron ${path} error:`, error);
  }
}

export function startCronScheduler() {
  console.log("[cron] Starting self-hosted cron scheduler");

  // Daily dataroom digest — 9 AM UTC
  cron.schedule("0 9 * * *", () => {
    callCronEndpoint("/api/cron/dataroom-digest/daily");
  });

  // Weekly dataroom digest — Monday 9 AM UTC
  cron.schedule("0 9 * * 1", () => {
    callCronEndpoint("/api/cron/dataroom-digest/weekly");
  });

  // Domain verification check — Daily 12 PM UTC
  cron.schedule("0 12 * * *", () => {
    callCronEndpoint("/api/cron/domains");
  });

  // Year-in-review email queue processing — Hourly
  cron.schedule("0 * * * *", () => {
    callCronEndpoint("/api/cron/year-in-review");
  });

  console.log("[cron] Scheduled 4 cron jobs");
}
