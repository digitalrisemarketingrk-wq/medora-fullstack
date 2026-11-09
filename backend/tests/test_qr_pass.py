from conftest import login


def test_temporary_qr_intake_stays_read_only_and_does_not_copy_history(client):
    patient = login(client, 'patient')
    generated = client.post('/api/v1/qr-pass/generate', json={'access_type': 'temporary'})
    assert generated.status_code == 200
    token = generated.json()['token']
    assert client.post('/api/v1/qr-pass/generate', json={'access_type': 'lifetime'}).status_code == 422
    doctor = login(client, 'doctor')
    preview = client.get('/api/v1/qr-pass/preview', params={'token': token})
    assert preview.status_code == 200 and preview.json()['patient_name'] == patient['name']
    intake = client.post('/api/v1/qr-pass/intake', json={'token': token, 'consent_confirmed': True, 'reason': 'Test consultation'})
    assert intake.status_code == 200 and intake.json()['grant_scope'] == 'read'
    own = client.get('/api/v1/workspace').json()
    assert own['data']['patients'] == [] and own['data']['notes'] == []
    shared = client.get('/api/v1/workspace', params={'owner_id': patient['id']})
    assert shared.status_code == 200 and shared.json()['can_write'] is False
    login(client, 'patient')
    for confirmation, consent in [('WRONG', True), ('DISCONNECT', False)]:
        assert client.post('/api/v1/patient/disconnect-doctor', json={'doctor_id': doctor['id'], 'reason': 'Completed care', 'confirmation': confirmation, 'consent': consent}).status_code == 400
    disconnected = client.post('/api/v1/patient/disconnect-doctor', json={'doctor_id': doctor['id'], 'reason': 'Completed care', 'confirmation': 'DISCONNECT', 'consent': True})
    assert disconnected.status_code == 200
    login(client, 'doctor')
    assert client.get('/api/v1/workspace', params={'owner_id': patient['id']}).status_code == 403
    assert client.post('/api/v1/qr-pass/intake', json={'token': token, 'consent': True}).status_code == 403
    assert client.post('/api/v1/doctor/patients/clear-inactive').status_code == 200
    assert client.delete('/api/v1/doctor/patients/'+patient['id']).status_code == 200
