"""Add labeled synthetic data to existing sample accounts; never overwrite records.

Run from backend: .venv/Scripts/python.exe seed_live_data.py
Use --documents-only while the practice SQL migration is awaiting installation.
"""
import argparse
import asyncio
import json
import uuid
from datetime import date, timedelta

import httpx
from fastapi import HTTPException

from medora.config import Settings
from medora.practice import PracticeRepository, normalize_times, now
from medora.practice_catalog import MODULES, validate_record
from medora.providers import Providers, supabase_headers
from medora.store import Store


PREFIX = "SYNTHETIC SAMPLE"


def key(practice, label):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"medora-live-sample-v1:{practice}:{label}"))


def sample_records(practice):
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    expiry = (date.today() + timedelta(days=365)).isoformat()
    patient = key(practice, "patients")
    linked = {"patient_id": patient}
    return [
        ("locations", {"name": f"{PREFIX} · Central clinic", "address": "Fictional training clinic, no real address", "timezone": "Asia/Kolkata", "hours": "Mon–Fri 09:00–17:00"}),
        ("patients", {"name": f"{PREFIX} · Aarav Shah", "dob": "1994-04-12", "email": "aarav@example.test", "history": "Fictional training record. No real patient or medical history.", "allergies": "Synthetic scenario: allergy reconciliation pending."}),
        ("appointments", {**linked, "clinician": "Sample clinician", "starts_at": tomorrow + "T10:00", "ends_at": tomorrow + "T10:30", "timezone": "Asia/Kolkata", "reason": f"{PREFIX} · Follow-up", "mode": "In person"}),
        ("emr", {**linked, "title": f"{PREFIX} · Initial assessment", "observations": "Fictional training scenario; no observations recorded.", "assessment": "Draft for workflow testing only.", "plan": "Review with an authorized clinician."}),
        ("treatments", {**linked, "title": f"{PREFIX} · Follow-up plan", "goals": "Demonstrate planning and review workflows.", "review_date": tomorrow}),
        ("prescriptions", {**linked, "title": f"{PREFIX} · Prescription draft", "medications": "No medication prescribed. Training draft only.", "allergy_review": "Reconciliation pending; fictional patient."}),
        ("billing", {**linked, "title": f"{PREFIX} · Consultation invoice", "amount": "850.00", "currency": "INR", "due_date": tomorrow, "notes": "Fictional draft invoice. No actual payment."}),
        ("claims", {**linked, "title": f"{PREFIX} · Claim draft", "payer": "Fictional insurer", "policy": "SAMPLE-POLICY-001", "amount": "850.00", "currency": "INR", "coding": "Not coded; training draft only."}),
        ("pharmacy", {"name": f"{PREFIX} · Training stock (not for dispensing)", "batch": "SAMPLE-BATCH-001", "quantity": "40", "unit": "training packs", "expiry": expiry, "reorder": "10", "supplier": "Fictional supplier"}),
        ("labs", {**linked, "title": f"{PREFIX} · Laboratory order", "requested_by": "Sample clinician", "specimen": "Not collected; training scenario", "report_reference": "SAMPLE-LAB-001"}),
        ("ipd", {**linked, "title": f"{PREFIX} · Training admission", "ward": "Sample ward", "bed": "SAMPLE-01", "admitted_at": tomorrow + "T09:00", "nursing_notes": "Fictional admission for workflow testing."}),
        ("inventory", {"name": f"{PREFIX} · Training consumables", "sku": "SAMPLE-SKU-001", "category": "Consumable", "quantity": "120", "reorder": "25", "unit": "pieces", "notes": "Fictional stock."}),
        ("crm", {"name": f"{PREFIX} · Follow-up enquiry", "contact": "enquiry@example.test", "source": "Training", "follow_up": tomorrow, "marketing_consent": "Not granted"}),
        ("communications", {**linked, "title": f"{PREFIX} · Reminder draft", "channel": "Email", "message": "Fictional appointment reminder. No message will be sent.", "scheduled_at": tomorrow + "T08:00"}),
        ("hr", {"name": f"{PREFIX} · Staff attendance", "type": "Attendance", "starts_at": tomorrow + "T09:00", "ends_at": tomorrow + "T17:00", "notes": "Fictional staff record; not verified attendance."}),
        ("telemedicine", {**linked, "title": f"{PREFIX} · Remote review", "starts_at": tomorrow + "T14:00", "clinician": "Sample clinician", "notes": "Training schedule only; no video service provisioned."}),
        ("templates", {"name": f"{PREFIX} · Consultation template", "specialty": "General practice", "type": "Consultation", "content": "Presenting concern:\nHistory:\nObservations:\nAssessment:\nPlan:\nClinician review:"}),
        ("consent", {**linked, "title": f"{PREFIX} · Feedback", "type": "Feedback", "evidence": "Fictional training feedback. Does not grant care or data-sharing access.", "recorded_by": "Sample staff", "date": date.today().isoformat()}),
    ]


