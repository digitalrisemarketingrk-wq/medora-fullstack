import copy
import pytest
from pydantic import ValidationError
from medora.config import Settings
from conftest import login


def snapshot(client):return client.get('/api/v1/workspace').json()
def put(client,ws,owner=None):return client.put('/api/v1/workspace',params={'owner_id':owner} if owner else {},json={'version':ws['version'],'data':ws['data']})


def test_session_is_http_only_not_exposed_in_response(client):
    response=client.post('/api/v1/auth/login',json={'email':'patient@medora.demo','password':'Medora123!'})
    assert response.status_code==200
    cookie=response.headers['set-cookie']
    assert 'HttpOnly' in cookie and 'SameSite=lax' in cookie
    assert set(response.json())=={'user'}
    assert 'password' not in response.text and 'token' not in response.text
    assert client.get('/api/v1/auth/me').json()['user']['role']=='patient'
    client.post('/api/v1/auth/logout',json={})
    assert client.get('/api/v1/workspace').status_code==401


def test_signup_cannot_choose_professional_role(client):
    body={'email':'new@example.com','password':'TestingPassword12!','name':'New Person','consent':True,'role':'doctor'}
    response=client.post('/api/v1/auth/signup',json=body)
    assert response.status_code==422 and body['password'] not in response.text
    body.pop('role');response=client.post('/api/v1/auth/signup',json=body)
    assert response.status_code==201 and response.json()['user']['role']=='patient'
    assert snapshot(client)['data']['documents']==[]


def test_cookie_mutations_require_allowed_origin(client):
    login(client)
    ws=snapshot(client)
    response=client.put('/api/v1/workspace',json={'version':ws['version'],'data':ws['data']},headers={'Origin':'https://attacker.example'})
    assert response.status_code==403
    assert client.get('/api/v1/workspace',headers={'Origin':'https://attacker.example'}).headers.get('access-control-allow-origin') is None


def test_access_requires_grant_even_for_professional(client):
    patient=login(client);owner=patient['id'];login(client,'doctor')
    assert client.get('/api/v1/workspace',params={'owner_id':owner}).status_code==403
    login(client)
    assert client.post('/api/v1/access',json={'recipient_email':'doctor@medora.demo','scope':'read'}).status_code==200
    login(client,'doctor');ws=client.get('/api/v1/workspace',params={'owner_id':owner}).json()
    assert ws['can_write'] is False and ws['data']['settings']['name']=='Alex Morgan'
    assert put(client,ws,owner).status_code==403
    doctor=client.get('/api/v1/auth/me').json()['user'];login(client)
    assert client.delete('/api/v1/access/'+doctor['id']).status_code==200
    login(client,'doctor')
    assert client.get('/api/v1/workspace',params={'owner_id':owner}).status_code==403


def test_write_grant_protects_identity_consent_and_medication(client):
    owner=login(client)['id'];client.post('/api/v1/access',json={'recipient_email':'doctor@medora.demo','scope':'write'})
    login(client,'doctor');ws=client.get('/api/v1/workspace',params={'owner_id':owner}).json()
    ws['data']['settings']['sharing']=True
    assert put(client,ws,owner).status_code==403
    ws=client.get('/api/v1/workspace',params={'owner_id':owner}).json()
    ws['data']['notes'].append({'id':'review1','patientId':'p1','title':'Reviewed note','body':'Verified by clinician','date':'2026-10-02'})
    assert put(client,ws,owner).status_code==200


def test_stale_save_never_overwrites_another_session(client):
    login(client);first=snapshot(client);stale=copy.deepcopy(first)
    first['data']['settings']['name']='Updated name'
    assert put(client,first).status_code==200
    stale['data']['settings']['name']='Old session'
    assert put(client,stale).status_code==409
    assert snapshot(client)['data']['settings']['name']=='Updated name'


def test_persisted_record_shape_is_validated(client):
    login(client);ws=snapshot(client);ws['data']['features']['savedSummaries']={}
    assert put(client,ws).status_code==422
    ws=snapshot(client);ws['data']['tasks']=[{'id':'broken'}]
    assert put(client,ws).status_code==422


