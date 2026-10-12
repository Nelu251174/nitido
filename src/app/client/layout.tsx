import type { Metadata } from "next";
import { ClientMobileNavigation } from "@/components/ClientMobileNavigation";
export const metadata:Metadata={robots:{index:false,follow:false},alternates:{canonical:null}};
export default function Layout({children}:{children:React.ReactNode}){
  return <><div className="client-mobile-layout">{children}</div><ClientMobileNavigation /></>;
}
