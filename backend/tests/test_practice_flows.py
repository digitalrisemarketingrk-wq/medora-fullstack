"""Public API lifecycle contracts and negative staff authorization scenarios."""
import uuid

import pytest

from conftest import login
from test_practice import setup, create, action


def inputs(patient):
    linked = {"patient_id": patient["id"]}
    return {
        "patients": {"name": "Lifecycle patient", "history": "Private medical history", "allergies": "Clinician-reconciled test allergy"},
        "appointments": {**linked, "clinician": "Dr Flow", "starts_at": "2026-12-11T09:00", "ends_at": "2026-12-11T09:30", "timezone": "Asia/Kolkata", "reason": "Lifecycle visit", "mode": "In person"},
        "emr": {**linked, "title": "Lifecycle encounter", "assessment": "Synthetic assessment"},
        "treatments": {**linked, "title": "Lifecycle plan", "goals": "Synthetic recorded goals"},
        "prescriptions": {**linked, "title": "Lifecycle prescription", "medications": "Synthetic medication instructions", "allergy_review": "Reviewed recorded source"},
        "billing": {**linked, "title": "Lifecycle invoice", "amount": "125.50", "currency": "INR"},
        "claims": {**linked, "title": "Lifecycle claim", "payer": "Synthetic payer", "amount": "125.50", "currency": "INR"},
        "pharmacy": {"name": "Lifecycle batch", "batch": "FLOW-1", "quantity": "1e2", "unit": "packs", "expiry": "2099-12-31", "reorder": "5.0"},
        "labs": {**linked, "title": "Lifecycle test", "requested_by": "Dr Flow", "results": "Synthetic result for testing"},
        "ipd": {**linked, "title": "Lifecycle admission", "ward": "Synthetic ward", "bed": "FLOW-1", "admitted_at": "2026-12-11T09:00", "discharge": "Synthetic discharge summary"},
        "inventory": {"name": "Lifecycle stock", "sku": "FLOW-1", "category": "Consumable", "quantity": "25", "reorder": "5", "unit": "boxes"},
        "crm": {"name": "Lifecycle enquiry", "contact": "synthetic@example.test", "marketing_consent": "Not granted"},
        "communications": {**linked, "title": "Lifecycle message", "channel": "Email", "message": "Synthetic draft message"},
        "hr": {"name": "Lifecycle staff", "type": "Attendance", "starts_at": "2026-12-11T09:00", "ends_at": "2026-12-11T17:00"},
        "telemedicine": {**linked, "title": "Lifecycle remote visit", "starts_at": "2026-12-11T09:00", "clinician": "Dr Flow", "meeting_url": "https://example.test/meeting"},
        "templates": {"name": "Lifecycle template", "specialty": "General", "type": "Consultation", "content": "Synthetic template content"},
        "consent": {**linked, "title": "Lifecycle consent", "type": "Treatment consent", "evidence": "Synthetic recorded evidence", "recorded_by": "Dr Flow", "date": "2026-12-11"},
        "locations": {"name": "Lifecycle branch", "address": "Synthetic address", "timezone": "Asia/Kolkata"},
    }


PATHS = {
    "patients": ["Archived", "Active"], "appointments": ["Checked in", "In consultation", "Completed"],
    "emr": ["Reviewed", "Signed"], "treatments": ["Active", "Completed"], "prescriptions": ["Reviewed", "Issued"],
    "billing": ["Issued"], "claims": ["Submitted", "Rejected", "Resubmitted", "Approved", "Reconciled"],
    "pharmacy": ["Quarantined", "Available", "Archived"], "labs": ["Collected", "Resulted", "Reviewed"],
    "ipd": ["Discharged"], "inventory": ["Archived", "Active"], "crm": ["Contacted", "Converted"],
    "communications": ["Ready", "Draft", "Cancelled"], "hr": ["Approved"], "telemedicine": ["Completed"],
    "templates": ["Published", "Archived"], "consent": ["Withdrawn"], "locations": ["Closed", "Active"],
}


