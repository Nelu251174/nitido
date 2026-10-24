#!/usr/bin/env python3
"""Inspect only ro.nitido.app with existing CI identities; never publish a release."""
import datetime as dt
import json
import os
import pathlib
import re
import time

PACKAGE = 'ro.nitido.app'
PROJECT = 'nitido-508720'
REPORTING = 'playdeveloperreporting.googleapis.com'
PUBLISHER = 'androidpublisher.googleapis.com'
SCOPES = ['https://www.googleapis.com/auth/androidpublisher',
          'https://www.googleapis.com/auth/playdeveloperreporting',
          'https://www.googleapis.com/auth/cloud-platform']


def interval_params(now):
    """Reporting uses google.type.DateTime fields, not ISO timestamp parameters."""
    now = now.astimezone(dt.timezone.utc).replace(minute=0, second=0, microsecond=0)
    result = {}
    for name, value in [('startTime', now-dt.timedelta(days=28)), ('endTime', now)]:
        for field, number in [('year', value.year), ('month', value.month),
                              ('day', value.day), ('hours', value.hour)]:
            result[f'interval.{name}.{field}'] = number
        result[f'interval.{name}.utcOffset'] = '0s'
    return result


def error_metadata(response):
    try:
        error = response.json().get('error', {})
    except (ValueError, AttributeError):
        error = {}
    reasons = sorted({row.get('reason') for row in error.get('details', [])
                      if isinstance(row, dict) and re.fullmatch('[A-Z_]+', str(row.get('reason', '')))})
    status = error.get('status')
    result = {'http': response.status_code, 'reasons': reasons}
    if isinstance(status, str) and re.fullmatch('[A-Z_]+', status):
        result['status'] = status
    message = str(error.get('message', '')).lower()
    if 'insufficient permissions' in message or 'does not have permission' in message:
        result['permissionDenied'] = True
    return result


def safe_version(value):
    if not isinstance(value, dict):
        return {}
    return {key: str(value[key])[:40] for key in ['versionCode', 'versionName']
            if key in value and re.fullmatch(r'[\w.()+ -]{1,40}', str(value[key]))}


def safe_issue(value):
    result = {}
    patterns = {'type': r'CRASH|APPLICATION_NOT_RESPONDING|NON_FATAL',
                'cause': r'[A-Za-z_][\w.$]*', 'location': r'[\w.$<>]+',
                'errorReportCount': r'\d+', 'distinctUsers': r'\d+',
                'lastErrorReportTime': r'\d{4}-\d\d-\d\dT[0-9:.+-]+Z?'}
    for field, pattern in patterns.items():
        text = str(value.get(field, ''))
        if text and len(text) <= 250 and re.fullmatch(pattern, text):
            result[field] = text
    for field in ['firstAppVersion', 'lastAppVersion']:
        result[field] = safe_version(value.get(field))
    return result


def safe_report(value):
    """Keep code locations and version numbers; discard exception messages and raw text."""
    raw = str(value.get('reportText', ''))
    classes = re.findall(r'(?m)^(?:Caused by: )?((?:[a-z_][\w$]*\.)+[\w$]*(?:Exception|Error))\b', raw)
    frames = re.findall(r'(?m)^\s*at\s+((?:[\w$]+\.)+[\w$<>]+)\(([^()\r\n]{1,100})\)', raw)
    frames = [method+'('+source+')' for method, source in frames
              if re.fullmatch(r'[\w.$-]+(?::\d+)?|Native Method|Unknown Source', source)][:60]
    return {'type': value.get('type') if value.get('type') in ['CRASH', 'APPLICATION_NOT_RESPONDING', 'NON_FATAL'] else 'UNKNOWN',
            'appVersion': safe_version(value.get('appVersion')),
            'exceptionClasses': list(dict.fromkeys(classes))[:10], 'frames': frames,
            'rawReportExported': False}


def inspect_services(session, identity_project, allow_enable):
    if identity_project != PROJECT:
        return {'checked': False, 'reason': 'IDENTITY_PROJECT_DIFFERS_NO_PROJECT_MUTATION'}
    permissions = session.post(f'https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT}:testIamPermissions',
                               json={'permissions': ['serviceusage.services.enable']}, timeout=30)
    can_enable = permissions.status_code == 200 and 'serviceusage.services.enable' in permissions.json().get('permissions', [])
    result = {'canEnableExistingProjectServices': can_enable, 'services': []}
    for service in [REPORTING, PUBLISHER]:
        url = f'https://serviceusage.googleapis.com/v1/projects/{PROJECT}/services/{service}'
        response = session.get(url, timeout=30)
        row = {'service': service, **error_metadata(response), 'enabledByThisRun': False}
        if response.status_code == 200:
            row['state'] = response.json().get('state')
            if row['state'] == 'DISABLED' and can_enable and allow_enable:
                enabled = session.post(url+':enable', json={}, timeout=30)
                row['enableHttp'] = enabled.status_code
                if enabled.status_code == 200:
                    operation = enabled.json()
                    name = operation.get('name', '')
                    if not re.fullmatch(r'operations/[A-Za-z0-9_./-]+', name):
                        raise RuntimeError('UNEXPECTED_SERVICE_OPERATION')
                    for _ in range(15):
                        if operation.get('done'):
                            break
                        time.sleep(2)
                        polled = session.get('https://serviceusage.googleapis.com/v1/'+name, timeout=30)
                        if polled.status_code != 200:
                            break
                        operation = polled.json()
                    row['enabledByThisRun'] = bool(operation.get('done') and not operation.get('error'))
                    row['state'] = session.get(url, timeout=30).json().get('state', 'UNKNOWN')
        result['services'].append(row)
    return result


