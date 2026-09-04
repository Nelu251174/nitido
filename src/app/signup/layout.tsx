import type { Metadata } from "next";

// /signup e client component, deci metadata nu poate fi exportată direct din
// pagină. Layout-ul server de aici îi dă titlu/descriere proprii pentru Google,
// fiind o pagină de conversie importantă (client nou / firmă nouă).
export const metadata: Metadata = {
  title: "Creează cont — client sau firmă de curățenie",
  description:
    "Înregistrează-te gratuit pe Nitido: ca client postezi lucrări de curățenie în câteva secunde, ca firmă primești alerte pentru lucrări noi în zona ta.",
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
