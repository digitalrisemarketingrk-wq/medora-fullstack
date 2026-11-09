# Medora redesign: visual and interaction QA

Date: 11 October 2026. Scope: the clinical worksheet and shared task drawer redesign.

**Findings**

No actionable P0/P1/P2 visual findings remain in the tested states. This result
covers the current iteration, not every feature or every possible product state.

The source is an exploratory concept. The implementation intentionally uses real
synthetic Supabase records, existing permissions and catalog fields. It does not
copy invented vitals, demographics, identity verification, file upload actions or
rich-text controls from the concept.

**Comparison target and normalization**

- Source visual truth: `C:/Users/Dell/Downloads/medora-fullstack/medora-fullstack/docs/design/2026-10-11/option-3.png`.
- Browser implementation: `http://localhost:5173/practice#emr`.
- Final implementation screenshot: `C:/Users/Dell/Downloads/medora-fullstack/medora-fullstack/docs/design/2026-10-11/worksheet-desktop-final.png`.
- Full-view side-by-side evidence, source on the left: `C:/Users/Dell/Downloads/medora-fullstack/medora-fullstack/docs/design/2026-10-11/comparison-final.png`.
- Focused side-by-side section evidence: `C:/Users/Dell/Downloads/medora-fullstack/medora-fullstack/docs/design/2026-10-11/comparison-focus-final.png`.
- Source pixels: 1487 × 1058. Browser CSS viewport: 1487 × 1058. Implementation pixels: 1472 × 1058, excluding the 15 px browser scrollbar. Device density approximately 1. No density resampling was needed. Full comparison canvas: 2959 × 1058.
- The focused canvas uses 740 × 540 crops from each image, aligned to the clinical sections rather than identical page coordinates. Source starts at (285, 290); implementation at (285, 315).
- State: light theme; authenticated hospital sample practice; existing synthetic patient; saved encounter version 3, Draft; care plan expanded; patient history loaded; page at the top.
- Source and implementation differ in clinical content and sidebar module count. Their information hierarchy and section structure can be compared; exact line wrapping of different content cannot establish pixel fidelity.

**Required fidelity surfaces**

| Surface | Evidence and conclusion |
| --- | --- |
| Fonts and typography | The full and focused comparisons preserve a strong page title, medium-weight section titles, restrained helper text and readable previews. The existing Inter/system sans stack is retained; the installed system fallback renders in this browser. Display text is 28 px, section titles 15 px and previews 12 px. No clipped title or preview text was found at the tested sizes. Exact font equivalence with the raster concept is not claimed. |
| Spacing and layout rhythm | The implementation uses an identity strip followed by five compact section rows and a 275 px readiness rail. Excess setup content and the duplicate patient picker were removed. Care plan expansion fits the main task and visible review action in the desktop viewport. Optional references extend slightly below the fold and remain reachable by normal scrolling. Mobile switches to one column without horizontal overflow. |
| Colors and tokens | Pale slate surfaces, white cards, teal actions, subtle separators and amber allergy status preserve the concept's calm clinical hierarchy. Drawer save buttons were unified with the practice teal token. Draft and allergy states use text as well as color. Automated contrast certification was not part of this pass. |
| Image quality and assets | Both the concept and implementation are interface compositions without clinical photography or decorative illustration. The existing Medora brand and Lucide icon system are retained. No raster artwork, logo or illustration was replaced with a handmade approximation. Screenshots were reviewed at native density and focused crops were used to inspect small controls. |
| Copy and content | Task names are specific to the module. Draft, review and signing remain separate actions. Missing clinical information stays unknown or not recorded. Identity and allergy reconciliation prompt confirmation instead of displaying fabricated verification. Synthetic record labels are test data, not product instructions. |

**Comparison history**

| Iteration | Findings and fixes | Evidence and result |
| --- | --- | --- |
| 1 | The first capture had a scroll-state mismatch; it was recaptured at the page top before judging. P2: the repeated patient picker consumed vertical space. P2: excessive row/editor height and small rail text weakened the intended density. | `comparison-1.png` and `implementation-1.png`. Result at this stage: blocked. |
| 2 | Moved patient changes into the identity strip; hid redundant setup controls after selection; aligned titles and previews horizontally; reduced expanded editor and header spacing; increased section and rail type sizes. P2: branch selection was hidden on mobile. | `comparison-2.png` and `implementation-2.png`. Result at this stage: blocked pending mobile correction and recapture. |
| Final | Made the branch selector visible in a wrapping mobile row; standardized drawer action color; captured the loaded, saved record at the same desktop viewport with care plan expanded. Opened source and render together in both full and focused comparison images. No actionable P0/P1/P2 differences remain in this state. | `comparison-final.png`, `comparison-focus-final.png`, `worksheet-desktop-final.png`. Result: passed. |

All evidence filenames in this history are under
`C:/Users/Dell/Downloads/medora-fullstack/medora-fullstack/docs/design/2026-10-11/`.

**Responsive and primary interaction checks**

- Mobile CSS viewport 390 × 844, density approximately 1. Evidence: `worksheet-mobile-final.png` and `booking-mobile-final.png` in the evidence directory above.
- Mobile navigation opens and closes; focus returns to its trigger. Main worksheet content has no horizontal overflow. The branch selector remains available.
- Appointment drawer has a visible sticky footer with a 44 px save action at 390 × 844. A first resize capture was taken before viewport layout settled; reopening and recapturing confirmed that the footer was inside the viewport.
- Blank registration submit shows inline required-field errors and focuses the full-name input. Unsaved registration changes open the discard confirmation; discarding creates no patient.
- Clinical draft save updates the real Supabase record and remains saved after reload. The review dialog shows a summary before confirmation. The test deliberately left the encounter in Draft.
- Follow-up booking carries the selected patient and branch into the appointment drawer. A 45-minute duration produced the correct end time and persisted to Supabase. Editing the saved appointment preserves that duration.
- Final regression review corrected controls that could still mutate a worksheet during a save, and discard/navigation while a commit was pending. All mutating controls and navigation now share the save lock. The follow-up source review found no remaining concrete P0/P1/P2 issue in those paths; artificial network-latency browser stress testing was not performed.
- Final regression review corrected the schedule's initial day and Today to use the backend clinic date. Pagination preserves that original date window. Backend tests cover cross-timezone stock expiry eligibility; browser navigation and Today were exercised with an Asia/Kolkata branch.
- Dialog semantics, visible keyboard focus and section expanded state were inspected. Comprehensive screen-reader, assistive-device and usability studies remain outside this pass.
- Browser console checked after the final interactions: no error entries returned.

**Open questions and follow-up polish**

- There is no separate mobile source mock; mobile was assessed for responsive usability rather than exact visual cloning.
- P3: evaluate typography and task completion with real reception and clinical users on their clinic devices.
- P3: evaluate the entire role-specific journey, including empty/error states in every module, when the remaining domain integrations are implemented.

**Implementation checklist**

- [x] Compare source and browser render together at matched density and state.
- [x] Resolve all P0/P1/P2 findings from this comparison loop.
- [x] Inspect full-view and focused typography/section comparisons.
- [x] Check desktop and mobile core actions.
- [x] Verify persisted clinical save and appointment handoff against Supabase.
- [x] Check final browser console errors.

final result: passed
