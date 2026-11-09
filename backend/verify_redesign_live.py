"""Read-only verification of the local live server; prints no patient data."""
import json
from datetime import datetime

import httpx


def main():
    results = {}
    with httpx.Client(base_url='http://localhost:8000/api/v1', headers={'Origin': 'http://localhost:5173'}, timeout=30) as client:
        login = client.post('/auth/login', json={'email': 'hospital@medora.demo', 'password': 'Medora123!'})
        assert login.status_code == 200, 'Training-account login failed'
        bootstrap = client.get('/practice/bootstrap')
        assert bootstrap.status_code == 200
        practice = bootstrap.json()['practice_id']
        patients = client.get('/practice/records/patients', params={'practice_id': practice})
        assert patients.status_code == 200
        patient = next(row for row in patients.json()['items'] if row['title'].startswith('SYNTHETIC SAMPLE'))
        search = client.get('/practice/records/patients', params={'practice_id': practice, 'q': patient['data']['dob']})
        assert search.status_code == 200 and patient['id'] in [row['id'] for row in search.json()['items']]
        results['patient_search_by_birth_date'] = 'passed'
        for module in ['appointments', 'telemedicine', 'ipd', 'pharmacy', 'inventory']:
            query = {'practice_id': practice, 'branch_id': patient['branch_id'], 'limit': 100}
            response = client.get('/practice/operations/' + module, params=query)
            assert response.status_code == 200, module + ' operational query failed'
            page = response.json()
            if module in ['appointments', 'telemedicine']:
                assert page['from_date'] == page['to_date'] == page['as_of'], 'Default clinic day must use the server branch timezone'
            assert page['complete'] == (page['next_cursor'] is None)
            assert all(row['branch_id'] == patient['branch_id'] for row in page['items'])
            results[module] = {'status': response.status_code, 'retrieved': len(page['items']), 'complete': page['complete']}
        records = client.get('/practice/records/emr', params={'practice_id': practice}).json()['items']
        sample = next(row for row in records if row['title'].startswith('SYNTHETIC SAMPLE'))
        assert sample['version'] >= 3 and 'redesigned clinical worksheet save verified' in sample['data']['plan']
        results['browser_saved_encounter_readback'] = 'passed'
        appointments = client.get('/practice/records/appointments', params={'practice_id': practice}).json()['items']
        booking = next(row for row in appointments if row['title'] == 'SYNTHETIC SAMPLE · UX follow-up booking')
        assert booking['data']['patient_id'] == patient['id'] and booking['branch_id'] == patient['branch_id']
        assert (datetime.fromisoformat(booking['data']['ends_at']) - datetime.fromisoformat(booking['data']['starts_at'])).total_seconds() == 45 * 60
        results['browser_saved_booking_readback'] = 'passed'
        literal = client.get('/practice/records/patients', params={'practice_id': practice, 'q': '),or(title.eq.anything)'})
        assert literal.status_code == 200 and not literal.json()['items']
        results['literal_search_input'] = 'passed'
    with httpx.Client(base_url='http://localhost:8000/api/v1', timeout=30) as anonymous:
        response = anonymous.get('/practice/operations/ipd')
        assert response.status_code == 401
        results['anonymous_operations_denied'] = 'passed'
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    main()
