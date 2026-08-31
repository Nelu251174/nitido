import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {formatHeroJobDate,HERO_JOB_SCHEDULED_AT} from "./heroJobDate";

describe("homepage hero job date",()=>{
  it("derives Romanian full date and time from one authoritative ISO value",()=>{expect(HERO_JOB_SCHEDULED_AT).toBe("2026-08-30T11:24:00+03:00");expect(formatHeroJobDate()).toEqual({compactDate:"30.08.2026",longDate:"30 august 2026",time:"11:24"});});
  it("uses semantic time markup and keeps the existing CTA",()=>{const card=readFileSync(join(process.cwd(),"src/components/HeroJobCard.tsx"),"utf8");expect(card).toContain("<time dateTime={job.scheduledAt}");expect(card).toContain("schedule.compactDate");expect(card).toContain("schedule.longDate");expect(card).toContain("schedule.time");expect(card).toContain('href="/signup?role=firma"');});
  it("keeps a compact non-wrapping badge and the existing mobile card positioning",()=>{const card=readFileSync(join(process.cwd(),"src/components/HeroJobCard.tsx"),"utf8");expect(card).toContain("shrink-0 rounded-xl");expect(card).toContain("max-sm:left-3");expect(card).toContain("text-[10px]");});
});
