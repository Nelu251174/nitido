"""Read exact NITIDO publishing metadata. Never enable APIs or commit releases."""
import datetime,json,os,pathlib,re
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

def metadata(response):
    try:error=response.json().get('error',{})
    except (ValueError,AttributeError):error={}
    return {'http':response.status_code,'reasons':sorted({x.get('reason') for x in error.get('details',[]) if isinstance(x,dict) and re.fullmatch('[A-Z_]+',str(x.get('reason','')))})}

report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'package':'ro.nitido.app','releaseChanged':False,'serviceOrIamChanged':False,'credentialsExported':False,'identities':[]}
seen=set()
for alias in ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON','FIREBASE_SERVICE_ACCOUNT_JSON']:
    row={'alias':alias,'available':bool(os.environ.get(alias))};report['identities'].append(row)
    if row['available']:
        try:
            info=json.loads(os.environ[alias])
            if info.get('type')!='service_account':raise ValueError('INVALID_IDENTITY_TYPE')
            if info.get('client_email') in seen:
                row['sameAsEarlierIdentity']=True;continue
            seen.add(info.get('client_email'))
            session=AuthorizedSession(service_account.Credentials.from_service_account_info(info,scopes=['https://www.googleapis.com/auth/androidpublisher','https://www.googleapis.com/auth/cloud-platform']))
            if info.get('project_id')=='nitido-508720':
                permissions=session.post('https://cloudresourcemanager.googleapis.com/v1/projects/nitido-508720:testIamPermissions',json={'permissions':['serviceusage.services.enable']},timeout=30)
                row['canEnableApi']=permissions.status_code==200 and 'serviceusage.services.enable' in permissions.json().get('permissions',[])
            base='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/ro.nitido.app/edits'
            created=session.post(base,json={},timeout=30);row['publisher']=metadata(created)
            if created.status_code==200:
                edit=created.json()['id']
                if not re.fullmatch('[A-Za-z0-9_-]+',str(edit)):raise ValueError('INVALID_EDIT_ID')
                try:
                    codes=[];row['completeVersionRead']=True
                    for endpoint in ['tracks','bundles','apks']:
                        response=session.get(base+'/'+edit+'/'+endpoint,timeout=30)
                        if response.status_code!=200:row['completeVersionRead']=False;continue
                        data=response.json()
                        if endpoint=='tracks':
                            codes.extend(int(v) for track in data.get('tracks',[]) for release in track.get('releases',[]) for v in release.get('versionCodes',[]) if str(v).isdigit())
                        else:codes.extend(int(x['versionCode']) for x in data.get(endpoint,[]) if str(x.get('versionCode','')).isdigit())
                    row['versionCodes']=sorted(set(codes));row['highestVersionCode']=max(codes) if codes and row['completeVersionRead'] else None
                finally:row['temporaryEditDeleted']=session.delete(base+'/'+edit,timeout=30).status_code in [200,204]
        except Exception as error:row['errorType']=type(error).__name__
    print('PLAY_RECHECK', 'alias='+alias, 'available='+str(row['available']), 'publisher_http='+str(row.get('publisher',{}).get('http','not_checked')), 'reasons='+','.join(row.get('publisher',{}).get('reasons',[])), 'can_enable_api='+str(row.get('canEnableApi','not_checked')))
pathlib.Path('.store-recheck').mkdir(exist_ok=True)
pathlib.Path('.store-recheck/google-play.json').write_text(json.dumps(report,indent=2)+'\n')
