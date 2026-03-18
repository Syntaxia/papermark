export const conversionQueue = (_plan: string): undefined => {
  // Self-hosted: use the task's default queue (defined in task definition)
  // rather than named queues which must be pre-registered in Trigger.dev v4
  return undefined;
};
