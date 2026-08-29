import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const homepage = readFileSync(join(root, "src/app/page.tsx"), "utf8");

describe("public navigation", () => {
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
