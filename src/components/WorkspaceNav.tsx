"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
export function WorkspaceNav({role="client"}:{role?:"client"|"firma"|"admin"}){
 const path=usePathname();
 const items=role==="client"?[["Acasă","/client"],["Proprietăți","/client/proprietati"],["Business","/client/business"],["Aprobări și acces","/colaborari"],["Lucrările echipei","/echipa"],["Gazde","/client/host"],["Mesaje","/client/mesaje"]]:role==="firma"?[["Oportunități","/firma"],["Calendar","/firma/calendar"],["Echipe","/firma/echipe"],["Angajați și rapoarte","/echipa"],["Execuție","/firma/executie"],["Mesaje","/firma/mesaje"]]:[["Operațiuni","/admin"],["Website","/"]];
 return <nav className="workspace-nav" aria-label={`Navigare ${role}`}>{items.map(([label,href])=><Link key={href} href={href} aria-current={path===href?"page":undefined}>{label}</Link>)}</nav>
}
