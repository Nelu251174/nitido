import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({user:null as null|{id:string;role:string},create:vi.fn()}));
vi.mock('@/lib/auth',()=>({getCurrentUser:async()=>state.user}));
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/lib/reviews',()=>({createVerifiedReview:state.create}));
import {POST} from './route';
beforeEach(()=>{state.user=null;state.create.mockReset().mockReturnValue({ok:true,id:'r'});});
function post(body:unknown,origin='https://nitido.ro'){return POST(new NextRequest('https://nitido.ro/api/jobs/job/rating',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id:'job'})});}
it('denies unauthenticated and firm calls before any review write',async()=>{expect((await post({stars:5})).status).toBe(401);state.user={id:'firm-user',role:'firma'};expect((await post({stars:5})).status).toBe(401);expect(state.create).not.toHaveBeenCalled();});
it('denies cookie requests from an untrusted origin',async()=>{state.user={id:'owner',role:'client'};expect((await post({stars:5},'https://other.invalid')).status).toBe(403);expect(state.create).not.toHaveBeenCalled();});
it('rejects malformed payloads and derives identity exclusively from the authenticated session',async()=>{state.user={id:'owner',role:'client'};expect((await post(null)).status).toBe(400);expect((await post({stars:1,clientId:'other',firmId:'mine'})).status).toBe(201);expect(state.create).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({clientId:'owner',jobId:'job',rating:1}));});
it('propagates ownership, completion and duplicate failures rather than reporting success',async()=>{state.user={id:'owner',role:'client'};for(const status of [403,409]){state.create.mockReturnValueOnce({ok:false,status,error:'Evaluare nepermisă'});const response=await post({stars:4});expect(response.status).toBe(status);expect(await response.json()).toEqual({error:'Evaluare nepermisă'});}});
