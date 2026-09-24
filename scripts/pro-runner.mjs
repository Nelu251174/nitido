/** Run from the same private network as the deployment every 15 minutes. */
const base = process.env.NITIDO_PRO_RUNNER_URL,
  secret = process.env.CRON_SECRET;
if (!base || !secret)
  throw new Error("NITIDO_PRO_RUNNER_URL and CRON_SECRET are required.");
const url = new URL("/api/pro/cron", base);
if (
  url.protocol !== "https:" &&
  !["127.0.0.1", "localhost"].includes(url.hostname)
)
  throw new Error("HTTPS is required outside localhost.");
const result = await fetch(url, {
  method: "POST",
  headers: { "x-cron-secret": secret },
  signal: AbortSignal.timeout(240000),
});
if (!result.ok) throw new Error(`Pro runner failed: HTTP ${result.status}`);
console.log(JSON.stringify(await result.json()));
