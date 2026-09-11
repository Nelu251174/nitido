import {SiteHeader,SiteFooter} from '@/components/SiteChrome';
import {BookingConfigurator} from '@/components/BookingConfigurator';
import {getActiveEstimatorOptions} from '@/lib/estimatorConfig';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export const metadata={title:'Configurează curățenia',robots:{index:false,follow:false},alternates:{canonical:null}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams;
 const initial=Object.fromEntries(Object.entries(q).filter((e):e is [string,string]=>typeof e[1]==='string'));
 return <><SiteHeader/><main id="main-content" className="design-container booking-page"><BookingConfigurator initial={initial} options={getActiveEstimatorOptions(db)}/></main><SiteFooter/></>;
}
