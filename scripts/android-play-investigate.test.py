import datetime as dt
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('probe', pathlib.Path(__file__).with_name('android-play-investigate.py'))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class Response:
    def __init__(self, status, data):
        self.status_code, self.data = status, data

    def json(self):
        return self.data


class Session:
    def __init__(self, can_enable=False):
        self.calls, self.enabled, self.can_enable = [], set(), can_enable

    def post(self, url, **options):
        self.calls.append(('POST', url, options))
        if url.endswith(':testIamPermissions'):
            return Response(200, {'permissions': ['serviceusage.services.enable'] if self.can_enable else []})
        if url.endswith(':enable'):
            self.enabled.add(url.removesuffix(':enable'))
            return Response(200, {'name': 'operations/test-one', 'done': True})
        return Response(200, {'id': 'temporary-test-edit'})

    def get(self, url, **options):
        self.calls.append(('GET', url, options))
        if url.endswith('/tracks'):
            raise RuntimeError('SIMULATED_TRACKS_FAILURE')
        return Response(200, {'state': 'ENABLED' if url in self.enabled else 'DISABLED'})

    def delete(self, url, **options):
        self.calls.append(('DELETE', url, options))
        return Response(204, {})


class ProbeTests(unittest.TestCase):
    def test_interval_matches_discovery_datetime_fields_across_month_boundary(self):
        params = probe.interval_params(dt.datetime(2026, 10, 2, 13, 44, tzinfo=dt.timezone.utc))
        self.assertEqual(params['interval.startTime.month'], 9)
        self.assertEqual(params['interval.startTime.day'], 4)
        self.assertEqual(params['interval.endTime.hours'], 13)
        self.assertEqual(params['interval.endTime.utcOffset'], '0s')
        self.assertNotIn('interval.startTime', params)
        self.assertNotIn('interval.endTime', params)

    def test_stack_export_excludes_messages_credentials_and_urls(self):
        report = probe.safe_report({'type': 'CRASH', 'appVersion': {'versionCode': '18'}, 'reportText':
            'java.lang.RuntimeException: private-token-canary https://example.test/auth\n'
            'Caused by: java.lang.IllegalStateException: user@example.test\n'
            '  at com.getcapacitor.Bridge.createWebView(Bridge.java:214)\n'
            '  at ro.nitido.app.MainActivity.onCreate(MainActivity.java:12)\n'})
        self.assertEqual(report['exceptionClasses'], ['java.lang.RuntimeException', 'java.lang.IllegalStateException'])
        self.assertEqual(len(report['frames']), 2)
        self.assertNotIn('private-token-canary', str(report))
        self.assertNotIn('example.test', str(report))
        self.assertEqual(report['appVersion']['versionCode'], '18')

    def test_issue_keeps_actual_first_and_last_app_versions(self):
        result = probe.safe_issue({'cause': 'IllegalStateException', 'firstAppVersion': {'versionCode': '18'},
                                  'lastAppVersion': {'versionCode': '25'}, 'issueUri': 'https://private.invalid'})
        self.assertEqual(result['firstAppVersion']['versionCode'], '18')
        self.assertEqual(result['lastAppVersion']['versionCode'], '25')
        self.assertNotIn('issueUri', result)

    def test_no_service_mutation_without_existing_permission(self):
        session = Session()
        result = probe.inspect_services(session, probe.PROJECT, True)
        self.assertFalse(result['canEnableExistingProjectServices'])
        self.assertFalse(any(url.endswith(':enable') for _, url, _ in session.calls))

    def test_no_service_mutation_or_inspection_in_other_projects(self):
        session = Session(True)
        self.assertFalse(probe.inspect_services(session, 'unrelated-project', True)['checked'])
        self.assertEqual(session.calls, [])

    def test_enable_only_two_exact_services_when_already_authorized(self):
        session = Session(True)
        result = probe.inspect_services(session, probe.PROJECT, True)
        enables = [url for method, url, _ in session.calls if method == 'POST' and url.endswith(':enable')]
        self.assertTrue(result['services'][0]['enabledByThisRun'])
        self.assertEqual(set(enables), {f'https://serviceusage.googleapis.com/v1/projects/{probe.PROJECT}/services/{service}:enable' for service in [probe.REPORTING,probe.PUBLISHER]})
        self.assertFalse(any('setIamPolicy' in url for _, url, _ in session.calls))

    def test_temporary_play_edit_is_deleted_even_if_track_read_fails(self):
        session = Session()
        with self.assertRaisesRegex(RuntimeError, 'SIMULATED_TRACKS_FAILURE'):
            probe.inspect_play(session)
        self.assertTrue(any(method == 'DELETE' for method, _, _ in session.calls))
        self.assertFalse(any(url.endswith(':commit') for _, url, _ in session.calls))


if __name__ == '__main__':
    unittest.main()
