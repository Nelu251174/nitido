import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Stripe from 'stripe';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({process:vi.fn(),client:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/lib/payments',()=>({getStripeClient:state.client}));
vi.mock('@/lib/stripeEventProcessor',()=>({processStripeEvent:state.process}));
import {POST} from './route';
const secret='whsec_connect_test_only';
const platformSecret='whsec_platform_test_only';
const stripe=new Stripe('sk_test_fixture');
function event(overrides:Record<string,unknown>={}){
  return {id:'evt_connecttest',type:'payout.paid',livemode:false,account:'acct_firm',
    data:{object:{id:'po_test'}},...overrides};
}
function request(body:unknown=event(),signingSecret=secret,timestamp=Math.floor(Date.now()/1000)){
  const payload=JSON.stringify(body);
  const signature=stripe.webhooks.generateTestHeaderString({payload,secret:signingSecret,timestamp});
  return new NextRequest('https://sandbox.nitido.ro/api/stripe/connect-webhook',{
    method:'POST',body:payload,headers:{'stripe-signature':signature}});
}
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET',platformSecret);vi.stubEnv('STRIPE_CONNECT_WEBHOOK_SECRET',secret);
  state.client.mockReturnValue(stripe);state.process.mockResolvedValue({received:true});});
afterEach(()=>vi.unstubAllEnvs());
describe('Connect webhook with real Stripe signature verification',()=>{
  it.each([null,42,'invalid'])('rejects a signed non-event payload %j',async body=>{
    expect((await POST(request(body))).status).toBe(400);expect(state.process).not.toHaveBeenCalled();
  });
  it.each(['payout.paid','payout.failed','account.updated'])('processes signed %s in the matching context',async type=>{
    const body=event({type,...(type==='account.updated'?{data:{object:{id:'acct_firm'}}}:{})});
    expect((await POST(request(body))).status).toBe(200);
    expect(state.process).toHaveBeenCalledWith({},stripe,body);
  });
  it.each([platformSecret,'whsec_unrelated'])('rejects a different endpoint secret',async signingSecret=>{
    expect((await POST(request(event(),signingSecret))).status).toBe(400);expect(state.process).not.toHaveBeenCalled();
  });
  it('rejects missing and expired signatures before processing',async()=>{
    expect((await POST(new NextRequest('https://sandbox.nitido.ro/api/stripe/connect-webhook',{method:'POST',body:'{}'}))).status).toBe(400);
    expect((await POST(request(event(),secret,Math.floor(Date.now()/1000)-601))).status).toBe(400);
    expect(state.process).not.toHaveBeenCalled();
  });
  it.each([{account:undefined},{account:'not_an_account'},{livemode:true},{livemode:undefined},
    {type:'payment_intent.canceled'},{data:{object:{id:'pi_test'}}},{data:null},
    {type:'account.updated',data:{object:{id:'acct_other'}}}])('rejects mismatched signed envelopes %j',async change=>{
    expect((await POST(request(event(change)))).status).toBe(400);expect(state.process).not.toHaveBeenCalled();
  });
  it.each(['',platformSecret])('fails closed for a missing or reused secret',async value=>{
    vi.stubEnv('STRIPE_CONNECT_WEBHOOK_SECRET',value);expect((await POST(request())).status).toBe(503);
    expect(state.process).not.toHaveBeenCalled();
  });
  it('supports restricted live keys but rejects test events in live mode',async()=>{
    vi.stubEnv('STRIPE_SECRET_KEY','rk_live_fixture');expect((await POST(request())).status).toBe(400);
    expect((await POST(request(event({livemode:true})))).status).toBe(200);
  });
  it('preserves duplicate acknowledgement from the durable processor',async()=>{
    state.process.mockResolvedValue({received:true,duplicate:true});
    expect(await (await POST(request())).json()).toEqual({received:true,duplicate:true});
  });
  it('returns a retryable generic failure without leaking provider details',async()=>{
    state.process.mockRejectedValue(Error('private provider details'));const response=await POST(request());
    expect(response.status).toBe(500);expect(await response.text()).not.toContain('private provider details');
  });
  it('fails closed when the Stripe client cannot be configured',async()=>{
    state.client.mockImplementation(()=>{throw Error('private key')});expect((await POST(request())).status).toBe(503);
    state.client.mockReturnValue(null);expect((await POST(request())).status).toBe(503);
  });
});
