import httpx
import pytest
from medora.practice import normalize_times
from medora.practice_catalog import MODULES, validate_record
from seed_live_data import sample_records


def test_live_login_never_retries_with_another_password(make_client):
    submitted = []
    def handler(request):
        if request.url.path == '/auth/v1/token':
            submitted.append(request.content)
        return httpx.Response(400, json={'msg': 'Invalid login credentials'})
    client = make_client(handler, supabase_url='https://example.supabase.co',
                         supabase_publishable_key='public-test', supabase_secret_key='secret-test')
    response = client.post('/api/v1/auth/login', json={'email': 'doctor@medora.demo', 'password': 'wrong-password'})
    assert response.status_code == 401
    assert len(submitted) == 1
    assert b'wrong-password' in submitted[0]


@pytest.mark.parametrize('module,values', sample_records('00000000-0000-4000-8000-000000000001'))
def test_live_samples_match_catalog_and_normalize_times(module, values):
    assert module in MODULES
    data = normalize_times(module, validate_record(module, values), 'Asia/Kolkata')
    assert data
    for field in MODULES[module]['fields']:
        if field['kind'] == 'datetime-local' and data[field['key']]:
            assert data[field['key']].endswith('+00:00')
