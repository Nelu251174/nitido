#!/usr/bin/env python3
"""Authenticate exact Play package, read current build maximum, delete temporary edit.
No release track is changed or committed by this preflight.
"""
import json, os, pathlib, sys
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession
info=json.loads(os.environ['GOOGLE_PLAY_JSON'])
credentials=service_account.Credentials.from_service_account_info(info,scopes=['https://www.googleapis.com/auth/androidpublisher'])
session=AuthorizedSession(credentials)
base='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/ro.nitido.app/edits'
edit=None
try:
    response=session.post(base,json={},timeout=30)
    if response.status_code!=200: raise SystemExit('Current Play package access rejected (HTTP'+str(response.status_code)+')')
    edit=response.json()['id']
    maximum=0
    for resource in ('tracks','bundles','apks'):
        response=session.get(base+'/'+edit+'/'+resource,timeout=30)
        if response.status_code!=200: raise SystemExit('Cannot verify current Play '+resource)
        data=response.json()
        if resource=='tracks':
            for track in data.get('tracks',[]):
                for release in track.get('releases',[]):
                    for code in release.get('versionCodes',[]): maximum=max(maximum,int(code))
        else:
            for artifact in data.get(resource,[]): maximum=max(maximum,int(artifact['versionCode']))
    candidate=int(os.environ['NITIDO_VERSION_CODE'])
    if candidate<=maximum: raise SystemExit('Android versionCode must exceed current authenticated Play maximum')
    evidence=json.loads(pathlib.Path(os.environ['EVIDENCE']).read_text())
    if evidence['store']['highestBuild']!=maximum: raise SystemExit('Play evidence maximum does not match current authenticated state')
    print('Exact Play package authenticated; candidate version exceeds all current track/bundle/APK versions')
finally:
    if edit is not None:
        response=session.delete(base+'/'+edit,timeout=30)
        if response.status_code not in (200,204): raise SystemExit('Temporary Play preflight edit cleanup failed; inspect before retry')
