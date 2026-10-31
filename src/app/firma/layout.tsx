import '../workspace-partner-preview.css';
import {localizeMetadata} from '@/i18n/server';
import type { Metadata } from "next";
import {CurrentUserProvider} from '@/lib/useCurrentUser';
import {PartnerSecondaryShell} from '@/components/PartnerSecondaryShell';
const sourceMetadata:Metadata={robots:{index:false,follow:false},alternates:{canonical:null}};
export default function Layout({children}:{children:React.ReactNode}){
  return <CurrentUserProvider><div className="partner-preview"><PartnerSecondaryShell>{children}</PartnerSecondaryShell></div></CurrentUserProvider>;
}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
