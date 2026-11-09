# Practice management implementation

The new `/practice` workspace adds 18 persisted resource modules, financial analytics, clinician AI drafting, and responsive mobile access. It is a working application foundation, **not a completed hospital ERP, certified clinical system, or full implementation of every advertised competitor capability**. This document separates implemented behavior from the remaining work.

Professional users can enter it from **Practice management** in the existing care sidebar. API mode uses FastAPI persistence and server authorization. Browser demonstration mode uses fictional, clearly labelled records in local storage; it is unsuitable for real patient information.

## Feature coverage

| Requested module | Implemented locally | Remaining depth / connection |
| --- | --- | --- |
| Patient registration | Demographics, contacts, history, allergy-source text, emergency contact, searchable registry, archive/reactivate, paginated longitudinal history across linked resources | Identity verification, duplicate resolution, structured allergy reconciliation, merge workflow, association with existing patient portal accounts |
| Appointments | Booking, editing/rescheduling, check-in, consultation/completion, cancellation/no-show, timezone normalization, overlap prevention, clinic-day agenda | Stable clinician IDs, working-hours/leave/holiday rules, full date-range calendar, wait-list conversion, automated reminders |
| EMR / EHR | Encounter history, observations/vitals text, assessment/diagnosis, plan, document references, Draft → Reviewed → Signed; signed records cannot be overwritten | Structured coded diagnoses/vitals, attachment upload tied to the practice registry, explicitly linked amendments, clinical record export/interoperability |
| Clinical treatment | Goals, procedures, specialty assessment text, progress, review date, Planned → Active → Completed or Cancelled | Specialty chart schemas, dental charts, exercise tracking, outcome measures and procedure-specific validation |
| Prescriptions | Medication instructions and required allergy-review text, clinician-only issuing, templates, saved-record printing | Structured medication lines, licensed drug database, deterministic interaction checks, legally valid electronic signatures and digital delivery |
| Billing | Draft and issued invoices, exact minor-unit payment accounting, partial/final payments, outstanding balance, overpayment prevention, retry-safe payment recording, audit trail and printing | Itemized charges, tax configuration, sequential invoice numbering, expense ledger, refunds/credit notes, payment gateway and reconciliation |
| Insurance / RCM | Payer/policy/coding/remittance references; submission, approval, rejection, resubmission and reconciliation tracking | Real claim generation/EDI, insurer APIs, coding catalogs, automated denial workflows and remittance matching; current status changes record manual activity |
| Pharmacy | Batch/expiry/unit/supplier stock records, low-stock and expiry visibility, patient-linked dispensing, no negative stock, stale-version protection | Purchase orders, barcode workflows, licensed product catalog, returned stock, batch uniqueness/receipt reconciliation and pharmacy sales linked to invoices |
| Laboratory | Patient-linked test orders, specimen details, results/reference-range text, report reference, collection/result/review workflow; results required before marking Resulted | Analyzer interfaces, external lab integration, structured result values, upload/download tied to orders and critical-result escalation |
| Hospital IPD | Admission, occupied-bed board, collision prevention, bed transfers, nursing/ICU/OT notes, discharge summary required before discharge | A real bed/ward catalog, nursing flowsheets, medication administration, ICU monitoring, OT scheduling, discharge planning and consolidated inpatient billing |
| Inventory | Equipment/consumable/medication records, SKU, quantities and reorder thresholds | Stock movements, receiving/issuing ledger, reservations, stocktakes, depreciation and asset maintenance |
| CRM | Enquiry/contact/source tracking, follow-up dates, explicit marketing-consent status, contact/conversion/closure stages | Follow-up task execution, campaign audience rules, communications integration and consent-enforced marketing delivery |
| Communications | Patient-linked messages, email/SMS/WhatsApp/phone channel, planned time, draft/ready/cancelled workflow | No message delivery is configured. Requires approved provider credentials, an outbox/worker, opt-out enforcement, delivery receipts and retries |
| HRM | Attendance/leave records with start/end and approval/decline | Verified staff identities, actual punch-in/out, shifts, computed hours, approver delegation, payroll and leave balances |
| Analytics | Saved-record counts, workflow status distribution, per-currency issued/received/outstanding invoice totals, recent activity | Date-range revenue trends, appointment utilization, expense/profit reports, cohort metrics and live event delivery. No fictional charts are shown |
| Telemedicine | Remote visit scheduling, clinician, notes, approved HTTPS meeting link, complete/cancel stages | Video service credentials, secure room creation, participant authentication, waiting rooms, call audit and digital prescription delivery |
| Mobile | Responsive web layout, collapsible navigation, focused forms, horizontal table scrolling, keyboard focus and reduced-motion behavior | No Android/iOS binary, native distribution, push infrastructure, offline medical storage or PWA installation is provided |
| AI | Authorized practice-patient context; clinician-only notes/treatment/exercise drafting, explicit processing authorization, editable output and review acknowledgement before saving an unsigned EMR draft | Requires a configured backend model provider; unavailable providers return an honest error. No automatic treatment decisions, prescriptions or signed notes. No clinical validation or safety certification is implied |
| Customization | Specialty/type-specific form content, publication/archive states, searchable published templates inserted into clinical drafts | Visual form builder, typed custom fields, conditional fields, specialty chart rendering and governed schema migrations |
| Consent & feedback | Patient-linked purposes, evidence/feedback, date, recorder, withdrawal workflow, attributed audit event | Actual consent signing, verified signatures, versioned legal forms and operational enforcement of each consent category. These records do not themselves change care-access grants |
| Multi-location | Branch records, timezones/contacts/hours, active/closed branches, branch filtering, shared-practice membership and authorized practice switching | Fine-grained branch assignments, staff invitations/provisioning UI, branch billing configuration and cross-branch operational scheduling |

