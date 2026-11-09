# Medora prototype validation

Original version validated 2 October 2026 with synthetic data in the local preview. The later reference-based refinement has separate verification notes below; earlier browser results do not establish verification of the changed screens.

## Verified workflows

- Demo credential auto-fill and sign-in open the patient workspace.
- Patient booking: an existing time is disabled; review and confirmation create a new appointment. That booking is visible in the hospital workspace.
- Doctor Copilot: patient selection, scripted SOAP draft generation, editing, and local note saving. Saved notes appear in clinical note history.
- Hospital queue: checked-in patient progresses to in consultation and then completed; completed tab reflects the update.
- Account menu switches among all three role workspaces. Reset confirmation restores the seed records.
- Responsive navigation drawer opens and selecting a section closes it.

## Visual checks

- Desktop landing, login, and all three dashboards inspected.
- Patient dashboard, landing, and login inspected inside a 390px viewport fixture. No horizontal document overflow (375px content viewport after scrollbar).
- Login notification region moved outside the CSS grid after visual inspection exposed an empty first cell.
- Text sizes and muted text contrast tightened for dashboard information, forms, tables, and metadata.
- Temporary responsive fixture removed before packaging.

## Technical checks

TypeScript check and static production build run before publishing. Static export provides landing, login, patient, doctor, and hospital pages.

## Prototype limits

Synthetic records, local persistence, mock credential validation, scripted AI, file metadata only, locally saved message drafts, no live video/clinical/calendar connections. Charts include explicitly illustrative trend/forecast series. Selected navigation labels translate; clinical content is illustrative English. Feature-detected WebMCP registration is included; the preview browser did not advertise page tools, so WebMCP invocation validation was unavailable.

## Reference-based refinement

Six current-run baseline screenshots were captured before editing. Source inspection found partial feature implementations and missing intermediate actions. The feature audit records the comparison.

Twenty source and server-render checks passed: combined care filters, urgent/walk-in options, provider retention during rescheduling, UTF-8 calendar round-trip and reminders, impossible calendar-date rejection, first-event import, saved-data migration, day-specific dose status, initial renders of five patient feature workspaces, Doctor Copilot, and the existing hospital appointment view. TypeScript passed after the final code changes. These checks do not simulate browser clicks or certify the visual layout.

The supervised preview remained running, but the browser could no longer reach its entry page. Fresh desktop/mobile visual checks, final interaction walkthroughs, and after screenshots were therefore unavailable. This environment failure was not worked around with another host or live deployment URL. The implementation includes responsive layouts, keyboard focus, larger controls, and reduced-motion handling; their final visual appearance still requires browser review.
