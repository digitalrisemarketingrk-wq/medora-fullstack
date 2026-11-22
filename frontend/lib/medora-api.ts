'use client';

import type { DemoData, Doc, Role } from './medora-demo';

// Only these public, non-secret settings enter the browser bundle.
export const API_MODE = process.env.NEXT_PUBLIC_DATA_MODE !== 'demo';
export function getApiBase(): string {
  if (typeof window === 'undefined' && process.env.BACKEND_URL) {
    return new URL('api/v1', process.env.BACKEND_URL.endsWith('/') ? process.env.BACKEND_URL : `${process.env.BACKEND_URL}/`).toString().replace(/\/$/, '');
  }
  return (process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1').replace(/\/$/, '');
}
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export type Profile = { id: string; name: string; email: string; role: Role };
export type WorkspaceSnapshot = { owner_id: string; version: number; data: DemoData; can_write?: boolean };
export type Capabilities = { mode: 'local' | 'supabase'; ai: boolean; document_storage: string; semantic_search: boolean; demo_accounts: boolean; max_upload_bytes: number };
export type AccessGrant = { owner_id: string; recipient_id: string; scope: 'read' | 'write'; name: string; email: string };
export type AccessList = { sent: AccessGrant[]; received: AccessGrant[] };
export type DocumentResult = { document: Doc; workspace: WorkspaceSnapshot; indexing_warning?: string | null };

export type QRPass = {
  token: string;
  expires_at: number;
  scan_url: string;
  qr_svg: string;
  patient_name: string;
  access_type?: 'temporary' | 'lifetime';
};

export type QRPassPreview = {
  patient_id: string;
  patient_name: string;
  patient_email: string;
  expires_at: number;
  is_expired: boolean;
  blood_group: string;
  allergies_count: number | null;
  allergy_status?: 'unknown' | 'recorded';
  medications_count: number;
  documents_count: number;
  access_type?: 'temporary' | 'lifetime';
};

export type QRPassIntakeResult = {
  status: 'granted';
  patient_id: string;
  patient_name: string;
  reason: string;
  grant_scope: 'read';
  access_type?: 'temporary' | 'lifetime';
  summary: {
    patient_name: string;
    email: string;
    blood_group: string;
    allergies: string[];
    emergency_contacts: { name: string; relation: string; age?: string }[];
    active_medications: { id: string; name: string; detail: string; time: string }[];
    recent_documents: { id?: string; name?: string; kind?: string; uploaded_at?: string }[];
    clinical_notes: { id?: string; title?: string; body?: string; date?: string }[];
  };
  workspace_url: string;
};

export type TranslatedGlossaryItem = {
  term: string;
  original_term?: string;
  meaning: string;
};

export type TranslatedDocumentData = {
  translated_name: string;
  translated_summary: string;
  translated_findings: string[];
  translated_questions: string[];
  translated_glossary: TranslatedGlossaryItem[];
  cultural_guidance?: string;
  disclaimer?: string;
  language_code?: string;
  language_name?: string;
};

export type TranslationResult = {
  document_id: string;
  language: string;
  language_name: string;
  translation: TranslatedDocumentData;
  cached: boolean;
};

export type ChatCitation = {
  document_id: string;
  document_name: string;
  document_date?: string;
  score: number;
  match_percentage: number;
  excerpt: string;
};

export type ChatResult = {
  answer: string;
  sources: { id: string; name: string }[];
  retrieval: 'semantic-qdrant' | 'semantic' | 'authorised-records';
  citations?: ChatCitation[];
  suggestions?: string[];
  provider?: 'gemini' | 'groq';
};

export type AllergyAlert = {
  substance: string;
  severity: 'high' | 'moderate' | 'low';
  description: string;
  action: string;
};

export type DrugInteraction = {
  drugs: string[];
  severity: 'high' | 'moderate' | 'low';
  mechanism: string;
  recommendation: string;
};

export type DietaryGuideline = {
  medication: string;
  timing: string;
  food_cautions: string;
};

export type MedicationSafetyReport = {
  overall_risk: 'safe' | 'moderate' | 'high';
  summary: string;
  allergy_alerts: AllergyAlert[];
  drug_interactions: DrugInteraction[];
  dietary_guidelines: DietaryGuideline[];
  checked_at: string;
};

export type SOAPNoteResult = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10_suggestions: { code: string; description: string }[];
  formatted_note: string;
  generated_at: string;
  requires_review: boolean;
};

export type DrugRecommendation = {
  drug_name: string;
  generic_name: string;
  category: string;
  dosage_form: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  clinical_rationale: string;
  safety_alert?: string | null;
  contraindicated: boolean;
};

export type PrescriptionRecommendationsReport = {
  query: string;
  safety_summary: string;
  recommendations: DrugRecommendation[];
  suggested_investigations: string[];
  lifestyle_advice: string[];
  checked_at: string;
};

export type ExtractedIssue = {
  issue: string;
  severity?: 'mild' | 'moderate' | 'high';
  icd10?: string;
};

