import {localizeMetadata} from '@/i18n/server';
import type { Metadata } from "next";
import { ClientMobileNavigation } from "@/components/ClientMobileNavigation";
const sourceMetadata:Metadata={robots:{index:false,follow:false},alternates:{canonical:null}};
export default function Layout({children}:{children:React.ReactNode}){
  return <><div className="client-mobile-layout">{children}</div><ClientMobileNavigation /></>;
}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