def test_appointment_collision_is_rejected(client):
    login(client);ws=snapshot(client)
    slot={'id':'a1','patientId':'p1','patient':'Alex','doctor':'Doctor','provider':'Clinic','specialty':'GP','date':'2026-11-01','time':'09:00','mode':'In person','status':'Confirmed','reason':'Review','prep':[]}
    ws['data']['appointments']=[slot,{**slot,'id':'a2'}]
    assert put(client,ws).status_code==422


def test_private_file_is_authorized_and_metadata_cannot_be_forged(client):
    owner=login(client)['id'];response=client.post('/api/v1/documents',files={'file':('results.txt',b'Example report','text/plain')})
    assert response.status_code==201
    doc=response.json()['document'];assert doc['storagePath'].startswith(owner+'/')
    ws=snapshot(client);ws['data']['documents'][0].pop('storagePath')
    assert put(client,ws).status_code==400
    ws=snapshot(client);ws['data']['documents'][0]['summary']='Forged interpretation'
    assert put(client,ws).status_code==400
    assert client.get('/api/v1/documents/'+doc['id']+'/download').content==b'Example report'
    login(client,'doctor')
    assert client.get('/api/v1/documents/'+doc['id']+'/download',params={'owner_id':owner}).status_code==403


def test_file_content_not_just_extension_is_checked(client):
    login(client)
    assert client.post('/api/v1/documents',files={'file':('malicious.pdf',b'<script>alert(1)</script>','application/pdf')}).status_code==400
    assert client.post('/api/v1/documents',files={'file':('data.txt',b'\x00binary','text/plain')}).status_code==400
    assert snapshot(client)['data']['documents']==[]


def test_delete_removes_private_file_and_record(client):
    login(client);doc=client.post('/api/v1/documents',files={'file':('results.txt',b'Example','text/plain')}).json()['document']
    response=client.delete('/api/v1/documents/'+doc['id'])
    assert response.status_code==200 and response.json()['workspace']['data']['documents']==[]
    assert client.get('/api/v1/documents/'+doc['id']+'/download').status_code==404
    assert not (client.app.state.settings.data_dir/'documents'/doc['storagePath']).exists()


def test_patient_cannot_use_clinical_or_scribe_api(client):
    login(client)
    assert client.post('/api/v1/ai/clinical-draft',json={'kind':'Clinical note','context':'Patient review','patient_name':'Alex'}).status_code==403
    assert client.post('/api/v1/ai/transcribe?consent=true',files={'file':('audio.webm',b'audio','audio/webm')}).status_code==403


def test_missing_keys_are_explicit_and_capabilities_are_nonsecret(client):
    login(client)
    assert client.get('/api/v1/capabilities').json()['ai'] is False
    assert client.post('/api/v1/ai/chat',json={'message':'Explain my care plan'}).status_code==503
    assert client.get('/api/v1/workspace').headers['cache-control']=='no-store'


def test_authentication_is_throttled(client):
    for i in range(30):
        assert client.post('/api/v1/auth/login',json={'email':'unknown@example.com','password':'InvalidPassword'}).status_code==401
    assert client.post('/api/v1/auth/login',json={'email':'unknown@example.com','password':'InvalidPassword'}).status_code==429


@pytest.mark.parametrize('values',[{'app_env':'production'},{'allowed_origins':'*'},{'cookie_samesite':'none','cookie_secure':False},{'supabase_url':'https://test.supabase.co'},{'app_env':'production','supabase_url':'https://test.supabase.co','supabase_publishable_key':'test','supabase_secret_key':'secret','cookie_secure':True,'demo_accounts_enabled':True}])
def test_insecure_configuration_fails_closed(values):
    with pytest.raises(ValidationError):Settings(_env_file=None,**values)


def test_actual_stream_size_is_limited_without_content_length(client):
    login(client)
    def chunks():
        for _ in range(12):yield b'x'*(1024*1024)
    result=client.post('/api/v1/documents',content=chunks(),headers={'Content-Type':'application/octet-stream'})
    assert result.status_code==413
    assert snapshot(client)['data']['documents']==[]


def test_configuration_errors_do_not_print_secret_values():
    secret='never-print-this-credential'
    try:
        Settings(_env_file=None,app_env='production',groq_api_key=secret)
    except ValidationError as error:
        assert secret not in str(error)
    else:
        raise AssertionError('Expected production configuration rejection')
