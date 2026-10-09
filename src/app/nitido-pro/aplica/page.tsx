import LeadForm from "@/components/pro/LeadForm";
import { publicPageMetadata } from "@/lib/publicSeo";
export const metadata = publicPageMetadata("/nitido-pro/aplica");
export default function Page() {
  return (
    <div className="pro-wrap">
      <LeadForm />
    </div>
  );
}