export type ConsultationSessionInsights = {
  clean_transcript: string;
  summary: string;
  identified_issues: ExtractedIssue[];
  suggested_medications: DrugRecommendation[];
  investigations: string[];
  lifestyle_advice: string[];
  generated_at: string;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}) { super(message); this.name = 'ApiError'; }
}

function validationErrors(detail: unknown): Record<string,string> {
  const fields: Record<string,string> = {};
  if (Array.isArray(detail)) for (const issue of detail) {
    if (!issue || typeof issue !== 'object' || !Array.isArray(issue.loc)) continue;
    const key = issue.loc.filter((part:unknown)=>part!=='body'&&part!=='data').join('.');
    if (key && typeof issue.msg === 'string') fields[key] = issue.msg.replace(/^Value error, /,'');
  }
  if (detail && typeof detail === 'object' && 'field_errors' in detail) {
    const values = detail.field_errors;
    if (values && typeof values === 'object') for (const [key,value] of Object.entries(values)) if(typeof value==='string') fields[key]=value;
  }
  return fields;
}

let refreshPending: Promise<Response> | null = null;
export async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  let response: Response;
  const base = getApiBase();
  const url = base.startsWith('http')
    ? new URL(path.startsWith('/') ? path.slice(1) : path, base.endsWith('/') ? base : `${base}/`).toString()
    : base + path;
  try {
    response = await fetch(url, { credentials: 'include', cache: 'no-store', ...init, headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init.headers } });
  } catch { throw new ApiError(0, 'Cannot reach Medora. Check your connection and try again.'); }
  if (response.status === 401 && retry && !['/auth/login', '/auth/signup', '/auth/refresh'].includes(path)) {
    const refreshUrl = base.startsWith('http')
      ? new URL('auth/refresh', base.endsWith('/') ? base : `${base}/`).toString()
      : base + '/auth/refresh';
    refreshPending ??= fetch(refreshUrl, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }).finally(() => { refreshPending = null; });
    if ((await refreshPending).ok) return request<T>(path, init, false);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
    const message = typeof detail === 'string' ? detail : detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string' ? detail.message : response.status === 422 ? 'Some details are invalid. Check the form and try again.' : 'The request could not be completed.';
    throw new ApiError(response.status, message, validationErrors(detail));
  }
  return body as T;
}