The practice registry is independent of the earlier account-owned care workspace. A registry patient's ID is not an Auth profile ID, and adding a registry patient does not grant access to any portal account. Linking those two models needs a verified association flow; name matching must never create permission.

## Backend guarantees implemented

- Every practice route requires an authenticated professional account. Explicit administrator-provisioned membership is required to access another practice. Knowing a patient/record/branch UUID does not confer access.
- Both global doctor role and clinician membership are required to sign clinical records, issue prescriptions, or generate practice AI drafts. Hospital/coordinator accounts cannot finalize clinical records.
- The server owns allowed fields, field limits, value types, workflow transitions and initial statuses. Unknown fields, invalid dates, future birth dates, invalid amounts and cross-practice references are rejected.
- Every resource write supplies a record version and unique request ID. Stale writes return 409; successful retries return the original snapshot. Reusing a request ID for different data, modules or operations fails.
- Local SQLite writes and audit events share a `BEGIN IMMEDIATE` transaction. Supabase writes use a server-only transaction function with row locking and idempotency locking.
- Payment amounts use Decimal/integer minor units, with currency totals reported separately. Recording a payment does not charge a card, move money or imply bank reconciliation.
- Appointment times normalize to UTC. Nonexistent and ambiguous daylight-saving local times are rejected unless an explicit offset disambiguates them. Production SQL uses a GiST exclusion constraint for overlapping active clinician slots.
- Bed occupancy has a production partial unique index. Transfers and discharges update the same versioned admission and audit trail.
- Pharmacy dispensing requires an available, unexpired batch, a registered patient and a valid integer quantity. Two edits cannot silently overwrite stock.
- Resource lists are bounded (25 by default; 100 maximum), with stable timestamp/ID cursor pagination. Patient timelines and per-record audit histories are also paginated. Audit responses omit whole historical clinical snapshots.
- AI generation retrieves practice-scoped context on the server, excludes patient contact fields, checks processing authorization and leaves generated content unsaved. Users review and explicitly save it as an unsigned clinical draft. The context is a limited recent-record snapshot, not a complete chart.

Authorization now uses server-owned module permissions for shared clinician, coordinator, billing, pharmacist, laboratory and HR memberships. Unknown roles fail closed. Lists, individual records, history, patient timelines, summary counts/activity, finance, create/update/actions and AI authorization are checked independently. Nonclinical patient views omit medical history; only pharmacists additionally see recorded allergies. Reception updates preserve medical fields they cannot see. The owner retains full practice administration; clinical finalization additionally requires the global doctor role. Branch assignments, nurse-specific permissions and staff provisioning UI remain outstanding.

## Existing security and reliability fixes

QR pass creation is patient-only and cannot specify another patient. API QR passes are restricted to temporary read access. The previous lifetime QR option is disabled in API mode; ongoing access must use an explicit care-access grant. Signed expiry is enforced, the client cannot upgrade a pass's access type, and revoked passes cannot be replayed by the same recipient. New passes have a random nonce. Receipt creation/granting and receipt revocation/grant removal are transactional locally, with corresponding production RPCs.

