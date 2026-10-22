#!/usr/bin/env python3
"""Submit only the owner's prepared iOS 1.0.2 (19) metadata update to Apple review."""
import datetime
import http.cookiejar
import hashlib
import importlib.util
import json
import os
import pathlib
import subprocess
import struct
import time
import urllib.request

spec = importlib.util.spec_from_file_location('release', pathlib.Path(__file__).with_name('ios19-release-control.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def upload_large_screenshots(ro):
    """Replace the single inherited large-phone asset only after all three replacements complete."""
    folder = pathlib.Path(os.environ['IOS19_SCREENSHOTS'])
    files = sorted(folder.glob('*.png'))
    if len(files) != 3:
        raise ValueError('Exactly three large-phone screenshots required')
    for path in files:
        data = path.read_bytes()
        if data[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', data[16:24]) != (1320, 2868) or data[25] != 2:
            raise ValueError('Large screenshots must be RGB PNG 1320x2868')
    sets = release.rows('/v1/appStoreVersionLocalizations/' + ro['id'] + '/appScreenshotSets?limit=200')
    large = [s for s in sets if s['attributes']['screenshotDisplayType'] == 'APP_IPHONE_67']
    if len(large) != 1:
        raise ValueError('Expected the one existing large-iPhone screenshot set')
    endpoint = '/v1/appScreenshotSets/' + large[0]['id']
    existing = release.rows(endpoint + '/appScreenshots?limit=200')
    expected_names = {p.name for p in files}
    inherited = [s for s in existing if s['attributes']['fileName'] not in expected_names]
    if len(inherited) > 1:
        raise ValueError('Unexpected owner changes in large screenshot set; preserve them')
    selected = []
    for path in files:
        data = path.read_bytes()
        checksum = hashlib.md5(data).hexdigest()
        same_name = [s for s in existing if s['attributes']['fileName'] == path.name]
        if len(same_name) > 1:
            raise ValueError('Duplicate replacement screenshot names')
        screenshot = same_name[0] if same_name else None
        if screenshot and screenshot['attributes'].get('assetDeliveryState', {}).get('state') != 'COMPLETE':
            release.apple('/v1/appScreenshots/' + screenshot['id'], 'DELETE')
            screenshot = None
        if not screenshot:
            screenshot = release.apple('/v1/appScreenshots', 'POST', {'data': {
                'type': 'appScreenshots', 'attributes': {'fileName': path.name, 'fileSize': len(data)},
                'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': large[0]['id']}}}}})['data']
            operations = sorted(screenshot['attributes']['uploadOperations'], key=lambda op: op['offset'])
            covered = 0
            for operation in operations:
                parsed = release.urllib.parse.urlsplit(operation['url'])
                if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.apple.com'):
                    raise ValueError('Unexpected Apple asset-upload origin')
                start, length = operation['offset'], operation['length']
                if operation['method'] != 'PUT' or start != covered or length <= 0 or start + length > len(data):
                    raise ValueError('Invalid Apple upload chunk bounds')
                headers = {h['name']: h['value'] for h in operation['requestHeaders']}
                request = urllib.request.Request(operation['url'], data=data[start:start+length], headers=headers, method='PUT')
                with urllib.request.build_opener(release.NoRedirect).open(request, timeout=120) as response:
                    if response.status not in [200, 201, 204]:
                        raise ValueError('Asset chunk upload not accepted')
                covered += length
            if covered != len(data):
                raise ValueError('Apple upload operations did not cover the screenshot')
            release.apple('/v1/appScreenshots/' + screenshot['id'], 'PATCH', {'data': {
                'type': 'appScreenshots', 'id': screenshot['id'],
                'attributes': {'uploaded': True, 'sourceFileChecksum': checksum}}})
        for _ in range(90):
            current = release.apple('/v1/appScreenshots/' + screenshot['id'])['data']
            state = current['attributes'].get('assetDeliveryState', {}).get('state')
            if state == 'COMPLETE':
                if current['attributes'].get('sourceFileChecksum') not in [None, checksum]:
                    raise ValueError('Completed screenshot checksum does not match')
                selected.append(current)
                break
            if state == 'FAILED':
                raise ValueError('Apple screenshot processing failed')
            time.sleep(2)
        else:
            raise ValueError('Screenshot processing not confirmed')
    # Keep the inherited screenshot until all replacements are verified complete.
    for old in inherited:
        release.apple('/v1/appScreenshots/' + old['id'], 'DELETE')
    release.apple(endpoint + '/relationships/appScreenshots', 'PATCH', {
        'data': [{'type': 'appScreenshots', 'id': s['id']} for s in selected]})
    final = release.rows(endpoint + '/appScreenshots?limit=200')
    if [s['id'] for s in final] != [s['id'] for s in selected] or len(final) != 3:
        raise ValueError('Large screenshot order/count verification failed')
    report = {'display': 'APP_IPHONE_67', 'complete': 3, 'orderedFiles': [p.name for p in files]}
    release.save_report('ios19-large-screenshots.json', report)
    print(json.dumps(report), flush=True)


