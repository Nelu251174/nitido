import {pathToFileURL} from 'node:url';

// Only fixed identifiers and booleans leave this function. Never echo environment values.
export function inspectStaging(env){
 const checks=[];
 const add=(id,pass)=>checks.push({id,status:pass?'pass':'fail'});
 const secret=env.STRIPE_SECRET_KEY??'',publicKey=env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY??'';
 add('stripe_server_test_key',/^(sk|rk)_test_[A-Za-z0-9]+$/.test(secret)&&!/(dummy|fixture|example)/i.test(secret));
 add('stripe_publishable_test_key',/^pk_test_[A-Za-z0-9]+$/.test(publicKey)&&!/(dummy|fixture|example)/i.test(publicKey));
 add('stripe_webhook_signing_secret',/^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET??'')&&!/(dummy|fixture|example)/i.test(env.STRIPE_WEBHOOK_SECRET??''));
 let origin=null;
 try{const url=new URL(env.NEXT_PUBLIC_SITE_URL);if(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash)origin=url.origin;}catch{}
 add('staging_origin',origin==='https://sandbox.nitido.ro');
 add('transfers_explicitly_disabled',env.NITIDO_STRIPE_CONNECT_TRANSFERS_ENABLED==='false');
 add('demo_seeding_disabled',env.NITIDO_SEED_DEMO==='false');
 add('expected_stripe_account',/^acct_[a-zA-Z0-9]+$/.test(env.NITIDO_STRIPE_PLATFORM_ACCOUNT_ID??''));
 return {configurationReady:checks.every(c=>c.status==='pass'),checks,unverified:['publishable_key_same_account','signed_webhook_delivery','sandbox_payment_lifecycle','authenticated_dashboards','physical_devices','infrastructure_restore']};
}

export async function verifyStripeAccount(env,Stripe){
 if(!inspectStaging(env).configurationReady)return {id:'stripe_account_identity',status:'blocked'};
 try{
   const stripe=new Stripe(env.STRIPE_SECRET_KEY,{timeout:10000,maxNetworkRetries:0});
   const account=await stripe.accounts.retrieve();
   return {id:'stripe_account_identity',status:account.id===env.NITIDO_STRIPE_PLATFORM_ACCOUNT_ID?'pass':'fail'};
 }catch{return {id:'stripe_account_identity',status:'fail'};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const flags=process.argv.slice(2);
 if(flags.some(flag=>flag!=='--verify-stripe')){console.error('Usage: node scripts/staging-preflight.mjs [--verify-stripe]');process.exitCode=1;}
 else{
   const result=inspectStaging(process.env);
   if(flags.includes('--verify-stripe')){const {default:Stripe}=await import('stripe');result.checks.push(await verifyStripeAccount(process.env,Stripe));}
   console.log(JSON.stringify(result,null,2));
   if(result.checks.some(c=>c.status!=='pass'))process.exitCode=1;
 }
}
