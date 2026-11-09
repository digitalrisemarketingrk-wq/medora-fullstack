"""Operational views query their full scope instead of the generic first page."""
import asyncio
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from conftest import login
from medora.practice import PracticeRepository, postgrest_literal
from test_practice import create, setup


def insert_records(client, branch, module, values):
    records = []
    stamp = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for index, value in enumerate(values):
        data, status = value if isinstance(value, tuple) else (value, None)
        status = status or {"appointments": "Booked", "telemedicine": "Scheduled", "ipd": "Admitted", "pharmacy": "Available", "inventory": "Active", "patients": "Active", "emr": "Draft"}[module]
        created = (stamp + timedelta(seconds=index)).isoformat()
        record = {"id": str(uuid.uuid4()), "practice_id": branch["practice_id"], "module": module, "branch_id": branch["id"], "title": data.get("name") or data.get("title") or data.get("reason") or "Synthetic record", "status": status, "data": data, "version": 1, "created_at": created, "updated_at": created}
        records.append(record)
    with client.app.state.store.db() as db:
        db.executemany("INSERT INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", [(r["id"], r["practice_id"], r["module"], r["branch_id"], r["title"], r["status"], json.dumps(r["data"]), r["version"], r["created_at"], r["updated_at"]) for r in records])
    return records


def fetch_all(client, module, params):
    pages = []
    while True:
        response = client.get("/api/v1/practice/operations/" + module, params=params)
        assert response.status_code == 200, response.text
        page = response.json()
        pages.append(page)
        assert page["complete"] == (page["next_cursor"] is None)
        if page["complete"]:
            break
        params = {**params, "cursor": page["next_cursor"]}
        assert len(pages) < 30
    return pages


def test_schedule_date_scope_before_pagination_and_more_than_25_records(client):
    branch, patient = setup(client)
    data = {"patient_id": patient["id"], "clinician": "Dr Test", "starts_at": "2026-12-11T09:00:00+00:00", "ends_at": "2026-12-11T09:30:00+00:00", "timezone": "UTC", "reason": "Review", "mode": "In person"}
    wanted = insert_records(client, branch, "appointments", [{**data, "reason": f"December {i}"} for i in range(32)])
    insert_records(client, branch, "appointments", [{**data, "starts_at": "2027-01-11T09:00:00+00:00", "ends_at": "2027-01-11T09:30:00+00:00", "reason": f"January {i}"} for i in range(50)])
    generic = client.get("/api/v1/practice/records/appointments").json()
    assert len(generic["items"]) == 25
    pages = fetch_all(client, "appointments", {"branch_id": branch["id"], "from_date": "2026-12-11", "to_date": "2026-12-11", "limit": 10})
    records = [record for page in pages for record in page["items"]]
    assert len(records) == 32
    assert {r["id"] for r in records} == {r["id"] for r in wanted}
    assert all(page["patient_names"] == {patient["id"]: "Test Patient"} for page in pages)
    assert all(page["timezone"] == "UTC" for page in pages)


def test_schedule_uses_branch_timezone_and_overlap_semantics(client):
    branch, patient = setup(client)
    clinic = create(client, "locations", {"name": "Kolkata", "address": "Synthetic clinic", "timezone": "Asia/Kolkata"}).json()
    data = {"patient_id": patient["id"], "clinician": "Dr Test", "starts_at": "2026-12-11T18:15:00+00:00", "ends_at": "2026-12-11T18:45:00+00:00", "timezone": "Asia/Kolkata", "reason": "Crosses midnight", "mode": "In person"}
    overlap = insert_records(client, clinic, "appointments", [data])[0]
    response = client.get("/api/v1/practice/operations/appointments", params={"branch_id": clinic["id"], "from_date": "2026-12-12", "to_date": "2026-12-12"})
    assert response.status_code == 200, response.text
    assert [r["id"] for r in response.json()["items"]] == [overlap["id"]]
    assert response.json()["timezone"] == "Asia/Kolkata"
    params = {"from_date": "2026-12-12", "to_date": "2026-12-12"}
    assert client.get("/api/v1/practice/operations/appointments", params=params).json()["items"] == []
    tele = insert_records(client, clinic, "telemedicine", [{"patient_id": patient["id"], "clinician": "Dr Test", "starts_at": "2026-12-11T18:45:00+00:00", "title": "Remote review"}])[0]
    assert client.get("/api/v1/practice/operations/telemedicine", params={**params, "branch_id": clinic["id"]}).json()["items"][0]["id"] == tele["id"]


