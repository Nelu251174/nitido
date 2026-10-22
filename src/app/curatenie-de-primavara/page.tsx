import {SiteHeader,SiteFooter} from '@/components/SiteChrome';
import {BookingConfigurator} from '@/components/BookingConfigurator';
import {getActiveEstimatorOptions} from '@/lib/estimatorConfig';
import {db} from '@/lib/db';
import {localizeMetadata} from '@/i18n/server';
export const dynamic='force-dynamic';
export async function generateMetadata(){return localizeMetadata({title:'Pregătește casa pentru primăvară',description:'Configurează curățenia generală, verifică opțiunile pentru băi și geamuri și alege programarea potrivită.'});}
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams;
 const initial=Object.fromEntries(Object.entries(q).filter((e):e is [string,string]=>typeof e[1]==='string'));
 return <><SiteHeader/><main id="main-content" className="design-container booking-page"><BookingConfigurator occasion="spring" initial={initial} options={getActiveEstimatorOptions(db)}/></main><SiteFooter/></>;
}
