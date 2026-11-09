from typing import Any, Literal
from .workspace_schema import details
from pydantic import BaseModel, ConfigDict, Field, field_validator

Role = Literal["patient", "doctor", "hospital"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(Input):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def email_address(cls, value: str):
        value = value.strip().lower()
        if "@" not in value or "\n" in value:
            raise ValueError("Enter a valid email address")
        return value


class Signup(Login):
    name: str = Field(min_length=2, max_length=120)
    consent: bool


class Profile(BaseModel):
    id: str
    name: str
    email: str
    role: Role


class WorkspaceWrite(Input):
    version: int = Field(ge=0)
    data: dict[str, Any]


class Grant(Input):
    recipient_email: str = Field(min_length=3, max_length=254)
    scope: Literal["read", "write"] = "read"


class Chat(Input):
    message: str = Field(min_length=1, max_length=6000)
    history: list[dict[str, str]] = Field(default_factory=list, max_length=12)
    owner_id: str | None = None
    provider: Literal["groq", "gemini"] = "groq"


class ClinicalDraft(Input):
    owner_id: str | None = None
    patient_name: str = Field(min_length=1, max_length=120)
    kind: Literal["Clinical note", "Referral letter", "Follow-up plan", "Patient instructions"]
    context: str = Field(min_length=1, max_length=20000)


class Compare(Input):
    owner_id: str | None = None
    first_id: str = Field(min_length=1, max_length=64)
    second_id: str = Field(min_length=1, max_length=64)


class QRPassGenerate(Input):
    access_type: Literal["temporary", "lifetime"] = "temporary"


class QRPassIntake(Input):
    token: str = Field(min_length=10, max_length=512)
    consent: bool = False
    consent_confirmed: bool = False
    reason: str = Field(default="Emergency care", max_length=120)
    access_type: Literal["temporary", "lifetime"] | None = None


class DisconnectDoctor(Input):
    doctor_id: str = Field(min_length=1, max_length=120)
    reason: str = Field(default="Care pathway complete", max_length=200)
    confirmation: str = Field(min_length=1, max_length=20)
    consent: bool = False


class TranslateDocument(Input):
    target_language: str = Field(min_length=2, max_length=10)
    language_name: str | None = None
    owner_id: str | None = None


class VoiceSpeak(Input):
    text: str = Field(min_length=1, max_length=6000)
    language: str = "en"
    gender: Literal["female", "male"] = "female"
    rate: str = "+0%"
    pitch: str = "+0Hz"
    engine: Literal["auto", "gemini", "edge"] = "auto"


class MedicationSafetyCheck(Input):
    medicines: list[dict[str, Any]] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    patient_name: str = "Patient"
    owner_id: str | None = None


class SOAPNoteRequest(Input):
    transcript: str = Field(min_length=1, max_length=30000)
    patient_name: str = "Patient"
    patient_condition: str = "Not provided"
    specialty: str = "General Practice"
    owner_id: str | None = None


class PrescriptionRecommendationRequest(Input):
    query: str = Field(min_length=1, max_length=1000)
    patient_id: str | None = None
    patient_name: str = "Patient"
    patient_condition: str = "Not provided"
    patient_age: int | None = Field(default=None, ge=0, le=130)
    allergies: list[str] = Field(default_factory=list)
    current_medications: list[str] = Field(default_factory=list)
    owner_id: str | None = None


class ConsultationSessionRequest(Input):
    transcript: str = Field(min_length=1, max_length=30000)
    patient_id: str | None = None
    patient_name: str = "Patient"
    patient_condition: str = "Not provided"
    patient_age: int | None = Field(default=None, ge=0, le=130)
    allergies: list[str] = Field(default_factory=list)
    current_medications: list[str] = Field(default_factory=list)
    owner_id: str | None = None


class ClinicalProviderOutput(BaseModel):
    """Reject incomplete provider output before the UI can present it as a draft."""
    model_config = ConfigDict(extra="ignore", strict=True)


class SuggestedCode(ClinicalProviderOutput):
    code: str
    description: str


class SOAPNoteOutput(ClinicalProviderOutput):
    subjective: str
    objective: str
    assessment: str
    plan: str
    icd10_suggestions: list[SuggestedCode]
    formatted_note: str


class MedicationSuggestion(ClinicalProviderOutput):
    drug_name: str = Field(min_length=1)
    generic_name: str
    category: str
    dosage_form: str
    dosage: str
    frequency: str
    timing: str
    duration: str
    clinical_rationale: str
    safety_alert: str | None
    contraindicated: bool


class PrescriptionRecommendationOutput(ClinicalProviderOutput):
    query: str
    safety_summary: str
    recommendations: list[MedicationSuggestion]
    suggested_investigations: list[str]
    lifestyle_advice: list[str]


class ClinicalIssue(ClinicalProviderOutput):
    issue: str
    severity: Literal["mild", "moderate", "high", "unknown"]
    icd10: str


class ConsultationSessionOutput(ClinicalProviderOutput):
    clean_transcript: str
    summary: str
    identified_issues: list[ClinicalIssue]
    suggested_medications: list[MedicationSuggestion]
    investigations: list[str]
    lifestyle_advice: list[str]



WORKSPACE_FIELDS = {"features", "team", "appointments", "patients", "tasks", "documents", "medicines", "family", "notes", "messages", "access", "audit", "waiting", "programmes", "settings"}
LIST_FIELDS = WORKSPACE_FIELDS - {"features", "team", "settings"}


def validate_workspace(data: dict):
    if set(data) != WORKSPACE_FIELDS:
        raise ValueError("Workspace contains missing or unknown fields")
    for key in LIST_FIELDS:
        if not isinstance(data[key], list) or len(data[key]) > 1000:
            raise ValueError(f"Invalid {key} collection")
        ids = []
        for row in data[key]:
            if not isinstance(row, dict) or not isinstance(row.get("id"), str) or not 1 <= len(row["id"]) <= 64:
                raise ValueError(f"Invalid {key} identifier")
            ids.append(row["id"])
        if len(set(ids)) != len(ids):
            raise ValueError(f"Duplicate {key} identifier")
    for key in ("features", "team", "settings"):
        if not isinstance(data[key], dict):
            raise ValueError(f"Invalid {key}")
    required_settings = {"name", "location", "blood", "language", "largeText", "highContrast", "readAloud", "simple", "notifications", "treatment", "sharing", "research"}
    if set(data["settings"]) != required_settings or not isinstance(data["settings"]["name"], str):
        raise ValueError("Invalid settings")
    for appointment in data["appointments"]:
        if not all(isinstance(appointment.get(k), str) for k in ["id", "patientId", "patient", "doctor", "specialty", "provider", "date", "time", "mode", "status", "reason"]):
            raise ValueError("Invalid appointment")
    details(data)
    slots = [(a["doctor"], a["provider"], a["date"], a["time"]) for a in data["appointments"] if a["status"] not in ["Cancelled", "Completed"]]
    if len(slots) != len(set(slots)):
        raise ValueError("An appointment already occupies this provider's time slot")

