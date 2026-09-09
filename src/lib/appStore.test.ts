import { describe, it, expect } from "vitest";
import { resolveAppStoreLinks } from "./appStore";

describe("appStore — linkuri magazine pentru butonul de evaluare", () => {
  it("fără niciun link → pre-lansare (live=false)", () => {
    const links = resolveAppStoreLinks(undefined, undefined);
    expect(links).toEqual({ appStore: null, playStore: null, live: false });
  });

  it("șiruri goale / doar spații → tratate ca lipsă", () => {
    const links = resolveAppStoreLinks("   ", "");
    expect(links.live).toBe(false);
    expect(links.appStore).toBeNull();
    expect(links.playStore).toBeNull();
  });

  it("un singur magazin configurat → live=true", () => {
    const links = resolveAppStoreLinks("https://apps.apple.com/app/nitido", undefined);
    expect(links.live).toBe(true);
    expect(links.appStore).toBe("https://apps.apple.com/app/nitido");
    expect(links.playStore).toBeNull();
  });

  it("ambele magazine, cu spații în jur → curățate", () => {
    const links = resolveAppStoreLinks("  https://apps.apple.com/x  ", " https://play.google.com/store/apps/details?id=ro.nitido ");
    expect(links.live).toBe(true);
    expect(links.appStore).toBe("https://apps.apple.com/x");
    expect(links.playStore).toBe("https://play.google.com/store/apps/details?id=ro.nitido");
  });
});