@pytest.mark.parametrize("module", list(PATHS))
def test_persisted_module_lifecycle(client, module):
    branch, patient = setup(client)
    response = create(client, module, inputs(patient)[module], branch["id"])
    assert response.status_code == 201, response.text
    record = response.json()
    assert client.get('/api/v1/practice/record/'+record['id']).json() == record
    assert record['id'] in [r['id'] for r in client.get('/api/v1/practice/records/'+module).json()['items']]
    data = {**record['data']}
    # Internal metadata is server-owned and never included in form writes.
    data = {k: v for k, v in data.items() if not k.startswith('_')}
    key = 'name' if 'name' in data else 'title' if 'title' in data else 'reason'
    data[key] += ' updated'
    result = client.put('/api/v1/practice/record/'+record['id'], json={'data':data,'branch_id':record['branch_id'],'version':record['version'],'request_id':str(uuid.uuid4())})
    assert result.status_code == 200, result.text
    record = result.json()
    assert record['title'].endswith(' updated') and record['version'] == 2
    for status in PATHS[module]:
        result = action(client, record, status=status)
        assert result.status_code == 200, result.text
        record = result.json()
        assert record['status'] == status
    # A fresh authentication session sees the same persisted result.
    login(client, 'doctor')
    assert client.get('/api/v1/practice/record/'+record['id']).json() == record
    events = client.get('/api/v1/practice/record/'+record['id']+'/history').json()['items']
    assert len(events) == 2 + len(PATHS[module])
    if module == 'billing':
        assert client.get('/api/v1/practice/finance').json()['currencies'][0]['outstanding_minor'] == 12550


ROLE_EXPECTATIONS = {
    'coordinator': ({'patients','appointments','crm','communications','consent','locations'}, {'patients','appointments','crm','communications','consent'}),
    'clinician': ({'patients','appointments','emr','treatments','prescriptions','pharmacy','labs','ipd','telemedicine','templates','consent','locations'}, {'patients','appointments','emr','treatments','prescriptions','labs','ipd','telemedicine','templates','consent'}),
    'billing': ({'patients','billing','claims','locations'}, {'billing','claims'}),
    'pharmacist': ({'patients','prescriptions','pharmacy','inventory','locations'}, {'pharmacy','inventory'}),
    'laboratory': ({'patients','labs','locations'}, {'labs'}),
    'hr': ({'hr','locations'}, {'hr'}),
}


@pytest.mark.parametrize('role', list(ROLE_EXPECTATIONS))
def test_staff_module_boundaries_apply_to_every_endpoint(client, role):
    branch, patient = setup(client)
    records = {}
    for module, data in inputs(patient).items():
        result = create(client, module, data, branch['id'])
        assert result.status_code == 201, result.text
        records[module] = result.json()
    staff = login(client, 'hospital')
    with client.app.state.store.db() as db:
        db.execute('INSERT INTO practice_members VALUES (?,?,?)', (patient['practice_id'], staff['id'], role))
    params = {'practice_id':patient['practice_id']}
    readable, writable = ROLE_EXPECTATIONS[role]
    boot = client.get('/api/v1/practice/bootstrap',params=params).json()
    assert {m['key'] for m in boot['modules']} == readable
    assert set(boot['permissions']['write']) == writable
    assert boot['permissions']['clinical_sign'] is False  # Global hospital role cannot sign.
    for module, record in records.items():
        expected = 200 if module in readable else 403
        assert client.get('/api/v1/practice/records/'+module, params=params).status_code == expected
        assert client.get('/api/v1/practice/record/'+record['id'], params=params).status_code == expected
        assert client.get('/api/v1/practice/record/'+record['id']+'/history', params=params).status_code == expected
        if module not in writable:
            payload = {'data':inputs(patient)[module],'branch_id':record['branch_id'],'version':record['version'],'request_id':str(uuid.uuid4())}
            assert client.put('/api/v1/practice/record/'+record['id'],params=params,json=payload).status_code == 403
            assert client.post('/api/v1/practice/records/'+module,params=params,json={**payload,'version':0}).status_code == 403
            assert client.post('/api/v1/practice/record/'+record['id']+'/action/status',params=params,json={'version':1,'request_id':str(uuid.uuid4()),'status':PATHS[module][0]}).status_code == 403
    assert client.get('/api/v1/practice/finance',params=params).status_code == (200 if 'billing' in readable else 403)
    summary = client.get('/api/v1/practice/summary',params=params).json()
    assert all(c['module'] in readable for c in summary['counts'])
    restricted_ids = {r['id'] for m,r in records.items() if m not in readable}
    assert not restricted_ids.intersection(e['record_id'] for e in summary['activity'])
    timeline = client.get('/api/v1/practice/patient/'+patient['id']+'/timeline',params=params)
    assert timeline.status_code == (200 if 'patients' in readable else 403)
    if 'patients' in readable:
        assert all(r['module'] in readable for r in timeline.json()['items'])
        exposed = client.get('/api/v1/practice/record/'+records['patients']['id'],params=params).json()['data']
        assert ('history' in exposed) == (role == 'clinician')
        assert ('allergies' in exposed) == (role in ['clinician','pharmacist'])


