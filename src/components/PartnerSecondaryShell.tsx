'use client';

import type {ReactNode} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useCurrentUser} from '@/lib/useCurrentUser';
import {BoardSidebar} from '@/components/BoardSidebar';
import {DesignIcon} from '@/components/DesignIcon';
import {UiElement,UiText} from '@/components/UiText';

const secondaryPartnerRoutes=new Set([
  '/firma/programari',
  '/firma/intervale-libere',
  '/firma/planificare',
]);

/** Frames only partner pages that do not already own a workspace shell. */
export function PartnerSecondaryShell({children}:{children:ReactNode}) {
  const pathname=usePathname();
  const {user}=useCurrentUser();
  if(!secondaryPartnerRoutes.has(pathname))return children;
  const partner=user?.role==='firma'?user:null;

  // Keep the child subtree in place while auth resolves or is revalidated.
  return <div className={partner?'operations-layout role-firma partner-preview-secondary':undefined}>
    {partner&&<BoardSidebar key="partner-sidebar" role="firma"/>}
    <div key="partner-content" className={partner?'operations-main partner-preview-main':undefined}>
      {partner&&<div className="operations-topbar partner-preview-topbar">
        <span className="partner-preview-breadcrumb"><DesignIcon name="building" size={17}/><UiText text="NITIDO PARTENER"/></span>
        <div className="partner-preview-tools"><UiElement as={Link} href="/firma#profil" className="account-profile-link" aria-label="Deschide profilul meu"><span className="board-avatar" aria-hidden="true">{partner.name.slice(0,1)}</span><b>{partner.name}</b></UiElement></div>
      </div>}
      {children}
    </div>
  </div>;
}
