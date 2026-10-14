import {localizeMetadata} from '@/i18n/server';
import {ClientReports} from '@/components/ClientReports';
const sourceMetadata={title:'Rapoarte istorice · NITIDO',robots:{index:false,follow:false}};
export default function Page(){return <ClientReports/>}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
