// Manual smoke on the EXISTING sandbox. Never a production key or real user.
const SITE=process.env.NEXT_PUBLIC_SITE_URL;
const KEY=process.env.STRIPE_SECRET_KEY||'';
if(SITE!=='https://sandbox.nitido.ro')throw Error('SMOKE_WRONG_TARGET');
if(!/^(?:sk|rk)_test_/.test(KEY))throw Error('SMOKE_TEST_CREDENTIAL_REQUIRED');
const Stripe=require('stripe');
const stripe=new Stripe(KEY);
const tag='nitido-supplement-20261022-v1';
(async()=>{
 const customer=await stripe.customers.create({name:'NITIDO synthetic supplement smoke',metadata:{synthetic:'true',purpose:tag}},{idempotencyKey:tag+'-customer'});
 const setup=await stripe.setupIntents.create({customer:customer.id,payment_method:'pm_card_visa',confirm:true,usage:'off_session',automatic_payment_methods:{enabled:true,allow_redirects:'never'}},{idempotencyKey:tag+'-setup'});
 if(setup.status!=='succeeded'||typeof setup.payment_method!=='string')throw Error('SMOKE_CARD_SETUP_NOT_CONFIRMED');
 let intent=await stripe.paymentIntents.create({amount:1000,currency:'ron',customer:customer.id,payment_method:setup.payment_method,off_session:true,confirm:true,capture_method:'manual',metadata:{synthetic:'true',jobId:tag,paymentId:tag+'-payment'}},{idempotencyKey:tag+'-hold'});
 intent=await stripe.paymentIntents.retrieve(intent.id,{expand:['latest_charge']});
 if(intent.livemode||intent.currency!=='ron'||intent.amount!==1000||intent.capture_method!=='manual'||intent.metadata.jobId!==tag)throw Error('SMOKE_IDENTITY_MISMATCH');
 if(intent.status==='requires_capture'){
  const charge=intent.latest_charge&&typeof intent.latest_charge==='object'?intent.latest_charge:null;
  const deadline=charge?.payment_method_details?.card?.capture_before;
  if(intent.amount_capturable!==1000||typeof deadline!=='number'||deadline*1000<=Date.now()+210*60000)throw Error('SMOKE_HOLD_COVERAGE_NOT_CONFIRMED');
  intent=await stripe.paymentIntents.capture(intent.id,{}, {idempotencyKey:tag+'-capture'});
 }
 if(intent.livemode||intent.status!=='succeeded'||intent.amount_received!==1000)throw Error('SMOKE_CAPTURE_NOT_CONFIRMED');
 console.log(JSON.stringify({status:'passed',synthetic:true,mode:'test',setup:true,manualHold:true,capture:true,transfers:false}));
})().catch(e=>{console.error(JSON.stringify({status:'failed',code:/^SMOKE_[A-Z_]+$/.test(e.message)?e.message:'SMOKE_PROVIDER_NOT_CONFIRMED',providerCode:typeof e.code==='string'&&/^[a-z_]+$/.test(e.code)?e.code:null}));process.exitCode=1;});
