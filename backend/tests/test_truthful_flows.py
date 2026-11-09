"""Failure-path coverage: no fabricated clinical results or access-revocation success."""
import copy

import pytest
from fastapi import HTTPException

from conftest import login
from medora.models import ConsultationSessionRequest, PrescriptionRecommendationRequest


CLINICAL_REQUESTS = [
    ("soap-notes", {"transcript": "Patient: I want to discuss my cough."}),
    ("prescription-recommendations", {"query": "Discuss the cough; no regimen has been selected."}),
    ("consultation-session-insights", {"transcript": "Patient: There is a level change; no medicines discussed."}),
]


@pytest.mark.parametrize("route,body", CLINICAL_REQUESTS)
def test_clinical_provider_outage_does_not_return_or_persist_invented_care(client, monkeypatch, route, body):
    login(client, "doctor")
    before = client.get("/api/v1/workspace").json()
    original = copy.deepcopy(body)

    async def unavailable(*args, **kwargs):
        raise HTTPException(503, "provider request failed with private credentials")

    monkeypatch.setattr(client.app.state.providers, "ai", unavailable)
    response = client.post("/api/v1/ai/" + route, json=body)
    assert response.status_code == 503
    assert "private credentials" not in response.text
    assert not any(key in response.json() for key in ["plan", "recommendations", "suggested_medications", "identified_issues"])
    assert client.get("/api/v1/workspace").json() == before
    assert body == original


@pytest.mark.parametrize("route,body", CLINICAL_REQUESTS)
@pytest.mark.parametrize("malformed", [{"summary": "Incomplete provider result"}, "not valid JSON", []])
def test_malformed_provider_output_is_unavailable_instead_of_a_clinical_draft(client, monkeypatch, route, body, malformed):
    login(client, "doctor")

    async def invalid(*args, **kwargs):
        return malformed

    monkeypatch.setattr(client.app.state.providers, "ai", invalid)
    response = client.post("/api/v1/ai/" + route, json=body)
    assert response.status_code == 503
    assert set(response.json()) == {"detail"}


@pytest.mark.parametrize("medicines", [[], [{"name": "Synthetic drug"}]])
def test_medication_safety_needs_validated_knowledge_and_never_claims_safe(client, monkeypatch, medicines):
    login(client)

    async def provider_must_not_substitute_for_validated_knowledge(*args, **kwargs):
        raise AssertionError("An LLM cannot replace a validated medication safety service")

    monkeypatch.setattr(client.app.state.providers, "ai", provider_must_not_substitute_for_validated_knowledge)
    response = client.post("/api/v1/ai/medication-safety", json={"medicines": medicines, "allergies": []})
    assert response.status_code == 503
    assert "validated drug knowledge source" in response.json()["detail"]
    assert "overall_risk" not in response.json()


def test_patient_age_omission_is_unknown_not_a_fabricated_default():
    assert PrescriptionRecommendationRequest(query="Review recorded medication").patient_age is None
    assert ConsultationSessionRequest(transcript="Patient: Hello.").patient_age is None
    assert ConsultationSessionRequest(transcript="Infant review", patient_age=0).patient_age == 0


def test_session_preserves_unknown_age_allergies_and_ambiguous_transcript(client, monkeypatch):
    login(client, "doctor")
    calls = []

    async def valid(messages, **kwargs):
        calls.append(messages)
        return {"clean_transcript": "Patient: There is a level change.", "summary": "Patient reported a level change; clarification required.",
                "identified_issues": [], "suggested_medications": [], "investigations": [], "lifestyle_advice": []}

    monkeypatch.setattr(client.app.state.providers, "ai", valid)
    response = client.post("/api/v1/ai/consultation-session-insights", json={"transcript": "Patient: There is a level change."})
    assert response.status_code == 200
    result = response.json()
    assert result["suggested_medications"] == [] and result["identified_issues"] == []
    assert result["requires_review"] is True and result["safety_verification"] == "unverified"
    prompt = calls[0][1]["content"]
    assert "Age: Unknown; not provided" in prompt
    assert "Unknown; allergy history has not been reconciled" in prompt
    assert "45 years" not in prompt and "No known drug allergies" not in prompt
    assert "never recover a drug" in prompt.lower()