def test_reception_updates_preserve_hidden_medical_information(client):
    branch, patient = setup(client)
    patient = create(client,'patients',inputs(patient)['patients'],branch['id']).json()
    staff = login(client,'hospital')
    with client.app.state.store.db() as db:
        db.execute('INSERT INTO practice_members VALUES (?,?,?)',(patient['practice_id'],staff['id'],'coordinator'))
    params={'practice_id':patient['practice_id']}
    body={'data':{'name':'Corrected contact name'},'branch_id':branch['id'],'version':1,'request_id':str(uuid.uuid4())}
    result=client.put('/api/v1/practice/record/'+patient['id'],params=params,json=body)
    assert result.status_code==200 and 'history' not in result.json()['data']
    malicious={**body,'version':2,'request_id':str(uuid.uuid4()),'data':{'name':'Patient','history':'Overwritten'}}
    assert client.put('/api/v1/practice/record/'+patient['id'],params=params,json=malicious).status_code==403
    login(client,'doctor')
    data=client.get('/api/v1/practice/record/'+patient['id']).json()['data']
    assert data['history']=='Private medical history' and data['allergies']=='Clinician-reconciled test allergy'


def test_branch_timezone_used_for_other_operational_times(client):
    branch, patient=setup(client)
    branch=create(client,'locations',{'name':'India','address':'Synthetic','timezone':'Asia/Kolkata'}).json()
    for module in ['ipd','hr','telemedicine']:
        record=create(client,module,inputs(patient)[module],branch['id']).json()
        key='admitted_at' if module=='ipd' else 'starts_at'
        assert record['data'][key]=='2026-12-11T03:30:00+00:00'
        assert record['data']['_timezone']=='Asia/Kolkata'
    hr=inputs(patient)['hr']
    assert create(client,'hr',{**hr,'starts_at':'2026-12-11T10:00+02:00','ends_at':'2026-12-11T09:30+01:00'},branch['id']).status_code==201
    assert create(client,'hr',{**hr,'starts_at':'2026-12-11T09:00+01:00','ends_at':'2026-12-11T10:00+03:00'},branch['id']).status_code==422


def test_numeric_stock_is_canonical_before_dispensing(client):
    branch,patient=setup(client)
    stock=create(client,'pharmacy',inputs(patient)['pharmacy'],branch['id']).json()
    assert stock['data']['quantity']=='100' and stock['data']['reorder']=='5'
    result=action(client,stock,'dispense',quantity=1,patient_id=patient['id'])
    assert result.status_code==200 and result.json()['data']['quantity']=='99'


def test_revoked_and_unknown_memberships_fail_closed(client):
    branch,patient=setup(client)
    staff=login(client,'hospital')
    params={'practice_id':patient['practice_id']}
    with client.app.state.store.db() as db:
        db.execute('INSERT INTO practice_members VALUES (?,?,?)',(patient['practice_id'],staff['id'],'unknown-role'))
    assert client.get('/api/v1/practice/bootstrap',params=params).status_code==403
    assert client.get('/api/v1/practice/record/'+patient['id'],params=params).status_code==403
    with client.app.state.store.db() as db:
        db.execute("UPDATE practice_members SET role='coordinator' WHERE user_id=?",(staff['id'],))
    assert client.get('/api/v1/practice/record/'+patient['id'],params=params).status_code==200
    with client.app.state.store.db() as db:
        db.execute('DELETE FROM practice_members WHERE user_id=?',(staff['id'],))
    assert client.get('/api/v1/practice/record/'+patient['id'],params=params).status_code==403
    assert client.get('/api/v1/practice/summary',params=params).status_code==403


def test_practice_ai_is_rate_limited_before_provider_execution(client):
    branch,patient=setup(client)
    calls=[]
    async def provider(messages,**kwargs):
        calls.append(messages)
        return 'Synthetic draft for clinician review'
    client.app.state.providers.ai=provider
    url='/api/v1/practice/patient/'+patient['id']+'/clinical-draft'
    responses=[client.post(url,json={'kind':'Clinical note','consent':True}) for _ in range(21)]
    assert all(r.status_code==200 for r in responses[:20])
    assert responses[-1].status_code==429 and responses[-1].headers['Retry-After']=='60'
    assert len(calls)==20


def test_linked_patient_names_do_not_depend_on_first_registry_page(client):
    branch,patient=setup(client)
    for i in range(26):
        assert create(client,'patients',{'name':f'Other synthetic patient {i}'},branch['id']).status_code==201
    assert patient['id'] not in [r['id'] for r in client.get('/api/v1/practice/records/patients').json()['items']]
    note=create(client,'emr',{'patient_id':patient['id'],'title':'Older registry patient visit'},branch['id']).json()
    page=client.get('/api/v1/practice/records/emr').json()
    assert page['items'][0]['id']==note['id']
    assert page['patient_names']=={patient['id']:patient['title']}
