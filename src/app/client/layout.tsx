import {localizeMetadata} from '@/i18n/server';
import type { Metadata } from "next";
import { ClientMobileNavigation } from "@/components/ClientMobileNavigation";
import { CurrentUserProvider } from "@/lib/useCurrentUser";
const sourceMetadata:Metadata={robots:{index:false,follow:false},alternates:{canonical:null}};
export default function Layout({children}:{children:React.ReactNode}){
  return <CurrentUserProvider><div className="client-mobile-layout">{children}</div><ClientMobileNavigation /></CurrentUserProvider>;
}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
