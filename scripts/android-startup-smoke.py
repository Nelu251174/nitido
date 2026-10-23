#!/usr/bin/env python3
"""Cold/warm launch a disposable candidate in CI; no login, push send or store upload."""
import json, pathlib, subprocess, time
PACKAGE = 'ro.nitido.app'
OUT = pathlib.Path('android-startup-proof')
OUT.mkdir(exist_ok=True)
def adb(*args):
    return subprocess.run(['adb', *args], capture_output=True, text=True, check=True, timeout=45).stdout
results=[]
try:
    adb('wait-for-device')
    for iteration in range(3):
        adb('shell', 'am', 'force-stop', PACKAGE)
        adb('logcat', '-b', 'crash', '-c')
        start=adb('shell', 'am', 'start', '-W', '-n', PACKAGE+'/.MainActivity')
        if 'Error:' in start or 'Status: ok' not in start:
            raise RuntimeError('ACTIVITY_START_FAILED')
        time.sleep(12)
        if not adb('shell', 'pidof', PACKAGE).strip():
            raise RuntimeError('PROCESS_DIED_AFTER_COLD_START')
        adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        time.sleep(2)
        adb('shell', 'am', 'start', '-W', '-n', PACKAGE+'/.MainActivity')
        time.sleep(3)
        if not adb('shell', 'pidof', PACKAGE).strip():
            raise RuntimeError('PROCESS_DIED_AFTER_RESUME')
        crash=adb('logcat', '-b', 'crash', '-d')
        if PACKAGE in crash:
            (OUT/'native-crash.txt').write_text(crash)
            raise RuntimeError('NATIVE_CRASH_RECORDED')
        results.append({'coldStart':iteration+1,'processAlive':True,'resumeAlive':True,'nativeCrash':False})
    report={'status':'passed','api':adb('shell','getprop','ro.build.version.sdk').strip(),'attempts':results,'physicalPhoneVerified':False,'pushReceiptVerified':False}
except Exception as error:
    crash=adb('logcat','-b','crash','-d')
    if crash.strip(): (OUT/'native-crash.txt').write_text(crash)
    report={'status':'failed','reason':str(error) if isinstance(error,RuntimeError) else type(error).__name__,'attempts':results}
(OUT/'result.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
if report['status']!='passed': raise SystemExit(1)
