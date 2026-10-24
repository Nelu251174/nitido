"""Exercise real Compose interpolation using synthetic values, without containers."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

source = Path(__file__).resolve().parents[1] / 'docker-compose.production.yml'
compose = source.read_text()
old_line = '      STRIPE_CONNECT_WEBHOOK_SECRET: ${STRIPE_CONNECT_WEBHOOK_SECRET:?Configure the production Connect webhook secret}\n'
old = compose.replace('      # STRIPE_CONNECT_WEBHOOK_SECRET is runtime-only and comes from env_file.\n      # Requiring it during Compose build interpolation blocks Coolify builds.\n', old_line)
build_values = {'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY': 'pk_test_synthetic', 'STRIPE_SECRET_KEY': 'sk_test_synthetic', 'STRIPE_WEBHOOK_SECRET': 'whsec_synthetic'}
runtime_value = 'whsec_connect_synthetic_runtime_only'
env = {k: v for k, v in os.environ.items() if k not in [*build_values, 'STRIPE_CONNECT_WEBHOOK_SECRET', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']}

with tempfile.TemporaryDirectory(prefix='nitido-compose-') as td:
    root = Path(td)
    def configure(text, values):
        (root/'compose.yml').write_text(text)
        (root/'.env').write_text(''.join(k+'='+v+'\n' for k, v in values.items()))
        return subprocess.run(['docker', 'compose', '--project-name', 'nitido-synthetic-check', '--env-file', str(root/'.env'), '-f', str(root/'compose.yml'), 'config', '--format', 'json'], env=env, capture_output=True, text=True)
    before = configure(old, build_values)
    assert before.returncode != 0 and 'STRIPE_CONNECT_WEBHOOK_SECRET' in before.stderr, 'Old missing runtime-only configuration must reproduce failure'
    built = configure(compose, build_values)
    assert built.returncode == 0, 'Build-only Compose configuration must parse without runtime-only secret'
    runtime = configure(compose, {**build_values, 'STRIPE_CONNECT_WEBHOOK_SECRET': runtime_value})
    assert runtime.returncode == 0
    config = json.loads(runtime.stdout)
    app = config['services']['nitido']
    assert app['environment']['STRIPE_CONNECT_WEBHOOK_SECRET'] == runtime_value, 'Runtime secret must be inherited from env_file'
    assert app['build']['args'].get('STRIPE_CONNECT_WEBHOOK_SECRET') is None, 'Runtime secret must not become a build argument'
    assert config['volumes']['nitido_data']['name'] == 'zxnelxi2cejranyvfpw0scac_nitido-data'
    assert config['volumes']['nitido_uploads']['name'] == 'zxnelxi2cejranyvfpw0scac_nitido-uploads'
    missing_public = configure(compose, {k:v for k,v in build_values.items() if k != 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'})
    assert missing_public.returncode != 0, 'Required public build configuration must remain required'
print(json.dumps({'oldFailureReproduced': True, 'buildWithoutRuntimeSecret': True, 'runtimeSecretPreserved': True, 'secretNotBuildArgument': True, 'existingVolumesPreserved': True, 'requiredPublicConfigPreserved': True, 'containersStarted': False, 'realCredentialsUsed': False}))
