"""Upload only inspected public native captures to the existing Apple draft."""
import hashlib
import io
import json
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt
from PIL import Image

APP = "6810752486"
VERSION = "bdad9f9b-8f05-40ae-84d2-a6682f387d0c"
LOCALIZATION = "9ca6ef58-ff53-4e16-9908-c079f3f51b76"
SOURCE = "95f3c555ecb655e45f0a4db6ddc3511c7ad0f7df"
INSPECTED_SHA256 = {
    "iphone": "c9126d79aa1d27d2e96aa94c0ad03e94de41435a4f67c63a1558ff8331aa8ca4",
    "ipad": "d15424ae9f943b7453511d8c2b61f7bdd43b44e64cccee249f21bc1a131a17a7",
}

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def upload():
    opener = urllib.request.build_opener(NoRedirect)
    token = jwt.encode({"iss": os.environ["ASC_ISSUER_ID"], "iat": int(time.time()),
        "exp": int(time.time()) + 1200, "aud": "appstoreconnect-v1"}, os.environ["ASC_PRIVATE_KEY"],
        algorithm="ES256", headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"})

    def api(path, method="GET", data=None):
        assert path.startswith("/v1/") and "?" not in path
        req = urllib.request.Request("https://api.appstoreconnect.apple.com" + path,
            data=json.dumps(data).encode() if data else None, method=method,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        with opener.open(req, timeout=30) as response:
            return json.load(response)

    assert api("/v1/apps/" + APP)["data"]["attributes"]["bundleId"] == "ro.nitido.app"
    version = api("/v1/appStoreVersions/" + VERSION)["data"]
    assert version["attributes"]["appStoreState"] == "PREPARE_FOR_SUBMISSION"
    assert version["attributes"]["releaseType"] in ("MANUAL", "AFTER_APPROVAL")
    assert api("/v1/appStoreVersions/" + VERSION + "/build")["data"]["attributes"]["version"] == "16"
    assert api("/v1/appStoreVersionLocalizations/" + LOCALIZATION)["data"]["attributes"]["locale"] == "ro"
    root = pathlib.Path(os.environ["CAPTURE_INPUT"])
    provenance = json.loads((root / "provenance.json").read_text())
    assert provenance["sourceSha"] == SOURCE and provenance["origin"] == "https://nitido.ro"
    results = []
    for device, display, size in [("iphone", "APP_IPHONE_67", (1320, 2868)),
                                  ("ipad", "APP_IPAD_PRO_3GEN_129", (2064, 2752))]:
        filename = "NITIDO-" + device + "-01-acasa.png"
        assert hashlib.sha256((root / filename).read_bytes()).hexdigest() == INSPECTED_SHA256[device]
        capture = next(c for c in provenance["captures"] if c["file"] == filename)
        assert capture["method"] == "native_capacitor_ios_simulator"
        assert capture["authenticated"] is False and capture["path"] == "/"
        im = Image.open(root / filename)
        assert im.size == size and im.mode == "RGBA" and im.getchannel("A").getextrema() == (255, 255)
        # Strip an entirely opaque alpha channel; preserve every displayed pixel and dimensions.
        rgb = im.convert("RGB")
        buffer = io.BytesIO()
        rgb.save(buffer, format="PNG", icc_profile=im.info.get("icc_profile"))
        payload = buffer.getvalue()
        sets = api("/v1/appStoreVersionLocalizations/" + LOCALIZATION + "/appScreenshotSets")["data"]
        screenshot_set = next((s for s in sets if s["attributes"]["screenshotDisplayType"] == display), None)
        if not screenshot_set:
            screenshot_set = api("/v1/appScreenshotSets", "POST", {"data": {"type": "appScreenshotSets",
                "attributes": {"screenshotDisplayType": display}, "relationships": {
                    "appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": LOCALIZATION}}}}})["data"]
        existing = api("/v1/appScreenshotSets/" + screenshot_set["id"] + "/appScreenshots")["data"]
        screenshot = next((s for s in existing if s["attributes"]["fileName"] == filename), None)
        if not screenshot:
            screenshot = api("/v1/appScreenshots", "POST", {"data": {"type": "appScreenshots",
                "attributes": {"fileName": filename, "fileSize": len(payload)}, "relationships": {
                    "appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": screenshot_set["id"]}}}}})["data"]
            for operation in screenshot["attributes"]["uploadOperations"]:
                parsed = urllib.parse.urlsplit(operation["url"])
                assert parsed.scheme == "https" and parsed.username is None and parsed.port in (None, 443)
                assert any(parsed.hostname.endswith("." + suffix) for suffix in ["blobstore.apple.com", "object-storage.apple.com"])
                assert operation["method"] == "PUT"
                start, length = operation["offset"], operation["length"]
                assert 0 <= start < len(payload) and 0 < length <= len(payload) - start
                headers = {h["name"]: h["value"] for h in operation["requestHeaders"]}
                assert not any(h.lower() == "authorization" for h in headers)
                req = urllib.request.Request(operation["url"], data=payload[start:start + length], method="PUT", headers=headers)
                with opener.open(req, timeout=60) as response:
                    assert 200 <= response.status < 300
            api("/v1/appScreenshots/" + screenshot["id"], "PATCH", {"data": {"type": "appScreenshots",
                "id": screenshot["id"], "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(payload).hexdigest()}}})
        for _ in range(36):
            state = api("/v1/appScreenshots/" + screenshot["id"])["data"]["attributes"]["assetDeliveryState"]["state"]
            if state in ["COMPLETE", "FAILED"]:
                break
            time.sleep(5)
        assert state == "COMPLETE"
        results.append({"display": display, "state": state, "count": 1})
    return results

if __name__ == "__main__":
    try:
        print("NITIDO_SCREENSHOT_REPORT=" + json.dumps({"success": True, "sets": upload()}))
    except Exception as error:
        print("NITIDO_SCREENSHOT_REPORT=" + json.dumps({"success": False, "errorType": type(error).__name__,
            "httpStatus": error.code if isinstance(error, urllib.error.HTTPError) else None}))
        raise SystemExit(1)
