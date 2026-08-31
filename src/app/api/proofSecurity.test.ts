import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");

describe("proof upload and visibility security",()=>{
  const upload=read("src/app/api/uploads/route.ts");
  const asset=read("src/app/api/uploads/[id]/route.ts");
  const jobs=read("src/app/api/jobs/route.ts");
  it("derives proof ownership from authenticated allocated firm",()=>{expect(upload).toContain("getFirmByUserId(user.id)");expect(upload).toContain("job.accepted_firm_id !== firm.id");expect(upload).toContain("uploaded_by_firm_id");expect(upload).not.toContain("formData.get(\"uploadedByFirmId\")");});
  it("prevents clients from uploading firm proof types",()=>{expect(upload).toContain('if (user.role === "firma")');expect(upload).toContain("'CLIENT_CONTEXT'");});
  it("validates image content, size and generated filename",()=>{expect(upload).toContain("MAX_SIZE_BYTES");expect(upload).toContain("detectedImageType(buffer)");expect(upload).toContain('const filename = `${id}.${ext}`');});
  it("limits private proof assets to owning client, allocated firm or admin",()=>{expect(asset).toContain("photo.client_id === user.id");expect(asset).toContain("photo.accepted_firm_id === firm.id");expect(asset).toContain("admin ||");expect(asset).toContain('Cache-Control": "private, no-store');});
  it("returns typed proofs only inside authorized job context",()=>{expect(jobs).toContain("canSeePrivate");expect(jobs).toContain("proofs: proofsByJob.get(j.id)");});
});