const ownerQuery = (owner?: string) => owner ? '?owner_id=' + encodeURIComponent(owner) : '';
const json = (value: unknown) => JSON.stringify(value);
export const api = {
  me: () => request<{ user: Profile }>('/auth/me'),
  login: (email: string, password: string) => request<{ user: Profile }>('/auth/login', { method: 'POST', body: json({ email, password }) }),
  signup: (email: string, password: string, name: string, consent: boolean) => request<{ user: Profile | null; requires_confirmation: boolean }>('/auth/signup', { method: 'POST', body: json({ email, password, name, consent }) }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: '{}' }),
  capabilities: () => request<Capabilities>('/capabilities'),
  workspace: (owner?: string) => request<WorkspaceSnapshot>('/workspace' + ownerQuery(owner)),
  save: (data: DemoData, version: number, owner?: string) => request<WorkspaceSnapshot>('/workspace' + ownerQuery(owner), { method: 'PUT', body: json({ data, version }) }),
  access: () => request<AccessList>('/access'),
  grant: (recipient_email: string, scope: 'read' | 'write') => request<AccessGrant>('/access', { method: 'POST', body: json({ recipient_email, scope }) }),
  revoke: (recipient: string) => request<{ ok: boolean }>('/access/' + encodeURIComponent(recipient), { method: 'DELETE' }),
  upload: (file: File, owner?: string) => { const body = new FormData(); body.append('file', file); return request<DocumentResult>('/documents' + ownerQuery(owner), { method: 'POST', body }); },
  analyse: (id: string, owner?: string) => request<DocumentResult>('/documents/' + encodeURIComponent(id) + '/analyse' + ownerQuery(owner), { method: 'POST', body: '{}' }),
  index: (id: string, owner?: string) => request<{ workspace: WorkspaceSnapshot; chunks: number }>('/documents/' + encodeURIComponent(id) + '/index' + ownerQuery(owner), { method: 'POST', body: '{}' }),
  deleteDocument: (id: string, owner?: string) => request<{ workspace: WorkspaceSnapshot }>('/documents/' + encodeURIComponent(id) + ownerQuery(owner), { method: 'DELETE' }),
  compare: (first_id: string, second_id: string, owner_id?: string) => request<{ comparison: string }>('/ai/compare', { method: 'POST', body: json({ first_id, second_id, owner_id }) }),
  translateDocument: (document_id: string, target_language: string, language_name?: string, owner_id?: string) =>
    request<TranslationResult>('/documents/' + encodeURIComponent(document_id) + '/translate' + ownerQuery(owner_id), { method: 'POST', body: json({ target_language, language_name, owner_id }) }),
  chat: (message: string, history: { role: 'user' | 'assistant'; content: string }[], owner_id?: string, provider: 'gemini' | 'groq' = 'gemini') =>
    request<ChatResult>('/ai/chat', { method: 'POST', body: json({ message, history, owner_id, provider }) }),
  clinical: (kind: string, patient_name: string, context: string, owner_id?: string) => request<{ draft: string; requires_review: boolean }>('/ai/clinical-draft', { method: 'POST', body: json({ kind, patient_name, context, owner_id }) }),
  checkMedicationSafety: (medicines?: any[], allergies?: string[], patient_name?: string, owner_id?: string) =>
    request<MedicationSafetyReport>('/ai/medication-safety', { method: 'POST', body: json({ medicines, allergies, patient_name, owner_id }) }),
  generateSoapNotes: (transcript: string, patient_name?: string, patient_condition?: string, specialty?: string, owner_id?: string) =>
    request<SOAPNoteResult>('/ai/soap-notes', { method: 'POST', body: json({ transcript, patient_name, patient_condition, specialty, owner_id }) }),
  prescriptionRecommendations: (
    query: string,
    patient_name?: string,
    patient_condition?: string,
    patient_age?: number,
    allergies?: string[],
    current_medications?: string[],
    owner_id?: string
  ) =>
    request<PrescriptionRecommendationsReport>('/ai/prescription-recommendations', {
      method: 'POST',
      body: json({
        query,
        patient_name,
        patient_condition,
        patient_age,
        allergies,
        current_medications,
        owner_id
      })
    }),
  consultationSessionInsights: (
    transcript: string,
    patient_name?: string,
    patient_condition?: string,
    patient_age?: number,
    allergies?: string[],
    current_medications?: string[],
    owner_id?: string
  ) =>
    request<ConsultationSessionInsights>('/ai/consultation-session-insights', {
      method: 'POST',
      body: json({
        transcript,
        patient_name,
        patient_condition,
        patient_age,
        allergies,
        current_medications,
        owner_id
      })
    }),
  transcribe: (file: File) => { const body = new FormData(); body.append('file', file); return request<{ transcript: string }>('/ai/transcribe?consent=true', { method: 'POST', body }); },
  speak: async (text: string, language: string = 'en', gender: 'female' | 'male' = 'female', engine: 'auto' | 'gemini' | 'edge' = 'auto'): Promise<Blob> => {
    const base = getApiBase();
    const url = base.startsWith('http')
      ? new URL('ai/speak', base.endsWith('/') ? base : `${base}/`).toString()
      : base + '/ai/speak';
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, gender, engine })
    });
    if (!res.ok) throw new ApiError(res.status, 'Could not synthesize neural voice.');
    return await res.blob();
  },
  generateQRPass: (access_type: 'temporary' | 'lifetime' = 'temporary') => request<QRPass>('/qr-pass/generate', { method: 'POST', body: json({ access_type }) }),
  previewQRPass: (token: string) => request<QRPassPreview>('/qr-pass/preview?token=' + encodeURIComponent(token)),
  intakeQRPass: (token: string, consent_confirmed: boolean, reason: string, access_type?: 'temporary' | 'lifetime') => request<QRPassIntakeResult>('/qr-pass/intake', { method: 'POST', body: json({ token, consent: consent_confirmed, consent_confirmed, reason, access_type }) }),
  disconnectDoctor: (doctor_id: string, reason: string, confirmation: string, consent: boolean) => request<{ ok: boolean; message: string }>('/patient/disconnect-doctor', { method: 'POST', body: json({ doctor_id, reason, confirmation, consent }) }),
  removeDoctorPatient: (patient_id: string) => request<{ ok: boolean; patients: any[] }>('/doctor/patients/' + encodeURIComponent(patient_id), { method: 'DELETE' }),
  clearInactiveDoctorPatients: () => request<{ ok: boolean; patients: any[] }>('/doctor/patients/clear-inactive', { method: 'POST', body: '{}' }),
  downloadOriginal: async (id: string, name: string, owner?: string) => {
    const base = getApiBase();
    const docPath = 'documents/' + encodeURIComponent(id) + '/download' + ownerQuery(owner);
    const originalUrl = base.startsWith('http')
      ? new URL(docPath, base.endsWith('/') ? base : `${base}/`).toString()
      : base + '/' + docPath;
    const fetchOriginal = () => fetch(originalUrl, { credentials: 'include', cache: 'no-store' });
    let response = await fetchOriginal();
    if (response.status === 401) { await request('/auth/me'); response = await fetchOriginal(); }
    if (!response.ok) throw new ApiError(response.status, 'The original document could not be downloaded.');
    if (response.headers.get('Content-Type')?.includes('application/json')) {
      const result = await response.json() as { url: string };
      response = await fetch(result.url, { credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new ApiError(response.status, 'The temporary file link could not be downloaded. Please retry.');
    }
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
