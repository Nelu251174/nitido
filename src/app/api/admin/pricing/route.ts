import {managedBookingEnabled} from "@/lib/bookingQuotes";
import {NextRequest,NextResponse} from 'next/server';
import {isAdmin,auditAdminAction} from '@/lib/adminAuth';
import {db} from '@/lib/db';
import {hasTrustedMutationOrigin} from '@/lib/security';
import {ManagedPricingError} from '@/lib/managedPricing';
import {listTariffs,createTariff,saveTariff,simulateTariff,publishTariff,withdrawTariff} from '@/lib/managedPricingStore';

export async function GET(){
  if(!await isAdmin())return NextResponse.json({error:'Neautorizat'},{status:401});
  return NextResponse.json({tariffs:listTariffs(db),bookingActivation:managedBookingEnabled()},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest){
  if(!await isAdmin())return NextResponse.json({error:'Neautorizat'},{status:401});
  if(!hasTrustedMutationOrigin(req))return NextResponse.json({error:'Origine invalidă'},{status:403});
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))return NextResponse.json({error:'Cerere invalidă'},{status:400});
  try{
    const result=db.transaction(()=>{
      let result;
      switch(body.action){
        case 'create':result=createTariff(db,body.label,body.sourceId);break;
        case 'save':result=saveTariff(db,body.id,body.revision,body.definition,body.scope,body.label);break;
        case 'simulate':result=simulateTariff(db,body.id,body.revision);break;
        case 'publish':result=publishTariff(db,body.id,body.revision,body.simulationId,body.from,body.until);break;
        case 'withdraw':result=withdrawTariff(db,body.id,body.revision,body.reason);break;
        default:throw new ManagedPricingError('Acțiune necunoscută.');
      }
      auditAdminAction(`pricing.${body.action}`,body.action==='create'&&'id' in result?result.id:body.id,{revision:'revision' in result?result.revision:null});
      return result;
    }).immediate();
    return NextResponse.json({result,tariffs:listTariffs(db),bookingActivation:managedBookingEnabled()});
  }catch(e){
    if(e instanceof ManagedPricingError)return NextResponse.json({error:e.message},{status:e.status});
    return NextResponse.json({error:'Operațiunea nu a fost confirmată. Reîncarcă lista înainte de reîncercare.'},{status:500});
  }
}
