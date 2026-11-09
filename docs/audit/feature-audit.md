# Medora reference feature audit — 2 October 2026

Scope: six supplied feature-flow posters compared with the current local Medora UI. All medical records and providers are fictional. Backend work remains deferred.

| Step | Reference | Before refinement | Missing frontend flow |
| --- | --- | --- | --- |
| 1 | London Healthcare Finder | Partial: search, specialty/funding/access filters, cards, provider detail and booking | Area preferences, service/language/availability filters, saved providers, schematic map and travel preview |
| 2 | Medical Document AI | Partial: file metadata, scripted summary, questions, export | Extraction/terminology preview, comparison, saved summary and sharing preview |
| 3 | Medication Intelligence | Partial: add, reminder time, taken toggle, review task | Prescription import preview, multiple dose times, adherence, refill/review planning and safety-review UI |
| 4 | Family Health Agent | Limited: dependent profile creation and access preview | Member dashboard, shared roles, appointments, vaccination/medication records, caregiver reminders |
| 5 | Appointments & Preparation | Partial: booking, reschedule, cancel, basic checklist | Calendar import/export, visit agenda, editable questions, linked documents, visit summary/action list |
| 6 | Doctor Copilot | Partial: patient selection, summary, scripted scribe, editable notes, referral form, save/export | Separate referral/follow-up/patient-instruction outputs and unified save-to-record workflow |

## Evidence

Current-run screenshots: `01-finder-before.jpg`, `02-documents-before.jpg`, `03-medications-before.jpg`, `04-family-before.jpg`, `05-appointments-before.jpg`, `06-copilot-before.jpg`.

The first view is readable and actions are labelled, but secondary text is visually faint and pages repeat a flat card pattern. Dates and appointment status need stronger hierarchy. Family cards leave the primary care task absent. Buttons need consistent touch targets and visible keyboard focus. Motion should use short transitions and respect reduced motion.

Screenshots establish visible UI and available actions; source inspection establishes the local data operations. No clinical safety validation, real AI, security certification, NHS connection, external calendar sync, live directions, audio transcription, or real caregiver access is claimed.

## Implemented refinement

| Reference flow | Frontend implementation after refinement | Remaining live capability |
| --- | --- | --- |
| London Healthcare Finder | Saved area/preferences; specialty/service, funding, language, accessibility, availability and urgency filters; saved providers; schematic area selector; provider details, travel mode preview and sample booking | GPS, geographic map/routing, verified providers, live availability and clinical symptom matching |
| Medical Document AI | Metadata upload/drop; scripted explanation and glossary; saved editable doctor questions; side-by-side document comparison; save/download summary; recipient/scope/expiry sharing previews | OCR/extraction, clinical analysis, numerical change detection, real file storage and access-controlled sharing |
| Medication Intelligence | Manual creation and prescription-import preview; editable multiple dose times; reminders, daily logs and weekly record; sample stock, refill/review dates; refill care task; safety-review acknowledgement | Scan/OCR, validated doses, drug/allergy checks, scheduled alerts and pharmacy ordering |
| Family Health Agent | Member/all-family dashboard; profile creation; caregiver role/scope previews; appointments with correct member and hospital visibility; vaccination/medication records; local caregiver reminders | Verified dependent consent, actual access enforcement, real records and delivered notifications |
| Appointments & Preparation | Sample booking/rescheduling/cancellation; personal pre-visit form and checklist; saved questions and linked documents; first-event .ics import, manual import and .ics export with optional reminder; visit summary, next-step tasks and family-aware follow-ups | Live appointments, external calendar-account sync, real travel and clinic form submission |
| Doctor Copilot | Patient search/summary; scripted scribe/pause; separate editable clinical note, referral, follow-up and patient-instruction drafts; each draft reviewed separately; unified save/history/download; appropriate patient tasks and shared sample documents | Live transcription, clinical AI, healthcare record integration, actual referral delivery and verified patient instructions |

Shared UI changes: consistent rounded action buttons, short hover/press feedback, colour anchors for feature sections, stronger hierarchy, clearer metadata, responsive feature grids, focus outlines, and reduced-motion support. Existing patient/doctor/hospital demo accounts remain unchanged.

## Verification and limits

TypeScript and 20 source/server-render checks passed after the final implementation. The production build and publication are handled by the site workflow. Source checks cover combined filters, rescheduling provider retention, calendar round-trip/invalid dates, saved-state migration, day-specific dose tracking, all six feature renders and hospital appointments.

The preview browser became unavailable after the baseline audit. Fresh visual/mobile QA and end-to-end interaction verification for the new screens remain **unverified**. No after screenshot or claim of browser verification is made. Responsive CSS and motion are implemented but require a later visual walkthrough.

## Baseline screenshots

These are the original screens captured before refinement, not previews of the new design.

![Finder before refinement](docs/audit/01-finder-before.jpg)
![Documents before refinement](docs/audit/02-documents-before.jpg)
![Medications before refinement](docs/audit/03-medications-before.jpg)
![Family health before refinement](docs/audit/04-family-before.jpg)
![Appointments before refinement](docs/audit/05-appointments-before.jpg)
![Doctor Copilot before refinement](docs/audit/06-copilot-before.jpg)
