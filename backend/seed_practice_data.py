"""Seed Medora Practice Management with comprehensive Indian clinical data.

Modules seeded:
- locations: Bandra West Flagship Clinic, Mumbai
- patients: Rahul Sharma, Ananya Gupta, Vikram Patel, Pooja Verma, Mohammed Riaz
- appointments: Non-overlapping OPD consultations & follow-ups
- emr: Clinical encounter notes, assessments & plans
- treatments: Comprehensive care & intervention plans
- prescriptions: Formatted Indian Rx with standard dosages (Telma, Thyronorm, etc.)
- billing: OPD Invoices with INR currency (₹)
- claims: Star Health & Care Health TPA insurance records
- pharmacy: Batch stocks with expiry dates in 2027/2028
- labs: Diagnostic test orders (HbA1c, Lipid profile, Thyroid panel, ECG)
- ipd: Daycare & Inpatient bed allocations
- inventory: Clinical supplies & equipment
- crm: Patient enquiries & leads
- communications: WhatsApp / SMS appointment reminders
- hr: Clinician and staff duty rosters
- telemedicine: Video consultation schedules
- templates: Clinical SOAP & discharge summary templates
- consent: Patient treatment & data privacy consent forms
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone, timedelta

def now_iso(offset_minutes=0):
    dt = datetime.now(timezone.utc) + timedelta(minutes=offset_minutes)
    return dt.isoformat()

def date_iso(days_offset=0):
    dt = datetime.now(timezone.utc) + timedelta(days=days_offset)
    return dt.strftime("%Y-%m-%d")

DOCTOR_ID = "c87fa5da-cf3c-4ef9-9b24-5791d1744da9"
HOSPITAL_ID = "f42fb1c4-4a8d-40d5-9938-b7c1d2340b39"

PATIENTS = [
    {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Rahul Sharma",
        "dob": "1990-05-14",
        "phone": "+91 98201 23456",
        "email": "patient@medora.demo",
        "address": "Flat 402, Sea Green Apts, Bandra West, Mumbai 400050",
        "history": "Type 2 Diabetes Mellitus (dx 2021), Essential Hypertension (dx 2023).",
        "allergies": "No known drug allergies (NKDA). Mild dust allergy.",
        "emergency_contact": "Sunita Sharma (Spouse) - +91 98201 65432"
    },
    {
        "id": "22222222-2222-4222-8222-222222222222",
        "name": "Ananya Gupta",
        "dob": "1982-11-20",
        "phone": "+91 98202 34567",
        "email": "ananya.gupta@example.in",
        "address": "B-12, Palm Grove, Pali Hill, Bandra West, Mumbai 400050",
        "history": "Primary Hypothyroidism, Severe Vitamin D Deficiency, Seasonal allergic rhinitis.",
        "allergies": "Sulphonamides (skin rash).",
        "emergency_contact": "Karan Gupta (Brother) - +91 98202 76543"
    },
    {
        "id": "33333333-3333-4333-8333-333333333333",
        "name": "Vikram Patel",
        "dob": "1968-03-08",
        "phone": "+91 98203 45678",
        "email": "vikram.patel@example.in",
        "address": "701, Regency Tower, Khar West, Mumbai 400052",
        "history": "CAD - Post-PTCA LAD Stent (Nov 2023). Mixed Dyslipidemia.",
        "allergies": "Aspirin-triggered mild gastric intolerance (managed with enteric coat + PPI).",
        "emergency_contact": "Meera Patel (Spouse) - +91 98203 87654"
    },
    {
        "id": "44444444-4444-4444-8444-444444444444",
        "name": "Pooja Verma",
        "dob": "1996-08-25",
        "phone": "+91 98204 56789",
        "email": "pooja.verma@example.in",
        "address": "304, Green Acres, Juhu Tara Road, Mumbai 400049",
        "history": "Bronchial Allergic Asthma since childhood, allergic rhinitis.",
        "allergies": "NSAIDs / Ibuprofen (bronchospasm trigger), penicillin.",
        "emergency_contact": "Ramesh Verma (Father) - +91 98204 98765"
    },
    {
        "id": "55555555-5555-4555-8555-555555555555",
        "name": "Mohammed Riaz",
        "dob": "1961-07-12",
        "phone": "+91 98205 67890",
        "email": "mohammed.riaz@example.in",
        "address": "12/A, Hill View Enclave, Hill Road, Bandra West, Mumbai 400050",
        "history": "Bilateral Knee Osteoarthritis (Grade 3 Kellgren-Lawrence), Hyperuricemia.",
        "allergies": "Codeine (severe nausea/dizziness).",
        "emergency_contact": "Farhan Riaz (Son) - +91 98205 09876"
    }
]

def seed_practice(db_path="backend/.data/medora.sqlite3"):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Ensure tables exist
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS practice_members (
        practice_id TEXT,
        user_id TEXT,
        role TEXT NOT NULL,
        PRIMARY KEY(practice_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS practice_records (
        id TEXT PRIMARY KEY,
        practice_id TEXT NOT NULL,
        module TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS practice_record_list ON practice_records(practice_id,module,branch_id,created_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS practice_patient_timeline ON practice_records(practice_id,json_extract(data,'$.patient_id'),created_at DESC);
    CREATE TABLE IF NOT EXISTS practice_events (
        id TEXT PRIMARY KEY,
        practice_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        record_id TEXT NOT NULL,
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS practice_event_list ON practice_events(practice_id,created_at DESC,id DESC);
    """)

    # Setup practice members
    members = [
        (DOCTOR_ID, DOCTOR_ID, "owner"),
        (DOCTOR_ID, HOSPITAL_ID, "coordinator"),
        (HOSPITAL_ID, HOSPITAL_ID, "owner"),
        (HOSPITAL_ID, DOCTOR_ID, "clinician")
    ]
    for pid, uid, role in members:
        cur.execute("INSERT OR REPLACE INTO practice_members (practice_id, user_id, role) VALUES (?, ?, ?)", (pid, uid, role))

    for practice_id, practice_name, clinician_name in [
        (DOCTOR_ID, "Dr. Rajesh Sharma Clinic", "Dr. Rajesh Sharma"),
        (HOSPITAL_ID, "Apollo City Clinic", "Dr. Rajesh Sharma")
    ]:
        print(f"Seeding practice: {practice_name} ({practice_id})")

        # 1. Location (Branch)
        branch_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:branch_bandra"))
        branch_data = {
            "name": "Bandra West Flagship Clinic",
            "address": "Plot 42, Waterfield Road, Bandra West, Mumbai 400050",
            "timezone": "Asia/Kolkata",
            "phone": "+91 22 2640 8899",
            "hours": "Mon–Sat 08:30–20:30 IST"
        }
        cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
            branch_id, practice_id, "locations", branch_id, branch_data["name"], "Active",
            json.dumps(branch_data), 1, now_iso(-10000), now_iso(-10000)
        ))

        # 2. Patients
        patient_map = {}
        for p in PATIENTS:
            p_rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:{p['id']}"))
            patient_map[p["name"]] = p_rec_id
            p_data = {
                "name": p["name"],
                "dob": p["dob"],
                "phone": p["phone"],
                "email": p["email"],
                "address": p["address"],
                "history": p["history"],
                "allergies": p["allergies"],
                "emergency_contact": p["emergency_contact"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                p_rec_id, practice_id, "patients", branch_id, p["name"], "Active",
                json.dumps(p_data), 1, now_iso(-8000), now_iso(-8000)
            ))

        # 3. Appointments (Non-overlapping)
        appts = [
            {
                "patient": "Rahul Sharma",
                "reason": "Quarterly Diabetes & Hypertension Assessment",
                "mode": "In-person clinic consultation",
                "status": "In consultation",
                "starts": f"{date_iso(0)}T09:30:00+05:30",
                "ends": f"{date_iso(0)}T10:00:00+05:30",
                "notes": "Patient brought 7-day blood glucose log. Fasting 118 mg/dL."
            },
            {
                "patient": "Ananya Gupta",
                "reason": "Thyroid & Vitamin D Profile Review",
                "mode": "In-person clinic consultation",
                "status": "Checked in",
                "starts": f"{date_iso(0)}T10:15:00+05:30",
                "ends": f"{date_iso(0)}T10:45:00+05:30",
                "notes": "TSH improved to 2.4 mIU/L on Thyronorm 50 mcg."
            },
            {
                "patient": "Vikram Patel",
                "reason": "Post-PTCA Cardiology Follow-up & ECG",
                "mode": "In-person clinic consultation",
                "status": "Booked",
                "starts": f"{date_iso(0)}T11:00:00+05:30",
                "ends": f"{date_iso(0)}T11:30:00+05:30",
                "notes": "Resting ECG and cardiac rehab progress review."
            },
            {
                "patient": "Pooja Verma",
                "reason": "Bronchial Asthma & Peak Flow Monitoring",
                "mode": "In-person clinic consultation",
                "status": "Booked",
                "starts": f"{date_iso(0)}T14:30:00+05:30",
                "ends": f"{date_iso(0)}T15:00:00+05:30",
                "notes": "Inhaler technique review and seasonal allergen management."
            },
            {
                "patient": "Mohammed Riaz",
                "reason": "Knee Osteoarthritis Intra-articular Review",
                "mode": "In-person clinic consultation",
                "status": "Booked",
                "starts": f"{date_iso(1)}T10:00:00+05:30",
                "ends": f"{date_iso(1)}T10:30:00+05:30",
                "notes": "Mobility score and physical therapy response assessment."
            }
        ]
        for a in appts:
            p_id = patient_map[a["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:appt:{a['patient']}:{a['starts']}"))
            appt_data = {
                "patient_id": p_id,
                "clinician": clinician_name,
                "starts_at": a["starts"],
                "ends_at": a["ends"],
                "timezone": "Asia/Kolkata",
                "reason": a["reason"],
                "mode": a["mode"],
                "notes": a["notes"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "appointments", branch_id, f"{a['patient']} · {a['reason']}", a["status"],
                json.dumps(appt_data), 1, now_iso(-5000), now_iso(-5000)
            ))

        # 4. EMR (Encounters)
        emr_notes = [
            {
                "patient": "Rahul Sharma",
                "title": "OPD Progress Note - T2DM & Essential HTN",
                "status": "Signed",
                "obs": "Vitals: BP 124/82 mmHg, HR 72 bpm, BMI 25.1 kg/m². Fasting blood sugar 114 mg/dL.",
                "history": "Compliant with Metformin 500mg SR BD and Telmisartan 40mg OD. No hypoglycemic episodes.",
                "assess": "Type 2 Diabetes Mellitus well-regulated; stage 1 essential hypertension within target.",
                "plan": "Continue current regimen. Schedule HbA1c in 10 weeks. Dietitian referral for low-glycemic dietary counseling."
            },
            {
                "patient": "Ananya Gupta",
                "title": "Endocrine Review - Hypothyroidism & Vit D Deficiency",
                "status": "Signed",
                "obs": "Vitals: BP 118/76 mmHg, HR 68 bpm. No peripheral edema, no tremor.",
                "history": "Takes Thyronorm 50mcg on empty stomach daily with water. Energy levels noticeably improved.",
                "assess": "Euthyroid state achieved on Thyronorm 50 mcg. Vitamin D deficiency corrected.",
                "plan": "Continue Thyronorm 50 mcg empty stomach. Vitamin D3 60,000 IU maintenance once monthly."
            },
            {
                "patient": "Vikram Patel",
                "title": "Cardiology Post-PTCA Follow-up",
                "status": "Signed",
                "obs": "Vitals: BP 122/78 mmHg, HR 64 bpm, SpO2 99%. Heart sounds regular, no S3/S4 or murmurs.",
                "history": "Underwent drug-eluting stent to proximal LAD in Nov 2023. Tolerating dual antiplatelet therapy without bruising.",
                "assess": "Stable ischemic heart disease, post-PTCA with satisfactory exercise tolerance.",
                "plan": "Continue Ecosprin 75mg + Clopidogrel 75mg OD, Atorvastatin 40mg at bedtime. Routine treadmill stress test in 6 months."
            },
            {
                "patient": "Pooja Verma",
                "title": "Pulmonology Note - Bronchial Asthma",
                "status": "Signed",
                "obs": "Vitals: SpO2 99% on room air, RR 16/min. Auscultation: Bilateral clear vesicular breath sounds.",
                "history": "Using Budesonide + Formoterol (Foracort 200) twice daily with good compliance.",
                "assess": "Mild persistent allergic asthma, currently well controlled on low-dose ICS-LABA.",
                "plan": "Continue Foracort 200 BD. Keep Levosalbutamol inhaler as emergency rescue. Avoid sudden dust exposure."
            },
            {
                "patient": "Mohammed Riaz",
                "title": "Orthopedic & Rheumatology Evaluation",
                "status": "Signed",
                "obs": "Bilateral knee mild crepitus, no acute effusion. Range of motion: Right 0-115 deg, Left 0-120 deg.",
                "history": "Reports aching discomfort after walking >20 minutes. Taking Paracetamol 650mg SOS.",
                "assess": "Bilateral knee osteoarthritis, Grade 2-3. Mixed dyslipidemia under Statin control.",
                "plan": "Quadriceps isometric strengthening exercises. Chondroitin-glucosamine supplement trial. Avoid prolonged squatting."
            }
        ]
        for note in emr_notes:
            p_id = patient_map[note["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:emr:{note['title']}"))
            emr_data = {
                "patient_id": p_id,
                "title": note["title"],
                "observations": note["obs"],
                "history": note["history"],
                "assessment": note["assess"],
                "plan": note["plan"],
                "attachments": ""
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "emr", branch_id, note["title"], note["status"],
                json.dumps(emr_data), 1, now_iso(-4000), now_iso(-4000)
            ))

        # 5. Treatments
        treatments = [
            {
                "patient": "Rahul Sharma",
                "title": "Metabolic Optimization & Cardiovascular Risk Reduction",
                "status": "Active",
                "goals": "Maintain HbA1c < 6.8%, SBP < 130 mmHg, achieve 150 minutes weekly aerobic activity.",
                "proc": "Quarterly clinical checkups, continuous glucose monitoring analysis.",
                "assess": "Excellent commitment to lifestyle interventions. BP and glucose responding.",
                "prog": "Weight reduced by 2.2 kg over 8 weeks. Target BMI < 24.5.",
                "review": date_iso(60)
            },
            {
                "patient": "Vikram Patel",
                "title": "Cardiac Rehabilitation Phase II Plan",
                "status": "Active",
                "goals": "Supervised aerobic exercise conditioning, dual antiplatelet adherence, lipid profile optimization.",
                "proc": "Structured telemetry-monitored treadmill and cycle ergometer training 3x/week.",
                "assess": "Achieving 6.5 METs without angina or ST deviations.",
                "prog": "Completed 18 of 24 planned rehab sessions.",
                "review": date_iso(30)
            }
        ]
        for t in treatments:
            p_id = patient_map[t["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:treatment:{t['title']}"))
            t_data = {
                "patient_id": p_id,
                "title": t["title"],
                "goals": t["goals"],
                "procedure": t["proc"],
                "assessment": t["assess"],
                "progress": t["prog"],
                "review_date": t["review"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "treatments", branch_id, t["title"], t["status"],
                json.dumps(t_data), 1, now_iso(-3500), now_iso(-3500)
            ))

        # 6. Prescriptions
        rx_list = [
            {
                "patient": "Rahul Sharma",
                "title": "Rx - Metformin SR 500mg + Telmisartan 40mg",
                "status": "Issued",
                "meds": "1. Tab Metformin 500mg SR - 1 tab twice daily after meals (1-0-1)\n2. Tab Telmisartan 40mg - 1 tab once daily in morning after breakfast (1-0-0)",
                "allergy": "Reviewed: Patient has NKDA. Verified no contraindications.",
                "instructions": "Maintain low glycemic index diet. Check morning BP once weekly.",
                "review": date_iso(90)
            },
            {
                "patient": "Ananya Gupta",
                "title": "Rx - Thyronorm 50 mcg + Cholecalciferol",
                "status": "Issued",
                "meds": "1. Tab Thyronorm 50 mcg - 1 tab daily on empty stomach 45 mins before breakfast (1-0-0)\n2. Sachet Calcirol 60K (Cholecalciferol) - 1 sachet in warm milk once weekly for 8 weeks",
                "allergy": "Reviewed: Allergy to Sulphonamides noted. No related cross-reactivity.",
                "instructions": "Do not take calcium or iron supplements within 4 hours of Thyronorm.",
                "review": date_iso(60)
            },
            {
                "patient": "Vikram Patel",
                "title": "Rx - Dual Antiplatelet & High-Intensity Statin",
                "status": "Issued",
                "meds": "1. Tab Ecosprin 75mg - 1 tab once daily after lunch (0-1-0)\n2. Tab Clopilet 75mg (Clopidogrel) - 1 tab once daily at bedtime (0-0-1)\n3. Tab Atorva 40mg (Atorvastatin) - 1 tab once daily at bedtime (0-0-1)",
                "allergy": "Reviewed: Mild aspirin dyspepsia noted; enteric-coated formulation prescribed with Pantoprazole 40mg SOS.",
                "instructions": "Never discontinue antiplatelet medications without consulting cardiologist.",
                "review": date_iso(90)
            }
        ]
        for rx in rx_list:
            p_id = patient_map[rx["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:rx:{rx['title']}"))
            rx_data = {
                "patient_id": p_id,
                "title": rx["title"],
                "medications": rx["meds"],
                "allergy_review": rx["allergy"],
                "instructions": rx["instructions"],
                "review_date": rx["review"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "prescriptions", branch_id, rx["title"], rx["status"],
                json.dumps(rx_data), 1, now_iso(-3000), now_iso(-3000)
            ))

        # 7. Billing
        bills = [
            {
                "patient": "Rahul Sharma",
                "title": "INV-2026-0841 · OPD Comprehensive Consultation",
                "amount": "850.00",
                "status": "Paid",
                "due": date_iso(0),
                "notes": "Payment received via UPI (GPay ref #29384710)."
            },
            {
                "patient": "Ananya Gupta",
                "title": "INV-2026-0842 · Endocrine Specialist Consultation",
                "amount": "1200.00",
                "status": "Paid",
                "due": date_iso(0),
                "notes": "Paid by credit card at clinic front-desk."
            },
            {
                "patient": "Vikram Patel",
                "title": "INV-2026-0843 · Cardiology Review & 12-Lead ECG",
                "amount": "1750.00",
                "status": "Issued",
                "due": date_iso(7),
                "notes": "Awaiting cashless insurance claim clearance from Star Health."
            },
            {
                "patient": "Pooja Verma",
                "title": "INV-2026-0844 · Pulmonary Function Test (Spirometry)",
                "amount": "1500.00",
                "status": "Draft",
                "due": date_iso(14),
                "notes": "Scheduled for post-consultation billing."
            }
        ]
        for b in bills:
            p_id = patient_map[b["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:bill:{b['title']}"))
            b_data = {
                "patient_id": p_id,
                "title": b["title"],
                "amount": b["amount"],
                "currency": "INR",
                "due_date": b["due"],
                "notes": b["notes"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "billing", branch_id, b["title"], b["status"],
                json.dumps(b_data), 1, now_iso(-2500), now_iso(-2500)
            ))

        # 8. Claims (Insurance & TPA)
        claims = [
            {
                "patient": "Vikram Patel",
                "title": "CLM-SH-2026-902 · Star Health Cashless OPD & Diagnostics",
                "payer": "Star Health and Allied Insurance Co Ltd",
                "policy": "SH-RE-2024-884192",
                "amount": "4500.00",
                "status": "Submitted",
                "coding": "ICD-10 I25.10 (Atherosclerotic heart disease), Z95.5 (Coronary angioplasty implant)",
                "decision": "Under initial TPA pre-authorization review (Medi Assist TPA)."
            },
            {
                "patient": "Mohammed Riaz",
                "title": "CLM-CARE-2026-140 · Care Health Senior Citizen Plan",
                "payer": "Care Health Insurance",
                "policy": "CHI-SC-99214-B",
                "amount": "2800.00",
                "status": "Approved",
                "coding": "ICD-10 M17.0 (Bilateral primary osteoarthritis of knee)",
                "decision": "Approved for full OPD cashless reimbursement. Ref #CH-882194."
            }
        ]
        for c in claims:
            p_id = patient_map[c["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:claim:{c['title']}"))
            c_data = {
                "patient_id": p_id,
                "title": c["title"],
                "payer": c["payer"],
                "policy": c["policy"],
                "amount": c["amount"],
                "currency": "INR",
                "coding": c["coding"],
                "decision": c["decision"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "claims", branch_id, c["title"], c["status"],
                json.dumps(c_data), 1, now_iso(-2200), now_iso(-2200)
            ))

        # 9. Pharmacy Inventory & Batches
        pharmacy_items = [
            {
                "name": "Metformin Hydrochloride 500mg SR Tablets",
                "batch": "MF-2025-081",
                "qty": 850,
                "unit": "Strip of 10 Tablets",
                "expiry": "2027-10-31",
                "reorder": 200,
                "supplier": "Cipla Ltd, Vikhroli Depot"
            },
            {
                "name": "Telmisartan 40mg Tablets (Telma 40)",
                "batch": "TL-2025-114",
                "qty": 420,
                "unit": "Strip of 15 Tablets",
                "expiry": "2027-12-31",
                "reorder": 150,
                "supplier": "Glenmark Pharmaceuticals, Mumbai"
            },
            {
                "name": "Thyronorm 50 mcg (Levothyroxine Sodium)",
                "batch": "TH-2026-004",
                "qty": 310,
                "unit": "Bottle of 120 Tablets",
                "expiry": "2028-02-28",
                "reorder": 100,
                "supplier": "Abbott Healthcare Pvt Ltd"
            },
            {
                "name": "Foracort 200 Inhaler (Budesonide 200mcg + Formoterol 6mcg)",
                "batch": "FC-2025-789",
                "qty": 48,
                "unit": "Canister (120 MDI Doses)",
                "expiry": "2027-08-31",
                "reorder": 20,
                "supplier": "Cipla Respiratory Care"
            },
            {
                "name": "Paracetamol 650mg Tablets (Dolo 650)",
                "batch": "DL-2026-032",
                "qty": 1200,
                "unit": "Strip of 15 Tablets",
                "expiry": "2028-05-31",
                "reorder": 300,
                "supplier": "Micro Labs Ltd"
            }
        ]
        for ph in pharmacy_items:
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:pharmacy:{ph['batch']}"))
            ph_data = {
                "name": ph["name"],
                "batch": ph["batch"],
                "quantity": ph["qty"],
                "unit": ph["unit"],
                "expiry": ph["expiry"],
                "reorder": ph["reorder"],
                "supplier": ph["supplier"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "pharmacy", branch_id, f"{ph['name']} ({ph['batch']})", "Available",
                json.dumps(ph_data), 1, now_iso(-2000), now_iso(-2000)
            ))

        # 10. Labs
        labs = [
            {
                "patient": "Rahul Sharma",
                "title": "Comprehensive Glycemic & Lipid Panel",
                "status": "Resulted",
                "req": clinician_name,
                "spec": "Fasting Venous Blood Serum",
                "res": "HbA1c: 6.4% (Good control); Fasting Blood Sugar: 112 mg/dL; Total Cholesterol: 182 mg/dL; Triglycerides: 148 mg/dL; HDL: 44 mg/dL; LDL: 108 mg/dL.",
                "ref": "Apollo Diagnostics Lab Ref #ADL-2026-8812",
                "rev": f"Reviewed by {clinician_name}. Target ranges maintained."
            },
            {
                "patient": "Ananya Gupta",
                "title": "Thyroid Hormone Profile (T3, T4, Ultrasensitive TSH)",
                "status": "Resulted",
                "req": clinician_name,
                "spec": "Serum",
                "res": "Free T3: 3.1 pg/mL (Normal 2.3-4.2); Free T4: 1.28 ng/dL (Normal 0.8-1.8); TSH: 2.35 uIU/mL (Optimal target 0.5-3.0).",
                "ref": "Suburban Diagnostics Lab Ref #SD-99214",
                "rev": f"Reviewed by {clinician_name}. Euthyroid state confirmed on current Thyronorm dose."
            },
            {
                "patient": "Vikram Patel",
                "title": "12-Lead Electrocardiogram (ECG)",
                "status": "Reviewed",
                "req": clinician_name,
                "spec": "Clinical Physiological Recording",
                "res": "Normal sinus rhythm at 64 bpm. PR interval 152 ms, QRS duration 86 ms, QTc 412 ms. No acute ST segment deviation or T-wave inversion.",
                "ref": "In-clinic GE Healthcare MAC 2000 System",
                "rev": f"Reviewed and signed off by {clinician_name}."
            }
        ]
        for lb in labs:
            p_id = patient_map[lb["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:lab:{lb['title']}"))
            lb_data = {
                "patient_id": p_id,
                "title": lb["title"],
                "requested_by": lb["req"],
                "specimen": lb["spec"],
                "results": lb["res"],
                "report_reference": lb["ref"],
                "review": lb["rev"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "labs", branch_id, lb["title"], lb["status"],
                json.dumps(lb_data), 1, now_iso(-1800), now_iso(-1800)
            ))

        # 11. IPD (Inpatient & Day Care Beds)
        ipd_records = [
            {
                "patient": "Mohammed Riaz",
                "title": "Day Care Admission - Intra-articular Hyaluronic Acid Injection",
                "status": "Admitted",
                "ward": "Day Care Medical Suite",
                "bed": "Bed DC-01",
                "admitted": f"{date_iso(0)}T08:30:00+05:30",
                "notes": "Patient prepped for bilateral knee injection. Vitals stable: BP 130/84 mmHg, SpO2 99%.",
                "proc": "Synvisc-One intra-articular injection into right knee under aseptic conditions.",
                "disch": f"{date_iso(0)}T16:30:00+05:30"
            }
        ]
        for ipd in ipd_records:
            p_id = patient_map[ipd["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:ipd:{ipd['bed']}"))
            ipd_data = {
                "patient_id": p_id,
                "title": ipd["title"],
                "ward": ipd["ward"],
                "bed": ipd["bed"],
                "admitted_at": ipd["admitted"],
                "nursing_notes": ipd["notes"],
                "procedure": ipd["proc"],
                "discharge": ipd["disch"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "ipd", branch_id, ipd["title"], ipd["status"],
                json.dumps(ipd_data), 1, now_iso(-1500), now_iso(-1500)
            ))

        # 12. Inventory (Consumables & Equipment)
        inventory_items = [
            {
                "name": "Disposable Sterile Syringes 5ml with 23G Needle",
                "sku": "MED-SYR-05ML",
                "cat": "Consumables",
                "qty": 450,
                "reorder": 100,
                "unit": "Pack of 10",
                "notes": "BD Medical sterile single-use syringes."
            },
            {
                "name": "N95 Particulate Respirator Masks (BIS Certified)",
                "sku": "PPE-N95-BIS",
                "cat": "Personal Protective Equipment",
                "qty": 280,
                "reorder": 80,
                "unit": "Box of 20",
                "notes": "Venus V-4400 N95 respirators for clinical OPD staff."
            },
            {
                "name": "ECG Disposable Electrodes (Adult Pre-gelled)",
                "sku": "MED-ECG-ELCT",
                "cat": "Cardiology Diagnostics",
                "qty": 600,
                "reorder": 150,
                "unit": "Pouch of 50",
                "notes": "3M Red Dot monitoring electrodes for resting and stress ECG."
            },
            {
                "name": "Nitrile Examination Gloves (Latex-Free, Powder-Free) Medium",
                "sku": "PPE-GLV-MED",
                "cat": "Consumables",
                "qty": 35,
                "reorder": 10,
                "unit": "Box of 100",
                "notes": "Kimberly-Clark Sterling Nitrile gloves."
            }
        ]
        for inv in inventory_items:
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:inv:{inv['sku']}"))
            inv_data = {
                "name": inv["name"],
                "sku": inv["sku"],
                "category": inv["cat"],
                "quantity": inv["qty"],
                "reorder": inv["reorder"],
                "unit": inv["unit"],
                "notes": inv["notes"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "inventory", branch_id, inv["name"], "Active",
                json.dumps(inv_data), 1, now_iso(-1400), now_iso(-1400)
            ))

        # 13. CRM (Leads & Enquiries)
        crm_leads = [
            {
                "name": "Deepak Malhotra",
                "contact": "+91 98209 11223 · deepak.m@example.in",
                "source": "WhatsApp Business Enquiry",
                "follow": date_iso(2),
                "consent": True,
                "notes": "Inquiring about comprehensive annual cardiac screening package for corporate executives.",
                "status": "Contacted"
            },
            {
                "name": "Sunita Deshmukh",
                "contact": "+91 98208 44556",
                "source": "Practo Clinic Profile",
                "follow": date_iso(1),
                "consent": True,
                "notes": "Requires second opinion for thyroid nodules & fine needle aspiration cytology (FNAC).",
                "status": "New"
            }
        ]
        for lead in crm_leads:
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:crm:{lead['name']}"))
            crm_data = {
                "name": lead["name"],
                "contact": lead["contact"],
                "source": lead["source"],
                "follow_up": lead["follow"],
                "marketing_consent": lead["consent"],
                "notes": lead["notes"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "crm", branch_id, f"Enquiry: {lead['name']}", lead["status"],
                json.dumps(crm_data), 1, now_iso(-1200), now_iso(-1200)
            ))

        # 14. Communications
        comms = [
            {
                "patient": "Rahul Sharma",
                "title": "WhatsApp Appointment Confirmation - Dr. Rajesh Sharma",
                "channel": "WhatsApp",
                "msg": f"Namaste Rahul Sharma, your OPD consultation with Dr. Rajesh Sharma at Apollo City Clinic (Bandra West) is confirmed for today at 09:30 AM IST. Please carry your previous lab reports and prescription sheet.",
                "sched": f"{date_iso(0)}T08:00:00+05:30",
                "status": "Ready"
            },
            {
                "patient": "Ananya Gupta",
                "title": "SMS Medication Refill Alert - Thyronorm 50mcg",
                "channel": "SMS",
                "msg": "Dear Ananya Gupta, your 60-day Thyronorm refill is due in 3 days. Dr. Rajesh Sharma has issued your digital prescription on Medora. Tap to order via Jan Aushadhi / Apollo Pharmacy.",
                "sched": f"{date_iso(2)}T09:00:00+05:30",
                "status": "Ready"
            }
        ]
        for cm in comms:
            p_id = patient_map[cm["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:comm:{cm['title']}"))
            cm_data = {
                "patient_id": p_id,
                "title": cm["title"],
                "channel": cm["channel"],
                "message": cm["msg"],
                "scheduled_at": cm["sched"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "communications", branch_id, cm["title"], cm["status"],
                json.dumps(cm_data), 1, now_iso(-1000), now_iso(-1000)
            ))

        # 15. HR (Rosters & Duty Shifts)
        hr_shifts = [
            {
                "name": f"{clinician_name} · Morning OPD Shift",
                "type": "OPD Clinical Consultation",
                "starts": f"{date_iso(0)}T08:30:00+05:30",
                "ends": f"{date_iso(0)}T14:30:00+05:30",
                "notes": "Consultation Room 1 - Bandra West Clinic."
            },
            {
                "name": "Sister Kavita Nair, RN · Day Triage & Vitals Shift",
                "type": "Nursing Care & Vitals Station",
                "starts": f"{date_iso(0)}T08:00:00+05:30",
                "ends": f"{date_iso(0)}T16:00:00+05:30",
                "notes": "Pre-consultation vitals recording, ECG monitoring, and patient triage."
            }
        ]
        for h in hr_shifts:
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:hr:{h['name']}"))
            h_data = {
                "name": h["name"],
                "type": h["type"],
                "starts_at": h["starts"],
                "ends_at": h["ends"],
                "notes": h["notes"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "hr", branch_id, h["name"], "Approved",
                json.dumps(h_data), 1, now_iso(-800), now_iso(-800)
            ))

        # 16. Telemedicine
        telemed = [
            {
                "patient": "Pooja Verma",
                "title": "Tele-consultation: Asthma Symptom Check & Inhaler Technique",
                "starts": f"{date_iso(3)}T16:00:00+05:30",
                "doc": clinician_name,
                "url": "https://meet.jit.si/medora-telemed-pooja-verma-2026",
                "notes": "Review video demonstration of spacer device technique.",
                "status": "Scheduled"
            }
        ]
        for tm in telemed:
            p_id = patient_map[tm["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:telemed:{tm['title']}"))
            tm_data = {
                "patient_id": p_id,
                "title": tm["title"],
                "starts_at": tm["starts"],
                "clinician": tm["doc"],
                "meeting_url": tm["url"],
                "notes": tm["notes"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "telemedicine", branch_id, tm["title"], tm["status"],
                json.dumps(tm_data), 1, now_iso(-600), now_iso(-600)
            ))

        # 17. Templates
        templates = [
            {
                "name": "Standard Indian OPD SOAP Consultation Format",
                "spec": "General Medicine",
                "type": "Consultation",
                "content": "SUBJECTIVE:\nChief Complaint: [Symptoms and duration]\nHistory of Present Illness: [Progression, aggravating/relieving factors]\nPast Medical/Surgical History: [Chronic illnesses, previous procedures]\nCurrent Medications: [Drug, dose, frequency, compliance]\nAllergies: [Medication, food, environmental]\n\nOBJECTIVE:\nVitals: BP [  ] mmHg, HR [  ] bpm, RR [  ]/min, SpO2 [  ]%, Temp [  ] F, Weight [  ] kg, BMI [  ] kg/m2\nSystemic Examination:\n- CVS: S1 S2 heard, no murmurs\n- RS: Bilateral air entry equal, clear\n- P/A: Soft, non-tender, no organomegaly\n- CNS: Conscious, oriented, no focal neurological deficits\n\nASSESSMENT:\nPrimary Diagnosis: [Diagnosis]\nDifferential Diagnosis: [Differential]\n\nPLAN:\n1. Diagnostics: [Ordered investigations]\n2. Medications: [Generic name, strength, dosage schedule, duration]\n3. Patient Education & Lifestyle: [Dietary modifications, physical activity]\n4. Red Flag Warnings: [Emergency signs requiring immediate ER visit]\n5. Follow-up: [Review interval]"
            },
            {
                "name": "Day Care / Minor Procedure Discharge Summary",
                "spec": "Day Care Surgery & Procedures",
                "type": "Discharge",
                "content": "CLINICAL SUMMARY:\nPatient Name: [Patient Name] | Age/Sex: [Age/Sex] | Date of Admission: [Date] | Date of Discharge: [Date]\nDiagnosis: [Diagnosis]\nProcedure Performed: [Procedure description and date]\nOperating/Attending Clinician: [Clinician Name]\nAnesthesia: [Local / Monitored Anesthesia Care]\n\nPOST-PROCEDURE COURSE:\nPatient tolerated the procedure well without immediate complications. Vitals stable at time of discharge. Oral intake tolerated. Ambulatory.\n\nDISCHARGE MEDICATIONS:\n[Medication list with dosage & duration]\n\nHOME CARE & WOUND CARE INSTRUCTIONS:\n- Keep dressing clean and dry.\n- Avoid heavy lifting and strenuous exertion for [ ] days.\n- Normal diet may be resumed.\n\nEMERGENCY CONTACT:\nContact Medora Emergency Line at +91 22 2640 8899 or visit the emergency department immediately if experiencing fever > 101 F, severe bleeding, or intractable pain.\n\nFOLLOW-UP:\nReview at OPD on [Follow-up Date] at [Time]."
            }
        ]
        for tpl in templates:
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:tpl:{tpl['name']}"))
            tpl_data = {
                "name": tpl["name"],
                "specialty": tpl["spec"],
                "type": tpl["type"],
                "content": tpl["content"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "templates", branch_id, tpl["name"], "Published",
                json.dumps(tpl_data), 1, now_iso(-400), now_iso(-400)
            ))

        # 18. Consent
        consents = [
            {
                "patient": "Mohammed Riaz",
                "title": "Informed Consent for Intra-articular Knee Injection",
                "type": "Procedure",
                "evidence": "Digitally signed informed consent captured at kiosk with patient acknowledgement of risks (temporary soreness, infection risk < 1:10000).",
                "by": clinician_name,
                "date": date_iso(0)
            },
            {
                "patient": "Rahul Sharma",
                "title": "Digital Health Records Sharing & DPDP Compliance Consent",
                "type": "Data sharing",
                "evidence": "Two-factor OTP verified patient consent authorizing encrypted EMR record maintenance and laboratory integration under Digital Personal Data Protection Act.",
                "by": clinician_name,
                "date": date_iso(-14)
            }
        ]
        for cs in consents:
            p_id = patient_map[cs["patient"]]
            rec_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{practice_id}:consent:{cs['title']}"))
            cs_data = {
                "patient_id": p_id,
                "title": cs["title"],
                "type": cs["type"],
                "evidence": cs["evidence"],
                "recorded_by": cs["by"],
                "date": cs["date"]
            }
            cur.execute("INSERT OR REPLACE INTO practice_records VALUES (?,?,?,?,?,?,?,?,?,?)", (
                rec_id, practice_id, "consent", branch_id, cs["title"], "Recorded",
                json.dumps(cs_data), 1, now_iso(-200), now_iso(-200)
            ))

    conn.commit()
    conn.close()
    print("Practice database seeding completed successfully!")

if __name__ == "__main__":
    seed_practice()

