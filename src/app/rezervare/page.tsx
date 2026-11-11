import {localizeMetadata} from '@/i18n/server';
import {SiteHeader,SiteFooter} from '@/components/SiteChrome';
import {BookingConfigurator} from '@/components/BookingConfigurator';
import {getActiveEstimatorOptions} from '@/lib/estimatorConfig';
import {db} from '@/lib/db';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {internationalPricingEnabled} from '@/lib/internationalRollout';
import {visitorCountry} from '@/lib/visitorCountry';
import {bookingEntryRedirect} from '@/lib/bookingEntry';
import {BookingEntry} from '@/components/BookingEntry';
export const dynamic='force-dynamic';
const sourceMetadata={title:'Configurează curățenia',robots:{index:false,follow:false},alternates:{canonical:null}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams;
 let suggestedDestination:string|null=null;
 if(internationalPricingEnabled()){
  const destination=bookingEntryRedirect(q,visitorCountry(await headers()),true);
  if(destination&&q.countryCode!==undefined)redirect(destination);
  suggestedDestination=destination;
 }
 const initial=Object.fromEntries(Object.entries(q).filter((e):e is [string,string]=>typeof e[1]==='string'));
 const form=<BookingConfigurator initial={initial} options={getActiveEstimatorOptions(db)}/>;
 return <><SiteHeader/><main id="main-content" className="design-container booking-page">{suggestedDestination?<BookingEntry destination={suggestedDestination}>{form}</BookingEntry>:form}</main><SiteFooter/></>;
}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
