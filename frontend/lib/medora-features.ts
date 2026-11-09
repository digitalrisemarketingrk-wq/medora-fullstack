export type CarePreferences = { area: string; funding: string; language: string; accessible: boolean; availability: string; urgency: string; savedProviders: string[] };
export type MedicationPlan = { times: string[]; stock: number; refillDate: string; reviewDate: string; refillRequested: boolean; safetyReviewed: boolean; doses: Record<string, string[]> };
export type FamilyCare = { caregiver: string; permission: string; reminders: boolean; vaccinations: { id: string; title: string; date: string; status: string }[]; medications: { id: string; name: string; instructions: string; time: string; taken: boolean }[] };
export type VisitAgenda = { questions: string[]; documentIds: string[]; reminder: boolean; notes: string; preVisitForm: { concerns: string; accessNeeds: string; completed: boolean }; actions: { id: string; title: string; done: boolean }[] };
export type FeatureState = {
  carePreferences: CarePreferences;
  medicationPlans: Record<string, MedicationPlan>;
  familyCare: Record<string, FamilyCare>;
  visitAgendas: Record<string, VisitAgenda>;
  savedSummaries: string[];
  documentQuestions: Record<string, string[]>;
  documentShares: { id: string; documentId: string; recipient: string; permission: string; expires: string }[];
  clinicalDrafts: Record<string, Record<string, string>>;
};
const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const emptyMedicationPlan = (time = '08:00'): MedicationPlan => ({ times: [time], stock: 14, refillDate: day(7), reviewDate: day(30), refillRequested: false, safetyReviewed: false, doses: {} });
export const emptyFamilyCare = (): FamilyCare => ({ caregiver: 'You', permission: 'Full access', reminders: true, vaccinations: [], medications: [] });
export const emptyVisitAgenda = (): VisitAgenda => ({ questions: ['What should I understand about my care plan?', 'What are the next steps after this visit?'], documentIds: [], reminder: true, notes: '', preVisitForm: { concerns: '', accessNeeds: '', completed: false }, actions: [] });
export function createFeatureState(): FeatureState {
  return {
    carePreferences: { area: 'Westminster, London', funding: 'All care types', language: 'Any language', accessible: false, availability: 'Any availability', urgency: 'Any urgency', savedProviders: [] },
    medicationPlans: { m1: emptyMedicationPlan('08:00'), m2: { ...emptyMedicationPlan('20:00'), stock: 7, refillDate: day(3), reviewDate: day(14) } },
    familyCare: {
      f1: { ...emptyFamilyCare(), caregiver: 'Jamie Morgan', permission: 'Can book appointments', medications: [{ id: 'fm1', name: 'Sample prescription', instructions: 'Copy and confirm the instructions with the care team.', time: '20:00', taken: false }] },
      f2: { ...emptyFamilyCare(), vaccinations: [{ id: 'fv1', title: 'Vaccination record review', date: day(14), status: 'To discuss' }] },
    },
    visitAgendas: {
      a1: { ...emptyVisitAgenda(), documentIds: ['d1', 'd2'] },
      a2: { ...emptyVisitAgenda(), documentIds: ['d3'] },
      a8: { ...emptyVisitAgenda(), notes: 'Sample visit summary: care goals and the current medication list were reviewed. Follow-up details should be confirmed with the clinician.', actions: [{ id: 'va1', title: 'Prepare questions for the next visit', done: false }, { id: 'va2', title: 'Keep your care documents together', done: false }] },
    },
    savedSummaries: [], documentQuestions: {}, documentShares: [], clinicalDrafts: {},
  };
}
export function mergeFeatureState(saved?: Partial<FeatureState>): FeatureState {
  const initial = createFeatureState();
  return { ...initial, ...saved, carePreferences: { ...initial.carePreferences, ...saved?.carePreferences }, medicationPlans: { ...initial.medicationPlans, ...saved?.medicationPlans }, familyCare: { ...initial.familyCare, ...saved?.familyCare }, visitAgendas: { ...initial.visitAgendas, ...saved?.visitAgendas } };
}
