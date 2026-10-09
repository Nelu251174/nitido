#!/usr/bin/env python3
"""Verify exported IPA on macOS, without printing credentials/profile contents."""
import datetime, os, pathlib, plistlib, re, stat, subprocess, sys, tempfile, zipfile
ipa, expected_version, expected_marketing = sys.argv[1:4]
with tempfile.TemporaryDirectory() as folder:
    with zipfile.ZipFile(ipa) as archive:
        for entry in archive.infolist():
            path = pathlib.PurePosixPath(entry.filename)
            if path.is_absolute() or '..' in path.parts:
                raise SystemExit('Unsafe IPA archive path')
            if stat.S_ISLNK(entry.external_attr >> 16):
                target=archive.read(entry).decode('utf8')
                resolved=os.path.normpath(str(path.parent / target))
                if target.startswith('/') or resolved=='..' or resolved.startswith('../'):
                    raise SystemExit('Unsafe IPA symbolic link')
        # macOS ditto preserves framework symlinks and executable modes for codesign.
        subprocess.run(['ditto','-x','-k',ipa,folder],check=True)
    apps = list(pathlib.Path(folder).glob('Payload/*.app'))
    if len(apps) != 1: raise SystemExit('Expected exactly one IPA application')
    app = apps[0]
    subprocess.run(['codesign','--verify','--deep','--strict',str(app)], check=True)
    info = plistlib.loads((app/'Info.plist').read_bytes())
    if info['CFBundleIdentifier'] != 'ro.nitido.app' or info['CFBundleVersion'] != expected_version or info['CFBundleShortVersionString'] != expected_marketing:
        raise SystemExit('IPA identity or version mismatch')
    sdk=re.fullmatch(r'iphoneos([0-9]+)(?:\.[0-9]+)*',str(info.get('DTSDKName','')))
    if int(str(info.get('DTXcode','0'))[:2]) < 26 or not sdk or int(sdk.group(1)) < 26:
        raise SystemExit('IPA SDK must meet Xcode26/iOS26 minimum')
    decoded = subprocess.run(['security','cms','-D','-i',str(app/'embedded.mobileprovision')],capture_output=True,check=True).stdout
    profile = plistlib.loads(decoded)
    expiry=profile.get('ExpirationDate')
    if not isinstance(expiry,datetime.datetime): raise SystemExit('Distribution profile expiry missing')
    if expiry.tzinfo is None: expiry=expiry.replace(tzinfo=datetime.timezone.utc)
    if expiry <= datetime.datetime.now(datetime.timezone.utc): raise SystemExit('Distribution profile expired')
    if os.environ['APPLE_TEAM_ID'] not in profile.get('TeamIdentifier',[]): raise SystemExit('Distribution profile team mismatch')
    ent = profile['Entitlements']
    expected_app = os.environ['APPLE_TEAM_ID']+'.ro.nitido.app'
    if ent.get('application-identifier') != expected_app or ent.get('get-task-allow') is not False or profile.get('ProvisionedDevices') or profile.get('ProvisionsAllDevices'):
        raise SystemExit('IPA must use the existing team App Store distribution profile')
    if ent.get('aps-environment') != 'production': raise SystemExit('Missing production APNs entitlement')
    signed = subprocess.run(['codesign','-d','--entitlements',':-',str(app)],capture_output=True,check=True).stdout
    actual = plistlib.loads(signed)
    if actual.get('application-identifier') != expected_app or actual.get('get-task-allow',False) is not False or actual.get('aps-environment') != 'production':
        raise SystemExit('Signed app entitlements do not match distribution profile')
    print('IPA signature, identity, version, SDK and distribution entitlements verified')