def test_operational_scope_validation_and_staff_permissions(client):
    branch, patient = setup(client)
    base = "/api/v1/practice/operations/"
    assert client.get(base + "patients").status_code == 404
    assert client.get(base + "appointments", params={"from_date": "2026-01-01", "to_date": "2026-02-01"}).status_code == 422
    assert client.get(base + "appointments", params={"from_date": "2026-01-01", "to_date": "2025-12-01"}).status_code == 422
    assert client.get(base + "appointments", params={"cursor": "invalid"}).status_code == 422
    assert client.get(base + "appointments", params={"branch_id": patient["id"]}).status_code == 422
    assert client.get(base + "appointments", params={"branch_id": str(uuid.uuid4())}).status_code == 404
    assert client.get(base + "appointments", params={"limit": 101}).status_code == 422
    staff = login(client, "hospital")
    assert client.get(base + "appointments", params={"practice_id": branch["practice_id"]}).status_code == 403
    with client.app.state.store.db() as db:
        db.execute("INSERT INTO practice_members VALUES (?,?,?)", (branch["practice_id"], staff["id"], "coordinator"))
    params = {"practice_id": branch["practice_id"], "branch_id": branch["id"]}
    assert client.get(base + "appointments", params=params).status_code == 200
    assert client.get(base + "ipd", params=params).status_code == 403
    assert client.get(base + "pharmacy", params=params).status_code == 403
    with client.app.state.store.db() as db:
        db.execute("UPDATE practice_members SET role='pharmacist' WHERE user_id=?", (staff["id"],))
    assert client.get(base + "appointments", params=params).status_code == 403
    assert client.get(base + "pharmacy", params=params).status_code == 200
    login(client)
    assert client.get(base + "appointments").status_code == 403
    client.cookies.clear()
    assert client.get(base + "appointments").status_code == 401


def test_bed_occupancy_ignores_discharged_rows_before_pagination(client):
    branch, patient = setup(client)
    data = {"patient_id": patient["id"], "title": "Admission", "ward": "A", "bed": "1", "admitted_at": "2026-12-11T09:00:00+00:00"}
    active = insert_records(client, branch, "ipd", [{**data, "bed": str(i)} for i in range(32)])
    insert_records(client, branch, "ipd", [({**data, "bed": str(i)}, "Discharged") for i in range(50)])
    pages = fetch_all(client, "ipd", {"branch_id": branch["id"], "limit": 10})
    records = [record for page in pages for record in page["items"]]
    assert {r["id"] for r in records} == {r["id"] for r in active}
    assert all(r["status"] == "Admitted" for r in records)


def test_stock_alerts_bounded_scan_continues_after_empty_page(client):
    branch, _ = setup(client)
    stock = {"name": "Synthetic stock", "sku": "SAMPLE", "category": "Consumable", "quantity": "20", "reorder": "5", "unit": "units"}
    values = [{**stock, "quantity": "0", "name": "Older low stock"}] + [{**stock, "name": f"Healthy {i}"} for i in range(1100)]
    low = insert_records(client, branch, "inventory", values)[0]
    first = client.get("/api/v1/practice/operations/inventory", params={"branch_id": branch["id"]}).json()
    assert first["items"] == []
    assert first["scan_limited"] is True and first["scanned_count"] == 1000
    assert first["complete"] is False and first["next_cursor"]
    second = client.get("/api/v1/practice/operations/inventory", params={"branch_id": branch["id"], "cursor": first["next_cursor"]}).json()
    assert [r["id"] for r in second["items"]] == [low["id"]]
    assert second["complete"] is True
    assert second["alerts"][low["id"]] == {"low_stock": True, "expired": False, "expiring_soon": False}


def test_pharmacy_alerts_include_expiry_and_are_paginated_without_skips(client):
    branch, _ = setup(client)
    today = datetime.now(timezone.utc).date()
    data = {"name": "Synthetic batch", "batch": "DEMO", "quantity": "20", "reorder": "5", "unit": "packs", "expiry": (today + timedelta(days=100)).isoformat()}
    records = insert_records(client, branch, "pharmacy", [
        {**data, "quantity": "1"}, {**data, "expiry": (today - timedelta(days=1)).isoformat()},
        {**data, "expiry": (today + timedelta(days=30)).isoformat()}, data,
        ({**data, "quantity": "0"}, "Quarantined"), ({**data, "quantity": "0"}, "Archived"),
    ])
    pages = fetch_all(client, "pharmacy", {"branch_id": branch["id"], "limit": 1})
    found = [r for page in pages for r in page["items"]]
    assert {r["id"] for r in found} == {r["id"] for r in records[:3]}
    assert len(found) == 3


@pytest.mark.parametrize("instant,zone,clinic_day,allowed", [
    ("2026-10-11T19:00:00+00:00", "Asia/Kolkata", "2026-10-12", False),
    ("2026-10-12T00:30:00+00:00", "America/Los_Angeles", "2026-10-11", True),
])
def test_dispensing_expiry_matches_branch_day_even_when_server_day_differs(client, monkeypatch, instant, zone, clinic_day, allowed):
    _, patient = setup(client)
    branch = create(client, "locations", {"name": "Timezone clinic", "address": "Synthetic clinic", "timezone": zone}).json()
    batch = create(client, "pharmacy", {"name": "Synthetic medicine", "batch": "TZ-001", "quantity": "5", "reorder": "1", "unit": "packs", "expiry": "2026-10-11"}, branch["id"]).json()
    frozen = datetime.fromisoformat(instant)

    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen.astimezone(tz) if tz is not None else frozen.replace(tzinfo=None)

    class ServerDate(date):
        @classmethod
        def today(cls):
            # Reproduce a UTC server clock independently of the clinic's day.
            return frozen.date()

    monkeypatch.setattr("medora.practice.datetime", FixedDatetime)
    monkeypatch.setattr("medora.practice.date", ServerDate)
    page = client.get("/api/v1/practice/operations/pharmacy", params={"branch_id": branch["id"]}).json()
    assert page["as_of"] == clinic_day
    assert page["alerts"][batch["id"]]["expired"] is not allowed
    response = client.post("/api/v1/practice/record/" + batch["id"] + "/action/dispense", json={"version": 1, "request_id": str(uuid.uuid4()), "quantity": 1, "patient_id": patient["id"]})
    assert response.status_code == (200 if allowed else 422), response.text
    saved = client.get("/api/v1/practice/record/" + batch["id"]).json()
    assert saved["data"]["quantity"] == ("4" if allowed else "5")
    assert saved["version"] == (2 if allowed else 1)