async def seed_practice(store, profile):
    repo = PracticeRepository(store)
    created = skipped = 0
    branch = key(profile.id, "locations")
    for module, values in sample_records(profile.id):
        record_id = key(profile.id, module)
        try:
            await repo.get(profile.id, record_id)
            skipped += 1
            continue
        except HTTPException as error:
            if error.status_code != 404:
                raise
        data = normalize_times(module, validate_record(module, values), "Asia/Kolkata")
        stamp = now()
        record = {"id": record_id, "practice_id": profile.id, "module": module,
                  "branch_id": branch, "title": data.get("name") or data.get("title") or data.get("reason"),
                  "status": MODULES[module]["statuses"][0], "data": data,
                  "version": 0, "created_at": stamp, "updated_at": stamp}
        await repo.commit(profile, profile.id, record, 0, key(profile.id, module + ":create"),
                          "Created", {"source": "synthetic-sample-v1", "module": module})
        created += 1
    return {"created": created, "existing_preserved": skipped}


async def seed_document(store, providers):
    profile = await store.profile_by_email("patient@medora.demo")
    doc_id = key(profile.id, "training-document")
    ws = await store.workspace(profile.id)
    doc = next((d for d in ws["data"]["documents"] if d["id"] == doc_id), None)
    text = "SYNTHETIC SAMPLE — not a real patient record. Training care review: appointment follow-up, allergy reconciliation, and preparation of a visit agenda. No diagnosis, medication, or clinical advice is provided."
    path = f"{profile.id}/{doc_id}.txt"
    if doc is None:
        # A prior interrupted attempt may have uploaded the same immutable file.
        response = await store.client.get(providers.object_url(path), headers=supabase_headers(store.s.supabase_secret_key.get_secret_value()))
        missing = response.status_code == 404
        if response.is_error:
            try:
                missing = missing or str(response.json().get("statusCode")) == "404"
            except ValueError:
                pass
        if missing:
            await providers.upload(path, text.encode("utf-8"), "text/plain")
        elif response.is_error:
            raise HTTPException(503, "Sample storage preflight failed")
        elif response.content != text.encode("utf-8"):
            raise HTTPException(409, "Existing sample file differs; preserved without replacement")
        doc = {"id": doc_id, "name": "SYNTHETIC SAMPLE - care review.txt", "type": "Training sample",
               "date": date.today().isoformat(), "size": "1 KB", "summary": text,
               "storagePath": path, "mime": "text/plain", "analysisStatus": "pending", "indexed": False,
               "extractedText": text, "findings": [], "glossary": []}
        ws["data"]["documents"].append(doc)
        await store.save(profile.id, ws["data"], ws["version"])
    # Only our immutable synthetic document is indexed; other records are untouched.
    chunks = await providers.index(profile.id, doc_id, text)
    matches = await providers.search(profile.id, "training appointment follow-up", [doc_id])
    if not matches or any(m["document_id"] != doc_id or m["owner_id"] != profile.id for m in matches):
        raise HTTPException(503, "Scoped Qdrant retrieval verification failed")
    ws = await store.workspace(profile.id)
    target = next(d for d in ws["data"]["documents"] if d["id"] == doc_id)
    target["indexed"] = True
    await store.save(profile.id, ws["data"], ws["version"])
    if await providers.read(path) != text.encode("utf-8"):
        raise HTTPException(503, "Supabase file readback verification failed")
    return {"document_saved": True, "indexed_chunks": chunks, "scoped_search_matches": len(matches)}


async def main(documents_only=False):
    settings = Settings()
    if not settings.supabase_enabled or not settings.rag_enabled:
        raise SystemExit("Supabase and Qdrant must both be configured; local fallback is prohibited.")
    async with httpx.AsyncClient(timeout=60) as client:
        store, providers = Store(settings, client), Providers(settings, client)
        report = {}
        if not documents_only:
            # Preflight before any practice writes. Service key cannot create SQL tables.
            await store.remote("GET", "medora_practice_records", params={"select": "id", "limit": "1"})
            for role in ["doctor", "hospital"]:
                profile = await store.profile_by_email(role + "@medora.demo")
                if profile.role != role:
                    raise SystemExit("Sample account role mismatch; no privileges will be changed.")
                report[role + "_practice"] = await seed_practice(store, profile)
        report["patient_document"] = await seed_document(store, providers)
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--documents-only", action="store_true")
    args = parser.parse_args()
    try:
        asyncio.run(main(args.documents_only))
    except HTTPException as error:
        raise SystemExit(f"Import stopped ({error.status_code}): {error.detail}") from None
