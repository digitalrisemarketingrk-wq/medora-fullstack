import type {PracticeField, PracticeModule} from '@/lib/practice-api';

export type PracticeFormSection = {
  key: string;
  title: string;
  description?: string;
  fields: string[];
  optional?: boolean;
  openFor?: string[];
};

export type PracticeTaskLayout = {
  title: string;
  editTitle: string;
  action: string;
  description: string;
  sections: PracticeFormSection[];
  notice?: string;
};

const LAYOUTS: Record<string, PracticeTaskLayout> = {
  patients: {
    title: 'Register a patient', editTitle: 'Patient details', action: 'Register patient',
    description: 'Start with the essentials. Add more details when they are needed.',
    sections: [
      {key: 'identity', title: 'Who is the patient?', fields: ['name', 'dob', 'phone', 'email']},
      {key: 'contact', title: 'Address & emergency contact', fields: ['address', 'emergency_contact'], optional: true},
      {key: 'history', title: 'Medical history & allergies', description: 'Record the source of any reported allergy. Blank means not recorded.', fields: ['allergies', 'history'], optional: true},
    ],
  },
  appointments: {
    title: 'Book a visit', editTitle: 'Reschedule or edit visit', action: 'Book visit',
    description: 'Choose the patient, clinician and time. Conflicts are checked when you save.',
    sections: [
      {key: 'visit', title: 'Patient & visit', fields: ['patient_id', 'reason', 'mode']},
      {key: 'schedule', title: 'Clinician & time', fields: ['clinician', 'starts_at']},
      {key: 'notes', title: 'Visit notes', fields: ['notes'], optional: true},
      {key: 'time', title: 'Time settings', description: 'Times are interpreted in this clinic timezone.', fields: ['timezone'], optional: true},
    ],
    notice: 'A saved booking reserves recorded clinician time. Live availability and working hours are not connected.',
  },
  emr: {
    title: 'Start a consultation note', editTitle: 'Consultation note', action: 'Save draft',
    description: 'Document the encounter. Review and signing are separate steps.',
    sections: [
      {key: 'encounter', title: 'Encounter', fields: ['patient_id', 'title']},
      {key: 'assessment', title: 'Clinical assessment', fields: ['observations', 'assessment', 'plan']},
      {key: 'history', title: 'History & document references', fields: ['history', 'attachments'], optional: true},
    ],
  },
  treatments: {
    title: 'Plan treatment', editTitle: 'Treatment & progress', action: 'Save treatment plan',
    description: 'Set a clear goal, then document procedures and progress as care continues.',
    sections: [
      {key: 'goal', title: 'Patient & treatment goal', fields: ['patient_id', 'title', 'goals', 'review_date']},
      {key: 'progress', title: 'Progress & procedures', fields: ['progress', 'procedure'], optional: true, openFor: ['Active', 'Completed']},
      {key: 'assessment', title: 'Specialty assessment', fields: ['assessment'], optional: true},
    ],
  },
  prescriptions: {
    title: 'Draft a prescription', editTitle: 'Prescription draft', action: 'Save prescription draft',
    description: 'Write medication instructions and reconcile allergies before review.',
    sections: [
      {key: 'patient', title: 'Patient & prescription', fields: ['patient_id', 'title']},
      {key: 'medication', title: 'Medication instructions', description: 'Include each medicine, strength, route, frequency and duration.', fields: ['medications', 'allergy_review']},
      {key: 'followup', title: 'Patient advice & review', fields: ['instructions', 'review_date'], optional: true},
    ],
    notice: 'Saving creates a draft. Issuing requires clinical review; digital delivery is a separate integration.',
  },
  billing: {
    title: 'Prepare an invoice', editTitle: 'Invoice draft', action: 'Save invoice draft',
    description: 'Record the total for this charge. Review the draft before issuing it.',
    sections: [
      {key: 'charge', title: 'Who & what is this for?', fields: ['patient_id', 'title']},
      {key: 'total', title: 'Invoice amount', fields: ['amount', 'currency']},
      {key: 'details', title: 'Due date & notes', fields: ['due_date', 'notes'], optional: true},
    ],
    notice: 'This invoice records one total. Payments are recorded after it is issued; saving does not collect funds.',
  },
  claims: {
    title: 'Prepare an insurance claim', editTitle: 'Claim details', action: 'Save claim draft',
    description: 'Collect payer and claim details before an external submission.',
    sections: [
      {key: 'claim', title: 'Patient & payer', fields: ['patient_id', 'title', 'payer', 'policy']},
      {key: 'value', title: 'Claim amount', fields: ['amount', 'currency']},
      {key: 'coding', title: 'Codes & decision notes', fields: ['coding', 'decision'], optional: true, openFor: ['Submitted', 'Approved', 'Rejected']},
    ],
    notice: 'Saving keeps a claim record in this practice. Electronic payer submission is not connected.',
  },
  pharmacy: {
    title: 'Receive a medicine batch', editTitle: 'Medicine batch', action: 'Save medicine batch',
    description: 'Identify the batch and expiry, then record usable stock.',
    sections: [
      {key: 'batch', title: 'Medicine & batch', fields: ['name', 'batch', 'expiry']},
      {key: 'stock', title: 'Stock controls', fields: ['quantity', 'unit', 'reorder']},
      {key: 'supplier', title: 'Supplier', fields: ['supplier'], optional: true},
    ],
  },
  labs: {
    title: 'Request a lab test', editTitle: 'Lab order & results', action: 'Save lab order',
    description: 'Start with the test request. Add results and review when they arrive.',
    sections: [
      {key: 'order', title: 'Test request', fields: ['patient_id', 'title', 'requested_by', 'specimen']},
      {key: 'results', title: 'Results & report reference', fields: ['results', 'report_reference'], optional: true, openFor: ['Result available', 'Reviewed']},
      {key: 'review', title: 'Clinical review', fields: ['review'], optional: true, openFor: ['Reviewed']},
    ],
  },
  ipd: {
    title: 'Admit a patient', editTitle: 'Admission & care notes', action: 'Save admission',
    description: 'Record the admission and allocated bed. Occupied beds are checked when you save.',
    sections: [
      {key: 'admission', title: 'Patient & admission', fields: ['patient_id', 'title', 'admitted_at']},
      {key: 'bed', title: 'Bed allocation', fields: ['ward', 'bed']},
      {key: 'care', title: 'Nursing & procedure notes', fields: ['nursing_notes', 'procedure'], optional: true},
      {key: 'discharge', title: 'Discharge summary', description: 'Prepare the summary before confirming discharge from the admission record.', fields: ['discharge'], optional: true},
    ],
  },
  inventory: {
    title: 'Add a stock item', editTitle: 'Stock item', action: 'Save stock item',
    description: 'Identify an item, record the quantity and set its low-stock threshold.',
    sections: [
      {key: 'item', title: 'Item identity', fields: ['name', 'sku', 'category']},
      {key: 'stock', title: 'Stock controls', fields: ['quantity', 'unit', 'reorder']},
      {key: 'notes', title: 'Item notes', fields: ['notes'], optional: true},
    ],
  },
  crm: {
    title: 'Capture an enquiry', editTitle: 'Enquiry & follow-up', action: 'Save enquiry',
    description: 'Capture the contact and next step without assuming marketing permission.',
    sections: [
      {key: 'contact', title: 'Contact & next step', fields: ['name', 'contact', 'follow_up']},
      {key: 'permission', title: 'Communication permission', fields: ['marketing_consent']},
      {key: 'detail', title: 'Source & notes', fields: ['source', 'notes'], optional: true},
    ],
  },
  communications: {
    title: 'Prepare a patient message', editTitle: 'Message draft', action: 'Save message draft',
    description: 'Prepare a clear message and record the intended channel.',
    sections: [
      {key: 'recipient', title: 'Recipient & channel', fields: ['patient_id', 'channel']},
      {key: 'message', title: 'Message', fields: ['title', 'message']},
      {key: 'schedule', title: 'Planned time', fields: ['scheduled_at'], optional: true},
    ],
    notice: 'This saves a message draft. Email, SMS and WhatsApp delivery are not connected.',
  },
  hr: {
    title: 'Record staff time', editTitle: 'Staff time & leave', action: 'Save time record',
    description: 'Record an attendance period or leave request for approval.',
    sections: [
      {key: 'staff', title: 'Staff member & type', fields: ['name', 'type']},
      {key: 'period', title: 'Time period', fields: ['starts_at', 'ends_at']},
      {key: 'notes', title: 'Supporting notes', fields: ['notes'], optional: true},
    ],
  },
  telemedicine: {
    title: 'Schedule a remote visit', editTitle: 'Remote visit', action: 'Save remote visit',
    description: 'Arrange the consultation and add an approved meeting link when available.',
    sections: [
      {key: 'visit', title: 'Patient & consultation', fields: ['patient_id', 'title']},
      {key: 'time', title: 'Clinician & time', fields: ['clinician', 'starts_at']},
      {key: 'meeting', title: 'Meeting link & notes', fields: ['meeting_url', 'notes'], optional: true},
    ],
    notice: 'Meeting links come from your approved video provider. This form does not create a video room.',
  },
  templates: {
    title: 'Create a documentation template', editTitle: 'Documentation template', action: 'Save template draft',
    description: 'Write a reusable starting point. Patient-specific review is still required.',
    sections: [
      {key: 'template', title: 'Template identity', fields: ['name', 'specialty', 'type']},
      {key: 'content', title: 'Reusable content', fields: ['content']},
    ],
  },
  consent: {
    title: 'Record consent or feedback', editTitle: 'Consent evidence', action: 'Save evidence',
    description: 'Describe what was agreed, by whom and when. Include the source of evidence.',
    sections: [
      {key: 'purpose', title: 'Patient & purpose', fields: ['patient_id', 'title', 'type']},
      {key: 'evidence', title: 'Evidence & attribution', fields: ['evidence', 'recorded_by', 'date']},
    ],
    notice: 'A recorded entry is evidence documentation. It does not collect a digital signature.',
  },
  locations: {
    title: 'Set up a branch', editTitle: 'Branch settings', action: 'Save branch',
    description: 'Give the branch its identity, address and local timezone.',
    sections: [
      {key: 'identity', title: 'Branch details', fields: ['name', 'address', 'timezone']},
      {key: 'contact', title: 'Phone & opening hours', description: 'Hours are descriptive; they do not currently restrict bookings.', fields: ['phone', 'hours'], optional: true},
    ],
  },
};

