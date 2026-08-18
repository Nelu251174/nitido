export async function register() {
  // Doar în runtime Node.js (nu Edge) — better-sqlite3 nu rulează pe Edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startNoShowScheduler } = await import("@/lib/noShowScheduler");
    startNoShowScheduler();
  }
}
