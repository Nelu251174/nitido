import {beforeEach,expect,it,vi} from 'vitest';import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({auth:vi.fn(),expire:vi.fn(),queries:[] as string[],writes:vi.fn()}));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.auth}));
vi.mock('@/lib/db',()=>({db:{prepare:(sql:string)=>{mocks.queries.push(sql);return {all:()=>[],get:()=>undefined,run:mocks.writes}}},newId:vi.fn(),getFirmByUserId:vi.fn()}));
vi.mock('@/lib/express60',async importOriginal=>({...await importOriginal<typeof import('@/lib/express60')>(),expireExpress60Guarantees:mocks.expire}));
import {GET} from './route';
beforeEach(()=>{vi.clearAllMocks();mocks.queries.length=0;mocks.auth.mockResolvedValue({id:'synthetic-client',role:'client'})});
it('reads an authenticated feed without expiration or SQL writes and preserves read-only session lookup',async()=>{const req=new NextRequest('https://nitido.ro/api/jobs');const response=await GET(req);expect(response.status).toBe(200);expect(mocks.auth).toHaveBeenCalledWith(req,{readOnly:true});expect(mocks.expire).not.toHaveBeenCalled();expect(mocks.writes).not.toHaveBeenCalled();expect(mocks.queries.every(sql=>/^SELECT\b/.test(sql.trim()))).toBe(true)});
