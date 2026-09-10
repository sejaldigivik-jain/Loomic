import { publishDuePosts } from "@/lib/publish-service";

type SchedulerGlobal = typeof globalThis & {
  __socialflowSchedulerStarted?: boolean;
  __socialflowSchedulerRunning?: boolean;
  __socialflowSchedulerTimer?: ReturnType<typeof setInterval>;
};

const g = globalThis as SchedulerGlobal;

function schedulerIntervalMs() {
  const configured = Number(process.env.SOCIALFLOW_SCHEDULER_INTERVAL_MS ?? "5000");
  if (!Number.isFinite(configured)) return 5000;
  return Math.max(2000, Math.min(configured, 60_000));
}

async function tick() {
  // Prevent one slow Instagram publish from overlapping the next scheduler tick.
  if (g.__socialflowSchedulerRunning) return;
  g.__socialflowSchedulerRunning = true;
  try {
    const results = await publishDuePosts(25);
    if (results.length > 0) {
      const published = results.filter((result) => result.status === "published").length;
      const failed = results.filter((result) => result.status === "failed").length;
      console.log(`[SocialFlow Scheduler] Processed ${results.length} due post(s): ${published} published, ${failed} failed.`);
    }
  } catch (error) {
    console.error("[SocialFlow Scheduler] Scheduled publish check failed:", error);
  } finally {
    g.__socialflowSchedulerRunning = false;
  }
}

if (!g.__socialflowSchedulerStarted) {
  g.__socialflowSchedulerStarted = true;
  const intervalMs = schedulerIntervalMs();
  console.log(`[SocialFlow Scheduler] Automatic scheduled publishing is ON (checking every ${Math.round(intervalMs / 1000)}s).`);

  // Run shortly after the server boots so overdue posts are recovered quickly.
  setTimeout(() => void tick(), 1500);
  g.__socialflowSchedulerTimer = setInterval(() => void tick(), intervalMs);

  // Do not keep the process alive solely because of the scheduler timer.
  const timer = g.__socialflowSchedulerTimer as ReturnType<typeof setInterval> & { unref?: () => void };
  timer.unref?.();
}
