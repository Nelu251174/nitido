import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Workspace from "@/components/pro/Workspace";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Portofoliul NITIDO Pro",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  if (process.env.NITIDO_PRO_ENABLED !== "true") notFound();
  const { path = [] } = await params;
  if (
    path.length > 2 ||
    (path[0] &&
      ![
        "dashboard",
        "proprietati",
        "calendar",
        "lucrari",
        "tichete",
        "aprobari",
        "rapoarte",
        "echipa",
        "setari",
        "partener",
        "operator",
      ].includes(path[0]))
  )
    notFound();
  return <Workspace key={path.join("/")} path={path} />;
}
