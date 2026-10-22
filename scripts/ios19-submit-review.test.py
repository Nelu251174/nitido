import contextlib
import importlib.util
import io
import json
import pathlib
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('review', pathlib.Path(__file__).with_name('ios19-submit-review.py'))
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
r = review.release


class SubmitReview(unittest.TestCase):
    def scenario(self, state='PREPARE_FOR_SUBMISSION', build='19', screenshots=3, whats_new='Updated presentation'):
        calls = []
        attrs = {'platform': 'IOS', 'versionString': '1.0.2', 'appStoreState': state, 'releaseType': 'AFTER_APPROVAL'}
        def rows(path):
            if path.startswith('/v1/apps?'):
                return [{'id': r.APP, 'attributes': {'bundleId': r.BUNDLE}}]
            if '/appStoreVersions?' in path:
                return [{'id': 'version101', 'attributes': attrs}]
            if '/appStoreVersionLocalizations?' in path:
                return [{'id': 'ro', 'attributes': {'locale': 'ro', 'description': 'Description', 'supportUrl': 'https://nitido.ro/contact', 'whatsNew': whats_new}}]
            if '/appScreenshotSets?' in path:
                return [{'id': 'phone', 'attributes': {'screenshotDisplayType': 'APP_IPHONE_67'}}]
            if '/appScreenshots?' in path:
                return [{'attributes': {'assetDeliveryState': {'state': 'COMPLETE'}}} for _ in range(screenshots)]
            if path.startswith('/v1/reviewSubmissions?'):
                return []
            raise AssertionError(path)
        def apple(path, method='GET', data=None):
            calls.append((path, method, data))
            if path.endswith('/build'):
                return {'data': {'id': 'build19', 'attributes': {'version': build, 'processingState': 'VALID'}}}
            if path.endswith('/preReleaseVersion'):
                return {'data': {'attributes': {'version': '1.0.2', 'platform': 'IOS'}}}
            if path.endswith('/appStoreReviewDetail'):
                return {'data': {'attributes': {k: 'provided' for k in ['contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone']}}}
            if path == '/v1/reviewSubmissions' and method == 'POST':
                return {'data': {'id': 'review101', 'attributes': {'state': 'READY_FOR_REVIEW'}}}
            if path == '/v1/reviewSubmissionItems' and method == 'POST':
                return {'data': {'id': 'item101'}}
            if path == '/v1/reviewSubmissions/review101' and method == 'PATCH':
                attrs['appStoreState'] = 'WAITING_FOR_REVIEW'
                return {'data': {'id': 'review101'}}
            if path == '/v1/reviewSubmissions/review101':
                return {'data': {'attributes': {'state': 'WAITING_FOR_REVIEW'}}}
            if path == '/v1/appStoreVersions/version101':
                return {'data': {'attributes': attrs}}
            raise AssertionError((path, method))
        return calls, rows, apple

    def run_case(self, expected_error=None, **kwargs):
        calls, rows, apple = self.scenario(**kwargs)
        with tempfile.TemporaryDirectory() as folder:
            evidence = pathlib.Path(folder) / 'evidence.json'
            evidence.write_text(json.dumps({'sourceSha': r.SOURCE, 'build': 19, 'marketingVersion': '1.0.2'}))
            with patch.dict(review.os.environ, {'IOS19_EVIDENCE': str(evidence), 'RUNNER_TEMP': folder}), \
                    patch.object(r, 'rows', side_effect=rows), patch.object(r, 'apple', side_effect=apple), \
                    patch.object(review, 'upload_large_screenshots'), \
                    patch.object(review.subprocess, 'run'), patch.object(review, 'verify_review_login', return_value={'login': True, 'logout': True}), \
                    contextlib.redirect_stdout(io.StringIO()):
                if expected_error:
                    with self.assertRaisesRegex(ValueError, expected_error):
                        review.submit()
                    report = None
                else:
                    review.submit()
                    report = json.loads((pathlib.Path(folder) / 'ios19-app-review-confirmation.json').read_text())
        return calls, report

    def test_submits_only_version_101_and_confirms_review_queue(self):
        calls, report = self.run_case()
        self.assertTrue(report['submittedForReview'])
        self.assertFalse(report['approved'])
        self.assertEqual(report['releaseType'], 'AFTER_APPROVAL')
        self.assertEqual([p for p, m, _ in calls if m == 'POST'], ['/v1/reviewSubmissions', '/v1/reviewSubmissionItems'])
        item = next(d for p, m, d in calls if p == '/v1/reviewSubmissionItems')
        self.assertEqual(item['data']['relationships']['appStoreVersion']['data']['id'], 'version101')

    def test_queued_version_does_not_create_duplicate_submission(self):
        calls, report = self.run_case(state='WAITING_FOR_REVIEW')
        self.assertTrue(report['alreadySubmitted'])
        self.assertFalse(any(m != 'GET' for _, m, _ in calls))

    def test_old_build_blocks_all_mutations(self):
        calls, _ = self.run_case(build='17', expected_error='processed build 19')
        self.assertFalse(any(m != 'GET' for _, m, _ in calls))

    def test_two_screenshots_block_all_mutations(self):
        calls, _ = self.run_case(screenshots=2, expected_error='Three completed')
        self.assertFalse(any(m != 'GET' for _, m, _ in calls))

    def test_missing_release_notes_block_all_mutations(self):
        calls, _ = self.run_case(whats_new='', expected_error='Missing Romanian listing fields')
        self.assertFalse(any(m != 'GET' for _, m, _ in calls))

    def test_unexpected_version_state_is_preserved(self):
        calls, _ = self.run_case(state='REJECTED', expected_error='Unexpected draft state')
        self.assertFalse(any(m != 'GET' for _, m, _ in calls))


