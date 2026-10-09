import { describe,expect,it } from "vitest";
import { toE164Romania } from "./sms";

describe("normalizare E.164 România",()=>{
  it.each([["0721234567","+40721234567"],["0721 234 567","+40721234567"],["721234567","+40721234567"],["40721234567","+40721234567"],["+40721234567","+40721234567"]])("normalizează %s",(input,expected)=>expect(toE164Romania(input)).toBe(expected));
  it.each(["abc","123","+441234567890","07123","+407212345678"])("respinge numărul invalid %s",input=>expect(toE164Romania(input)).toBeNull());
});
