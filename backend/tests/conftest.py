from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).parents[1]))
import httpx
import pytest
from fastapi.testclient import TestClient
from medora.app import create_app
from medora.config import Settings

ORIGIN='http://localhost:3000'

@pytest.fixture
def client(tmp_path):
    settings=Settings(_env_file=None,app_env='test',data_dir=tmp_path,demo_accounts_enabled=True)
    with TestClient(create_app(settings,transport=httpx.MockTransport(lambda request:httpx.Response(503))),headers={'Origin':ORIGIN}) as client:
        yield client

@pytest.fixture
def make_client(tmp_path):
    active=[]
    def build(handler,**kwargs):
        settings=Settings(_env_file=None,app_env='test',data_dir=tmp_path/str(len(active)),demo_accounts_enabled=True,**kwargs)
        ctx=TestClient(create_app(settings,transport=httpx.MockTransport(handler)),headers={'Origin':ORIGIN})
        client=ctx.__enter__();active.append(ctx);return client
    yield build
    for ctx in reversed(active):ctx.__exit__(None,None,None)


def login(client,role='patient'):
    result=client.post('/api/v1/auth/login',json={'email':role+'@medora.demo','password':'Medora123!'})
    assert result.status_code==200,result.text
    return result.json()['user']
