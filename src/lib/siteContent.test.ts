import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOOTER_LINK_GROUPS } from "@/components/SiteChrome";
import { LEGAL_CONFIG_KEYS } from "@/lib/legalConfig";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const routeFile = (href: string) => {
  const pathname = href.split("?")[0];
  return pathname === "/" ? "src/app/page.tsx" : `src/app${pathname}/page.tsx`;
};

describe("footer and information pages", () => {
  const links = FOOTER_LINK_GROUPS.reduce<Array<[string, string]>>((all, group) => {
    for (const [label, href] of group.links) all.push([label, href]);
    return all;
  }, []);

  it("gives every visible canonical footer link a real non-anchor destination", () => {
    expect(links).toHaveLength(14);
    for (const [label, href] of links) {
      expect(href, label).not.toBe("#");
      expect(href, label).not.toContain("/#");
      expect(fs.existsSync(path.join(root, routeFile(href))), `${label}: ${href}`).toBe(true);
    }
  });

  it("does not leave footer destinations empty or as one-paragraph placeholders", () => {
    for (const [label, href] of links.filter(([, href]) => !href.startsWith("/signup"))) {
      const source = read(routeFile(href));
      expect(source.length, label).toBeGreaterThan(500);
      expect(source, label).not.toMatch(/Lorem ipsum|coming soon|href=["']#["']/i);
    }
  });

  it("contains the required product and trust headings", () => {
    expect(read("src/app/cum-functioneaza/page.tsx")).toContain("Cum funcționează NITIDO.RO");
    expect(read("src/app/pentru-clienti/page.tsx")).toContain("Ce este NITIDO.RO pentru client");
    expect(read("src/app/pentru-firme/page.tsx")).toContain("Regula first valid Accept");
    expect(read("src/app/cariere/page.tsx")).toContain("Momentan nu avem poziții publicate");
    expect(read("src/app/siguranta/page.tsx")).toContain("Limitele Asistentului AI");
  });

  it("keeps support details consistent", () => {
    const sources = ["pentru-clienti", "pentru-firme", "preturi", "cariere", "urmarire-live", "siguranta", "termeni", "confidentialitate", "cookie-uri"]
      .map(route => read(`src/app/${route}/page.tsx`)).join("\n");
    expect(sources).toContain("0341.402.403");
    expect(sources).toContain("contact@nitido.ro");
    expect(sources).not.toMatch(/cariere@nitido\.ro/);
  });

  it("contains all legal sections and isolated deployment requirements", () => {
    const terms = read("src/app/termeni/page.tsx");
    const privacy = read("src/app/confidentialitate/page.tsx");
    expect((terms.match(/title:"\d+\./g) ?? []).length).toBe(33);
    expect((privacy.match(/title:"\d+\./g) ?? []).length).toBe(33);
    const env = read(".env.example");
    for (const key of LEGAL_CONFIG_KEYS) expect(env).toContain(`${key}=`);
    expect(terms).toContain("BLOCAJ DE PRODUCȚIE");
    expect(privacy).toContain("BLOCAJ DE PRODUCȚIE");
  });

  it("documents only the cookies found in the application", () => {
    const policy = read("src/app/cookie-uri/page.tsx");
    expect(policy).toContain("nitido_session");
    expect(policy).toContain("30 de zile");
    expect(policy).toContain("nitido_admin_session");
    expect(policy).toContain("8 ore");
    expect(policy).toContain("Nu am identificat instrumente sau cookie-uri de analytics active");
  });
});

describe("Contact structural layout", () => {
  it("uses a real spacer between header and content with exact breakpoints", () => {
    const page = read("src/app/contact/page.tsx");
    const css = read("src/app/globals.css");
    expect(page).toMatch(/<SiteHeader\/><div className="contact-page-top-spacer" aria-hidden="true"\/><div className="contact-page-content">/);
    expect(css).toMatch(/\.contact-page-top-spacer\s*{\s*height: 140px;/);
    for (const value of ["100px", "72px", "40px"]) expect(css).toContain(`height: ${value}`);
    expect(css).not.toMatch(/contact-page-(?:top-spacer|content)[^{]*{[^}]*(?:transform|position:\s*absolute|margin-top:\s*-)/);
  });

  it("does not auto-scroll the chat on initial render", () => {
    const support = read("src/components/SupportCenter.tsx");
    expect(support).toContain("if (messages.length <= 1 && !loading) return");
    expect(support).not.toContain("scrollIntoView");
    expect(support).not.toContain("window.scrollTo");
    expect(support).toContain("chatMessagesRef.current");
    expect(support).toContain("chat.scrollTo({ top: chat.scrollHeight");
  });

  it("keeps every quick question non-navigating while AI submission remains wired", () => {
    const support = read("src/components/SupportCenter.tsx");
    for (const question of ["Cum postez o lucrare?", "Cum acceptă o firmă o lucrare?", "Cum funcționează plata?", "Când vede firma adresa exactă?", "Cum funcționează ratingul?", "Ce se întâmplă la no-show?"]) {
      expect(support).toContain(question);
    }
    expect(support).toContain('suggestions.slice(0,6).map(question => <button type="button"');
    expect(support).toContain("onClick={() => void send(question)}");
    expect(support).not.toContain('href="#');
    expect(support).toContain('<form onSubmit={submit}');
    expect(support).toContain('<button type="submit"');
  });
});
