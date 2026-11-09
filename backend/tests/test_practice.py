import uuid
from concurrent.futures import ThreadPoolExecutor
from conftest import login


def create(client, module, data, branch=None, key=None):
    return client.post('/api/v1/practice/records/'+module, json={'data':data,'branch_id':branch or str(uuid.uuid4()),'version':0,'request_id':key or str(uuid.uuid4())})


def setup(client):
    login(client,'doctor')
    branch=create(client,'locations',{'name':'Central','address':'Synthetic test clinic','timezone':'UTC'}).json()
    assert 'id' in branch,branch
    patient=create(client,'patients',{'name':'Test Patient'},branch['id']).json()
    assert 'id' in patient,patient
    return branch,patient


def action(client,record,command='status',**values):
    return client.post('/api/v1/practice/record/'+record['id']+'/action/'+command,json={'version':record['version'],'request_id':str(uuid.uuid4()),**values})


def test_professional_access_and_cross_practice_isolation(client):
    assert client.get('/api/v1/practice/bootstrap').status_code==401
    login(client)
    assert client.get('/api/v1/practice/bootstrap').status_code==403
    branch,patient=setup(client)
    login(client,'hospital')
    assert client.get('/api/v1/practice/record/'+patient['id']).status_code==404
    assert client.get('/api/v1/practice/bootstrap',params={'practice_id':patient['practice_id']}).status_code==403
    assert create(client,'emr',{'patient_id':patient['id'],'title':'Unauthorized'},branch['id']).status_code==422


def test_create_idempotency_version_conflict_and_audit(client):
    branch,patient=setup(client)
    key=str(uuid.uuid4())
    first=create(client,'patients',{'name':'Idempotent'},branch['id'],key)
    second=create(client,'patients',{'name':'Idempotent'},branch['id'],key)
    assert first.status_code==second.status_code==201
    assert first.json()==second.json()
    changed=create(client,'patients',{'name':'Different'},branch['id'],key)
    assert changed.status_code==409
    assert create(client,'invalid',{'name':'Idempotent'},branch['id'],key).status_code==404
    assert create(client,'templates',{'name':'Idempotent'},branch['id'],key).status_code==409
    body={'data':{'name':'Updated'},'branch_id':branch['id'],'version':patient['version'],'request_id':str(uuid.uuid4())}
    assert client.put('/api/v1/practice/record/'+patient['id'],json=body).status_code==200
    body['request_id']=str(uuid.uuid4())
    assert client.put('/api/v1/practice/record/'+patient['id'],json=body).status_code==409
    assert client.get('/api/v1/practice/summary').json()['activity']


def test_invoice_payment_is_bounded_and_retry_safe(client):
    branch,patient=setup(client)
    invoice=create(client,'billing',{'patient_id':patient['id'],'title':'Consultation','amount':'100.00','currency':'INR'},branch['id']).json()
    invoice=action(client,invoice,status='Issued').json()
    body={'version':invoice['version'],'request_id':str(uuid.uuid4()),'amount':'40.00'}
    response=client.post('/api/v1/practice/record/'+invoice['id']+'/action/pay',json=body)
    assert response.status_code==200,response.text
    assert response.json()['status']=='Part-paid'
    assert client.post('/api/v1/practice/record/'+invoice['id']+'/action/pay',json=body).json()==response.json()
    assert action(client,response.json(),'pay',amount='61').status_code==422
    final_body={'version':response.json()['version'],'request_id':str(uuid.uuid4()),'amount':'60'}
    final=client.post('/api/v1/practice/record/'+invoice['id']+'/action/pay',json=final_body)
    paid=final.json()
    assert paid['status']=='Paid' and paid['data']['_paid_minor']=='10000'
    assert client.post('/api/v1/practice/record/'+invoice['id']+'/action/pay',json=final_body).json()==paid
    assert action(client,paid,status='Void').status_code==422


def test_dispensing_never_allows_negative_or_expired_stock(client):
    branch,patient=setup(client)
    stock=create(client,'pharmacy',{'name':'Test batch','batch':'B1','quantity':'5','unit':'packs','expiry':'2099-01-01','reorder':'2'},branch['id']).json()
    assert action(client,stock,'dispense',quantity=6,patient_id=patient['id']).status_code==422
    result=action(client,stock,'dispense',quantity=3,patient_id=patient['id'])
    assert result.status_code==200,result.text
    assert result.json()['data']['quantity']=='2'
    assert action(client,stock,'dispense',quantity=3,patient_id=patient['id']).status_code==409
    expired=create(client,'pharmacy',{'name':'Expired','batch':'B2','quantity':'5','unit':'packs','expiry':'2000-01-01','reorder':'2'},branch['id']).json()
    assert action(client,expired,'dispense',quantity=1,patient_id=patient['id']).status_code==422


