import {afterEach,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
import {hasTrustedMutationOrigin} from "./security";
afterEach(()=>vi.unstubAllEnvs());
const request=(origin:string,extra:Record<string,string>={})=>new NextRequest("http://localhost:3000/api/auth/verify-email",{method:"POST",headers:{origin,...extra}});
describe("public origin behind a reverse proxy",()=>{
 it("accepts the configured HTTPS site despite an internal Next.js origin",()=>{
  vi.stubEnv("NEXT_PUBLIC_SITE_URL","https://sandbox.nitido.ro");
  expect(hasTrustedMutationOrigin(request("https://sandbox.nitido.ro"))).toBe(true);
 });
 it.each(["https://evil.example","https://sandbox.nitido.ro.evil.example","http://sandbox.nitido.ro","https://sandbox.nitido.ro:444","null"])("rejects foreign or altered origin %s",origin=>{
  vi.stubEnv("NEXT_PUBLIC_SITE_URL","https://sandbox.nitido.ro");vi.stubEnv("NITIDO_ENABLE_BEARER_AUTH","false");
  expect(hasTrustedMutationOrigin(request(origin,{"x-forwarded-host":"sandbox.nitido.ro","x-forwarded-proto":"https"}))).toBe(false);
 });
 it.each(["","invalid","http://sandbox.nitido.ro","https://user:pass@sandbox.nitido.ro"])("does not trust invalid public configuration %s",site=>{
  vi.stubEnv("NEXT_PUBLIC_SITE_URL",site);vi.stubEnv("NITIDO_ENABLE_BEARER_AUTH","false");
  expect(hasTrustedMutationOrigin(request("https://sandbox.nitido.ro"))).toBe(false);
 });
});
