"""Server-owned practice module definitions and workflow validation."""
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import HTTPException


def field(key, label, kind="text", required=False, options=None):
    return {"key": key, "label": label, "kind": kind, "required": required, **({"options": options} if options else {})}


PATIENT = field("patient_id", "Patient", "patient", True)
NOTES = field("notes", "Notes", "textarea")


def module(key, name, group, description, fields, statuses, transitions=None, integration=None):
    return {"key": key, "name": name, "group": group, "description": description, "fields": fields,
            "statuses": statuses, "transitions": transitions or {}, "integration": integration}


MODULES = {
    m["key"]: m for m in [
        module("patients", "Patient registry", "Clinical", "Patient identity, contact details and longitudinal care history.", [field("name", "Full name", required=True), field("dob", "Date of birth", "date"), field("phone", "Phone"), field("email", "Email", "email"), field("address", "Address", "textarea"), field("history", "Medical history", "textarea"), field("allergies", "Recorded allergies and source", "textarea"), field("emergency_contact", "Emergency contact")], ["Active", "Archived"], {"Active": ["Archived"], "Archived": ["Active"]}),
        module("appointments", "Appointments", "Clinical", "Reserve clinician time, prepare visits and track attendance.", [PATIENT, field("clinician", "Clinician", required=True), field("starts_at", "Start", "datetime-local", True), field("ends_at", "End", "datetime-local", True), field("timezone", "Clinic timezone", required=True), field("reason", "Visit reason", required=True), field("mode", "Visit type", "select", True, ["In person", "Video", "Telephone"]), NOTES], ["Booked", "Checked in", "In consultation", "Completed", "Cancelled", "No-show"], {"Booked": ["Checked in", "Cancelled", "No-show"], "Checked in": ["In consultation", "Cancelled"], "In consultation": ["Completed"]}),
        module("emr", "Clinical records", "Clinical", "Encounter notes, observations, diagnoses and attributed clinical history.", [PATIENT, field("title", "Encounter title", required=True), field("observations", "Vitals and observations", "textarea"), field("history", "History", "textarea"), field("assessment", "Assessment / diagnosis", "textarea"), field("plan", "Plan", "textarea"), field("attachments", "Document references", "textarea")], ["Draft", "Reviewed", "Signed"], {"Draft": ["Reviewed"], "Reviewed": ["Draft", "Signed"]}),
        module("treatments", "Treatment plans", "Clinical", "Goals, procedures, assessments and follow-up progress.", [PATIENT, field("title", "Treatment / procedure", required=True), field("goals", "Goals", "textarea", True), field("procedure", "Procedure record", "textarea"), field("assessment", "Specialty assessment", "textarea"), field("progress", "Progress notes", "textarea"), field("review_date", "Next review", "date")], ["Planned", "Active", "Completed", "Cancelled"], {"Planned": ["Active", "Cancelled"], "Active": ["Completed", "Cancelled"]}),
        module("prescriptions", "Prescriptions", "Clinical", "Clinician-reviewed medication instructions and prescription records.", [PATIENT, field("title", "Prescription title", required=True), field("medications", "Medication, strength, route and instructions", "textarea", True), field("allergy_review", "Allergy reconciliation", "textarea", True), field("instructions", "Patient instructions", "textarea"), field("review_date", "Review date", "date")], ["Draft", "Reviewed", "Issued", "Cancelled"], {"Draft": ["Reviewed", "Cancelled"], "Reviewed": ["Draft", "Issued", "Cancelled"]}, "Digital delivery requires a configured messaging provider."),
        module("billing", "Billing & payments", "Finance", "Invoices, recorded payments, outstanding balances and receipts.", [PATIENT, field("title", "Invoice description", required=True), field("amount", "Invoice total", "money", True), field("currency", "Currency", "select", True, ["INR", "GBP", "USD", "EUR"]), field("due_date", "Due date", "date"), NOTES], ["Draft", "Issued", "Part-paid", "Paid", "Void"], {"Draft": ["Issued", "Void"], "Issued": ["Void"]}),
        module("claims", "Insurance & RCM", "Finance", "Track claim preparation, submissions, decisions and reconciliation.", [PATIENT, field("title", "Claim reference", required=True), field("payer", "Payer", required=True), field("policy", "Policy reference"), field("amount", "Claim amount", "money", True), field("currency", "Currency", "select", True, ["INR", "GBP", "USD", "EUR"]), field("coding", "Codes and coding system", "textarea"), field("decision", "Decision / remittance reference", "textarea")], ["Draft", "Submitted", "Approved", "Rejected", "Resubmitted", "Reconciled"], {"Draft": ["Submitted"], "Submitted": ["Approved", "Rejected"], "Rejected": ["Resubmitted"], "Resubmitted": ["Approved", "Rejected"], "Approved": ["Reconciled"]}, "Payer submission is recorded manually; no insurer connection is configured."),
        module("pharmacy", "Pharmacy", "Operations", "Batch-level medicine stock, expiry visibility and dispensing ledger.", [field("name", "Medicine / strength", required=True), field("batch", "Batch number", required=True), field("quantity", "Opening quantity", "number", True), field("unit", "Stock unit", required=True), field("expiry", "Expiry date", "date", True), field("reorder", "Low-stock threshold", "number", True), field("supplier", "Supplier")], ["Available", "Quarantined", "Archived"], {"Available": ["Quarantined", "Archived"], "Quarantined": ["Available", "Archived"]}),
        module("labs", "Laboratory", "Clinical", "Test orders, results, report references and clinician review.", [PATIENT, field("title", "Test / panel", required=True), field("requested_by", "Requesting clinician", required=True), field("specimen", "Specimen / collection details"), field("results", "Result, units and reference ranges", "textarea"), field("report_reference", "Report reference"), field("review", "Review notes", "textarea")], ["Ordered", "Collected", "Resulted", "Reviewed", "Cancelled"], {"Ordered": ["Collected", "Cancelled"], "Collected": ["Resulted"], "Resulted": ["Reviewed"]}, "Analyzer and external laboratory connections are not configured."),
        module("ipd", "Admissions & beds", "Operations", "Admission, bed allocation, nursing documentation and discharge.", [PATIENT, field("title", "Admission reason", required=True), field("ward", "Ward", required=True), field("bed", "Bed identifier", required=True), field("admitted_at", "Admission time", "datetime-local", True), field("nursing_notes", "Nursing / ICU observations", "textarea"), field("procedure", "OT / procedure notes", "textarea"), field("discharge", "Discharge summary", "textarea")], ["Admitted", "Discharged"], {"Admitted": ["Discharged"]}),
        module("inventory", "Inventory", "Operations", "Consumables, equipment and stock-level records.", [field("name", "Item name", required=True), field("sku", "SKU / asset tag", required=True), field("category", "Category", "select", True, ["Consumable", "Equipment", "Medication"]), field("quantity", "Quantity", "number", True), field("reorder", "Alert threshold", "number", True), field("unit", "Unit", required=True), NOTES], ["Active", "Archived"], {"Active": ["Archived"], "Archived": ["Active"]}),
        module("crm", "Patient engagement", "Engagement", "Consent-aware enquiries, follow-up tasks and relationship history.", [field("name", "Contact name", required=True), field("contact", "Contact details", required=True), field("source", "Enquiry source"), field("follow_up", "Follow-up date", "date"), field("marketing_consent", "Marketing consent", "select", True, ["Not granted", "Granted", "Withdrawn"]), NOTES], ["New", "Contacted", "Converted", "Closed"], {"New": ["Contacted", "Closed"], "Contacted": ["Converted", "Closed"]}),
        module("communications", "Communications", "Engagement", "Prepare patient reminders and keep attributed communication records.", [PATIENT, field("title", "Subject", required=True), field("channel", "Channel", "select", True, ["Email", "SMS", "WhatsApp", "Phone"]), field("message", "Message", "textarea", True), field("scheduled_at", "Planned time", "datetime-local")], ["Draft", "Ready", "Cancelled"], {"Draft": ["Ready", "Cancelled"], "Ready": ["Draft", "Cancelled"]}, "Delivery is unavailable until a messaging provider and consent checks are configured."),
        module("hr", "People & attendance", "Operations", "Staff working-time records and leave approvals.", [field("name", "Staff member", required=True), field("type", "Record type", "select", True, ["Attendance", "Leave"]), field("starts_at", "Start", "datetime-local", True), field("ends_at", "End", "datetime-local", True), NOTES], ["Pending", "Approved", "Declined"], {"Pending": ["Approved", "Declined"]}),
        module("telemedicine", "Telemedicine", "Clinical", "Schedule remote visits and record reviewed consultation details.", [PATIENT, field("title", "Consultation reason", required=True), field("starts_at", "Visit time", "datetime-local", True), field("clinician", "Clinician", required=True), field("meeting_url", "Approved meeting URL", "url"), field("notes", "Consultation notes", "textarea")], ["Scheduled", "Completed", "Cancelled"], {"Scheduled": ["Completed", "Cancelled"]}, "Video calls require an approved external meeting service; recording is not enabled."),
        module("templates", "Forms & templates", "Settings", "Versioned specialty documentation and form templates.", [field("name", "Template name", required=True), field("specialty", "Specialty", required=True), field("type", "Template type", "select", True, ["Consultation", "Prescription", "Assessment", "Consent", "Discharge"]), field("content", "Template content", "textarea", True)], ["Draft", "Published", "Archived"], {"Draft": ["Published", "Archived"], "Published": ["Archived"]}),
        module("consent", "Consent & feedback", "Engagement", "Record consent evidence, withdrawal and patient feedback.", [PATIENT, field("title", "Purpose", required=True), field("type", "Record type", "select", True, ["Treatment consent", "Data sharing", "Recording consent", "Feedback"]), field("evidence", "Consent evidence / feedback", "textarea", True), field("recorded_by", "Recorded by", required=True), field("date", "Recorded date", "date", True)], ["Recorded", "Withdrawn"], {"Recorded": ["Withdrawn"]}),
        module("locations", "Branches", "Settings", "Branch details, clinic timezones and operational contacts.", [field("name", "Branch name", required=True), field("address", "Address", "textarea", True), field("timezone", "Timezone", required=True), field("phone", "Contact number"), field("hours", "Opening hours", "textarea")], ["Active", "Closed"], {"Active": ["Closed"], "Closed": ["Active"]}),
    ]
}


