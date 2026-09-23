export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startNoShowScheduler } = await import("@/lib/noShowScheduler");
    startNoShowScheduler();
    const { startIcalScheduler } = await import("@/lib/icalSync");
    const { db } = await import("@/lib/db");
    startIcalScheduler(db);
    await import("@/lib/pro/init");
  }
}