def inspect_play(session):
    base = f'https://{PUBLISHER}/androidpublisher/v3/applications/{PACKAGE}/edits'
    response = session.post(base, json={}, timeout=30)
    result = error_metadata(response)
    if response.status_code != 200:
        return result
    edit = response.json()['id']
    if not re.fullmatch(r'[A-Za-z0-9_-]+', edit):
        raise RuntimeError('INVALID_TEMPORARY_EDIT')
    try:
        tracks = session.get(base+'/'+edit+'/tracks', timeout=30)
        result['tracksAccess'] = error_metadata(tracks)
        if tracks.status_code == 200:
            result['tracks'] = [{'track': t.get('track'), 'releases': [
                {'status': r.get('status'), 'versions': [str(v) for v in r.get('versionCodes', []) if str(v).isdigit()]}
                for r in t.get('releases', [])]} for t in tracks.json().get('tracks', [])]
    finally:
        deleted = session.delete(base+'/'+edit, timeout=30)
        result['temporaryEditDeleted'] = deleted.status_code in [200, 204]
        if not result['temporaryEditDeleted']:
            raise RuntimeError('TEMPORARY_EDIT_CLEANUP_FAILED')
    return result


def inspect_reporting(session, now):
    root = f'https://{REPORTING}/v1beta1/apps/{PACKAGE}'
    params = {**interval_params(now), 'filter': 'errorIssueType = CRASH', 'pageSize': 50}
    response = session.get(root+'/errorIssues:search', params=params, timeout=30)
    result = {'issuesAccess': error_metadata(response)}
    if response.status_code == 200:
        data = response.json()
        result['issues'] = [safe_issue(row) for row in data.get('errorIssues', [])]
        result['issuesTruncated'] = bool(data.get('nextPageToken'))
        reports = session.get(root+'/errorReports:search', params={**params, 'pageSize': 20}, timeout=30)
        result['reportsAccess'] = error_metadata(reports)
        if reports.status_code == 200:
            data = reports.json()
            result['reports'] = [safe_report(row) for row in data.get('errorReports', [])]
            result['reportsTruncated'] = bool(data.get('nextPageToken'))
    return result


def main():
    from google.oauth2 import service_account
    from google.auth.transport.requests import AuthorizedSession
    now = dt.datetime.now(dt.timezone.utc)
    result = {'package': PACKAGE, 'checkedAt': now.isoformat(), 'releaseChanged': False,
              'credentialsExported': False, 'rawCrashReportsExported': False,
              'iamRolesChanged': False, 'identities': []}
    seen = set()
    for alias in ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', 'FIREBASE_SERVICE_ACCOUNT_JSON']:
        row = {'alias': alias, 'available': False}
        result['identities'].append(row)
        try:
            raw = os.environ.get(alias, '').strip()
            if not raw:
                continue
            info = json.loads(raw)
            if info.get('type') != 'service_account':
                row['reason'] = 'NOT_A_SERVICE_ACCOUNT'
                continue
            row['available'] = True
            identity = info.get('client_email')
            if identity in seen:
                row['sameAsEarlierIdentity'] = True
                continue
            seen.add(identity)
            credentials = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
            session = AuthorizedSession(credentials)
            row['identityProjectMatchesNitido'] = info.get('project_id') == PROJECT
            row['services'] = inspect_services(session, info.get('project_id'), os.environ.get('NITIDO_ENABLE_REPORTING_API') == '1')
            row['play'] = inspect_play(session)
            row['reporting'] = inspect_reporting(session, now)
        except Exception as error:
            row['reason'] = str(error) if isinstance(error, RuntimeError) and re.fullmatch('[A-Z_]+', str(error)) else type(error).__name__
    pathlib.Path('android-play-investigation.json').write_text(json.dumps(result, indent=2))
    print(json.dumps({k: v for k, v in result.items() if k != 'identities'} | {
        'identities': [{k: v for k, v in row.items() if k not in ['reporting']} | {
            'reporting': {k: v for k, v in row.get('reporting', {}).items() if k not in ['issues', 'reports']}}
            for row in result['identities']]}))


if __name__ == '__main__':
    main()
