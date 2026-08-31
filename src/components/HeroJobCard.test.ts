import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
const card=readFileSync(join(process.cwd(),"src/components/HeroJobCard.tsx"),"utf8");const homepage=readFileSync(join(process.cwd(),"src/app/page.tsx"),"utf8");
describe("dynamic hero job card",()=>{
  it("derives title from centralized service mapping",()=>{expect(card).toContain("jobTypeLabel(job.serviceType)");expect(card).not.toContain(">Curățenie apartament<");expect(homepage).toContain('<HeroJobCard job={heroJob}/>');});
  it("accepts structured safe demo or future feed data",()=>{for(const field of ["serviceType","zone","surfaceM2","scheduledAt","estimatedPrice"])expect(card).toContain(field);expect(card).not.toMatch(/street|postal|address|adresă/i);});
  it("supports long labels without overflow and preserves CTA",()=>{expect(card).toContain("max-h-10 overflow-hidden");expect(card).toContain("leading-5");expect(card).not.toContain("line-clamp");expect(card).toContain('href="/signup?role=firma"');expect(card).toContain("Accept lucrarea");});
});
