"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function ProLink({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  if (process.env.NEXT_PUBLIC_NITIDO_PRO_PUBLIC !== "true") return null;
  return (
    <Link
      href="/nitido-pro"
      onClick={onNavigate}
      className="v2-btn pro-header-link"
      aria-current={pathname.startsWith("/nitido-pro") ? "page" : undefined}
    >
      <svg
        aria-hidden="true"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <path d="m3 7 4 3 5-6 5 6 4-3-2 12H5L3 7Z" />
        <path d="M5 22h14" />
      </svg>
      NITIDO PRO
    </Link>
  );
}