def test_chat_does_not_infer_allergy_from_a_keyword_even_in_a_negated_note(client, monkeypatch):
    patient = login(client)
    with client.app.state.store.db() as db:
        import json
        current = db.execute("SELECT data FROM workspaces WHERE owner_id=?", (patient["id"],)).fetchone()
        data = json.loads(current["data"])
        data["notes"].append({"id": "negative-allergy-note", "title": "Patient denies penicillin allergy", "body": "Not a reconciled allergy entry"})
        db.execute("UPDATE workspaces SET data=? WHERE owner_id=?", (json.dumps(data), patient["id"]))
    calls = []

    async def valid(messages, **kwargs):
        calls.append(messages)
        return "Please confirm the allergy history with your clinician."

    monkeypatch.setattr(client.app.state.providers, "ai", valid)
    assert client.post("/api/v1/ai/chat", json={"message": "What allergies are recorded?"}).status_code == 200
    context = calls[0][0]["content"]
    assert "Unknown; no structured, verified allergy history" in context
    assert "Penicillin (Moderate" not in context and "No known drug allergies" not in context


def test_qr_preview_marks_unverified_allergy_history_as_unknown(client):
    login(client)
    token = client.post("/api/v1/qr-pass/generate", json={}).json()["token"]
    login(client, "doctor")
    result = client.get("/api/v1/qr-pass/preview", params={"token": token}).json()
    assert result["allergies_count"] is None
    assert result["allergy_status"] == "unknown"


def test_revoke_failure_does_not_mutate_display_or_claim_success(client, monkeypatch):
    doctor = login(client, "doctor")
    patient = login(client)
    assert client.post("/api/v1/access", json={"recipient_email": doctor["email"]}).status_code == 200
    before = client.get("/api/v1/workspace").json()
    calls = []

    async def unavailable(owner, recipient):
        calls.append((owner, recipient))
        raise HTTPException(503, "Access revocation service is unavailable")

    monkeypatch.setattr(client.app.state.store, "revoke", unavailable)
    response = client.post("/api/v1/patient/disconnect-doctor", json={"doctor_id": doctor["id"], "confirmation": "DISCONNECT", "consent": True})
    assert response.status_code == 503 and "ok" not in response.json()
    assert calls == [(patient["id"], doctor["id"])]
    assert client.get("/api/v1/workspace").json() == before
    login(client, "doctor")
    assert client.get("/api/v1/workspace", params={"owner_id": patient["id"]}).status_code == 200


@pytest.mark.parametrize("alias", ["doc_sarah_khan", "Sarah Khan", "x1"])
def test_revoke_rejects_demo_aliases_instead_of_targeting_a_different_account(client, monkeypatch, alias):
    login(client)
    calls = []

    async def revoke(owner, recipient):
        calls.append((owner, recipient))

    monkeypatch.setattr(client.app.state.store, "revoke", revoke)
    response = client.post("/api/v1/patient/disconnect-doctor", json={"doctor_id": alias, "confirmation": "DISCONNECT", "consent": True})
    assert response.status_code == 422
    assert calls == []


def test_exact_email_revocation_does_not_delete_other_patients_with_the_same_name(client):
    doctor = login(client, "doctor")
    before = client.get("/api/v1/workspace").json()
    before["data"]["patients"] = [{"id": "same-name-person", "name": "Alex Morgan", "email": "other@example.test", "age": 30, "initials": "AM", "condition": "Synthetic test", "lastVisit": "2026-10-11", "risk": "Not assessed"}]
    assert client.put("/api/v1/workspace", json={"version": before["version"], "data": before["data"]}).status_code == 200
    clinician_registry = client.get("/api/v1/workspace").json()
    patient = login(client)
    assert client.post("/api/v1/access", json={"recipient_email": doctor["email"]}).status_code == 200
    response = client.post("/api/v1/patient/disconnect-doctor", json={"doctor_id": doctor["email"].upper(), "confirmation": "DISCONNECT", "consent": True})
    assert response.status_code == 200
    login(client, "doctor")
    assert client.get("/api/v1/workspace", params={"owner_id": patient["id"]}).status_code == 403
    assert client.get("/api/v1/workspace").json() == clinician_registry


def test_display_save_failure_reports_completed_authoritative_revocation(client, monkeypatch):
    doctor = login(client, "doctor")
    patient = login(client)
    assert client.post("/api/v1/access", json={"recipient_email": doctor["email"]}).status_code == 200

    async def conflict(*args, **kwargs):
        raise HTTPException(409, "Display changed in another session")

    monkeypatch.setattr(client.app.state.store, "save", conflict)
    response = client.post("/api/v1/patient/disconnect-doctor", json={"doctor_id": doctor["id"], "confirmation": "DISCONNECT", "consent": True})
    assert response.status_code == 503
    assert "Care access was revoked" in response.json()["detail"]
    login(client, "doctor")
    assert client.get("/api/v1/workspace", params={"owner_id": patient["id"]}).status_code == 403
