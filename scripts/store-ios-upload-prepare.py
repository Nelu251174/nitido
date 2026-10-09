"""Refresh real Apple store evidence before the beta upload; no public submission."""
import importlib.util, json, os, pathlib, datetime
module_path = pathlib.Path(__file__).with_name('store-publication-inspect.py')
spec = importlib.util.spec_from_file_location('store_inspector', module_path)
inspector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inspector)
state = inspector.apple_inspect()
if not state.get('authenticated') or state['bundleId'] != 'ro.nitido.app':
    raise SystemExit('Existing Apple app is not authenticated')
if int(os.environ['NITIDO_IOS_BUILD_NUMBER']) <= state['highestBuild']:
    raise SystemExit('Candidate version is already uploaded or obsolete; inspect before retry')
evidence = json.loads(pathlib.Path(os.environ['EVIDENCE']).read_text())
if evidence['sourceSha'] != os.environ['NITIDO_SOURCE_SHA']:
    raise SystemExit('Candidate evidence source mismatch')
evidence['store'] = {'verified': True, 'highestBuild': state['highestBuild'],
    'receipt': 'Authenticated exact Apple app ' + state['appId'] + '; current maximum ' +
        str(state['highestBuild']) + '; ' + datetime.datetime.now(datetime.timezone.utc).isoformat()}
pathlib.Path(os.environ['EVIDENCE']).write_text(json.dumps(evidence, indent=2))
print('Authenticated Apple app; fresh store maximum and beta upload evidence verified')
