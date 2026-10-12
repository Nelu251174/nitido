import { describe, it, expect } from "vitest";
import { resolveAppStoreLinks, storeLinksForPlatform } from "./appStore";

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

describe("platform-specific store links", () => {
  const links = resolveAppStoreLinks("https://apps.apple.com/app/nitido", "https://play.google.com/store/apps/details?id=ro.nitido.app");

  it("iPhone and iPad only offer the Apple store, even when both are configured", () => {
    expect(storeLinksForPlatform(links, "ios")).toEqual({appStore:links.appStore,playStore:null,live:true});
    expect(storeLinksForPlatform(resolveAppStoreLinks(null, links.playStore), "ios").live).toBe(false);
  });

  it("Android only offers its store", () => {
    expect(storeLinksForPlatform(links, "android")).toEqual({appStore:null,playStore:links.playStore,live:true});
  });

  it("the browser retains both stores, but an unidentified client offers neither", () => {
    expect(storeLinksForPlatform(links, "web")).toEqual(links);
    expect(storeLinksForPlatform(links, "unknown")).toEqual({appStore:null,playStore:null,live:false});
  });
});
