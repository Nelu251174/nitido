import { LegalPage } from "@/components/LegalPage";

export default function CookieUriPage() {
  return (
    <LegalPage title="Politica de cookie-uri" updated="16 august 2026">
      <section>
        <h2>Ce sunt cookie-urile</h2>
        <p>
          Cookie-urile sunt fișiere mici stocate în browser-ul tău, folosite ca site-ul să
          funcționeze corect și să-ți păstreze sesiunea autentificată.
        </p>
      </section>

      <section>
        <h2>Ce cookie folosim</h2>
        <p>
          Folosim un singur cookie esențial — cel de sesiune, care te ține autentificat între
          vizite. Este necesar pentru funcționarea platformei (postare lucrări, panou firmă) și nu
          poate fi dezactivat fără a pierde accesul la cont. Nu folosim cookie-uri de marketing sau
          tracking cross-site.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Întrebări legate de această politică — contact@nitido.ro.</p>
      </section>
    </LegalPage>
  );
}
