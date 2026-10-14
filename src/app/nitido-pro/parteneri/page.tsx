import {localizeMetadata} from '@/i18n/server';
import LeadForm from "@/components/pro/LeadForm";
import { publicPageMetadata } from "@/lib/publicSeo";
const sourceMetadata = publicPageMetadata("/nitido-pro/parteneri");
export default function Page() {
  return (
    <div className="pro-wrap">
      <LeadForm partner />
    </div>
  );
}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
