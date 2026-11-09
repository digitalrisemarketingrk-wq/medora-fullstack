"""Server-owned staff permissions. Unknown roles have no access."""
from fastapi import HTTPException

from .practice_catalog import MODULES

ROLE_MODULES = {
    "clinician": {
        "read": "patients appointments emr treatments prescriptions pharmacy labs ipd telemedicine templates consent locations",
        "write": "patients appointments emr treatments prescriptions labs ipd telemedicine templates consent",
    },
    "coordinator": {
        "read": "patients appointments crm communications consent locations",
        "write": "patients appointments crm communications consent",
    },
    "billing": {"read": "patients billing claims locations", "write": "billing claims"},
    "pharmacist": {"read": "patients prescriptions pharmacy inventory locations", "write": "pharmacy inventory"},
    "laboratory": {"read": "patients labs locations", "write": "labs"},
    "hr": {"read": "hr locations", "write": "hr"},
}


def permissions_for(role, doctor=False):
    policy = ROLE_MODULES.get(role)
    if role == "owner":
        read = write = list(MODULES)
    elif policy:
        read, write = policy["read"].split(), policy["write"].split()
    else:
        raise HTTPException(403, "This practice membership has no configured permissions")
    return {"role": role, "read": read, "write": write,
            "clinical_sign": doctor and role in ["owner", "clinician"],
            "finance": "billing" in read}


def require_module(permissions, module, operation="read"):
    if module not in permissions[operation]:
        raise HTTPException(403, "Your staff role cannot " + operation + " this module")


def visible_record(record, permissions):
    require_module(permissions, record["module"])
    if record["module"] == "patients" and permissions["role"] not in ["owner", "clinician"]:
        # Nonclinical staff can identify the patient without reading a medical history.
        fields = {"name", "dob", "phone", "email", "address", "emergency_contact"}
        if permissions["role"] == "pharmacist":
            fields.add("allergies")
        return {**record, "data": {k: v for k, v in record["data"].items() if k in fields}}
    return record
