#!/usr/bin/env python3
"""Exercise immutable old/current bundles on disposable emulators, never owner devices."""
import importlib.util
import json
import pathlib
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = 'ro.nitido.app'
OUT = pathlib.Path('android-lifecycle-proof')
OUT.mkdir(exist_ok=True)
spec = importlib.util.spec_from_file_location('sanitizer', pathlib.Path(__file__).with_name('android-play-investigate.py'))
sanitizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sanitizer)
report = {'package': PACKAGE, 'physicalDeviceVerified': False, 'installedStoreVersionIdentified': False,
          'pushSent': False, 'accountUsed': False, 'releasePublished': False, 'checks': []}


def adb(*args, timeout=45):
    return subprocess.run(['adb', *args], capture_output=True, text=True, check=True, timeout=timeout).stdout


def version():
    output = adb('shell', 'dumpsys', 'package', PACKAGE)
    match = re.search(r'\bversionCode=(\d+)', output)
    if not match:
        raise RuntimeError('INSTALLED_VERSION_NOT_READABLE')
    return int(match.group(1))


def alive():
    if not adb('shell', 'pidof', PACKAGE).strip():
        raise RuntimeError('APPLICATION_PROCESS_DIED')
    crash = adb('logcat', '-b', 'crash', '-d', '-v', 'raw')
    if PACKAGE in crash:
        report['crash'] = sanitizer.safe_report({'type': 'CRASH', 'reportText': crash})
        raise RuntimeError('NATIVE_CRASH_RECORDED')


def launch(label, expected):
    report['currentScenario'] = label
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('logcat', '-b', 'crash', '-c')
    output = adb('shell', 'am', 'start', '-W', '-n', PACKAGE+'/.MainActivity')
    if 'Status: ok' not in output or 'Error:' in output:
        raise RuntimeError('ACTIVITY_START_FAILED')
    time.sleep(12)
    alive()
    installed = version()
    if installed != expected:
        raise RuntimeError('UNEXPECTED_INSTALLED_VERSION')
    report['checks'].append({'scenario': label, 'versionCode': installed, 'processAlive': True, 'nativeCrash': False})


def resume_and_rotate(label):
    report['currentScenario'] = label
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    time.sleep(2)
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE+'/.MainActivity')
    adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
    for rotation in ['1', '0']:
        adb('shell', 'settings', 'put', 'system', 'user_rotation', rotation)
        time.sleep(2)
        alive()
    for mode in ['yes', 'no']:
        adb('shell', 'cmd', 'uimode', 'night', mode)
        time.sleep(2)
        alive()
    report['checks'].append({'scenario': label, 'versionCode': version(), 'resumeAlive': True, 'rotations': 2, 'appearanceChanges': 2})


def network(online):
    adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable' if online else 'enable')
    for service in ['wifi', 'data']:
        adb('shell', 'svc', service, 'enable' if online else 'disable')
    time.sleep(5)


def webview(label):
    report['currentScenario'] = label
    adb('shell', 'uiautomator', 'dump', '--compressed', '/sdcard/nitido-lifecycle.xml', timeout=35)
    xml = adb('exec-out', 'cat', '/sdcard/nitido-lifecycle.xml')
    root = ET.fromstring(xml)
    nodes = list(root.iter('node'))
    found = any(n.attrib.get('class') == 'android.webkit.WebView' and n.attrib.get('package') == PACKAGE for n in nodes)
    if not found:
        raise RuntimeError('APPLICATION_WEBVIEW_NOT_VISIBLE')
    report['checks'].append({'scenario': label, 'versionCode': version(), 'webViewVisible': True})


try:
    adb('wait-for-device')
    report['api'] = adb('shell', 'getprop', 'ro.build.version.sdk').strip()
    report['webviewProvider'] = bool('WebView' in adb('shell', 'dumpsys', 'webviewupdate'))
    adb('install', 'legacy/universal.apk')
    launch('legacy-fresh', 24)
    webview('legacy-fresh-visible')
    adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.POST_NOTIFICATIONS')
    launch('legacy-notification-permission-already-granted', 24)
    resume_and_rotate('legacy-resume-rotate-appearance')
    network(False)
    launch('legacy-offline-cold-start', 24)
    webview('legacy-offline-visible')
    network(True)
    launch('legacy-online-after-offline', 24)
    adb('install', '-r', 'current/universal.apk')
    report['upgradePreservedAppData'] = True  # -r, same disposable certificate; no clear/uninstall.
    launch('upgraded-current-with-existing-permission', 26)
    resume_and_rotate('current-resume-rotate-appearance')
    webview('current-upgraded-visible')
    network(False)
    launch('current-offline-cold-start', 26)
    webview('current-offline-visible')
    network(True)
    launch('current-online-after-offline', 26)
    webview('current-final-visible')
    report['status'] = 'passed'
except Exception as error:
    report['status'] = 'failed'
    report['reason'] = str(error) if isinstance(error, RuntimeError) and re.fullmatch('[A-Z_]+', str(error)) else type(error).__name__
    try:
        report['crash'] = sanitizer.safe_report({'type': 'CRASH', 'reportText': adb('logcat', '-b', 'crash', '-d', '-v', 'raw')})
    except Exception:
        pass
finally:
    try:
        network(True)
    except Exception:
        pass
    (OUT/'result.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
if report['status'] != 'passed':
    raise SystemExit(1)
