"use client";

import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {MouseEvent,useEffect} from "react";

const RESET_KEY="nitido-home-reset";

export function resetHomeLocation(){
  window.history.replaceState(window.history.state,"","/");
  window.scrollTo({top:0,left:0,behavior:"auto"});
}

export function HomeLogoLink({onNavigate}:{onNavigate?:()=>void}){
  const pathname=usePathname();
  const router=useRouter();
  useEffect(()=>{
    if(pathname!=="/"||sessionStorage.getItem(RESET_KEY)!=="1")return;
    sessionStorage.removeItem(RESET_KEY);
    resetHomeLocation();
  },[pathname]);

  function activate(event:MouseEvent<HTMLAnchorElement>){
    onNavigate?.();
    if(pathname==="/"){
      event.preventDefault();
      resetHomeLocation();
      return;
    }
    event.preventDefault();
    sessionStorage.setItem(RESET_KEY,"1");
    router.push("/",{scroll:true});
  }

  return <Link href="/" onClick={activate} scroll aria-label="NITIDO.RO – Pagina principală" className="design-wordmark focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-4"><span aria-hidden="true">NITIDO<span>.RO</span></span></Link>;
}
