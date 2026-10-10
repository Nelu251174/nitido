"""Capture public production screens inside the actual Capacitor iOS simulator app."""
import json
import os
import pathlib
import shutil
import subprocess
import time

def run(*args):
    return subprocess.check_output(args, text=True).strip()

output = pathlib.Path(os.environ["CAPTURE_OUTPUT"])
output.mkdir(parents=True, exist_ok=True)
derived = pathlib.Path(os.environ["RUNNER_TEMP"]) / "nitido-capture-derived"
with (output / "build.log").open("w") as log:
    subprocess.run(["xcodebuild", "-project", "ios/App/App.xcodeproj", "-scheme", "App",
        "-configuration", "Debug", "-sdk", "iphonesimulator", "-destination", "generic/platform=iOS Simulator",
        "-derivedDataPath", str(derived), "CODE_SIGNING_ALLOWED=NO", "build"],
        stdout=log, stderr=subprocess.STDOUT, check=True)
app = derived / "Build/Products/Debug-iphonesimulator/App.app"
devices = json.loads(run("xcrun", "simctl", "list", "devices", "available", "--json"))
available = [d for group in devices["devices"].values() for d in group]
phone = next(d for name in ["iPhone 16 Pro Max", "iPhone 17 Pro Max", "iPhone 16 Plus", "iPhone 15 Pro Max"]
    for d in available if d["name"] == name)
tablet = next(d for name in ["iPad Pro 13-inch (M5)", "iPad Pro 13-inch (M4)", "iPad Air 13-inch (M3)", "iPad Air 13-inch (M2)"]
    for d in available if d["name"] == name)
captures = []
for label, device in [("iphone", phone), ("ipad", tablet)]:
    udid = device["udid"]
    if device["state"] != "Booted":
        run("xcrun", "simctl", "boot", udid)
    run("xcrun", "simctl", "bootstatus", udid, "-b")
    run("xcrun", "simctl", "status_bar", udid, "override", "--time", "9:41", "--batteryState", "charged",
        "--batteryLevel", "100", "--wifiMode", "active", "--wifiBars", "3", "--cellularMode", "active", "--cellularBars", "4")
    for slug, path in [("01-acasa", "/"), ("02-configurare", "/rezervare"), ("03-conectare", "/login")]:
        # Change only the capture app copy's starting page, preserving production origin and native shell.
        bundle = output / "capture-app" / "App.app"
        if bundle.exists():
            shutil.rmtree(bundle)
        shutil.copytree(app, bundle)
        config_path = bundle / "capacitor.config.json"
        config = json.loads(config_path.read_text())
        assert config["appId"] == "ro.nitido.app"
        assert config["server"]["url"] == "https://nitido.ro"
        config["server"]["url"] = "https://nitido.ro" + path
        config_path.write_text(json.dumps(config))
        subprocess.run(["xcrun", "simctl", "terminate", udid, "ro.nitido.app"], capture_output=True)
        run("xcrun", "simctl", "install", udid, str(bundle))
        run("xcrun", "simctl", "launch", udid, "ro.nitido.app")
        time.sleep(30)
        filename = "NITIDO-" + label + "-" + slug + ".png"
        run("xcrun", "simctl", "io", udid, "screenshot", str(output / filename))
        captures.append({"file": filename, "path": path, "device": device["name"],
            "method": "native_capacitor_ios_simulator", "authenticated": False, "physicalDevice": False})
        print("Captured " + filename, flush=True)
    run("xcrun", "simctl", "shutdown", udid)
shutil.rmtree(output / "capture-app")
(output / "provenance.json").write_text(json.dumps({"origin": "https://nitido.ro", "sourceSha": os.environ["GITHUB_SHA"],
    "scope": "Public native simulator screenshots; no sign-in, bookings, payments or test-user data.", "captures": captures}, indent=2))
