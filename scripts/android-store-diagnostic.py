#!/usr/bin/env python3
"""Read exact NITIDO Play tracks and crash issue metadata; never commit a Play edit."""
import datetime, json, os, pathlib, re
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession
package='ro.nitido.app'
report={'package':package,'releaseChanged':False,'credentialsExported':False}
raw=os.environ.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') or os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
try:
    info=json.loads(raw or '{}')
    if info.get('type')!='service_account' or info.get('project_id')!='nitido-508720':
        raise ValueError('NITIDO_GOOGLE_IDENTITY_UNAVAILABLE')
    credentials=service_account.Credentials.from_service_account_info(info,scopes=['https://www.googleapis.com/auth/androidpublisher','https://www.googleapis.com/auth/playdeveloperreporting'])
    session=AuthorizedSession(credentials)
    base='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+package+'/edits'
    edit=None
    try:
        response=session.post(base,json={},timeout=30)
        report['playAccessHttp']=response.status_code
        if response.status_code==200:
            edit=response.json()['id']
            response=session.get(base+'/'+edit+'/tracks',timeout=30)
            report['tracksHttp']=response.status_code
            if response.status_code==200:
                report['tracks']=[{'track':track.get('track'),'releases':[{'status':r.get('status'),'versions':r.get('versionCodes',[])} for r in track.get('releases',[])]} for track in response.json().get('tracks',[])]
    finally:
        if edit:
            response=session.delete(base+'/'+edit,timeout=30)
            report['temporaryEditDeleted']=response.status_code in (200,204)
            if not report['temporaryEditDeleted']: raise RuntimeError('TEMPORARY_EDIT_CLEANUP_FAILED')
    now=datetime.datetime.now(datetime.timezone.utc)
    start=now-datetime.timedelta(days=7)
    response=session.get('https://playdeveloperreporting.googleapis.com/v1beta1/apps/'+package+'/errorIssues:search',params={'interval.startTime':start.isoformat().replace('+00:00','Z'),'interval.endTime':now.isoformat().replace('+00:00','Z'),'pageSize':20},timeout=30)
    report['crashReportingHttp']=response.status_code
    body=response.json()
    if response.status_code==200:
        report['issues']=[{k:v for k,v in row.items() if k in ['name','type','cause','location','firstReportTime','lastReportTime','errorReportCount','distinctUsers','distinctVersions']} for row in body.get('errorIssues',[])]
    else:
        report['googleErrorStatus']=body.get('error',{}).get('status')
        report['reasonCodes']=[d.get('reason') for d in body.get('error',{}).get('details',[]) if re.fullmatch('[A-Z_]+',str(d.get('reason','')))]
except Exception as error:
    report['reason']=str(error) if isinstance(error,(ValueError,RuntimeError)) and re.fullmatch('[A-Z_]+',str(error)) else type(error).__name__
pathlib.Path('android-store-diagnostic.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
