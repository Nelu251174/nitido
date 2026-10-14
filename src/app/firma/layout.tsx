import {localizeMetadata} from '@/i18n/server';
import type { Metadata } from "next";
const sourceMetadata:Metadata={robots:{index:false,follow:false},alternates:{canonical:null}};
export default function Layout({children}:{children:React.ReactNode}){return children;}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
