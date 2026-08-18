import Link from "next/link";
import { Logo } from "@/components/ui";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <Link href="/" className="text-sm font-display font-bold text-muted hover:text-ink">
            ← Înapoi la Nitido
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display font-extrabold text-3xl text-ink mb-2">{title}</h1>
        <p className="text-sm text-muted mb-10">Actualizat: {updated}</p>
        <div className="space-y-8 text-[15px] leading-relaxed text-ink [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-lg [&_h2]:text-ink [&_h2]:mb-2 [&_p]:text-muted [&_li]:text-muted">
          {children}
        </div>
      </main>
      <footer className="border-t border-line bg-mist">
        <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-muted">
          © {new Date().getFullYear()} Nitido — Marketplace de curățenie, România.
        </div>
      </footer>
    </div>
  );
}
