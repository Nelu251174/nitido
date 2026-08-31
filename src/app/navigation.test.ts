import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const homepage = readFileSync(join(root, "src/app/page.tsx"), "utf8");
const siteChrome = readFileSync(join(root,"src/components/SiteChrome.tsx"),"utf8");
const homeLogo = readFileSync(join(root,"src/components/HomeLogoLink.tsx"),"utf8");

describe("public navigation", () => {
  it("uses an accessible semantic home logo in the shared header",()=>{
    expect(siteChrome).toContain("<HomeLogoLink/>");
    expect(homepage).toContain("<HomeLogoLink/>");
    expect(homeLogo).toContain('<Link href="/"');
    expect(homeLogo).toContain('aria-label="NITIDO.RO – Pagina principală"');
    expect(homeLogo).toContain("focus-visible:ring-2");
    expect(homeLogo).not.toContain('href="#"');
  });

  it("resets same-page home scroll and removes hashes deterministically",()=>{
    expect(homeLogo).toContain('if(pathname==="/")');
    expect(homeLogo).toContain("event.preventDefault()");
    expect(homeLogo).toContain('replaceState(window.history.state,"","/")');
    expect(homeLogo).toContain("window.scrollTo({top:0,left:0,behavior:\"auto\"})");
  });

  it.each(["contact","preturi","despre-noi"])("routes /%s through the shared header home control",route=>{
    const source=readFileSync(join(root,`src/app/${route}/page.tsx`),"utf8");
    expect(source.includes("SiteHeader")||source.includes("InformationPage")||source.includes("HomeLogoLink")).toBe(true);
    expect(homeLogo).toContain('router.push("/",{scroll:true})');
    expect(homeLogo).toContain('sessionStorage.setItem(RESET_KEY,"1")');
  });

  it("provides a mobile-menu close hook on one-tap logo activation",()=>{
    expect(homeLogo).toContain("onNavigate?.()");
    expect(homeLogo).toContain("onClick={activate}");
  });
  it("does not contain placeholder anchors", () => {
    const sourceFiles = [
      "src/app/page.tsx",
      "src/components/InfoPageV2.tsx",
      "src/components/MobileScreens.tsx",
    ];

    for (const file of sourceFiles) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source).not.toMatch(/href\s*=\s*["']#(?:["']|\s)/);
      expect(source).not.toMatch(/href\s*=\s*["']["']/);
    }
  });

  it.each(["cum", "clienti", "firme", "preturi"])(
    "provides the #%s homepage section",
    (section) => {
      expect(homepage).toContain(`id="${section}"`);
    },
  );

  it.each([
    "despre-noi",
    "contact",
    "cariere",
    "urmarire-live",
    "siguranta",
    "termeni",
    "confidentialitate",
    "cookie-uri",
    "incredere",
  ])("provides the /%s route", (route) => {
    expect(existsSync(join(root, `src/app/${route}/page.tsx`))).toBe(true);
  });

  it.each([
    "client-home",
    "post-job",
    "firm-feed",
    "live-tracking",
    "messages",
    "payment-review",
    "firm-push",
    "client-allocation",
    "firm-location",
  ])("keeps the /mobile/%s route available", (screen) => {
    const routeSource = readFileSync(
      join(root, "src/app/mobile/[screen]/page.tsx"),
      "utf8",
    );
    expect(routeSource).toContain("mobileScreens.includes");
    expect(homepage).not.toContain(`href="#"`);
    expect(screen).toBeTruthy();
  });
});
