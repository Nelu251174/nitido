"use client";

import {UiText} from '@/components/UiText';
import Link from "next/link";
import {ProLink} from "./pro/ProLink";

// Public navigation stays public, independently of ADMIN or partner sessions.
export function HeaderAuthButtons({onNavigate}:{onNavigate?:()=>void} = {}) {
  return <div className="public-account-actions">
    <Link href="/login?role=client" onClick={onNavigate} className="v2-btn v2-btn-secondary"><UiText text={"Login client"}/></Link>
    <Link href="/login?role=firma" onClick={onNavigate} className="v2-btn v2-btn-primary"><UiText text={"Login firmă"}/></Link>
    <ProLink onNavigate={onNavigate}/>
  </div>;
}
