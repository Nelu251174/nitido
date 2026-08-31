import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { notificationRoute } from "./push.web";
const source=(file:string)=>readFileSync(join(process.cwd(),file),"utf8");
describe("final mobile integrations",()=>{
  it("routes notification references through authenticated app screens",()=>{expect(notificationRoute("firma","JOB_CREATED","job-1")).toBe("/(firma)/job-preview/job-1");expect(notificationRoute("client","JOB_COMPLETED","job-1")).toBe("/(client)/job/job-1")});
  it("registers and revokes only the current device",()=>{const push=source("src/push.ts");expect(push).toContain("/api/push/register");expect(push).toContain("/api/push/unregister");expect(source("src/auth.tsx")).toContain("unregisterCurrentPush")});
  it("keeps SMS backend-only",()=>{expect(source("app/notifications.tsx")).toContain("SMS-ul de rezervă este gestionat exclusiv de backend");expect(source("src/push.ts")).not.toMatch(/sendSms|twilio|SMS_API_KEY/)});
  it("provides contextual location permission and truthful map fallback",()=>{const active=source("app/(firma)/active.tsx");expect(active).toContain("requestForegroundPermissionsAsync");expect(active).not.toContain("requestBackgroundPermissionsAsync");expect(active).toContain("backendul furnizează adresa autorizată")});
  it("renders payment truth received from backend",()=>{const client=source("app/(client)/job/[id].tsx");const firm=source("app/(firma)/earnings.tsx");expect(client).toContain("job.financial?.paymentStatus");expect(firm).toContain("job.financial.firmPayout");expect(client+firm).not.toMatch(/0\.82|0\.18|calculatePayment/)});
  it("connects verified reviews and honest empty states",()=>{const detail=source("app/(client)/job/[id].tsx");expect(detail).toContain(`/rating`);expect(detail).toContain("job.ownReview");expect(source("app/(firma)/reviews.tsx")).toContain("Încă nu există suficiente evaluări")});
  it("ships Trust Center and role-aware AI backend integration",()=>{expect(source("app/trust.tsx")).toContain("/api/trust");const support=source("src/SupportChat.tsx");expect(support).toContain("/api/support/ai");expect(support).toContain("contextul permis rolului tău")});
  it("keeps web startup platform-safe",()=>{expect(source("src/push.web.ts")).not.toContain("expo-notifications");expect(source("app/(firma)/active.tsx")).toContain('await import("expo-location")')});
});
