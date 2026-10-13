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
    if os.environ.get("PREPARE_DRAFT") == "true":
        # Preparing AFTER_APPROVAL is not a submission or a public release.
        draft = next(v for v in versions if v["id"] == "bdad9f9b-8f05-40ae-84d2-a6682f387d0c")
        assert draft["attributes"]["appStoreState"] == "PREPARE_FOR_SUBMISSION"
        assert draft["attributes"]["versionString"] == "1.0"
        build = next(b for b in builds if b["id"] == "5118fe93-f0c9-45ca-994c-90eef0bf4ad7")
        assert build["attributes"]["version"] == "16"
        assert build["attributes"]["processingState"] == "VALID" and not build["attributes"].get("expired")
        vp = "/v1/appStoreVersions/" + draft["id"]
        request(vp, "PATCH", {"data": {"type": "appStoreVersions", "id": draft["id"],
            "attributes": {"releaseType": "AFTER_APPROVAL", "copyright": "2026 ATP SPEDITION SL"}}})
        request(vp + "/relationships/build", "PATCH", {"data": {"type": "builds", "id": build["id"]}})
        metadata = json.loads(pathlib.Path("docs/store/METADATA-RO.json").read_text())
        for loc in rows(vp + "/appStoreVersionLocalizations?limit=200"):
            if loc["attributes"]["locale"] != "ro":
                continue
            request("/v1/appStoreVersionLocalizations/" + loc["id"], "PATCH", {"data": {
                "type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": {
                    "description": metadata["shared"]["fullDescription"],
                    "keywords": metadata["apple"]["keywords"],
                    "supportUrl": metadata["shared"]["supportUrl"],
                    "marketingUrl": metadata["shared"]["marketingUrl"]}}})
        infos = rows("/v1/apps/" + APP_ID + "/appInfos?limit=200")
        for info in infos:
            if info["attributes"]["appStoreState"] != "PREPARE_FOR_SUBMISSION":
                continue
            assert info["id"] == "74864fe5-1911-4de4-876a-7b1286c3d73f"
            age = request("/v1/appInfos/" + info["id"] + "/ageRatingDeclaration")["data"]
            # Physical cleaning marketplace: job photos and participant chat exist.
            # No arbitrary override: Apple calculates the rating from these answers.
            age_attributes = {key: False for key in [
                "advertising", "ageAssurance", "gambling", "healthOrWellnessTopics",
                "lootBox", "parentalControls", "socialMedia", "socialMediaAgeRestricted",
                "unrestrictedWebAccess"]}
            age_attributes.update({key: "NONE" for key in [
                "alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated",
                "gunsOrOtherWeapons", "horrorOrFearThemes", "matureOrSuggestiveThemes",
                "medicalOrTreatmentInformation", "profanityOrCrudeHumor",
                "sexualContentGraphicAndNudity", "sexualContentOrNudity",
                "violenceCartoonOrFantasy", "violenceRealistic",
                "violenceRealisticProlongedGraphicOrSadistic"]})
            age_attributes.update({"messagingAndChat": True, "userGeneratedContent": True,
                "ageRatingOverrideV2": "NONE"})
            request("/v1/ageRatingDeclarations/" + age["id"], "PATCH", {"data": {
                "type": "ageRatingDeclarations", "id": age["id"], "attributes": age_attributes}})
            for loc in rows("/v1/appInfos/" + info["id"] + "/appInfoLocalizations?limit=200"):
                if loc["attributes"]["locale"] == "ro":
                    request("/v1/appInfoLocalizations/" + loc["id"], "PATCH", {"data": {
                        "type": "appInfoLocalizations", "id": loc["id"], "attributes": {
                            "name": metadata["apple"]["name"], "subtitle": metadata["apple"]["subtitle"],
                            "privacyPolicyUrl": metadata["shared"]["privacyUrl"]}}})
            categories = rows("/v1/appCategories?limit=200")
            assert any(c["id"] == "LIFESTYLE" for c in categories)
            request("/v1/appInfos/" + info["id"], "PATCH", {"data": {"type": "appInfos", "id": info["id"],
                "relationships": {"primaryCategory": {"data": {"type": "appCategories", "id": "LIFESTYLE"}}}}})
        versions = rows("/v1/apps/" + APP_ID + "/appStoreVersions?limit=200")
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
        age = optional(ip + "/ageRatingDeclaration")
        item["ageRatingProvided"] = bool(age)
        if age:
            age_attributes = age.get("attributes", {})
            item["ageDeclarationId"] = age["id"]
            item["ageUnsetFields"] = sorted(k for k, value in age_attributes.items() if value is None)
            item["ageMessagingDeclared"] = age_attributes.get("messagingAndChat") is True
            item["ageUserContentDeclared"] = age_attributes.get("userGeneratedContent") is True
            item["ageAdultOverrideDeclared"] = age_attributes.get("ageRatingOverrideV2") == "EIGHTEEN_PLUS"
            item["ageRatingOverrideV2"] = age_attributes.get("ageRatingOverrideV2")
        for key in ["primaryCategory", "secondaryCategory"]:
            item[key + "Provided"] = bool(optional(ip + "/" + key))
        report["appInfos"].append(item)
    availability = optional("/v1/apps/" + APP_ID + "/appAvailabilityV2")
    if availability:
        report["availabilityProvided"] = True
        territories = optional("/v2/appAvailabilities/" + availability["id"] + "/territoryAvailabilities")
        report["availableTerritoryCount"] = sum(t.get("attributes", {}).get("available") is True for t in territories or [])
    else:
        report["availabilityProvided"] = False
        report["legacyAvailabilityProvided"] = bool(optional("/v1/apps/" + APP_ID + "/appAvailability"))
    price = optional("/v1/apps/" + APP_ID + "/appPriceSchedule")
    report["priceScheduleProvided"] = bool(price)
    if price:
        report["manualPriceCount"] = len(optional("/v1/appPriceSchedules/" + price["id"] + "/manualPrices") or [])
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
