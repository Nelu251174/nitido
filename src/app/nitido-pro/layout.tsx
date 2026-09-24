import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
export default function Layout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_NITIDO_PRO_PUBLIC !== "true") notFound();
  return (
    <>
      <SiteHeader />
      <main className="pro-public">{children}</main>
      <SiteFooter />
    </>
  );
}
