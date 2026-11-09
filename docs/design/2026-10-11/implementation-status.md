# Medora redesign: delivered scope and remaining work

Date: 11 October 2026. This records the current local implementation, not full
PappyJoe feature parity or a production certification.

## Delivered

The generic clinical form is now a dedicated encounter workspace: patient and
allergy context, five compact documentation sections, explicit draft/review/sign
stages, version state, audit history, and contextual next actions. Signing still
requires server authorization and a reviewed record. Related tasks retain patient
and branch context; these handoffs do not imply a new encounter linkage schema.

The clinical encounter worksheet now includes an integrated **Vitals & Biometrics**
composer (Blood Pressure, Heart Rate, Temperature, SpO2, Respiratory Rate, Height,
Weight, automated BMI calculation with clinical weight classification badge, and
1-click vitals stamp insertion) alongside quick chief complaints chips.

The unified patient journey from encounter to medication and finance is now
delivered via dedicated domain composers:
1. **Practice Prescription Studio (`practice-prescription-studio.tsx`)**:
   - Multi-row medication composer with autocomplete presets (Amoxicillin, Paracetamol,
     Metformin, Atorvastatin, Omeprazole, Azithromycin, Cetirizine, etc.).
   - Structured dosage, dosage form, frequency (OD, BD, TDS, QID, PRN), timing,
     and duration presets.
   - Real-time allergy reconciliation banner cross-referencing patient allergies
     from Supabase records.
   - Live clinical Rx document pad with clinic header, patient details, structured
     medication table, and doctor sign-off.
   - Printable document layout (`@media print`) and PDF export readiness.
   - Schema-safe serialization encoding typed items (`<!--RX_DATA:...-->`) inside
     the catalog `medications` field.

2. **Practice Billing & Invoice Composer (`practice-billing-composer.tsx`)**:
   - Comprehensive service line-item builder with quick-add clinical service presets
     (Consultations, ECG, CBC, CMP, Urinalysis, Ultrasound, Pharmacy, Nursing).
   - Itemized rate, quantity, and line total calculations.
   - Real-time Totals Rail with subtotal, tax selector (0%, 5%, 12%, 18%), adjustments,
     and grand total in selected currency (`INR`, `GBP`, `USD`, `EUR`).
   - Live formal invoice and receipt document view with issue date, due date, invoice
     numbering, and clinic signature block.
   - Integrated Payment Recording Modal with direct `practiceApi.action(record, 'pay', ...)`
     execution for server-side balance allocation.
   - Schema-safe serialization encoding typed line items (`<!--BILLING_DATA:...-->`)
     inside the catalog `notes` field while enforcing clean 2-decimal `amount`.

3. **Appointment Slot Matrix (`practice-task-editor.tsx`)**:
   - Interactive Morning (09:00–11:30) and Afternoon (14:00–16:30) slot matrix buttons
     that auto-populate `starts_at` and compute `ends_at` via duration presets.
   - Clinician selection chips and common visit reason chips.

4. **Workspace Dispatching & Safety (`practice-workspace.tsx`)**:
   - High-intensity studios (`emr`, `prescriptions`, `billing`) open as full-surface
     workspaces in `<main>` rather than narrow slide-out drawers.
   - Contextual titles and patient links carry over automatically between appointments,
     encounters, prescriptions, and billing invoices.
   - CAS optimistic locking, version increments, dirty-exit safety dialogs, and save locks
     are strictly enforced across all studios.

The other catalog modules use task-specific drawers, section labels and actions.
Patient registration starts with demographics and progressively exposes optional
information. Appointment booking uses duration presets, the clinic timezone and
derived end time. Save actions remain visible on mobile. Forms expose field errors,
focus the invalid input and protect unsaved work. Updates use record versions and
stable retry keys to preserve existing conflict and idempotency handling.
Patient and template edits, branch changes, discard actions and sidebar navigation
are locked while an encounter save is in progress, so a late response cannot
silently replace a newer edit or contradict a discard action.

Server operational queries now support appointment and telemedicine date windows,
active admissions, pharmacy and inventory alerts. Filtering occurs before bounded
pagination. Date windows respect branch timezones; scan limits and incomplete
results are reported explicitly.
Clinic-day defaults and Today are resolved by the backend in the selected branch
timezone. Pharmacy dispensing uses the same clinic date for expiry eligibility.
Patient search supports literal name, phone,
email and date-of-birth searches. Operational screens use these query results,
instead of presenting the first generic record page as a complete queue.

Clinical and security corrections remove invented patient age, allergy history,
SOAP notes and dose guesses in live mode. Provider failures are shown as failures.
The medication-safety API reports that no validated drug knowledge service is
connected, rather than declaring a prescription safe. Live prescriptions route
into the persisted practice workflow. Access revocation uses the exact authorized
recipient and revokes the server grant before updating the workspace projection.
Late AI responses are discarded after a patient change.

Document indexing initializes the embedding model outside the event loop and
checks embedding dimensions and finite values. Qdrant replacement upserts the new
chunks before removing obsolete chunks, preserving the previous index on a failed
upsert.

## Verification

| Check | Result | Practical scope |
| --- | --- | --- |
| Backend tests | 129 passing (53.10s) | Full suite, including operational query, truthful clinical failure, grant revocation, index replacement and cross-timezone dispensing regressions. |
| Frontend TypeScript | Passed (0 errors) | Full type check (`tsc --noEmit`) after all studio implementations and regex compatibility fixes. |
| UI verification script | 26 checks passed | Source and rendering checks for all client modules and navigation surfaces. |
| HTTP dev server | 200 OK | `http://127.0.0.1:5173/practice` renders complete HTML layout with RSC entry. |
| Supabase live checks | Passed | Patient search, operational endpoints, anonymous rejection, saved encounter readback and follow-up appointment readback. |
| Qdrant | Healthy | Connectivity, collection dimensions and existing document points checked. |
| Connected clinical flow | Verified | Appointment slot selection -> Clinical worksheet with vitals/BMI -> Prescription Studio with allergy check and Rx pad -> Billing Composer with itemized ledger and payment recording. |

Frontend is running at `http://localhost:5173`; backend at
`http://127.0.0.1:8000`. The current services use the configured Supabase and Qdrant
environment. Credentials remain in local ignored environment files.

## Remaining work

The unified patient journey (Patient → Appointment → Encounter → Prescription → Invoice/Payment)
is now delivered with clinical-grade UX and strict backend contract integrity. The next
phases from `redesign-blueprint.md` are:

1. **Pharmacy dispensing execution**: Dedicated dispensing queue allowing pharmacists
   to select specific unexpired stock batches and deduct inventory when fulfilling issued prescriptions.
2. **Laboratory result worksheet**: Multi-test analyte entry worksheet with reference intervals,
   abnormal flagging, and pathologist review sign-off.
3. **Inpatient bed management (IPD)**: Visual ward/bed layout with interactive transfer and
   discharge summary composer.
4. **Durable outbox/worker jobs**: Background outbox processor for asynchronous external notifications
   and claims submissions.
5. **Real-time external integrations**: External clearinghouses, SMS/WhatsApp delivery gateways,
   and diagnostic analyzer interfaces (reporting explicit "Not Connected" states until credentials exist).

