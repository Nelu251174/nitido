import type {Database} from "better-sqlite3";
import {getStripeClient} from "@/lib/payments";

type FirmConnectRow={id:string;verified:number;stripe_account_id:string|null;stripe_account_status:string;stripe_transfers_capability:string;name:string;email:string|null;phone:string|null};

export function getFirmConnectRow(db:Database,userId:string):FirmConnectRow|undefined{
  return db.prepare(`SELECT f.id,f.verified,f.stripe_account_id,f.stripe_account_status,f.stripe_transfers_capability,u.name,u.email,u.phone FROM firms f JOIN users u ON u.id=f.user_id WHERE f.user_id=?`).get(userId) as FirmConnectRow|undefined;
}

export async function createOrReuseRecipientAccount(db:Database,userId:string):Promise<string>{
  const firm=getFirmConnectRow(db,userId);
  if(!firm)throw new Error("FIRM_NOT_FOUND");
  if(!firm.verified)throw new Error("FIRM_NOT_VERIFIED");
  if(firm.stripe_account_id)return firm.stripe_account_id;
  const stripe=getStripeClient();
  if(!stripe)throw new Error("STRIPE_NOT_CONFIGURED");
  const account=await stripe.v2.core.accounts.create({
    display_name:firm.name,contact_email:firm.email??undefined,contact_phone:firm.phone??undefined,
    dashboard:"express",identity:{country:"RO",entity_type:"company"},
    defaults:{currency:"ron",locales:["ro-RO"],responsibilities:{fees_collector:"application",losses_collector:"application"}},
    configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},
    metadata:{nitido_firm_id:firm.id},
  },{idempotencyKey:`nitido-connect-account-${firm.id}`});
  db.prepare("UPDATE firms SET stripe_account_id=?,stripe_account_status='onboarding',stripe_transfers_capability='pending' WHERE id=? AND stripe_account_id IS NULL").run(account.id,firm.id);
  return account.id;
}

export async function createOnboardingLink(db:Database,userId:string,baseUrl:string):Promise<string>{
  const accountId=await createOrReuseRecipientAccount(db,userId);
  const stripe=getStripeClient();
  if(!stripe)throw new Error("STRIPE_NOT_CONFIGURED");
  const link=await stripe.v2.core.accountLinks.create({account:accountId,use_case:{type:"account_onboarding",account_onboarding:{configurations:["recipient"],collection_options:{fields:"eventually_due",future_requirements:"include"},refresh_url:`${baseUrl}/api/stripe/connect/onboarding`,return_url:`${baseUrl}/firma?stripe=returned`}}});
  return link.url;
}

export async function refreshRecipientCapability(db:Database,accountId:string):Promise<void>{
  const stripe=getStripeClient();if(!stripe)throw new Error("STRIPE_NOT_CONFIGURED");
  const account=await stripe.v2.core.accounts.retrieve(accountId,{include:["configuration.recipient","requirements"]});
  const capability=account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const active=capability==="active";
  db.prepare("UPDATE firms SET stripe_account_status=?,stripe_transfers_capability=? WHERE stripe_account_id=?").run(active?"ready":"restricted",capability??"inactive",accountId);
}