Intake no longer copies medical history to another account, invents an age/risk/allergy status, or creates a permanent care-team connection. The patient workspace remains the authorization boundary. QR preview/intake identifies unverified allergy information instead of presenting fabricated penicillin allergy data.

Automatic background ecosystem synchronization after workspace saves was removed. It previously inferred identity from names and silently copied information or created grants. Legacy synchronization code remains dormant; practice resources are written through explicit APIs.

The old AI chat fallback claimed questions were saved and produced a plausible answer on provider failure. It now returns a service-unavailable error without inventing a saved clinical action. Consultation transcription enforces professional role and processing consent.

SQLite connections now close deterministically. The frontend uses same-origin API requests during local development, avoiding cross-hostname cookie failures. Existing care-role views and modals load through separate dynamic imports, so opening one role no longer eagerly imports all three role workflows.

## Files and setup

- `frontend/app/practice/page.tsx`: new route.
- `frontend/components/medora/practice-*.tsx` and `practice.css`: workspace, history/printing, operational views, templates and AI drafting.
- `frontend/lib/practice-api.ts`: typed client; distinct demonstration persistence.
- `backend/medora/practice_catalog.py`: server-owned field/workflow definitions.
- `backend/medora/practice.py`: authorization, resource transactions, timelines, finance, audit and clinician drafting.
- `backend/migrations/002_practice.sql`: production schema and transaction functions.
- `frontend/scripts/sync-practice-catalog.py`: regenerate the non-secret demonstration catalog when module definitions change.

For Supabase, apply migrations **001 then 002 then 003** as the database administrator. Migrations 002 and 003 have not been executed against a live Supabase project in this task. Existing installations must apply them before deploying these backend changes, because access-grant reads also expect the expiry column and expanded staff roles require the updated constraint.

Shared membership is deliberately administrator provisioned:

```sql
insert into public.medora_practice_members(practice_id,user_id,role)
values ('<practice-owner-profile-uuid>','<staff-profile-uuid>','coordinator');
```

Use `clinician` only for verified doctor accounts authorized to finalize clinical records. The authenticated practice selector shows existing memberships; it cannot create privileges.

The local preview used `backend/.preview-practice` with synthetic data and external-provider settings disabled. That directory is ignored by Git. It is separate from the existing `.data` directory and configured remote services. Do not treat its synthetic patient, branch or invoice as migrated production records.

## Verification and deployment limits

Verified locally: strict TypeScript, targeted ESLint for the new practice components/client, 26 frontend regression checks, 73 backend authentication/security/provider/practice tests, a production bundle, and browser checks for branch/patient/invoice creation, partial payment, appointment booking/rescheduling and persistence. Backend tests cover concurrent slot reservation, version conflicts, duplicate/final payment retries, stock limits/expiry, bed conflicts/transfers, signed record immutability, practice isolation, timezone changes, AI authorization and QR revocation. See `docs/audit/practice-qa.md` and its saved desktop/phone screenshots.

The PostgreSQL migration, real Supabase RLS/transaction behavior, insurer/device/messaging/video connections, native app delivery, real AI providers and load under production traffic have not been validated here. SQLite is for local development, not a horizontally scaled deployment. Production uses Postgres-backed resources, but the legacy care workspace still stores large JSON snapshots and needs further migration.

Before a production rollout, the next implementation steps are:

1. Apply and integration-test migration 002 in a staging Supabase project; test real concurrent booking, stock and payment writes against Postgres, not only SQLite.
2. Replace clinician names with staff IDs; add availability and location assignment rules. Add date-range calendar APIs and indexed search.
3. Add branch assignments and staff provisioning to the implemented module permissions. Verify permission revocation and the module boundaries against real Postgres-backed accounts.
4. Normalize invoice lines, payments, stock movements, structured clinical fields and linked amendments. Retain typed invariants in the database.
5. Add a durable outbox and workers before enabling reminders, messages, claim submission or lab imports. Use provider webhook verification, idempotent delivery, retries, dead-letter handling and reconciliation.
6. Implement actual provider adapters and test complete flows against their sandboxes; keep integration indicators honest until they work.
7. Establish measured response-time/error targets, distributed telemetry, dependency timeouts, backup restore drills, retention rules and tested recovery procedures. Validate the complete clinical workflow with intended users.

These are required engineering follow-ups, not claims that the current build has passed a production security assessment or a healthcare compliance certification.