def test_occupied_bed_transfer_and_discharge_validation(client):
    branch,patient=setup(client)
    data={'patient_id':patient['id'],'title':'Admission','ward':'Ward A','bed':'A1','admitted_at':'2026-10-10T09:00'}
    admission=create(client,'ipd',data,branch['id']).json()
    assert 'id' in admission,admission
    assert create(client,'ipd',data,branch['id']).status_code==409
    assert action(client,admission,status='Discharged').status_code==422
    transferred=action(client,admission,'transfer',ward='Ward B',bed='B1')
    assert transferred.status_code==200,transferred.text
    assert transferred.json()['data']['bed']=='B1'
    assert create(client,'ipd',data,branch['id']).status_code==201


def test_signed_notes_are_immutable_and_hospital_cannot_sign(client):
    branch,patient=setup(client)
    note=create(client,'emr',{'patient_id':patient['id'],'title':'Encounter'},branch['id']).json()
    assert action(client,note,status='Signed').status_code==422
    reviewed=action(client,note,status='Reviewed').json()
    signed=action(client,reviewed,status='Signed').json()
    body={'data':{'patient_id':patient['id'],'title':'Changed'},'branch_id':branch['id'],'version':signed['version'],'request_id':str(uuid.uuid4())}
    assert client.put('/api/v1/practice/record/'+signed['id'],json=body).status_code==409
    login(client,'hospital')
    branch=create(client,'locations',{'name':'Hospital','address':'Test','timezone':'UTC'}).json()
    patient=create(client,'patients',{'name':'Another Patient'},branch['id']).json()
    note=create(client,'emr',{'patient_id':patient['id'],'title':'Nursing record'},branch['id']).json()
    reviewed=action(client,note,status='Reviewed').json()
    assert action(client,reviewed,status='Signed').status_code==403


def test_appointment_overlap_and_cancellation_releases_slot(client):
    branch,patient=setup(client)
    data={'patient_id':patient['id'],'clinician':'Dr Test','starts_at':'2026-10-11T09:00','ends_at':'2026-10-11T09:30','timezone':'UTC','reason':'Review','mode':'In person'}
    first=create(client,'appointments',data,branch['id'])
    assert first.status_code==201,first.text
    assert create(client,'appointments',{**data,'starts_at':'2026-10-11T09:15','ends_at':'2026-10-11T09:45'},branch['id']).status_code==409
    assert action(client,first.json(),status='Cancelled').status_code==200
    assert create(client,'appointments',data,branch['id']).status_code==201


def test_unknown_fields_references_and_pagination_are_validated(client):
    branch,patient=setup(client)
    assert create(client,'patients',{'name':'Test','role':'doctor'},branch['id']).status_code==422
    assert create(client,'patients',{'name':'Test','dob':'2099-01-01'},branch['id']).status_code==422
    assert create(client,'emr',{'patient_id':str(uuid.uuid4()),'title':'Missing'},branch['id']).status_code==422
    assert client.get('/api/v1/practice/records/patients?limit=1000').status_code==422
    assert client.get('/api/v1/practice/records/patients?cursor=garbage').status_code==422
    for n in range(3):
        assert create(client,'patients',{'name':f'Patient {n}'},branch['id']).status_code==201
    page=client.get('/api/v1/practice/records/patients?limit=2').json()
    second=client.get('/api/v1/practice/records/patients',params={'limit':2,'cursor':page['next_cursor']}).json()
    assert len(page['items'])==len(second['items'])==2
    assert not {r['id'] for r in page['items']} & {r['id'] for r in second['items']}


def test_qr_issuance_scope_and_expiry_are_enforced(client):
    patient=login(client)
    assert client.post('/api/v1/qr-pass/generate',json={'patient_email':'someone@example.com'}).status_code==422
    assert client.post('/api/v1/qr-pass/generate',json={'access_type':'lifetime'}).status_code==422
    token=client.post('/api/v1/qr-pass/generate',json={'access_type':'temporary'}).json()['token']
    doctor=login(client,'doctor')
    assert client.post('/api/v1/qr-pass/generate',json={}).status_code==403
    assert client.post('/api/v1/qr-pass/intake',json={'token':token,'consent':True,'access_type':'lifetime'}).status_code==422
    intake=client.post('/api/v1/qr-pass/intake',json={'token':token,'consent':True})
    assert intake.status_code==200,intake.text
    ws=client.get('/api/v1/workspace',params={'owner_id':patient['id']}).json()
    assert ws['can_write'] is False
    with client.app.state.store.db() as db:
        db.execute('UPDATE grants SET expires_at=1 WHERE owner_id=? AND recipient_id=?',(patient['id'],doctor['id']))
    assert client.get('/api/v1/workspace',params={'owner_id':patient['id']}).status_code==403


def test_revoked_qr_pass_cannot_be_replayed_by_same_recipient(client):
    patient=login(client)
    token=client.post('/api/v1/qr-pass/generate',json={'access_type':'temporary'}).json()['token']
    doctor=login(client,'doctor')
    assert client.post('/api/v1/qr-pass/intake',json={'token':token,'consent':True}).status_code==200
    login(client)
    assert client.delete('/api/v1/access/'+doctor['id']).status_code==200
    login(client,'doctor')
    assert client.post('/api/v1/qr-pass/intake',json={'token':token,'consent':True}).status_code==403


