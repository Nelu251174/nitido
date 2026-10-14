import {localizeMetadata} from '@/i18n/server';
import LeadForm from "@/components/pro/LeadForm";
import { publicPageMetadata } from "@/lib/publicSeo";
const sourceMetadata = publicPageMetadata("/nitido-pro/aplica");
export default function Page() {
  return (
    <div className="pro-wrap">
      <LeadForm />
    </div>
  );
}

export async function generateMetadata() { return localizeMetadata(sourceMetadata); }
