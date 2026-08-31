import { buildCreatePayload, type CreatedJobResponse, type JobQuote, type PostJobDraft, type SchedulingConfig } from "./postJobCore";

type Requester = <T>(path: string, init?: RequestInit) => Promise<T>;

export async function requestAuthoritativeQuote(draft: PostJobDraft, request: Requester) {
  return request<{ quote: JobQuote; scheduling: SchedulingConfig }>("/api/jobs/quote", {
    method: "POST",
    body: JSON.stringify({ spaceType: draft.spaceType, sqm: Number(draft.sqm) }),
  });
}

export async function publishClientJob(draft: PostJobDraft, idempotencyKey: string, request: Requester) {
  return request<CreatedJobResponse>("/api/jobs", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(buildCreatePayload(draft)),
  });
}
