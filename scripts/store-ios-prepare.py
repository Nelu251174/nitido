"""Inspect the existing Apple release without exposing reviewer credentials."""
import datetime
import json
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt

APP_ID = "6810752486"
BUNDLE_ID = "ro.nitido.app"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def inspect():
    token = jwt.encode(
        {"iss": os.environ["ASC_ISSUER_ID"], "iat": int(time.time()),
         "exp": int(time.time()) + 1200, "aud": "appstoreconnect-v1"},
        os.environ["ASC_PRIVATE_KEY"], algorithm="ES256",
        headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"},
    )
    opener = urllib.request.build_opener(NoRedirect)
    errors = []

    def request(path, method="GET", payload=None):
        url = path if path.startswith("https://") else "https://api.appstoreconnect.apple.com" + path
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "https" or parsed.netloc != "api.appstoreconnect.apple.com":
            raise ValueError("Unexpected Apple origin")
        req = urllib.request.Request(url, method=method,
            data=json.dumps(payload).encode() if payload is not None else None,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        with opener.open(req, timeout=30) as response:
            return json.load(response) if response.status != 204 else {}

    def optional(path):
        try:
            return request(path).get("data")
        except urllib.error.HTTPError as error:
            errors.append({"path": path, "httpStatus": error.code})
            return None

    def rows(path):
        result = []
        for _ in range(30):
            document = request(path)
            result.extend(document["data"])
            path = document.get("links", {}).get("next")
            if not path:
                return result
        raise ValueError("Pagination limit")

    def public(resource, fields):
        return {"id": resource["id"], **{k: resource.get("attributes", {}).get(k) for k in fields}}

    def review(resource):
        if not resource:
            return {"available": False}
        attrs = resource["attributes"]
        return {"available": True, "id": resource["id"],
            "missingFields": [k for k in ["contactFirstName", "contactLastName", "contactEmail", "contactPhone"] if not attrs.get(k)],
            "demoAccountRequired": attrs.get("demoAccountRequired"),
            "demoAccountProvided": bool(attrs.get("demoAccountName") and attrs.get("demoAccountPassword")),
            "notesProvided": bool(attrs.get("notes"))}

    app = request("/v1/apps/" + APP_ID)["data"]
    assert app["attributes"]["bundleId"] == BUNDLE_ID
    versions = rows("/v1/apps/" + APP_ID + "/appStoreVersions?limit=200")
    builds = rows("/v1/builds?filter%5Bapp%5D=" + APP_ID + "&limit=200")
    report = {"app": public(app, ["bundleId", "contentRightsDeclaration"]),
        "builds": [public(b, ["version", "processingState", "expired", "usesNonExemptEncryption"]) for b in builds],
        "versions": [], "appInfos": [], "optionalApiErrors": errors}
    for v in versions:
        vp = "/v1/appStoreVersions/" + v["id"]
        item = public(v, ["versionString", "appStoreState", "platform", "releaseType", "earliestReleaseDate"])
        build = optional(vp + "/build")
        item["selectedBuild"] = public(build, ["version", "processingState"]) if build else None
        item["copyrightProvided"] = bool(v["attributes"].get("copyright"))
        item["review"] = review(optional(vp + "/appStoreReviewDetail"))
        item["localizations"] = []
        for loc in rows(vp + "/appStoreVersionLocalizations?limit=200"):
            lp = "/v1/appStoreVersionLocalizations/" + loc["id"]
            localized = {"id": loc["id"], "locale": loc["attributes"].get("locale"), "missingFields": [k for k in ["description", "keywords", "supportUrl"] if not loc["attributes"].get(k)]}
            localized["screenshotSets"] = []
            for screenshot_set in rows(lp + "/appScreenshotSets?limit=200"):
                screenshots = rows("/v1/appScreenshotSets/" + screenshot_set["id"] + "/appScreenshots?limit=200")
                localized["screenshotSets"].append({**public(screenshot_set, ["screenshotDisplayType"]),
                    "count": len(screenshots), "completedCount": sum(s.get("attributes", {}).get("assetDeliveryState", {}).get("state") == "COMPLETE" for s in screenshots)})
            item["localizations"].append(localized)
        report["versions"].append(item)
    for info in rows("/v1/apps/" + APP_ID + "/appInfos?limit=200"):
        ip = "/v1/appInfos/" + info["id"]
        item = public(info, ["appStoreState", "appStoreAgeRating", "brazilAgeRating", "kidsAgeBand"])
        item["localizations"] = [{"id": x["id"], "locale": x["attributes"].get("locale"), "missingFields": [k for k in ["name", "subtitle", "privacyPolicyUrl"] if not x["attributes"].get(k)]}
            for x in rows(ip + "/appInfoLocalizations?limit=200")]
        item["ageRatingProvided"] = bool(optional(ip + "/ageRatingDeclaration"))
        for key in ["primaryCategory", "secondaryCategory"]:
            item[key + "Provided"] = bool(optional(ip + "/" + key))
        report["appInfos"].append(item)
    report["availabilityProvided"] = bool(optional("/v2/apps/" + APP_ID + "/appAvailability"))
    report["betaReview"] = review(optional("/v1/apps/" + APP_ID + "/betaAppReviewDetail"))
    return report


if __name__ == "__main__":
    report = {"verifiedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        report.update(inspect())
        report["authenticated"] = True
    except Exception as error:
        report.update({"authenticated": False, "errorType": type(error).__name__})
        if isinstance(error, urllib.error.HTTPError):
            report["httpStatus"] = error.code
    print("NITIDO_APPLE_REPORT=" + json.dumps(report, separators=(",", ":")))
    if not report["authenticated"]:
        raise SystemExit(1)
