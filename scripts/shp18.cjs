// Test-mode provider verification only. Does not load or mutate the application database.
const key=process.env.STRIPE_SECRET_KEY||'';
if(process.env.NEXT_PUBLIC_SITE_URL!=='https://sandbox.nitido.ro'||!/^(?:sk|rk)_test_/.test(key))throw Error('TEST_SANDBOX_REQUIRED');
const tag='nitido-supplement-20261022-v2';
async function api(method,path,data={},suffix=''){
 const payload=new URLSearchParams(data),url='https://api.stripe.com/v1/'+path+(method==='GET'?'?'+payload:'');
 const response=await fetch(url,{method,headers:{Authorization:'Bearer '+key,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':tag+suffix}:{})},...(method==='POST'?{body:payload}:{}),signal:AbortSignal.timeout(20000)});
 const result=await response.json();if(!response.ok)throw Error('TEST_PROVIDER_NOT_CONFIRMED');return result;
}
(async()=>{
 const customer=await api('POST','customers',{name:'NITIDO synthetic supplement smoke','metadata[synthetic]':'true','metadata[purpose]':tag},'-customer');
 if(customer.livemode!==false)throw Error('TEST_CUSTOMER_REQUIRED');
 const setup=await api('POST','setup_intents',{customer:customer.id,payment_method:'pm_card_visa',confirm:'true',usage:'off_session','payment_method_types[0]':'card'},'-setup');
 if(setup.livemode||setup.status!=='succeeded'||typeof setup.payment_method!=='string')throw Error('TEST_CARD_NOT_CONFIRMED');
 let intent=await api('POST','payment_intents',{amount:'1000',currency:'ron',customer:customer.id,payment_method:setup.payment_method,off_session:'true',confirm:'true',capture_method:'manual','payment_method_types[0]':'card','metadata[synthetic]':'true','metadata[jobId]':tag,'metadata[paymentId]':tag+'-payment'},'-hold');
 intent=await api('GET','payment_intents/'+intent.id,{'expand[0]':'latest_charge'});
 if(intent.livemode||intent.amount!==1000||intent.currency!=='ron'||intent.capture_method!=='manual'||intent.metadata.jobId!==tag)throw Error('TEST_IDENTITY_MISMATCH');
 if(intent.status==='requires_capture'){
  const deadline=intent.latest_charge?.payment_method_details?.card?.capture_before;
  if(intent.amount_capturable!==1000||typeof deadline!=='number'||deadline*1000<=Date.now()+210*60000)throw Error('TEST_HOLD_COVERAGE_NOT_CONFIRMED');
  intent=await api('POST','payment_intents/'+intent.id+'/capture',{},'-capture');
 }
 if(intent.livemode||intent.status!=='succeeded'||intent.amount_received!==1000)throw Error('TEST_CAPTURE_NOT_CONFIRMED');
 console.log(JSON.stringify({status:'passed',synthetic:true,mode:'test',cardSetup:true,manualHold:true,capture:true,transfers:false}));
})().catch(()=>{console.error('TEST_PAYMENT_NOT_CONFIRMED');process.exitCode=1});
