#!/usr/bin/env python3
"""Check publishing access for the existing NITIDO app; no crash reports or releases."""
import datetime,json,os,pathlib,importlib.util
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession
spec=importlib.util.spec_from_file_location('nitido_play',pathlib.Path(__file__).with_name('android-play-investigate.py'))
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
result={'package':'ro.nitido.app','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'releaseChanged':False,'credentialsExported':False,'crashReportsRead':False,'identities':[]}
seen=set()
for alias in ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON','FIREBASE_SERVICE_ACCOUNT_JSON']:
    row={'alias':alias,'available':bool(os.environ.get(alias))};result['identities'].append(row)
    if not row['available']:continue
    try:
        info=json.loads(os.environ[alias])
        if info.get('type')!='service_account':row['reason']='NOT_SERVICE_ACCOUNT';continue
        if info.get('client_email') in seen:row['sameAsEarlierIdentity']=True;continue
        seen.add(info.get('client_email'))
        session=AuthorizedSession(service_account.Credentials.from_service_account_info(info,scopes=['https://www.googleapis.com/auth/androidpublisher','https://www.googleapis.com/auth/cloud-platform']))
        if info.get('project_id')=='nitido-508720':
            permission=session.post('https://cloudresourcemanager.googleapis.com/v1/projects/nitido-508720:testIamPermissions',json={'permissions':['serviceusage.services.enable']},timeout=30)
            row['canEnableExistingNitidoPublisherApi']=permission.status_code==200 and 'serviceusage.services.enable' in permission.json().get('permissions',[])
            if row['canEnableExistingNitidoPublisherApi']:
                url='https://serviceusage.googleapis.com/v1/projects/nitido-508720/services/androidpublisher.googleapis.com'
                service=session.get(url,timeout=30)
                row['publisherService']=helper.error_metadata(service)
                if service.status_code==200:
                    row['publisherService']['state']=service.json().get('state')
                    if row['publisherService']['state']=='DISABLED':
                        enabled=session.post(url+':enable',json={},timeout=30)
                        row['publisherService']['enableHttp']=enabled.status_code
        row['publisher']=helper.inspect_play(session)
    except Exception as error:
        row['reason']=type(error).__name__
pathlib.Path('.store-readiness').mkdir(exist_ok=True)
pathlib.Path('.store-readiness/google-play.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
