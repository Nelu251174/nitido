import { notFound } from "next/navigation";
import { MobileScreen, mobileScreens } from "@/components/MobileScreens";
export function generateStaticParams(){return mobileScreens.map(screen=>({screen}));}
export default async function Page({params}:{params:Promise<{screen:string}>}){const {screen}=await params;if(!mobileScreens.includes(screen as typeof mobileScreens[number]))notFound();return <MobileScreen screen={screen as typeof mobileScreens[number]}/>}
