import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getCurrentUser} from '@/lib/auth';
import {ClientAssessments} from '@/components/ClientAssessments';
import {SiteHeader,SiteFooter} from '@/components/SiteChrome';
export const dynamic='force-dynamic';
export const metadata={title:'Evaluare asistată NITIDO',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams,city=typeof q.city==='string'?q.city.slice(0,100):'',area=Number(q.sqm),sqm=Number.isSafeInteger(area)&&area>0&&area<=1000000?area:100;
 const user=await getCurrentUser();if(!user){const next=`/client/evaluari?${new URLSearchParams({city,sqm:String(sqm)})}`;redirect(`/login?role=client&next=${encodeURIComponent(next)}`)}if(user.role!=='client')redirect('/firma');
 return <><SiteHeader/><main id="main-content" className="design-container booking-page"><Link href="/client">Înapoi în contul meu</Link><ClientAssessments initialCity={city} initialSqm={sqm}/></main><SiteFooter/></>;
}
