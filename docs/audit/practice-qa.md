# Practice workspace verification

Verified against the isolated local SQLite preview with synthetic records. No external messages, insurer claims, payment transactions or real AI requests were sent.

## Automated results

| Check | Result |
| --- | --- |
| Backend full suite | 73 passed after workflow hardening |
| Persisted module lifecycles | All 18 modules: create, update, workflow transitions, re-authentication, reload and audit |
| Shared staff authorization | Six roles checked across lists, individual records, histories, writes, actions, timeline, summary and finance; unknown/revoked memberships rejected |
| Strict TypeScript | Passed |
| ESLint on new practice components, route and API client | Passed; final date/time and navigation changes also checked |
| Existing frontend source/render regression suite | 26 passed |
| Production frontend build | Passed; includes `/practice`; no large-chunk warning after role splitting |
| Client secret scan | 75 final client assets checked; no configured server secret values found |

The backend emits an existing Starlette/httpx TestClient deprecation warning. Build output contains informational plugin timing messages. Neither was a failing check.

## Browser workflows checked

1. Sign in as the synthetic clinician and open the practice workspace.
2. Create an active branch with an IANA timezone, then register a synthetic patient. Verify persistence and audit events after reload.
3. Create and issue a ₹850 invoice. Record a ₹350 synthetic receipt; verify version increment, Part-paid status, attributed payment audit, and ₹500 outstanding in financial insights. This records an accounting fact only; it does not move funds.
4. Book a synthetic visit for 09:00–09:30 Asia/Kolkata, then edit it to 10:00–10:30. Verify UTC persistence, clinic-local display, version increment and updated audit history.
5. Inspect desktop overview, record details and financial insights.
6. Inspect a 390 × 844 phone breakpoint. The main page does not overflow horizontally; tables have their own scroll container. Closed navigation is inert and absent from the accessibility tree. Opening the drawer focuses its first link; Escape closes it and restores focus to Open navigation.
7. Reset the temporary viewport override and close background test tabs.

Date/time entry uses an explicit date field with a calendar picker and a 24-hour time field. This avoids the native combined datetime control's entry ambiguity and keeps clinic timezone context visible. The deferred calendar was opened in the browser, its saved date was correctly selected, and choosing another day updated the draft; that extra test change was discarded. The calendar remains a separate deferred chunk.

Additional browser verification after hardening:

- Two sessions edited the same synthetic patient. The second save succeeded; the first returned a version conflict without discarding its draft. The user selected their draft phone field while preserving the other session's email, then explicitly saved version 3. Both values and audit events were visible after persistence.
- A temporary synthetic coordinator membership exposed only authorized modules. Medical history/allergies were absent from its patient details and registration form; clinical/billing navigation was absent. Branches showed read-only access without an add/edit action. That temporary membership was removed after verification.
- At 390 × 844, patient registration fit the viewport. A visually hidden table heading initially escaped its scrolling container and widened the document. Giving the table container a positioning context fixed it; the final document width and viewport width both measured 390 pixels while the dialog measured approximately 358 pixels. The unsaved test form was cancelled and the viewport override reset.

## Saved visual proof

- `practice-overview-desktop.png`
- `practice-overview-mobile.png`
- `practice-appointment.png`
- `practice-finance.png`
- `practice-concurrent-review.png`
- `practice-role-permissions.png`
- `practice-patient-form-mobile.png`

These screenshots contain synthetic records only and are saved beside this file.

## Not validated

Real Supabase migration execution/RLS/transaction behavior, production load, backups and restoration, live provider integrations, native mobile distribution, clinical safety certification, and full role-by-role hospital operations. The feature-by-feature gaps are listed in `docs/practice-implementation.md`.
