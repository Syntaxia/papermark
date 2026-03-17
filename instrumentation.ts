export async function register() {
  // Only run cron scheduler on the server (not during build or in edge runtime)
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.SELF_HOSTED === "1"
  ) {
    const { startCronScheduler } = await import("./lib/cron/scheduler");
    startCronScheduler();
  }
}
