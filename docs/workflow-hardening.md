# Existing workflow reliability and security

This pass prioritizes the existing persisted workflows before adding further advertised capabilities. Local API tests are evidence of those implemented contracts; they do not establish full hospital functionality or production readiness.

## Changes

- Shared staff access now follows a server-owned role policy. Unknown or revoked memberships fail closed. The frontend receives permitted modules and write actions from the server. Restricted patient medical fields are excluded from responses and forms; reception edits preserve their stored values.
- Summary activity, patient timelines, individual record history and financial reports obey the same permission boundaries as record lists. Patient timelines apply module filtering before cursor pagination.
- All existing date/time fields normalize to UTC. Appointment records use their explicit clinic timezone; attendance, admissions, communications and remote visits use the branch timezone. Ambiguous or nonexistent daylight-saving times fail validation. Forms display the timezone and appointment defaults follow the chosen branch.
- Valid stock numbers are normalized to integer strings before persistence. Decimal/scientific representations can no longer pass validation and subsequently fail dispensing.
- Identical frontend retries reuse their request identifier; changing the submitted payload allocates a fresh one. This lets users correct an unsuccessful submission without reusing an identifier for a different operation.
- Concurrent record edits retain the draft. Users load the current version, explicitly resolve overlapping field edits, retain nonoverlapping updates, and then save the reviewed draft against the latest version. A finalized current record cannot be merged for editing.
- Patient names for linked records are resolved in one bounded database query, independently of the first registry page. A selected patient remains identifiable when search results change.
- Practice AI requests now use the existing bounded local provider rate limit. Production still needs distributed per-account throttling at the gateway; a process-local IP limit does not scale across workers.
- The frontend rejects an obsolete backend permission contract with a recoverable error rather than rendering unrestricted actions or crashing.

## Shared role policy

| Role | Access |
| --- | --- |
| Clinician | Clinical modules and clinical documentation; pharmacy read-only; cannot change branch configuration |
| Coordinator | Patient demographics, appointments, engagement, communications and consent; cannot read clinical notes, finances or HR |
| Billing | Invoice/claim workflows and patient demographics; cannot edit the registry or read clinical history |
| Pharmacist | Stock/inventory workflows, issued/draft prescription records and recorded patient allergies; cannot edit prescriptions or medical history |
| Laboratory | Lab workflows and patient demographics; clinical review requires a doctor with clinician permission |
| HR | Staff attendance/leave and branch details; no patient registry, clinical or finance access |

The module policy follows [OWASP's authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): deny unconfigured access and validate permissions on each request. Module permissions are not yet branch assignments or row-level staff care-team assignments. Owners still have broad access within their own practice.

## Release gate before expanding features

1. Apply migrations 001–003 to an explicitly designated staging Supabase project; preserve backups and migration logs. Test the server-only RPC and RLS with actual patient/professional/staff accounts.
2. Repeat persisted module lifecycles, invalid transitions, cross-practice/role denial, concurrent booking, payment retries, stock dispensing, bed transfers and membership revocation against that staging backend.
3. Exercise the complete clinical/reception workflow with intended users on desktop and phones. Confirm required fields, understandable errors, keyboard navigation and safe finalization.
4. Measure concurrent traffic, response latency, connection limits and error rates; test backup restoration and dependency outages. No production load or recovery certification has been performed locally.
5. Connect each external service in a sandbox and validate its complete flow before presenting it as available. Current manual claims/message records and meeting links do not imply real submission, delivery or video provisioning.

There is no verified staging target or local PostgreSQL toolchain in this session. Production SQL behavior and external providers therefore remain a concrete validation gap. See `practice-implementation.md` for the remaining feature depth and `audit/practice-qa.md` for test results and browser evidence.
