import {localizeMetadata} from '@/i18n/server';
import {OrganizationManagement} from '@/components/OrganizationManagement';
const sourceMetadata={title:'Organizații și aprobări · NITIDO',robots:{index:false,follow:false}};
export default function Page(){return <OrganizationManagement/>}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
