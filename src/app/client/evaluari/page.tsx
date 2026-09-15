import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getCurrentUser} from '@/lib/auth';
import {ClientAssessments} from '@/components/ClientAssessments';
import {Logo} from '@/components/ui';
import {WorkspaceNav} from '@/components/WorkspaceNav';
export const dynamic='force-dynamic';
export const metadata={title:'Evaluare asistată NITIDO',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams,city=typeof q.city==='string'?q.city.slice(0,100):'',area=Number(q.sqm),sqm=Number.isSafeInteger(area)&&area>0&&area<=1000000?area:100;
 const user=await getCurrentUser();if(!user){const next=`/client/evaluari?${new URLSearchParams({city,sqm:String(sqm)})}`;redirect(`/login?role=client&next=${encodeURIComponent(next)}`)}if(user.role!=='client')redirect('/firma');
 return <div className="operations-layout approved-operations role-client">
  <aside className="operations-sidebar"><Logo href="/client"/><WorkspaceNav role="client"/><div className="sidebar-user"><b>{user.name}</b><span>{user.email}</span></div></aside>
  <main id="main-content" className="operations-main min-w-0">
   <div className="operations-topbar"><span>NITIDO · CONT CLIENT</span><Link className="account-profile-link" href="/client#sec-cont">{user.name}</Link></div>
   <Link className="v2-btn v2-btn-secondary mb-6" href="/client">Înapoi în contul meu</Link>
   <ClientAssessments initialCity={city} initialSqm={sqm}/>
  </main>
 </div>;
}
