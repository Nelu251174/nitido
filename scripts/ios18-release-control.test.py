"""Guard the release controller's Apple mutations with offline API fixtures."""
import contextlib
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ios18', pathlib.Path(__file__).with_name('ios18-release-control.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class DraftBuildSelection(unittest.TestCase):
    def scenario(self, *, screenshot_count=3, selected=None, marketing='1.0.1', notes=None):
        calls = []
        def rows(path):
            if path.startswith('/v1/apps?'):
                return [{'id': release.APP, 'attributes': {'bundleId': release.BUNDLE}}]
            if path.startswith('/v1/builds?'):
                return [{'id': 'build18', 'attributes': {'processingState': 'VALID'}}]
            if path.startswith('/v1/apps/' + release.APP + '/appStoreVersions?'):
                return [{'id': 'draft101', 'attributes': {'platform': 'IOS', 'versionString': '1.0.1', 'appStoreState': 'PREPARE_FOR_SUBMISSION'}}]
            if '/appStoreVersionLocalizations?' in path:
                return [{'id': 'ro', 'attributes': {'locale': 'ro', 'whatsNew': notes}}]
            if '/appScreenshotSets?' in path:
                return [{'id': 'iphone', 'attributes': {'screenshotDisplayType': 'APP_IPHONE_63'}}]
            if '/appScreenshots?' in path:
                return [{'attributes': {'assetDeliveryState': {'state': 'COMPLETE'}}} for _ in range(screenshot_count)]
            raise AssertionError(path)
        selection = selected
        def apple(path, method='GET', data=None):
            nonlocal selection
            calls.append((path, method, data))
            if path.endswith('/preReleaseVersion'):
                return {'data': {'attributes': {'version': marketing, 'platform': 'IOS'}}}
            if path.endswith('/relationships/build') and method == 'PATCH':
                selection = {'id': data['data']['id']}
                return None
            if path.endswith('/build'):
                return {'data': selection}
            if path == '/v1/appStoreVersionLocalizations/ro' and method == 'PATCH':
                return {'data': data['data']}
            raise AssertionError((path, method))
        return calls, rows, apple

    def run_scenario(self, **kwargs):
        calls, rows, apple = self.scenario(**kwargs)
        with tempfile.TemporaryDirectory() as folder, patch.object(release, 'rows', side_effect=rows), \
                patch.object(release, 'apple', side_effect=apple), \
                patch.dict(release.os.environ, {'RUNNER_TEMP': folder}), contextlib.redirect_stdout(io.StringIO()):
            release.confirm()
            report = json.loads((pathlib.Path(folder) / 'ios18-apple-confirmation.json').read_text())
        return calls, report

    def test_selects_only_processed_exact_version_and_three_complete_screenshots(self):
        calls, report = self.run_scenario()
        self.assertTrue(report['buildSelected'])
        self.assertFalse(report['submittedForReview'])
        self.assertEqual(report['appStoreState'], 'PREPARE_FOR_SUBMISSION')
        self.assertEqual([path for path, method, _ in calls if method == 'PATCH'], [
            '/v1/appStoreVersions/draft101/relationships/build', '/v1/appStoreVersionLocalizations/ro'])

    def test_preserves_existing_notes_and_already_selected_candidate(self):
        calls, _ = self.run_scenario(selected={'id': 'build18'}, notes='Owner-written release notes')
        self.assertFalse(any(method == 'PATCH' for _, method, _ in calls))

    def test_does_not_replace_another_selected_build(self):
        calls, rows, apple = self.scenario(selected={'id': 'other-build'})
        with patch.object(release, 'rows', side_effect=rows), patch.object(release, 'apple', side_effect=apple), \
                contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(ValueError, 'Another build'):
            release.confirm()
        self.assertFalse(any(method == 'PATCH' for _, method, _ in calls))

    def test_does_not_mutate_draft_without_three_completed_screenshots(self):
        calls, rows, apple = self.scenario(screenshot_count=2)
        with patch.object(release, 'rows', side_effect=rows), patch.object(release, 'apple', side_effect=apple), \
                contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(ValueError, 'Three uploaded'):
            release.confirm()
        self.assertFalse(any(method == 'PATCH' for _, method, _ in calls))

    def test_wrong_marketing_version_blocks_mutations(self):
        calls, rows, apple = self.scenario(marketing='1.0')
        with patch.object(release, 'rows', side_effect=rows), patch.object(release, 'apple', side_effect=apple), \
                contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(ValueError, 'marketing version'):
            release.confirm()
        self.assertFalse(any(method == 'PATCH' for _, method, _ in calls))


if __name__ == '__main__':
    unittest.main()