class LargeScreenshotReplacement(unittest.TestCase):
    def run_upload(self, failure=False, origin='https://upload.appstoreconnect.apple.com/test'):
        calls, uploaded = [], []
        old = {'id': 'old', 'attributes': {'fileName': 'old-home.png', 'assetDeliveryState': {'state': 'COMPLETE'}}}
        assets = [old]
        def rows(path):
            if '/appScreenshotSets?' in path:
                return [{'id': 'large', 'attributes': {'screenshotDisplayType': 'APP_IPHONE_67'}}]
            if '/appScreenshots?' in path:
                return list(assets)
            raise AssertionError(path)
        def apple(path, method='GET', data=None):
            calls.append((path, method, data))
            if path == '/v1/appScreenshots' and method == 'POST':
                attrs = data['data']['attributes']
                item = {'id': 'new' + str(len(assets)), 'attributes': {
                    **attrs, 'uploadOperations': [{'url': origin, 'method': 'PUT', 'offset': 0,
                        'length': attrs['fileSize'], 'requestHeaders': [{'name': 'Content-Type', 'value': 'image/png'}]}],
                    'assetDeliveryState': {'state': 'COMPLETE'}}}
                if failure and item['id'] == 'new3':
                    item['attributes']['assetDeliveryState']['state'] = 'FAILED'
                assets.append(item)
                return {'data': item}
            if path.endswith('/relationships/appScreenshots'):
                self.assertEqual([i['id'] for i in data['data']], ['new1', 'new2', 'new3'])
                return None
            identifier = path.rsplit('/', 1)[-1]
            item = next(i for i in assets if i['id'] == identifier)
            if method == 'GET':
                return {'data': item}
            if method == 'PATCH':
                item['attributes']['sourceFileChecksum'] = data['data']['attributes']['sourceFileChecksum']
                return None
            if method == 'DELETE':
                assets.remove(item)
                return None
            raise AssertionError((path, method))
        @contextlib.contextmanager
        def open_upload(request, timeout):
            uploaded.append(request)
            yield SimpleNamespace(status=200)
        with tempfile.TemporaryDirectory() as folder:
            for n in range(3):
                header = b'\x89PNG\r\n\x1a\n' + bytes(8) + review.struct.pack('>II', 1320, 2868) + bytes([8, 2]) + bytes(20) + bytes([n])
                (pathlib.Path(folder) / f'{n+1}-screen.png').write_bytes(header)
            with patch.dict(review.os.environ, {'IOS19_SCREENSHOTS': folder, 'RUNNER_TEMP': folder}), \
                    patch.object(r, 'rows', side_effect=rows), patch.object(r, 'apple', side_effect=apple), \
                    patch.object(review.urllib.request, 'build_opener', return_value=SimpleNamespace(open=open_upload)), \
                    contextlib.redirect_stdout(io.StringIO()):
                if failure or origin != 'https://upload.appstoreconnect.apple.com/test':
                    with self.assertRaises(ValueError):
                        review.upload_large_screenshots({'id': 'ro'})
                else:
                    review.upload_large_screenshots({'id': 'ro'})
        return calls, uploaded, assets

    def test_replaces_inherited_asset_only_after_all_three_complete(self):
        calls, uploaded, assets = self.run_upload()
        delete = next(i for i, (p, m, _) in enumerate(calls) if p == '/v1/appScreenshots/old' and m == 'DELETE')
        last_check = next(i for i, (p, m, _) in enumerate(calls) if p == '/v1/appScreenshots/new3' and m == 'GET')
        self.assertGreater(delete, last_check)
        self.assertEqual([i['id'] for i in assets], ['new1', 'new2', 'new3'])
        self.assertEqual(len(uploaded), 3)
        self.assertTrue(all(request.get_header('Authorization') is None for request in uploaded))

    def test_preserves_inherited_asset_if_replacement_processing_fails(self):
        calls, _, assets = self.run_upload(failure=True)
        self.assertIn('old', [i['id'] for i in assets])
        self.assertFalse(any(p == '/v1/appScreenshots/old' and m == 'DELETE' for p, m, _ in calls))

    def test_does_not_send_asset_to_unexpected_upload_origin(self):
        calls, uploaded, assets = self.run_upload(origin='https://not-apple.invalid/test')
        self.assertEqual(uploaded, [])
        self.assertIn('old', [i['id'] for i in assets])


if __name__ == '__main__':
    unittest.main()