def verify_review_login(details):
    if not details.get('demoAccountRequired'):
        return {'required': False}
    email, password = details.get('demoAccountName'), details.get('demoAccountPassword')
    if not email or not password:
        raise ValueError('App Review test account is incomplete')
    # Test the existing reviewer account; never log its credentials or account data.
    opener = urllib.request.build_opener(release.NoRedirect, urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(path, data=None):
        req = urllib.request.Request('https://nitido.ro' + path,
            data=None if data is None else json.dumps(data).encode(),
            headers={'Content-Type': 'application/json'})
        with opener.open(req, timeout=30) as response:
            return json.load(response)
    logged_in = False
    try:
        result = request('/api/auth/login', {'email': email, 'password': password})
        logged_in = bool(result.get('ok'))
        if not logged_in or not request('/api/auth/me').get('user'):
            raise ValueError('Existing App Review account did not authenticate')
    finally:
        if logged_in:
            request('/api/auth/logout', {})
    if request('/api/auth/me').get('user') is not None:
        raise ValueError('Reviewer session logout was not confirmed')
    return {'required': True, 'login': True, 'logout': True}


def require_build(version):
    selected = release.apple('/v1/appStoreVersions/' + version['id'] + '/build')['data']
    if not selected or selected['attributes']['version'] != release.BUILD or selected['attributes']['processingState'] != 'VALID':
        raise ValueError('Exactly the processed build 19 must be selected')
    prerelease = release.apple('/v1/builds/' + selected['id'] + '/preReleaseVersion')['data']['attributes']
    if prerelease['version'] != release.VERSION or prerelease['platform'] != 'IOS':
        raise ValueError('Selected build is not iOS 1.0.2')
    return selected


def completed_iphone_sets(ro):
    result = []
    for item in release.rows('/v1/appStoreVersionLocalizations/' + ro['id'] + '/appScreenshotSets?limit=200'):
        if item['attributes']['screenshotDisplayType'].startswith('APP_IPHONE'):
            screenshots = release.rows('/v1/appScreenshotSets/' + item['id'] + '/appScreenshots?limit=200')
            result.append({'display': item['attributes']['screenshotDisplayType'], 'complete': sum(
                s['attributes'].get('assetDeliveryState', {}).get('state') == 'COMPLETE' for s in screenshots)})
    return result


def submit():
    evidence_path = pathlib.Path(os.environ['IOS19_EVIDENCE'])
    evidence = json.loads(evidence_path.read_text())
    if evidence['sourceSha'] != release.SOURCE or evidence['build'] != 19 or evidence['marketingVersion'] != release.VERSION:
        raise ValueError('Wrong signed release evidence')
    subprocess.run(['node', 'scripts/mobile-release-gate.mjs', str(evidence_path), 'ios', release.SOURCE, release.BUILD, 'beta'], check=True)
    release.identity()
    versions = [v for v in release.rows('/v1/apps/' + release.APP + '/appStoreVersions?limit=200')
                if v['attributes']['platform'] == 'IOS' and v['attributes']['versionString'] == release.VERSION]
    if len(versions) != 1:
        raise ValueError('Exactly one existing 1.0.2 version required')
    version = versions[0]
    build = require_build(version)
    state = version['attributes']['appStoreState']
    if state in ['WAITING_FOR_REVIEW', 'IN_REVIEW']:
        report = {'version': release.VERSION, 'build': release.BUILD, 'appStoreState': state, 'submittedForReview': True, 'alreadySubmitted': True}
        release.save_report('ios19-app-review-confirmation.json', report)
        print(json.dumps(report))
        return
    if state not in ['PREPARE_FOR_SUBMISSION', 'READY_FOR_REVIEW']:
        raise ValueError('Unexpected draft state; preserve the existing release')
    localizations = release.rows('/v1/appStoreVersions/' + version['id'] + '/appStoreVersionLocalizations?limit=200')
    ro = next(l for l in localizations if l['attributes']['locale'] == 'ro')
    missing = [k for k in ['description', 'supportUrl', 'whatsNew'] if not (ro['attributes'].get(k) or '').strip()]
    if missing:
        raise ValueError('Missing Romanian listing fields: ' + ', '.join(missing))
    screenshot_sets = completed_iphone_sets(ro)
    if not any(s['complete'] >= 3 for s in screenshot_sets):
        raise ValueError('Three completed Romanian iPhone screenshots required')
    upload_large_screenshots(ro)
    screenshot_sets = completed_iphone_sets(ro)
    if not any(s['display'] == 'APP_IPHONE_67' and s['complete'] == 3 for s in screenshot_sets):
        raise ValueError('Three completed large-iPhone screenshots required')
    details = release.apple('/v1/appStoreVersions/' + version['id'] + '/appStoreReviewDetail')['data']['attributes']
    if any(not details.get(k) for k in ['contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone']):
        raise ValueError('App Review contact information is incomplete')
    reviewer = verify_review_login(details)
    # The owner requested completion and publication: release automatically after Apple's approval.
    if version['attributes'].get('releaseType') != 'AFTER_APPROVAL':
        release.apple('/v1/appStoreVersions/' + version['id'], 'PATCH', {'data': {
            'type': 'appStoreVersions', 'id': version['id'], 'attributes': {'releaseType': 'AFTER_APPROVAL'}}})
    matching = []
    for submission in release.rows('/v1/reviewSubmissions?filter%5Bapp%5D=' + release.APP + '&filter%5Bplatform%5D=IOS&limit=200'):
        if submission['attributes']['state'] in ['READY_FOR_REVIEW', 'WAITING_FOR_REVIEW', 'IN_REVIEW']:
            items = release.rows('/v1/reviewSubmissions/' + submission['id'] + '/items?include=appStoreVersion&limit=200')
            if any((i.get('relationships', {}).get('appStoreVersion', {}).get('data') or {}).get('id') == version['id'] for i in items):
                if len(items) != 1:
                    raise ValueError('Do not submit other review items with this update')
                matching.append(submission)
    if len(matching) > 1:
        raise ValueError('Ambiguous pending submission; do not create another')
    if matching:
        submission = matching[0]
    else:
        submission = release.apple('/v1/reviewSubmissions', 'POST', {'data': {
            'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'},
            'relationships': {'app': {'data': {'type': 'apps', 'id': release.APP}}}}})['data']
        release.save_report('ios19-review-progress.json', {'submissionId': submission['id'], 'versionId': version['id'], 'stage': 'created'})
        release.apple('/v1/reviewSubmissionItems', 'POST', {'data': {
            'type': 'reviewSubmissionItems', 'relationships': {
                'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': submission['id']}},
                'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': version['id']}}}}})
    if submission['attributes']['state'] == 'READY_FOR_REVIEW':
        release.apple('/v1/reviewSubmissions/' + submission['id'], 'PATCH', {'data': {
            'type': 'reviewSubmissions', 'id': submission['id'], 'attributes': {'submitted': True}}})
    for _ in range(12):
        current = release.apple('/v1/reviewSubmissions/' + submission['id'])['data']
        current_version = release.apple('/v1/appStoreVersions/' + version['id'])['data']
        if current['attributes']['state'] in ['WAITING_FOR_REVIEW', 'IN_REVIEW'] and current_version['attributes']['appStoreState'] in ['WAITING_FOR_REVIEW', 'IN_REVIEW']:
            report = {'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'sourceSha': release.SOURCE, 'version': release.VERSION, 'build': release.BUILD,
                'buildId': build['id'], 'submissionId': submission['id'],
                'submissionState': current['attributes']['state'], 'appStoreState': current_version['attributes']['appStoreState'],
                'releaseType': current_version['attributes']['releaseType'], 'reviewerAccount': reviewer,
                'romanianIPhoneScreenshotSets': screenshot_sets, 'submittedForReview': True, 'approved': False}
            release.save_report('ios19-app-review-confirmation.json', report)
            print(json.dumps(report), flush=True)
            return
        time.sleep(5)
    raise ValueError('Submission requested; final Apple review queue state not yet confirmed. Inspect before retrying.')


if __name__ == '__main__':
    try:
        if len(__import__('sys').argv)>1 and __import__('sys').argv[1]=='prepare':upload_large_screenshots(release.prepare())
        else:submit()
    except urllib.error.HTTPError as error:
        print(json.dumps({'stage':'Apple metadata or review','httpStatus':error.code,'failed':True}));raise SystemExit(1)