export function getPracticeCreateLabel(key:string):string {
  const labels:Record<string,string>={patients:'Register patient',appointments:'Book visit',emr:'Start encounter',treatments:'Plan treatment',prescriptions:'Draft prescription',billing:'Prepare invoice',claims:'Create claim',pharmacy:'Add medicine batch',labs:'Request lab work',ipd:'Admit patient',inventory:'Add stock item',crm:'Add follow-up',communications:'Compose message',hr:'Record attendance',telemedicine:'Schedule consultation',templates:'Create template',consent:'Record consent',locations:'Add branch'};
  return labels[key]||'Create record';
}

export function getPracticeTaskLayout(module: PracticeModule): PracticeTaskLayout {
  const layout = LAYOUTS[module.key] || {
    title: 'Create ' + module.name.toLowerCase(), editTitle: module.name, action: 'Save record',
    description: module.description, sections: [{key: 'record', title: 'Record details', fields: module.fields.map(f => f.key)}],
  };
  // Server catalog remains authoritative when a module adds or removes a field.
  const visible = new Set(layout.sections.flatMap(section => section.fields));
  if (module.key === 'appointments') visible.add('ends_at');
  const added = module.fields.filter(field => !visible.has(field.key)).map(field => field.key);
  return added.length ? {...layout, sections: [...layout.sections, {key: 'additional', title: 'Additional details', fields: added}]} : layout;
}