def validate_record(module_key, values):
    definition = MODULES.get(module_key)
    if not definition:
        raise HTTPException(404, "Unknown practice module")
    allowed = {f["key"] for f in definition["fields"]}
    if set(values) - allowed:
        raise HTTPException(422, "The record contains unsupported fields")
    result = {}
    for f in definition["fields"]:
        value = values.get(f["key"], "")
        if not isinstance(value, (str, int, float)) or isinstance(value, bool):
            raise HTTPException(422, f"Invalid {f['label']}")
        value = str(value).strip()
        if f["required"] and not value:
            raise HTTPException(422, f"{f['label']} is required")
        if len(value) > (12000 if f["kind"] == "textarea" else 500):
            raise HTTPException(422, f"{f['label']} is too long")
        if value:
            try:
                if f["kind"] == "patient":
                    value = str(UUID(value))
                elif f["kind"] == "date":
                    value = date.fromisoformat(value).isoformat()
                elif f["kind"] == "datetime-local":
                    datetime.fromisoformat(value)
                elif f["kind"] == "select" and value not in f["options"]:
                    raise ValueError()
                elif f["kind"] in ["number", "money"]:
                    n = Decimal(value)
                    if not n.is_finite() or n < 0 or n > 100000000:
                        raise ValueError()
                    if f["kind"] == "number" and n != n.to_integral_value():
                        raise ValueError()
                    if f["kind"] == "money" and n * 100 != (n * 100).to_integral_value():
                        raise ValueError()
                    value = str(int(n)) if f["kind"] == "number" else format(n, ".2f")
                elif f["kind"] == "url" and not value.startswith("https://"):
                    raise ValueError()
                elif f["kind"] == "email" and "@" not in value:
                    raise ValueError()
            except (ValueError, InvalidOperation):
                raise HTTPException(422, f"Invalid {f['label']}") from None
        result[f["key"]] = value
    # Compare temporal values after UTC normalization, never as offset-bearing strings.
    if module_key == "patients" and result.get("dob") and result["dob"] > date.today().isoformat():
        raise HTTPException(422, "Date of birth cannot be in the future")
    return result