def test_patient_search_phone_email_dob_literal_metacharacters(client):
    branch, _ = setup(client)
    patient = create(client, "patients", {"name": "Literal %_* (patient)", "phone": "+91 (555) 9000", "email": "sample+literal@example.test", "dob": "1992-03-14"}, branch["id"]).json()
    for term in ["9000", "+91 (555)", "literal@example", "1992-03", "%_*", "(patient)"]:
        response = client.get("/api/v1/practice/records/patients", params={"q": term, "limit": 1})
        assert response.status_code == 200, response.text
        assert [r["id"] for r in response.json()["items"]] == [patient["id"]]
    assert client.get("/api/v1/practice/records/patients", params={"q": '",id.neq.0),or(title.eq.Test'}).json()["items"] == []


def test_activity_snapshot_filters_before_limit_and_preserves_old_branch(client):
    branch, patient = setup(client)
    other = create(client, "locations", {"name": "Other", "address": "Synthetic clinic", "timezone": "UTC"}).json()
    note = create(client, "emr", {"patient_id": patient["id"], "title": "Branch A note"}, branch["id"]).json()
    client.put("/api/v1/practice/record/" + note["id"], json={"data": note["data"], "branch_id": other["id"], "version": 1, "request_id": str(uuid.uuid4())})
    for index in range(12):
        create(client, "patients", {"name": f"Newer branch B {index}"}, other["id"])
    activity = client.get("/api/v1/practice/summary", params={"branch_id": branch["id"]}).json()["activity"]
    assert any(e["record_id"] == note["id"] and e["action"] == "Created" for e in activity)
    assert not any(e["record_id"] == note["id"] and e["action"] == "Updated" for e in activity)
    staff = login(client, "hospital")
    with client.app.state.store.db() as db:
        db.execute("INSERT INTO practice_members VALUES (?,?,?)", (branch["practice_id"], staff["id"], "coordinator"))
    activity = client.get("/api/v1/practice/summary", params={"branch_id": branch["id"], "practice_id": branch["practice_id"]}).json()["activity"]
    assert all(e["record_id"] != note["id"] for e in activity)
    assert any(e["record_id"] == patient["id"] for e in activity)


def test_supabase_filters_are_scoped_before_limit_and_search_is_quoted():
    calls = []
    async def remote(method, path, **kwargs):
        calls.append((method, path, kwargs))
        return {"counts": [], "activity": [{"record_id": "hidden"}]} if path.startswith("rpc/") else []
    repo = PracticeRepository(SimpleNamespace(s=SimpleNamespace(supabase_enabled=True), remote=remote))
    practice, branch = str(uuid.uuid4()), str(uuid.uuid4())
    cursor = "2026-01-01T00:00:00+00:00|" + str(uuid.uuid4())
    term = '",id.neq.0),or(title.eq.*%_\\'
    asyncio.run(repo.records(practice, "patients", cursor=cursor, query=term))
    params = calls[-1][2]["params"]
    assert params["practice_id"] == "eq." + practice and params["module"] == "eq.patients"
    assert params["limit"] == "26" and params["or"].startswith("(created_at.lt.")
    import re
    literal = postgrest_literal(re.escape(term))
    assert params["and"] == "(or(" + ",".join(f + ".imatch." + literal for f in ["title", "data->>phone", "data->>email", "data->>dob"]) + "))"
    result = asyncio.run(repo.summary(practice, branch, ["patients"]))
    assert result["activity"] == []
    _, path, kwargs = calls[-1]
    assert path == "medora_practice_events"
    assert kwargs["params"]["snapshot->>module"] == "in.(patients)"
    assert kwargs["params"]["snapshot->>branch_id"] == "eq." + branch
    assert kwargs["params"]["limit"] == "8"
    asyncio.run(repo.operational_rows(practice, "appointments", branch, cursor, 10, "2026-12-11T00:00:00+00:00", "2026-12-12T00:00:00+00:00"))
    params = calls[-1][2]["params"]
    assert params["data->>starts_at"] == "lt.2026-12-12T00:00:00+00:00"
    assert params["data->>ends_at"] == "gt.2026-12-11T00:00:00+00:00"
    assert params["branch_id"] == "eq." + branch and params["limit"] == "11"
