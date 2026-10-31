import '../workspace-client-preview.css';
import {localizeMetadata} from '@/i18n/server';
import type { Metadata } from "next";
import { ClientMobileNavigation } from "@/components/ClientMobileNavigation";
import { CurrentUserProvider } from "@/lib/useCurrentUser";
import {ClientPreviewSecondaryShell} from "@/components/ClientWorkspace";
const sourceMetadata:Metadata={robots:{index:false,follow:false},alternates:{canonical:null}};
export default function Layout({children}:{children:React.ReactNode}){
  return <CurrentUserProvider><div className="client-preview"><div className="client-mobile-layout"><ClientPreviewSecondaryShell>{children}</ClientPreviewSecondaryShell></div><ClientMobileNavigation /></div></CurrentUserProvider>;
}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