def test_patient_history_finance_and_audit_are_practice_scoped(client):
    branch,patient=setup(client)
    note=create(client,'emr',{'patient_id':patient['id'],'title':'Test encounter','history':'Sensitive detail'},branch['id']).json()
    invoice=create(client,'billing',{'patient_id':patient['id'],'title':'Consultation','amount':'12.34','currency':'INR'},branch['id']).json()
    invoice=action(client,invoice,status='Issued').json()
    action(client,invoice,'pay',amount='2.34')
    totals=client.get('/api/v1/practice/finance').json()['currencies']
    assert totals==[{'currency':'INR','billed_minor':1234,'received_minor':234,'outstanding_minor':1000}]
    assert client.get('/api/v1/practice/finance',params={'branch_id':str(uuid.uuid4())}).json()['currencies']==[]
    timeline=client.get('/api/v1/practice/patient/'+patient['id']+'/timeline').json()['items']
    assert {r['id'] for r in timeline}=={note['id'],invoice['id']}
    history=client.get('/api/v1/practice/record/'+note['id']+'/history')
    assert history.status_code==200 and history.json()['items'][0]['actor_id']==patient['practice_id']
    assert 'Sensitive detail' not in history.text
    login(client,'hospital')
    assert client.get('/api/v1/practice/patient/'+patient['id']+'/timeline').status_code==404
    assert client.get('/api/v1/practice/record/'+note['id']+'/history').status_code==404


def test_concurrent_booking_only_reserves_one_slot(client):
    branch,patient=setup(client)
    data={'patient_id':patient['id'],'clinician':'Dr Concurrent','starts_at':'2026-10-11T09:00','ends_at':'2026-10-11T09:30','timezone':'UTC','reason':'Review','mode':'In person'}
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:create(client,'appointments',data,branch['id']).status_code,range(2)))
    assert sorted(results)==[201,409]


def test_dst_invalid_and_ambiguous_appointments_are_rejected(client):
    branch,patient=setup(client)
    data={'patient_id':patient['id'],'clinician':'Dr DST','starts_at':'2026-03-08T02:15','ends_at':'2026-03-08T03:15','timezone':'America/New_York','reason':'Review','mode':'In person'}
    assert create(client,'appointments',data,branch['id']).status_code==422
    assert create(client,'appointments',{**data,'starts_at':'2026-11-01T01:15','ends_at':'2026-11-01T02:15'},branch['id']).status_code==422


def test_shared_practice_requires_admin_membership_and_clinical_permission(client):
    branch,patient=setup(client)
    note=create(client,'emr',{'patient_id':patient['id'],'title':'Shared encounter'},branch['id']).json()
    reviewed=action(client,note,status='Reviewed').json()
    coordinator=login(client,'hospital')
    with client.app.state.store.db() as db:
        db.execute('INSERT INTO practice_members VALUES (?,?,?)',(patient['practice_id'],coordinator['id'],'coordinator'))
    bootstrap=client.get('/api/v1/practice/bootstrap',params={'practice_id':patient['practice_id']})
    assert bootstrap.status_code==200 and bootstrap.json()['permissions']['clinical_sign'] is False
    assert len(bootstrap.json()['practices'])==2
    assert client.get('/api/v1/practice/record/'+note['id'],params={'practice_id':patient['practice_id']}).status_code==403
    assert client.post('/api/v1/practice/record/'+note['id']+'/action/status',params={'practice_id':patient['practice_id']},json={'version':reviewed['version'],'request_id':str(uuid.uuid4()),'status':'Signed'}).status_code==403


def test_ai_drafts_require_clinician_consent_and_never_auto_save(client):
    branch,patient=setup(client)
    data={**patient['data'],'phone':'Private contact','email':'private@example.test','history':'Recorded test history'}
    patient=client.put('/api/v1/practice/record/'+patient['id'],json={'data':data,'branch_id':branch['id'],'version':patient['version'],'request_id':str(uuid.uuid4())}).json()
    note=create(client,'emr',{'patient_id':patient['id'],'title':'Recorded encounter','plan':'Recorded plan'},branch['id']).json()
    url='/api/v1/practice/patient/'+patient['id']+'/clinical-draft'
    assert client.post(url,json={'kind':'Clinical note','consent':False}).status_code==403
    assert client.post(url,json={'kind':'Clinical note','consent':True}).status_code==503
    async def fake_ai(messages,**kwargs):
        assert 'Recorded test history' in messages[1]['content']
        assert 'Private contact' not in messages[1]['content'] and 'private@example.test' not in messages[1]['content']
        return 'Draft for clinician review. Missing information must be confirmed.'
    client.app.state.providers.ai=fake_ai
    result=client.post(url,json={'kind':'Treatment plan','consent':True})
    assert result.status_code==200 and result.json()['requires_review'] is True
    assert result.json()['source_record_ids']==[note['id']]
    assert len(client.get('/api/v1/practice/records/emr').json()['items'])==1
    login(client,'hospital')
    assert client.post(url,params={'practice_id':patient['practice_id']},json={'kind':'Clinical note','consent':True}).status_code==403
