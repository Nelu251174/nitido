import {describe,expect,it} from "vitest";
import {JOB_TYPE_LABELS,jobTypeLabel} from "./jobTypeLabels";

describe("canonical job type labels",()=>{
  it("maps every actual authoritative SpaceType",()=>{expect(JOB_TYPE_LABELS).toEqual({apartament:"Curățenie apartament",casa:"Curățenie casă",birou:"Curățenie birou / office",altul:"Curățenie – alt tip de spațiu"});});
  it("uses a controlled fallback for unsupported runtime values",()=>{expect(jobTypeLabel("hotel")).toBe("Serviciu de curățenie");expect(jobTypeLabel("villa")).toBe("Serviciu de curățenie");});
});
