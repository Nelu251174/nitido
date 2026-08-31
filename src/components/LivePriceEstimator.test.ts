import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {calcGrossPrice} from "@/lib/pricing";
import {ESTIMATOR_DEFAULT_SQM,ESTIMATOR_MAX_SQM,ESTIMATOR_MIN_SQM,ESTIMATOR_STEP_SQM} from "./LivePriceEstimator";

const source=readFileSync(join(process.cwd(),"src/components/LivePriceEstimator.tsx"),"utf8");
describe("interactive homepage price estimator",()=>{
  it("uses the expected native range bounds and default",()=>{expect(ESTIMATOR_MIN_SQM).toBe(10);expect(ESTIMATOR_MAX_SQM).toBe(1000);expect(ESTIMATOR_STEP_SQM).toBe(5);expect(ESTIMATOR_DEFAULT_SQM).toBe(120);expect(source).toContain('type="range"');});
  it("uses the authoritative apartment pricing function",()=>{expect(source).toContain('calcGrossPrice("apartament",sqm)');expect(calcGrossPrice("apartament",10)).toBe(350);expect(calcGrossPrice("apartament",120)).toBe(780);expect(calcGrossPrice("apartament",250)).toBe(1625);expect(calcGrossPrice("apartament",1000)).toBe(6500);});
  it("updates surface and price immediately from range input",()=>{expect(source).toContain("onChange={event=>setSqm(Number(event.target.value))}");expect(source).toContain("{sqm} m²");expect(source).toContain("{price} lei");expect(source).toContain("aria-live=\"polite\"");});
  it("is accessible by keyboard and touch through a semantic range",()=>{expect(source).toContain('aria-label="Suprafața estimată în metri pătrați"');expect(source).toContain("aria-valuetext");expect(source).toContain("touch-none");});
  it("is informational and cannot mutate job or payment state",()=>{expect(source).not.toContain("fetch(");expect(source).not.toContain("/api/jobs");expect(source).not.toMatch(/payment|authorize|capture/i);expect(source).toContain("Estimare orientativă. Prețul final este calculat la postarea lucrării.");});
});
