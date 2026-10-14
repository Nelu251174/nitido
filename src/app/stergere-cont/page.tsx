import {localizeMetadata} from '@/i18n/server';
import {UiText} from '@/components/UiText';
import type {Metadata} from 'next';
import {SiteHeader,SiteFooter} from '@/components/SiteChrome';
import {AccountDeletionRequest} from '@/components/AccountDeletionRequest';
const sourceMetadata:Metadata={title:'Ștergerea contului NITIDO',description:'Solicită ștergerea contului NITIDO și a datelor personale asociate.',robots:{index:false,follow:false}};
export default function AccountDeletionPage(){return <div className="bg-[#f7f3ec]"><SiteHeader/><main className="w-full max-w-3xl mx-auto px-5 py-10 space-y-5 min-w-0"><h1 className="workspace-title"><UiText text={"Ștergerea contului și a datelor asociate"}/></h1><AccountDeletionRequest/></main><SiteFooter/></div>;}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
