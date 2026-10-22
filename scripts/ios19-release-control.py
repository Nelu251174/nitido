#!/usr/bin/env python3
"""One release: verify production source, upload evidence, and select iOS 1.0.2 (19).

Credentials stay inside the Apple API job. This never submits an App Review.
"""
import datetime
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SOURCE = '5a5d1b0eece25f1233a448f15ca9cfa385a1d8d4'
APP = '6810752486'
BUNDLE = 'ro.nitido.app'
BUILD = '19'
VERSION = '1.0.2'
API = 'https://api.appstoreconnect.apple.com'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def apple(path, method='GET', data=None):
    import jwt
    url = path if path.startswith('https://') else API + path
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.netloc != 'api.appstoreconnect.apple.com':
        raise ValueError('Unexpected Apple API origin')
    now = int(time.time())
    token = jwt.encode({'iss': os.environ['ASC_ISSUER_ID'], 'iat': now,
                        'exp': now + 600, 'aud': 'appstoreconnect-v1'},
                       pathlib.Path(os.environ['ASC_KEY_PATH']).read_text(),
                       algorithm='ES256', headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'})
    request = urllib.request.Request(url, method=method,
        data=None if data is None else json.dumps(data).encode(),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            body = response.read()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as error:
        try:errors=json.loads(error.read()).get('errors',[])
        except Exception:errors=[]
        private=[]
        def redact_values(value):
            if isinstance(value,dict):
                for key,item in value.items():
                    if key.startswith(('contact','demoAccount')) and isinstance(item,str):private.append(item)
                    else:redact_values(item)
            elif isinstance(value,list):
                for item in value:redact_values(item)
        redact_values(data)
        def safe(value):
            text=str(value)
            for secret in private:
                if secret:text=text.replace(secret,'[redacted]')
            return text[:900]
        report={'path':urllib.parse.urlsplit(url).path,'method':method,'httpStatus':error.code,'errors':[{'code':safe(e.get('code','')),'title':safe(e.get('title','')),'detail':safe(e.get('detail','')),'pointer':safe(e.get('source',{}).get('pointer',''))} for e in errors[:5]]}
        save_report('ios19-api-failure.json',report);print(json.dumps(report),flush=True)
        raise


def rows(path):
    result = []
    for _ in range(50):
        document = apple(path)
        result.extend(document['data'])
        path = document.get('links', {}).get('next')
        if not path:
            return result
    raise ValueError('Apple pagination limit exceeded')


def identity():
    apps = rows('/v1/apps?filter%5BbundleId%5D=' + BUNDLE + '&limit=2')
    if len(apps) != 1 or apps[0]['id'] != APP or apps[0]['attributes']['bundleId'] != BUNDLE:
        raise ValueError('Exact existing Apple app identity required')


def save_report(name, report):
    destination = pathlib.Path(os.environ['RUNNER_TEMP']) / name
    destination.write_text(json.dumps(report, indent=2) + '\n')
    return destination


def evidence():
    actual = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    if actual != SOURCE:
        raise ValueError('Checkout must equal verified production source')
    receipt = json.loads(pathlib.Path(os.environ['LIVE_RECEIPT']).read_text())
    if receipt['sourceSha'] != SOURCE or receipt['live']['sourceSha'] != SOURCE:
        raise ValueError('Wrong production receipt source')
    verified = datetime.datetime.fromisoformat(receipt['verifiedAt'])
    age = datetime.datetime.now(datetime.timezone.utc) - verified
    if not 0 <= age.total_seconds() <= 86400:
        raise ValueError('Production receipt is older than 24 hours')
    with urllib.request.urlopen('https://nitido.ro/api/health', timeout=30) as response:
        if json.load(response)['status'] != 'ok':
            raise ValueError('Production health check failed')
    identity()
    builds = rows('/v1/builds?filter%5Bapp%5D=' + APP + '&limit=200')
    highest = max((int(b['attributes']['version']) for b in builds), default=0)
    if highest >= int(BUILD):
        raise ValueError('Candidate build already exists; stop rather than replace it')
    ipas = list((pathlib.Path(os.environ['RUNNER_TEMP']) / 'export').glob('*.ipa'))
    if len(ipas) != 1:
        raise ValueError('Expected exactly one signed IPA')
    # These are the existing source's complete signature/provisioning/SDK gates.
    subprocess.run(['python3', 'scripts/mobile-verify-ios.py', str(ipas[0]), BUILD, VERSION], check=True)
    sdk = int(subprocess.check_output(['xcrun', '--sdk', 'iphoneos', '--show-sdk-version'], text=True).split('.')[0])
    xcode = int(re.search(r'Xcode (\d+)', subprocess.check_output(['xcodebuild', '-version'], text=True)).group(1))
    run = 'https://github.com/' + os.environ['GITHUB_REPOSITORY'] + '/actions/runs/' + os.environ['GITHUB_RUN_ID']
    checksum = hashlib.sha256(ipas[0].read_bytes()).hexdigest()
    report = {**receipt, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'workflowSha': os.environ['GITHUB_SHA'], 'marketingVersion': VERSION, 'build': int(BUILD),
        'ipaSha256': checksum,
        'store': {'highestBuild': highest, 'verified': True, 'receipt': run + ': fresh authenticated exact app and all-builds maximum'},
        'ci': {'sourceSha': SOURCE, 'verified': True, 'receipt': run + ': production source archive, signed export and IPA verification passed'},
        'signing': {'verified': True, 'receipt': run + ': existing Apple team and exact application identifier; distribution-only profile, expiry, signature and production APNs verified'},
        'compatibility': {'verified': True, 'receipt': run + ': signed IPA SDK verification passed', 'xcodeMajor': xcode, 'iosSdkMajor': sdk}}
    save_report('ios19-release-evidence.json', report)
    print(json.dumps({'evidencePrepared': True, 'sourceSha': SOURCE, 'highestAppleBuild': highest, 'candidateBuild': BUILD, 'version': VERSION, 'ipaSha256': checksum}))


def confirm():
    identity()
    build = None
    for _ in range(40):
        matches = rows('/v1/builds?filter%5Bapp%5D=' + APP + '&filter%5Bversion%5D=' + BUILD + '&limit=200')
        if len(matches) > 1:
            raise ValueError('Ambiguous candidate build')
        build = matches[0] if matches else None
        state = build['attributes']['processingState'] if build else 'WAITING_FOR_APPLE'
        print(json.dumps({'build': BUILD, 'processingState': state}), flush=True)
        if state == 'VALID':
            break
        if state in ['FAILED', 'INVALID']:
            raise ValueError('Apple rejected processing the uploaded build')
        time.sleep(15)
    else:
        raise ValueError('Apple processing not confirmed within 10 minutes; inspect before retrying upload')
    prerelease = apple('/v1/builds/' + build['id'] + '/preReleaseVersion')['data']
    if prerelease['attributes']['version'] != VERSION or prerelease['attributes']['platform'] != 'IOS':
        raise ValueError('Uploaded build marketing version does not match 1.0.2 iOS')
    versions = [v for v in rows('/v1/apps/' + APP + '/appStoreVersions?limit=200')
                if v['attributes']['platform'] == 'IOS' and v['attributes']['versionString'] == VERSION]
    if len(versions) != 1 or versions[0]['attributes']['appStoreState'] != 'PREPARE_FOR_SUBMISSION':
        raise ValueError('Expected the existing editable iOS 1.0.2 draft')
    version = versions[0]
    localizations = rows('/v1/appStoreVersions/' + version['id'] + '/appStoreVersionLocalizations?limit=200')
    ro = next(l for l in localizations if l['attributes']['locale'] == 'ro')
    sets = rows('/v1/appStoreVersionLocalizations/' + ro['id'] + '/appScreenshotSets?limit=200')
    screenshot_sets = []
    for item in sets:
        if item['attributes']['screenshotDisplayType'].startswith('APP_IPHONE'):
            screenshots = rows('/v1/appScreenshotSets/' + item['id'] + '/appScreenshots?limit=200')
            complete = sum(s['attributes'].get('assetDeliveryState', {}).get('state') == 'COMPLETE' for s in screenshots)
            screenshot_sets.append({'display': item['attributes']['screenshotDisplayType'], 'complete': complete, 'count': len(screenshots)})
    if not any(s['complete'] >= 3 for s in screenshot_sets):
        raise ValueError('Three uploaded Romanian iPhone screenshots are not yet complete')
    try:
        selected = apple('/v1/appStoreVersions/' + version['id'] + '/build')['data']
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        selected = None
    if selected and selected['id'] != build['id']:
        raise ValueError('Another build is already selected; preserve the user selection')
    if not selected:
        apple('/v1/appStoreVersions/' + version['id'] + '/relationships/build', 'PATCH',
              {'data': {'type': 'builds', 'id': build['id']}})
    selected = apple('/v1/appStoreVersions/' + version['id'] + '/build')['data']
    if selected['id'] != build['id']:
        raise ValueError('Build association verification failed')
    # Preserve any release notes already entered by the owner.
    if not (ro['attributes'].get('whatsNew') or '').strip():
        apple('/v1/appStoreVersionLocalizations/' + ro['id'], 'PATCH', {'data': {
            'type': 'appStoreVersionLocalizations', 'id': ro['id'],
            'attributes': {'whatsNew': 'Actualizarea prezentării aplicației în App Store și îmbunătățiri ale interfeței de rezervare.'}}})
    report = {'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'sourceSha': SOURCE, 'appId': APP, 'bundleId': BUNDLE, 'version': VERSION,
        'build': BUILD, 'buildId': build['id'], 'processingState': 'VALID',
        'buildSelected': True, 'romanianIPhoneScreenshotSets': screenshot_sets,
        'appStoreState': 'PREPARE_FOR_SUBMISSION', 'submittedForReview': False}
    save_report('ios19-apple-confirmation.json', report)
    print(json.dumps(report), flush=True)


def prepare():
    """Prepare only 1.0.2; preserve the approved listing, user edits and credentials."""
    identity()
    versions=rows('/v1/apps/'+APP+'/appStoreVersions?filter%5Bplatform%5D=IOS&limit=200')
    old=[v for v in versions if v['attributes']['versionString']=='1.0.1' and v['attributes']['appStoreState']=='READY_FOR_SALE']
    if len(old)!=1:raise ValueError('Expected the currently approved 1.0.1 baseline')
    matches=[v for v in versions if v['attributes']['versionString']==VERSION]
    if len(matches)>1:raise ValueError('Ambiguous update version')
    created=not matches
    if created:
        version=apple('/v1/appStoreVersions','POST',{'data':{'type':'appStoreVersions','attributes':{'versionString':VERSION,'platform':'IOS','releaseType':'AFTER_APPROVAL'},'relationships':{'app':{'data':{'type':'apps','id':APP}}}}})['data']
    else:version=matches[0]
    if version['attributes']['appStoreState']!='PREPARE_FOR_SUBMISSION':raise ValueError('Preserve update already under review or published')
    baseline=rows('/v1/appStoreVersions/'+old[0]['id']+'/appStoreVersionLocalizations?limit=200')
    localizations=rows('/v1/appStoreVersions/'+version['id']+'/appStoreVersionLocalizations?limit=200')
    release_notes='Funcțiile noi sunt mai ușor de găsit în cont: curățenie pentru cei dragi, descrierea lucrării prin poze și intervale propuse de firme. Analiza foto cere acordul tău și verificarea descrierii înainte de rezervare. Intervalele apar numai pentru disponibilități publicate și verificate.'
    for source in baseline:
        locale=source['attributes']['locale'];target=next((x for x in localizations if x['attributes']['locale']==locale),None)
        attrs={k:source['attributes'].get(k) for k in ['description','keywords','marketingUrl','supportUrl','promotionalText'] if source['attributes'].get(k) is not None}
        if target:
            attrs={k:v for k,v in attrs.items() if not target['attributes'].get(k)}
            if locale=='ro' and (created or not target['attributes'].get('whatsNew')):attrs['whatsNew']=release_notes
            if attrs:apple('/v1/appStoreVersionLocalizations/'+target['id'],'PATCH',{'data':{'type':'appStoreVersionLocalizations','id':target['id'],'attributes':attrs}})
        else:
            attrs.update(locale=locale)
            if locale=='ro':attrs['whatsNew']=release_notes
            target=apple('/v1/appStoreVersionLocalizations','POST',{'data':{'type':'appStoreVersionLocalizations','attributes':attrs,'relationships':{'appStoreVersion':{'data':{'type':'appStoreVersions','id':version['id']}}}}})['data'];localizations.append(target)
    ro=next((x for x in localizations if x['attributes']['locale']=='ro'),None)
    if not ro:raise ValueError('Romanian listing required')
    sets=rows('/v1/appStoreVersionLocalizations/'+ro['id']+'/appScreenshotSets?limit=200')
    if not any(x['attributes']['screenshotDisplayType']=='APP_IPHONE_67' for x in sets):
        apple('/v1/appScreenshotSets','POST',{'data':{'type':'appScreenshotSets','attributes':{'screenshotDisplayType':'APP_IPHONE_67'},'relationships':{'appStoreVersionLocalization':{'data':{'type':'appStoreVersionLocalizations','id':ro['id']}}}}})
    old_details=apple('/v1/appStoreVersions/'+old[0]['id']+'/appStoreReviewDetail')['data']['attributes']
    try:detail=apple('/v1/appStoreVersions/'+version['id']+'/appStoreReviewDetail')['data']
    except urllib.error.HTTPError as error:
        if error.code!=404:raise
        detail=None
    fields=['contactFirstName','contactLastName','contactPhone','contactEmail','demoAccountName','demoAccountPassword','demoAccountRequired']
    attrs={k:old_details[k] for k in fields if k in old_details and old_details[k] is not None}
    note='Update 1.0.2: NEW entry cards are directly visible on the authenticated client home. Family beneficiaries see only a shared schedule after matching-email verification; payer retains booking/payment/report access. Photo analysis is optional, explicitly consented and user-editable; manual description is available. Provider availability starts in a single approved pilot city; no slots are shown until a provider publishes and an administrator verifies them. The owner attention panel is restricted to administrators and is not a customer feature. Existing physical-service payment authorization/capture rules remain unchanged.'
    if detail:
        attrs={k:v for k,v in attrs.items() if detail['attributes'].get(k) is None or detail['attributes'].get(k)==''}
        if created or not detail['attributes'].get('notes'):attrs['notes']=(old_details.get('notes','')+'\n\n'+note).strip()
        if attrs:apple('/v1/appStoreReviewDetails/'+detail['id'],'PATCH',{'data':{'type':'appStoreReviewDetails','id':detail['id'],'attributes':attrs}})
    else:
        attrs['notes']=(old_details.get('notes','')+'\n\n'+note).strip()
        apple('/v1/appStoreReviewDetails','POST',{'data':{'type':'appStoreReviewDetails','attributes':attrs,'relationships':{'appStoreVersion':{'data':{'type':'appStoreVersions','id':version['id']}}}}})
    if not version['attributes'].get('copyright') and old[0]['attributes'].get('copyright'):
        apple('/v1/appStoreVersions/'+version['id'],'PATCH',{'data':{'type':'appStoreVersions','id':version['id'],'attributes':{'copyright':old[0]['attributes']['copyright']}}})
    save_report('ios19-draft-prepared.json',{'version':VERSION,'build':BUILD,'versionId':version['id'],'baseline':'1.0.1','created':created,'notesDescribePilotLimits':True})
    return ro


if __name__ == '__main__':
    {'evidence': evidence, 'confirm': confirm}[sys.argv[1]]()