export const FIELD_HINTS: Record<string, string> = {
  allergy_review: 'Document known allergies, the source and what you checked. Do not assume none.',
  reorder: 'Flag this item when recorded stock reaches this quantity.',
  report_reference: 'Reference an existing report or document; this field does not upload a file.',
  attachments: 'Reference existing documents. Uploads are managed in the care workspace.',
  meeting_url: 'Use an HTTPS link from your approved provider.',
  recorded_by: 'Name the person who recorded or witnessed the evidence.',
  timezone: 'IANA timezone, for example Asia/Kolkata or Europe/London.',
  emergency_contact: 'Contact name, relationship and a phone number.',
};

export const FIELD_PLACEHOLDERS: Record<string, string> = {
  name: 'Full name', phone: 'Phone number', email: 'name@example.com', clinician: 'Clinician name',
  reason: 'What is the visit for?', title: 'Describe the purpose', unit: 'For example, tablets or packs',
  ward: 'Ward name', bed: 'Bed identifier', medications: 'Medicine, strength, route, frequency and duration…',
  message: 'Write your message…', content: 'Write your reusable documentation…',
};

export function validateTaskFields(fields: PracticeField[], data: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = (data[field.key] || '').trim();
    if (!value) {
      if (field.required) errors[field.key] = 'Enter ' + field.label.toLowerCase() + '.';
      continue;
    }
    if (field.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.key] = 'Enter a valid email address.';
    if (field.kind === 'date' && !validCalendarDay(value)) errors[field.key] = 'Enter a valid date.';
    if (field.kind === 'datetime-local' && (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value) || !validCalendarDay(value.split('T')[0]))) errors[field.key] = 'Choose a valid date and time.';
    if (field.kind === 'number' && (!/^\d+$/.test(value) || Number(value) > 100000000)) errors[field.key] = 'Enter a whole number between 0 and 100,000,000.';
    if (field.kind === 'money' && (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 100000000)) errors[field.key] = 'Enter a positive amount with up to two decimal places.';
    if (field.kind === 'url') {
      try {if (new URL(value).protocol !== 'https:') errors[field.key] = 'Use a secure HTTPS address.';}
      catch {errors[field.key] = 'Enter a valid HTTPS address.';}
    }
    if (field.key === 'timezone') {
      try {new Intl.DateTimeFormat('en', {timeZone: value}).format();}
      catch {errors[field.key] = 'Enter a valid IANA timezone, such as Asia/Kolkata.';}
    }
  }
  if (data.starts_at && data.ends_at && !errors.starts_at && !errors.ends_at && data.ends_at <= data.starts_at) errors.ends_at = 'End time must be after the start time.';
  return errors;
}

function validCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function practiceDatetimeInput(value: string, zone?: string): string {
  if (!value.includes('Z') && !/[+-]\d\d:\d\d$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: zone || Intl.DateTimeFormat().resolvedOptions().timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(date);
  const get = (key: string) => parts.find(part => part.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

// Arithmetic on the entered clinic wall-clock time; the server resolves timezone/DST.
export function addPracticeMinutes(value: string, minutes: number): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return '';
  const date = new Date(value + ':00Z');
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() + minutes * 60000).toISOString().slice(0, 16);
}

export function practiceDuration(start: string, end: string): string {
  if (!start || !end) return '30';
  const minutes = (new Date(end + ':00Z').getTime() - new Date(start + ':00Z').getTime()) / 60000;
  return [15, 30, 45, 60, 90].includes(minutes) ? String(minutes) : 'custom';
}
