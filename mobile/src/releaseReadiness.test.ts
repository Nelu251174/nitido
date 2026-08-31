import {existsSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),"utf8");

describe("mobile release readiness",()=>{
  it("uses the locked NITIDO icon for app and splash configuration",()=>{
    const config=JSON.parse(read("app.json")).expo;
    expect(config.icon).toBe("./assets/icon-ios-1024.png");
    expect(config.splash).toMatchObject({image:"../public/icons/icon-512x512.png",backgroundColor:"#F4F3EE"});
    expect(config.ios.icon).toBe("./assets/icon-ios-1024.png");
    expect(config.android.adaptiveIcon.foregroundImage).toBe("./assets/icon-android-foreground.png");
    expect(existsSync(join(root,config.icon))).toBe(true);
    expect(existsSync(join(root,config.android.adaptiveIcon.foregroundImage))).toBe(true);
  });

  it("uses the owner-approved platform identifiers and keeps EAS linking blocked",()=>{
    const config=JSON.parse(read("app.json")).expo;
    expect(config.ios.bundleIdentifier).toBe("ro.nitido.app");
    expect(config.android.package).toBe("ro.nitido.app");
    expect(config.extra.eas.projectId).toBe("OWNER_EAS_PROJECT_ID_REQUIRED");
  });

  it("does not request Android microphone access for still-photo proof",()=>{
    const config=JSON.parse(read("app.json")).expo;
    const cameraPlugin=config.plugins.find((entry:unknown)=>Array.isArray(entry)&&entry[0]==="expo-camera");
    expect(cameraPlugin?.[1]?.recordAudioAndroid).toBe(false);
    expect(cameraPlugin?.[1]?.microphonePermission).toBe(false);
    expect(config.android.blockedPermissions).toContain("android.permission.RECORD_AUDIO");
  });

  it("defines safe notification assets and the canonical deep-link scheme",()=>{
    const config=JSON.parse(read("app.json")).expo;
    const notifications=config.plugins.find((entry:unknown)=>Array.isArray(entry)&&entry[0]==="expo-notifications");
    expect(config.scheme).toBe("nitido");
    expect(notifications?.[1]).toMatchObject({icon:"./assets/notification-icon.png",color:"#1B8A4C"});
    expect(existsSync(join(root,notifications[1].icon))).toBe(true);
  });

  it("keeps valid development, preview and production EAS profiles",()=>{
    const eas=JSON.parse(read("eas.json"));
    expect(eas.build.development).toMatchObject({developmentClient:true,distribution:"internal",channel:"development"});
    expect(eas.build.preview).toMatchObject({distribution:"internal",channel:"preview"});
    expect(eas.build.production).toMatchObject({channel:"production",autoIncrement:true});
  });

  it("documents only public mobile environment variables",()=>{
    const env=read(".env.example");
    const keys=[...env.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(match=>match[1]);
    expect(keys).toEqual(["EXPO_PUBLIC_NITIDO_API_BASE_URL","EXPO_PUBLIC_EAS_PROJECT_ID"]);
    expect(env).not.toMatch(/SECRET|PRIVATE_KEY|AUTH_TOKEN/);
  });

  it("contains every owner review route",()=>{
    for(const route of [
      "app/index.tsx","app/(auth)/login.tsx","app/(auth)/register.tsx",
      "app/(client)/index.tsx","app/(client)/jobs.tsx","app/(client)/post.tsx",
      "app/(client)/profile.tsx","app/(client)/support.tsx",
      "app/(firma)/index.tsx","app/(firma)/jobs.tsx","app/(firma)/active.tsx",
      "app/(firma)/earnings.tsx","app/(firma)/history.tsx","app/(firma)/reviews.tsx",
      "app/(firma)/profile.tsx","app/(firma)/support.tsx","app/notifications.tsx","app/trust.tsx",
    ]) expect(existsSync(join(root,route)),route).toBe(true);
  });

  it("does not expose informational settings as dead buttons",()=>{
    const ui=read("src/mobileUi.tsx");
    expect(ui).toContain("return onPress?<Pressable");
    expect(ui).toContain(":<View accessibilityLabel={title}");
    expect(ui).toContain("{onPress?<Ionicons");
  });

  it("keeps sensitive provider credentials out of mobile application source",()=>{
    const sources=[
      "src/api.ts","src/auth.tsx","src/push.ts","src/sessionStore.ts",
      "src/tracking.ts","src/firmOperations.ts","app/_layout.tsx",
    ].map(read).join("\n");
    for(const secret of ["sk_live_","STRIPE_SECRET_KEY","OPENAI_API_KEY","FIREBASE_PRIVATE_KEY","APNS_PRIVATE_KEY","TWILIO_AUTH_TOKEN"])
      expect(sources).not.toContain(secret);
  });
});
