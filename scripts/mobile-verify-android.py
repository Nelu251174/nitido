#!/usr/bin/env python3
"""Verify signed AAB identity/config and native 16KB packaging using official bundletool."""
import json, pathlib, re, struct, subprocess, sys, tempfile, xml.etree.ElementTree as ET, zipfile
bundle, bundletool, version = sys.argv[1:4]
def tool(*args):
    return subprocess.run(['java','-jar',bundletool,*args],capture_output=True,check=True).stdout
manifest=ET.fromstring(tool('dump','manifest','--bundle='+bundle,'--module=base'))
ns='{http://schemas.android.com/apk/res/android}'
if manifest.get('package')!='ro.nitido.app' or manifest.get(ns+'versionCode')!=version:
    raise SystemExit('AAB identity/version mismatch')
if int(manifest.find('uses-sdk').get(ns+'targetSdkVersion','0'))<36:
    raise SystemExit('AAB target API below36')
if manifest.find('application').get(ns+'allowBackup')!='false':
    raise SystemExit('WebView/session backup must be disabled')
config=json.loads(tool('dump','config','--bundle='+bundle))
if config.get('optimizations',{}).get('uncompressNativeLibraries',{}).get('alignment')!='PAGE_ALIGNMENT_16K':
    raise SystemExit('Bundle native-library alignment must be16KB')
with tempfile.TemporaryDirectory() as folder:
    root=pathlib.Path(folder)
    with zipfile.ZipFile(bundle) as z:
        natives=[e for e in z.infolist() if e.filename.endswith('.so')]
        for idx,entry in enumerate(natives):
            path=root/('library-'+str(idx)+'.so');path.write_bytes(z.read(entry))
            output=subprocess.run(['readelf','-lW',str(path)],capture_output=True,check=True).stdout.decode()
            loads=[line.split() for line in output.splitlines() if line.strip().startswith('LOAD ')]
            if not loads or any(int(fields[-1],16)<16384 for fields in loads):
                raise SystemExit('Native ELF incompatible with16KB: '+entry.filename)
    # bundletool signs this disposable packaging-test APK with its debug key;
    # it is never uploaded and does not replace the existing store upload key.
    apks=root/'packaging-test.apks'
    tool('build-apks','--bundle='+bundle,'--output='+str(apks),'--mode=universal','--overwrite')
    with zipfile.ZipFile(apks) as z: (root/'universal.apk').write_bytes(z.read('universal.apk'))
    with zipfile.ZipFile(root/'universal.apk') as z:
        with (root/'universal.apk').open('rb') as raw:
            for e in z.infolist():
                if not e.filename.endswith('.so'): continue
                if e.compress_type!=zipfile.ZIP_STORED: raise SystemExit('APK native library must be uncompressed')
                raw.seek(e.header_offset);header=raw.read(30)
                name,extra=struct.unpack_from('<HH',header,26)
                if (e.header_offset+30+name+extra)%16384: raise SystemExit('APK native library ZIP offset is not16KB aligned')
print('AAB identity, targetAPI36, disabled backup, ELF and generated APK16KB packaging verified; runtime device proof remains separate')
