export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startNoShowScheduler } = await import("@/lib/noShowScheduler");
    startNoShowScheduler();
    await import("@/lib/pro/init");
  }
}
