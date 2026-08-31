import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./apiCore";
import { acceptFirmJob, canCompleteJob, canStartJob, firmOperationError, navigationUrl, paymentState } from "./firmOperations";
import type { Job } from "./types";

const base:Job={id:"job-1",city:"București",sqm:80,space_type:"apartament",scheduled_at:"2026-09-10T09:00:00.000Z",price_gross:500,status:"accepted",accepted_firm_id:"firm-1"};
describe("firm operational client",()=>{
  it("waits for the server-confirmed first valid Accept",async()=>{const request=vi.fn().mockResolvedValue({job:{...base,status:"accepted"}});const result=await acceptFirmJob(base.id,request);expect(request).toHaveBeenCalledWith("/api/jobs/job-1/accept",{method:"POST"});expect(result.job.status).toBe("accepted")});
  it("maps already-taken and eligibility failures without optimistic success",()=>{expect(firmOperationError(new ApiError("Conflict",409,"ALREADY_TAKEN"))).toContain("altă firmă");expect(firmOperationError(new ApiError("Firma nu este eligibilă",403))).toBe("Firma nu este eligibilă")});
  it("requires persisted arrival proof before start",()=>{expect(canStartJob(base)).toBe(false);expect(canStartJob({...base,proofs:[{id:"p1",type:"ARRIVAL",url:"/api/uploads/p1",createdAt:"now"}]})).toBe(true)});
  it("requires arrived state and persisted completion proof before completion",()=>{const proof={id:"p2",type:"COMPLETION" as const,url:"/api/uploads/p2",createdAt:"now"};expect(canCompleteJob({...base,proofs:[proof]})).toBe(false);expect(canCompleteJob({...base,status:"arrived",proofs:[proof]})).toBe(true)});
  it("uses only authorized address data for navigation",()=>{expect(navigationUrl({...base,street:undefined,postal_code:null})).toBeNull();expect(navigationUrl({...base,street:"Strada Exemplu 10",postal_code:"010101"})).toContain("Strada%20Exemplu%2010")});
  it("renders backend financial state without local payout math",()=>{expect(paymentState(base)).toContain("indisponibilă");expect(paymentState({...base,financial:{paymentStatus:"authorized",firmPayout:410,transferStatus:"pending",payoutStatus:"pending"}})).toBe("Plată autorizată")});
});
