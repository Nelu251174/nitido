import type { JobRow } from "@/lib/types";

export function clientCanReadJob(userId: string, job: JobRow): boolean {
  return job.client_id === userId;
}

export function firmCanReadFullJob(firmId: string, job: JobRow): boolean {
  return job.accepted_firm_id === firmId;
}

export function firmCanSeeWaitingJob(
  firmId: string,
  job: JobRow,
  coversCity: boolean
): boolean {
  return firmCanReadFullJob(firmId, job) || (job.status === "waiting" && coversCity);
}

export function firmCanTransitionJob(
  firmId: string,
  job: Pick<JobRow, "accepted_firm_id" | "status">,
  transition: "arrived" | "complete"
): boolean {
  if (job.accepted_firm_id !== firmId) return false;
  return transition === "arrived"
    ? job.status === "accepted"
    : job.status === "accepted" || job.status === "arrived";
}

export function canRateJob(userId: string, job: JobRow): boolean {
  return job.client_id === userId && job.status === "completed" && Boolean(job.accepted_firm_id);
}

export function shouldSeedDemo(nodeEnv: string | undefined, enabled: string | undefined): boolean {
  return nodeEnv !== "production" && enabled === "true";
}
