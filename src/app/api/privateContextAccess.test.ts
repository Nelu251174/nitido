import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({user:{id:"firm-user",role:"firma"},admin:false,photo:{filename:"photo.png",owner_user_id:"client",proof_type:"CLIENT_CONTEXT",client_id:"client",accepted_firm_id:null as string|null,job_status:"waiting",job_city:"București"}}));
vi.mock("@/lib/auth",()=>({getCurrentUser:async()=>state.user}));
vi.mock("@/lib/adminAuth",()=>({isAdmin:async()=>state.admin}));
vi.mock("@/lib/db",()=>({db:{prepare:()=>({get:()=>state.photo})},getFirmByUserId:()=>({id:"firm",verified:1,coverage_city:"București"})}));
vi.mock("fs",()=>({default:{existsSync:()=>true,readFileSync:()=>Buffer.from([137,80,78,71])}}));
import {GET} from "./uploads/[id]/route";
const get=()=>GET(new NextRequest("http://localhost/api/uploads/photo"),{params:Promise.resolve({id:"photo"})});
beforeEach(()=>{state.user={id:"firm-user",role:"firma"};state.admin=false;state.photo.accepted_firm_id=null;state.photo.job_status="waiting"});
describe("private context photos",()=>{
 it("denies a verified local firm before allocation",async()=>{expect((await get()).status).toBe(403)});
 it("permits the allocated firm with private no-store caching",async()=>{state.photo.accepted_firm_id="firm";state.photo.job_status="accepted";const res=await get();expect(res.status).toBe(200);expect(res.headers.get("Cache-Control")).toBe("private, no-store")});
 it("permits the owning client and denies a different client",async()=>{state.user={id:"client",role:"client"};expect((await get()).status).toBe(200);state.user={id:"other",role:"client"};expect((await get()).status).toBe(403)});
});
