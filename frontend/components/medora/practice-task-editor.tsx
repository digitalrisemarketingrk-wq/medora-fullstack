'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {Activity, AlertTriangle, ArrowRight, BedDouble, Calendar, CalendarDays, Check, ChevronDown, ChevronRight, CircleAlert, Clock3, FileText, HeartPulse, MapPin, MessageSquare, Package, Pill, Search, ShieldAlert, ShieldCheck, Sparkles, Stethoscope, UserRound, Video, Wallet, X, Zap} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle} from '@/components/ui/alert-dialog';
import {API_MODE, ApiError} from '@/lib/medora-api';
import {practiceApi, type PracticeField, type PracticeModule, type PracticeRecord} from '@/lib/practice-api';
import {PracticeConflictReview} from './practice-conflict-review';
import {PracticeDateTimeField} from './practice-datetime-field';
import {PracticeTemplatePicker} from './practice-template-picker';
import {addPracticeMinutes, FIELD_HINTS, FIELD_PLACEHOLDERS, getPracticeTaskLayout, practiceDatetimeInput, practiceDuration, validateTaskFields} from './practice-form-layout';
import './practice-task-editor.css';

export type PracticeTaskEditorProps = {
  module: PracticeModule;
  record?: PracticeRecord;
  initialData?: Record<string, string>;
  branches: PracticeRecord[];
  branch: string;
  practice: string;
  patientNames: Record<string, string>;
  onClose: () => void;
  onSaved: (record: PracticeRecord) => void;
};

function makeInputs(module: PracticeModule, source: Record<string, string>, zone: string): Record<string, string> {
  return Object.fromEntries(module.fields.map(field => [field.key,
    field.kind === 'datetime-local' && source[field.key]
      ? practiceDatetimeInput(source[field.key], source.timezone || source._timezone || zone)
      : source[field.key] || (field.key === 'timezone' ? zone : field.kind === 'select' ? field.options?.[0] || '' : ''),
  ]));
}

function serverFieldErrors(error: unknown, module: PracticeModule): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  if ('fieldErrors' in error && error.fieldErrors && typeof error.fieldErrors === 'object') return error.fieldErrors as Record<string, string>;
  const field = module.fields.find(item => error.message.toLowerCase().includes(item.label.toLowerCase()));
  return field ? {[field.key]: error.message} : {};
}

export function PracticeTaskEditor({module, record, initialData, branches, branch, practice, patientNames, onClose, onSaved}: PracticeTaskEditorProps) {
  const layout = getPracticeTaskLayout(module);
  const initialBranch = record?.branch_id || branch || branches.find(item => item.status === 'Active')?.id || '';
  const initialZone = branches.find(item => item.id === initialBranch)?.data.timezone || 'Asia/Kolkata';
  const [base, setBase] = useState(record);
  const [data, setData] = useState<Record<string, string>>(() => {
    const value = makeInputs(module, record?.data || initialData || {}, initialZone);
    if (module.key === 'appointments' && value.starts_at && !value.ends_at) value.ends_at = addPracticeMinutes(value.starts_at, 30);
    return value;
  });
  const [selectedBranch, setSelectedBranch] = useState(initialBranch);
  const [duration, setDuration] = useState(() => practiceDuration(data.starts_at, data.ends_at));
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => Object.fromEntries(layout.sections.map(section => [section.key, !section.optional || !!section.openFor?.includes(record?.status || '') || section.fields.some(key => Boolean((record?.data || initialData)?.[key]))])));
  const [branchOpen, setBranchOpen] = useState(!initialBranch);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [branchRequestId] = useState(() => crypto.randomUUID());
  const attempt = useRef<{payload: string; id: string} | null>(null);
  const saveInFlight = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const initialSnapshot = useRef(JSON.stringify({data, branch: initialBranch}));
  const dirty = JSON.stringify({data, branch: selectedBranch}) !== initialSnapshot.current;
  const branchRecord = branches.find(item => item.id === selectedBranch);
  const zone = data.timezone || branchRecord?.data.timezone || initialZone;
  const id = useId();
  const isAppointment = module.key === 'appointments';
  const isPatient = module.key === 'patients';
  const isLab = module.key === 'labs';
  const isIpd = module.key === 'ipd';
  const isPharmacy = module.key === 'pharmacy';
  const isTelemedicine = module.key === 'telemedicine';
  const isComms = module.key === 'communications';
  const isTreatment = module.key === 'treatments';
  const canUseTemplate = ['emr', 'prescriptions', 'treatments', 'consent', 'ipd'].includes(module.key);
  const Icon = module.key === 'patients' ? UserRound : isAppointment ? CalendarDays : ['billing', 'claims'].includes(module.key) ? Wallet : FileText;

  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmExit(true);
    else onClose();
  };
  const set = (key: string, value: string) => {
    setData(old => {
      const next = {...old, [key]: value};
      if (isAppointment && key === 'starts_at' && duration !== 'custom') next.ends_at = addPracticeMinutes(value, Number(duration));
      return next;
    });
    setErrors(old => {const next = {...old}; delete next[key]; return next;});
  };
  const chooseDuration = (value: string) => {
    setDuration(value);
    if (value !== 'custom') set('ends_at', addPracticeMinutes(data.starts_at, Number(value)));
  };
  const focusField = (key: string) => {
    const section = layout.sections.find(item => item.fields.includes(key));
    if (section) setOpenSections(old => ({...old, [section.key]: true}));
    if (key === 'branch_id') setBranchOpen(true);
    if (key === 'ends_at') setDuration('custom');
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(`[data-field-key="${CSS.escape(key)}"] input, [data-field-key="${CSS.escape(key)}"] select, [data-field-key="${CSS.escape(key)}"] textarea`)?.focus());
  };
  const showFieldErrors = (value: Record<string, string>) => {
    setErrors(value);
    setOpenSections(old => ({...old, ...Object.fromEntries(layout.sections.filter(section => section.fields.some(key => value[key])).map(section => [section.key, true]))}));
    if (value.branch_id) setBranchOpen(true);
    if (value.ends_at) setDuration('custom');
    const first = Object.keys(value)[0];
    if (first) focusField(first);
  };
  const toInput = (value: PracticeRecord) => makeInputs(module, value.data, branches.find(item => item.id === value.branch_id)?.data.timezone || initialZone);
  const save = async () => {
    if (saveInFlight.current || conflict) return;
    const fieldErrors = validateTaskFields(module.fields, data);
    if (module.key !== 'locations' && !selectedBranch) fieldErrors.branch_id = 'Choose a branch for this record.';
    if (Object.keys(fieldErrors).length) {showFieldErrors(fieldErrors); setError('Check the highlighted details. Your draft is still here.'); return;}
    saveInFlight.current = true;
    setBusy(true); setError(''); setErrors({});
    try {
      // Submit catalog fields only; internal audit/payment metadata is server-owned.
      const payload = {data: Object.fromEntries(module.fields.map(field => [field.key, data[field.key] || ''])), branch_id: module.key === 'locations' ? branchRequestId : selectedBranch, version: base?.version || 0};
      const fingerprint = JSON.stringify(payload);
      if (attempt.current?.payload !== fingerprint) attempt.current = {payload: fingerprint, id: crypto.randomUUID()};
      const saved = await practiceApi.save(module.key, {...payload, request_id: attempt.current.id}, base, practice);
      initialSnapshot.current = JSON.stringify({data, branch: selectedBranch});
      toast.success(record ? 'Changes saved' : module.key === 'patients' ? 'Patient registered' : 'Saved successfully');
      onSaved(saved);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save. Your draft is still here.');
      const fieldErrors = serverFieldErrors(failure, module);
      if (Object.keys(fieldErrors).length) showFieldErrors(fieldErrors);
      if (failure instanceof ApiError && failure.status === 409 && failure.message.toLowerCase().includes('record changed')) setConflict(true);
    } finally {saveInFlight.current = false; setBusy(false);}
  };

  return <>
    <Dialog open onOpenChange={open => {if (!open) requestClose();}}>
      <DialogContent className="pr-task-drawer" data-module={module.key} showCloseButton={false} onEscapeKeyDown={event => {event.preventDefault(); requestClose();}} onInteractOutside={event => {event.preventDefault(); if (!confirmExit) requestClose();}}>
        <DialogHeader className="pr-task-header">
          <div className="pr-task-heading-line"><span className="pr-task-icon"><Icon size={22}/></span><span className="pr-task-kicker">{module.group} / {module.name}</span><button type="button" className="pr-task-close" aria-label="Close editor" onClick={requestClose} disabled={busy}><X size={21}/></button></div>
          <DialogTitle>{record ? layout.editTitle : layout.title}</DialogTitle>
          <DialogDescription>{layout.description}</DialogDescription>
          {record && <div className="pr-task-version"><span>{record.status}</span>Version {base?.version} · {record.title}</div>}
        </DialogHeader>
        <form ref={form} noValidate className="pr-task-form" onSubmit={event => {event.preventDefault(); void save();}}>
          <div className="pr-task-scroll">
            {module.key !== 'locations' && <section className="pr-task-context" aria-label="Branch context">
              <button type="button" className="pr-task-context-toggle" aria-expanded={branchOpen} aria-controls={id + '-branch'} onClick={() => setBranchOpen(!branchOpen)} disabled={busy}><MapPin size={16}/><span><small>Saving in</small><strong>{branchRecord?.title || 'Choose a branch'}</strong></span>{branchOpen ? <ChevronDown size={17}/> : <ChevronRight size={17}/>}</button>
              {branchOpen && <div id={id + '-branch'} className="pr-task-field" data-field-key="branch_id"><label htmlFor={id + '-branch-input'}>Branch<span aria-hidden="true"> *</span></label><select id={id + '-branch-input'} value={selectedBranch} disabled={busy} aria-required="true" aria-invalid={Boolean(errors.branch_id)} aria-describedby={errors.branch_id ? id + '-branch-error' : undefined} onChange={event => {const next = event.target.value; setSelectedBranch(next); if (isAppointment) set('timezone', branches.find(item => item.id === next)?.data.timezone || 'UTC'); setErrors(old => {const nextErrors = {...old}; delete nextErrors.branch_id; return nextErrors;});}}><option value="">Choose branch</option>{branches.filter(item => item.status === 'Active' || item.id === selectedBranch).map(item => <option key={item.id} value={item.id}>{item.title}{item.status !== 'Active' ? ' · inactive' : ''}</option>)}</select>{errors.branch_id && <small className="pr-task-field-error" id={id + '-branch-error'}>{errors.branch_id}</small>}</div>}
            </section>}

            {Object.keys(errors).length > 0 && <div className="pr-task-error-summary" role="alert"><CircleAlert size={19}/><div><strong>Check {Object.keys(errors).length === 1 ? 'this detail' : 'these details'}</strong><ul>{Object.entries(errors).map(([key, message]) => <li key={key}><button type="button" onClick={() => focusField(key)}>{message}</button></li>)}</ul></div></div>}

            {layout.sections.map((section, index) => {
              const fields = section.fields.flatMap(key => {const field = module.fields.find(item => item.key === key); return field ? [field] : [];});
              if (!fields.length) return null;
              const open = !section.optional || openSections[section.key];
              const filled = fields.filter(field => Boolean(data[field.key]?.trim())).length;
              return <section className={'pr-task-section ' + (section.optional ? 'optional' : '')} key={section.key}>
                {section.optional ? <button type="button" className="pr-task-section-toggle" aria-expanded={open} aria-controls={id + '-section-' + section.key} onClick={() => setOpenSections(old => ({...old, [section.key]: !open}))} disabled={busy}><div><h3>{section.title}</h3><small>{filled ? `${filled} ${filled === 1 ? 'detail' : 'details'} added` : 'Optional · add when needed'}</small></div>{open ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}</button> : <div className="pr-task-section-heading"><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{section.title}</h3>{section.description && <p>{section.description}</p>}</div></div>}
                {open && <div id={id + '-section-' + section.key} className="pr-task-fields">
                  {section.optional && section.description && <p className="pr-task-section-description">{section.description}</p>}
                  {fields.map(field => <PracticeTaskField key={field.key} field={field} value={data[field.key] || ''} zone={zone} practice={practice} initialPatientName={patientNames[data[field.key]]} error={errors[field.key]} disabled={busy} onChange={value => set(field.key, value)}/>)}
                  {isAppointment && (section.key === 'appointment' || section.key === 'visit') && (
                    <div className="pr-task-quick-presets wide">
                      <div className="pr-preset-group">
                        <small className="pr-preset-title">Clinician Quick-Select:</small>
                        <div className="pr-preset-chips">
                          {['Dr. Rajesh Sharma (General Practice)', 'Dr. Amit Patel (Cardiology)', 'Dr. Priya Nair (Dermatology)', 'Dr. Aisha Rahman (Dentistry)'].map(dr => (
                            <button type="button" key={dr} className="pr-preset-chip" onClick={() => set('clinician', dr)} disabled={busy}>
                              {dr}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pr-preset-group">
                        <small className="pr-preset-title">Common Visit Reasons:</small>
                        <div className="pr-preset-chips">
                          {['Initial Clinical Assessment', 'Follow-up Consultation', 'Chronic Care Review', 'Lab Results Review', 'Medication Renewal'].map(rsn => (
                            <button type="button" key={rsn} className="pr-preset-chip" onClick={() => set('reason', rsn)} disabled={busy}>
                              {rsn}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {isPatient && section.key === 'history' && (
                    <div className="pr-form-helper-card wide">
                      <div className="pr-fhc-header amber">
                        <ShieldAlert size={16} />
                        <span>Allergy Safety Reconciliation</span>
                      </div>
                      <p className="pr-fhc-desc">
                        Record verified drug or environmental allergies. These are cross-referenced across prescriptions and clinical notes.
                      </p>
                      <div className="pr-chip-group">
                        {['No known allergies (NKDA)', 'Penicillin', 'Sulfa drugs', 'Aspirin / NSAIDs', 'Latex allergy', 'Cephalosporins'].map(alg => (
                          <button
                            type="button"
                            key={alg}
                            className="pr-helper-chip warning"
                            onClick={() => set('allergies', data.allergies ? `${data.allergies}, ${alg}` : alg)}
                            disabled={busy}
                          >
                            + {alg}
                          </button>
                        ))}
                      </div>
                      <div className="pr-fhc-header teal" style={{ marginTop: '6px' }}>
                        <HeartPulse size={15} />
                        <span>Blood Group Indicator:</span>
                      </div>
                      <div className="pr-chip-group">
                        {['O+ Positive', 'O- Negative', 'A+ Positive', 'A- Negative', 'B+ Positive', 'B- Negative', 'AB+ Positive', 'AB- Negative'].map(bg => (
                          <button
                            type="button"
                            key={bg}
                            className="pr-helper-chip"
                            onClick={() => set('history', data.history ? `${data.history}\nBlood Group: ${bg}` : `Blood Group: ${bg}`)}
                            disabled={busy}
                          >
                            {bg}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isLab && section.key === 'order' && (
                    <div className="pr-form-helper-card wide">
                      <div className="pr-fhc-header blue">
                        <Activity size={16} />
                        <span>Diagnostic Panels & Test Presets:</span>
                      </div>
                      <div className="pr-chip-group">
                        {[
                          { name: 'Complete Blood Count (CBC)', spec: 'Whole Blood (EDTA)' },
                          { name: 'Comprehensive Metabolic Panel (CMP)', spec: 'Serum (SST)' },
                          { name: 'Lipid Profile (Fasting)', spec: 'Fasting Serum' },
                          { name: 'Thyroid Panel (TSH / FT4)', spec: 'Serum' },
                          { name: 'HbA1c Glycated Hemoglobin', spec: 'Whole Blood (EDTA)' },
                          { name: 'Liver Function Tests (LFT)', spec: 'Serum' },
                          { name: 'Renal Function Panel (KFT)', spec: 'Serum' },
                          { name: 'Urinalysis (Routine & Micro)', spec: 'Clean Catch Urine' }
                        ].map(test => (
                          <button
                            type="button"
                            key={test.name}
                            className="pr-helper-chip"
                            onClick={() => {
                              set('title', test.name);
                              set('specimen', test.spec);
                            }}
                            disabled={busy}
                          >
                            + {test.name}
                          </button>
                        ))}
                      </div>
                      <div className="pr-fhc-header teal" style={{ marginTop: '6px' }}>
                        <Stethoscope size={15} />
                        <span>Requesting Clinician Quick-Select:</span>
                      </div>
                      <div className="pr-chip-group">
                        {['Dr. Rajesh Sharma', 'Dr. Amit Patel', 'Dr. Priya Nair', 'Dr. Aisha Rahman'].map(dr => (
                          <button
                            type="button"
                            key={dr}
                            className="pr-helper-chip"
                            onClick={() => set('requested_by', dr)}
                            disabled={busy}
                          >
                            {dr}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isIpd && section.key === 'admission' && (
                    <div className="pr-form-helper-card wide">
                      <div className="pr-fhc-header amber">
                        <BedDouble size={16} />
                        <span>Admission Reason Presets:</span>
                        <button
                          type="button"
                          className="pr-now-btn"
                          onClick={() => set('admitted_at', new Date().toISOString().slice(0, 16))}
                          disabled={busy}
                        >
                          <Clock3 size={11} /> Set Admitted to Now
                        </button>
                      </div>
                      <div className="pr-chip-group">
                        {['Acute Medical Observation', 'Post-Operative Recovery', 'IV Antibiotic Protocol', 'Cardiovascular Monitoring', 'General Surgery Admission'].map(rsn => (
                          <button
                            type="button"
                            key={rsn}
                            className="pr-helper-chip"
                            onClick={() => set('title', rsn)}
                            disabled={busy}
                          >
                            + {rsn}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isIpd && section.key === 'bed' && (
                    <div className="pr-form-helper-card wide">
                      <div className="pr-fhc-header blue">
                        <BedDouble size={16} />
                        <span>Ward & Bed Allocation:</span>
                      </div>
                      <div className="pr-chip-group">
                        {['General Medical Ward', 'Intensive Care Unit (ICU)', 'Semi-Private Ward', 'Deluxe Suite', 'Emergency Bay'].map(w => (
                          <button
                            type="button"
                            key={w}
                            className="pr-helper-chip"
                            onClick={() => set('ward', w)}
                            disabled={busy}
                          >
                            Ward: {w}
                          </button>
                        ))}
                      </div>
                      <div className="pr-chip-group" style={{ marginTop: '4px' }}>
                        {['Bed 101-A', 'Bed 102-B', 'Bed 201', 'Bed 202', 'ICU-01', 'ICU-02', 'Deluxe-01'].map(b => (
                          <button
                            type="button"
                            key={b}
                            className="pr-helper-chip"
                            onClick={() => set('bed', b)}
                            disabled={busy}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isPharmacy && section.key === 'batch' && (
                    <div className="pr-form-helper-card wide">
                      <div className="pr-fhc-header teal">
                        <Pill size={16} />
                        <span>Medicine Formulation Presets:</span>
                        <button
                          type="button"
                          className="pr-now-btn"
                          onClick={() => set('batch', `BATCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)}
                          disabled={busy}
                        >
                          <Sparkles size={11} /> Generate Batch #
                        </button>
                      </div>
                      <div className="pr-chip-group">
                        {[
                          { name: 'Paracetamol 500mg Tablet', unit: 'Tablets' },
                          { name: 'Amoxicillin 500mg Capsule', unit: 'Capsules' },
                          { name: 'Metformin 500mg Tablet', unit: 'Tablets' },
                          { name: 'Atorvastatin 20mg Tablet', unit: 'Tablets' },
                          { name: 'Omeprazole 20mg Capsule', unit: 'Capsules' },
                          { name: 'Cetirizine 10mg Tablet', unit: 'Tablets' },
                          { name: 'Normal Saline 0.9% 500ml IV', unit: 'Bottles' }
                        ].map(drug => (
                          <button
                            type="button"
                            key={drug.name}
                            className="pr-helper-chip"
                            onClick={() => {
                              set('name', drug.name);
                              set('unit', drug.unit);
                            }}
                            disabled={busy}
                          >
                            + {drug.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isTelemedicine && (section.key === 'connection' || section.key === 'visit') && (
                    <div className="pr-form-helper-card wide">
                      <div className="pr-fhc-header violet">
                        <Video size={16} />
                        <span>Virtual Video Room Link:</span>
                        <button
                          type="button"
                          className="pr-now-btn"
                          onClick={() => set('meeting_url', `https://meet.medora.health/room/tele-${crypto.randomUUID().slice(0, 8)}`)}
                          disabled={busy}
                        >
                          <Zap size={11} /> Generate Video Room URL
                        </button>
                      </div>
                      <div className="pr-chip-group">
                        {['Follow-up Video Consultation', 'Lab Results Review', 'Medication Refill Evaluation', 'Specialist Second Opinion'].map(rsn => (
                          <button
                            type="button"
                            key={rsn}
                            className="pr-helper-chip"
                            onClick={() => set('title', rsn)}
                            disabled={busy}
                          >
                            + {rsn}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isComms && section.key === 'message' && (
                    <div className="pr-form-helper-card wide">
                      <div className="pr-fhc-header blue">
                        <MessageSquare size={16} />
                        <span>Approved Clinic Templates:</span>
                      </div>
                      <div className="pr-chip-group">
                        {[
                          { title: 'Appointment Reminder', text: 'Dear Patient, this is a reminder for your upcoming consultation at Medora Clinic. Please arrive 10 minutes early.' },
                          { title: 'Lab Report Ready', text: 'Dear Patient, your recent laboratory diagnostic test reports have been verified by your physician and are ready for review.' },
                          { title: 'Prescription Ready', text: 'Dear Patient, your prescribed medications are prepared and available for pickup at our pharmacy dispensary.' },
                          { title: 'Post-Visit Check-In', text: 'Dear Patient, following your recent visit with our care team, please let us know how your symptoms are resolving.' }
                        ].map(tmpl => (
                          <button
                            type="button"
                            key={tmpl.title}
                            className="pr-helper-chip"
                            onClick={() => {
                              set('title', tmpl.title);
                              set('message', tmpl.text);
                            }}
                            disabled={busy}
                          >
                            {tmpl.title}
                          </button>
                        ))}
                      </div>
                      {data.message && (
                        <div className="pr-bubble-preview">
                          <div className="pr-bubble-preview-title">
                            <MessageSquare size={13} /> {data.channel || 'SMS'} Message Preview
                          </div>
                          <p>{data.message}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {isTreatment && section.key === 'goal' && (
                    <div className="pr-form-helper-card wide">
                      <div className="pr-fhc-header teal">
                        <HeartPulse size={16} />
                        <span>Standard Care Protocols & Goal Chips:</span>
                      </div>
                      <div className="pr-chip-group">
                        {[
                          { title: 'Cardiovascular Risk Protocol', goal: 'Target systolic BP < 130 mmHg, LDL cholesterol reduction > 50%' },
                          { title: 'Type 2 Diabetes Glycemic Plan', goal: 'Target HbA1c < 7.0%, fasting glucose 80-130 mg/dL' },
                          { title: 'Post-Op Wound Healing Course', goal: 'Clean wound healing without erythema, exudate or dehiscence' },
                          { title: 'Physiotherapy & Mobility Protocol', goal: 'Restore active range of motion to > 90 degrees with pain score < 3/10' }
                        ].map(prot => (
                          <button
                            type="button"
                            key={prot.title}
                            className="pr-helper-chip"
                            onClick={() => {
                              set('title', prot.title);
                              set('goals', prot.goal);
                            }}
                            disabled={busy}
                          >
                            + {prot.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isAppointment && section.key === 'schedule' && <>
                    <fieldset className="pr-task-duration" disabled={busy}><legend>Visit duration</legend><div>{['15', '30', '45', '60', '90', 'custom'].map(value => <button type="button" key={value} aria-pressed={duration === value} className={duration === value ? 'selected' : ''} onClick={() => chooseDuration(value)}>{value === 'custom' ? 'Custom' : value + ' min'}</button>)}</div></fieldset>
                    <div className="pr-task-slots-container wide">
                      <div className="pr-slots-header">
                        <span>Select Available Slot:</span>
                        <small>{data.starts_at ? `Selected: ${data.starts_at.replace('T', ' at ')}` : 'Click a time slot to schedule'}</small>
                      </div>
                      <div className="pr-slots-matrix">
                        <div className="pr-slots-period">
                          <small>MORNING</small>
                          <div className="pr-slots-row">
                            {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map(t => {
                              const activeDate = data.starts_at ? data.starts_at.split('T')[0] : new Date().toISOString().slice(0, 10);
                              const full = `${activeDate}T${t}`;
                              const isSelected = data.starts_at?.startsWith(`${activeDate}T${t}`);
                              return (
                                <button type="button" key={t} className={`pr-slot-btn ${isSelected ? 'selected' : ''}`} onClick={() => set('starts_at', full)} disabled={busy}>
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="pr-slots-period">
                          <small>AFTERNOON</small>
                          <div className="pr-slots-row">
                            {['14:00', '14:30', '15:00', '15:30', '16:00', '16:30'].map(t => {
                              const activeDate = data.starts_at ? data.starts_at.split('T')[0] : new Date().toISOString().slice(0, 10);
                              const full = `${activeDate}T${t}`;
                              const isSelected = data.starts_at?.startsWith(`${activeDate}T${t}`);
                              return (
                                <button type="button" key={t} className={`pr-slot-btn ${isSelected ? 'selected' : ''}`} onClick={() => set('starts_at', full)} disabled={busy}>
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    {duration === 'custom' ? <PracticeTaskField field={module.fields.find(field => field.key === 'ends_at')!} value={data.ends_at || ''} zone={zone} practice={practice} error={errors.ends_at} disabled={busy} onChange={value => set('ends_at', value)}/> : <div className="pr-task-visit-summary"><Clock3 size={16}/><span>{data.starts_at && data.ends_at ? `${data.starts_at.replace('T', ' · ')} → ${data.ends_at.split('T')[0] !== data.starts_at.split('T')[0] ? data.ends_at.replace('T', ' · ') : data.ends_at.split('T')[1]}` : 'Choose a start time to set the visit end.'}<small>{zone} · Clinic local time</small></span></div>}
                  </>}
                </div>}
              </section>;
            })}

            {canUseTemplate && <section className="pr-task-template"><button type="button" className="pr-task-link" aria-expanded={templatesOpen} onClick={() => setTemplatesOpen(!templatesOpen)} disabled={busy}>{templatesOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}Use a published documentation template</button>{templatesOpen && <PracticeTemplatePicker module={module.key} practice={practice} disabled={busy} onApply={(key, content) => {if (!busy) {set(key, (data[key] ? data[key] + '\n\n' : '') + content); const section = layout.sections.find(item => item.fields.includes(key)); if (section) setOpenSections(old => ({...old, [section.key]: true}));}}}/>}</section>}
            {layout.notice && <div className="pr-task-notice"><ShieldCheck size={16}/><p>{layout.notice}</p></div>}
            {error && !Object.keys(errors).length && <div className="pr-task-save-error" role="alert"><CircleAlert size={18}/><span>{error}</span></div>}
            {conflict && base && <PracticeConflictReview record={base} module={module} draft={data} toInput={toInput} onResolved={(latest, merged) => {setBase(latest); setData(merged); setSelectedBranch(latest.branch_id); setDuration(practiceDuration(merged.starts_at, merged.ends_at)); setConflict(false); setError('Your merged draft is ready. Review the details, then save.'); setErrors({});}}/>}
          </div>
          <footer className="pr-task-footer"><div className="pr-task-save-state"><ShieldCheck size={14}/><span>{busy ? 'Saving to your practice…' : dirty ? 'Unsaved changes' : API_MODE ? 'Private practice record' : 'Browser demonstration'}<small>{API_MODE ? 'Changes are attributed to your account.' : 'Changes stay in this browser.'}</small></span></div><div className="pr-task-footer-actions"><button type="button" className="pr-button" onClick={requestClose} disabled={busy}>Cancel</button><button type="submit" className="pr-button primary" disabled={busy || conflict}>{busy ? 'Saving…' : record ? 'Save changes' : layout.action}<ArrowRight size={16}/></button></div></footer>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}><AlertDialogContent className="pr-task-exit"><AlertDialogHeader><AlertDialogTitle>Discard this draft?</AlertDialogTitle><AlertDialogDescription>Your changes have not been saved. Keep editing to finish this task, or discard the draft to close it.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={onClose}>Discard draft</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

function PracticeTaskField({field, value, zone, practice, initialPatientName, error, disabled, onChange}: {field: PracticeField; value: string; zone: string; practice: string; initialPatientName?: string; error?: string; disabled: boolean; onChange: (value: string) => void}) {
  const id = useId();
  const hint = FIELD_HINTS[field.key];
  const descriptions = [hint ? id + '-hint' : '', error ? id + '-error' : ''].filter(Boolean).join(' ') || undefined;
  const common = {id, value, disabled, 'aria-required': field.required, 'aria-invalid': Boolean(error), 'aria-describedby': descriptions};
  const wide = field.kind === 'textarea' || field.kind === 'patient' || field.kind === 'datetime-local' || ['name', 'title', 'reason', 'clinician', 'contact', 'payer', 'timezone', 'meeting_url'].includes(field.key);
  return <div className={'pr-task-field ' + (wide ? 'wide' : '')} data-field-key={field.key} role={field.kind === 'patient' || field.kind === 'datetime-local' ? 'group' : undefined} aria-labelledby={field.kind === 'patient' || field.kind === 'datetime-local' ? id + '-label' : undefined} aria-describedby={descriptions}>
    <label id={id + '-label'} htmlFor={field.kind === 'patient' || field.kind === 'datetime-local' ? undefined : id}>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>
    {field.kind === 'textarea' ? <textarea {...common} rows={field.key === 'medications' || field.key === 'content' || field.key === 'message' ? 5 : 3} maxLength={12000} placeholder={FIELD_PLACEHOLDERS[field.key]} onChange={event => onChange(event.target.value)}/>
      : field.kind === 'patient' ? <PracticePatientPicker value={value} practice={practice} initialName={initialPatientName} onChange={onChange} disabled={disabled} required={field.required} error={error}/>
      : field.kind === 'select' ? <select {...common} onChange={event => onChange(event.target.value)}>{field.options?.map(option => <option key={option}>{option}</option>)}</select>
      : field.kind === 'datetime-local' ? <fieldset disabled={disabled} className="pr-task-datetime"><PracticeDateTimeField value={value} label={field.label} timezone={zone} required={false} onChange={onChange}/></fieldset>
      : <input {...common} type={field.kind === 'money' || field.kind === 'number' ? 'number' : ['date', 'email', 'url'].includes(field.kind) ? field.kind : field.key === 'phone' ? 'tel' : 'text'} min={field.kind === 'money' || field.kind === 'number' ? 0 : undefined} step={field.kind === 'money' ? '0.01' : field.kind === 'number' ? '1' : undefined} maxLength={500} inputMode={field.kind === 'money' ? 'decimal' : field.kind === 'number' ? 'numeric' : undefined} autoComplete={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'off'} placeholder={FIELD_PLACEHOLDERS[field.key]} onChange={event => onChange(event.target.value)}/>
    }
    {hint && <small className="pr-task-field-hint" id={id + '-hint'}>{hint}</small>}
    {error && <small className="pr-task-field-error" id={id + '-error'}>{error}</small>}
  </div>;
}

export function PracticePatientPicker({value, practice, onChange, onSelected, initialName, disabled = false, required = true, error}: {value: string; practice: string; onChange: (value: string) => void; onSelected?: (record: PracticeRecord | null) => void; initialName?: string; disabled?: boolean; required?: boolean; error?: string}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(!value);
  const [page, setPage] = useState<{items: PracticeRecord[]; next: boolean; loading: boolean; error: string}>({items: [], next: false, loading: false, error: ''});
  const [selection, setSelection] = useState<{value: string; record: PracticeRecord | null; error: string}>({value: '', record: null, error: ''});
  const selectedCallback = useRef(onSelected);
  const id = useId();
  useEffect(() => {selectedCallback.current = onSelected;}, [onSelected]);
  useEffect(() => {
    let active = true;
    if (!value) {selectedCallback.current?.(null); return;}
    void practiceApi.get(value, practice).then(record => {if (!active) return; if (record.module !== 'patients') throw new Error('The selected record is not a patient.'); setSelection({value, record, error: ''}); selectedCallback.current?.(record);}).catch(() => {if (active) {setSelection({value, record: null, error: 'Selected patient could not be loaded. Check your connection before continuing.'}); selectedCallback.current?.(null);}});
    return () => {active = false;};
  }, [value, practice]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      setPage({items: [], next: false, loading: true, error: ''});
      void practiceApi.list('patients', undefined, undefined, query, practice).then(result => {if (active) setPage({items: result.items, next: Boolean(result.next_cursor), loading: false, error: ''});}).catch(() => {if (active) setPage({items: [], next: false, loading: false, error: 'Patient search could not be loaded. Try another search or retry.'});});
    }, 180);
    return () => {active = false; clearTimeout(timer);};
  }, [query, practice, open]);
  const patient = selection.value === value ? selection.record : null;
  const name = patient?.title || initialName || (value ? 'Selected patient · ' + value.slice(0, 8) : '');
  return <div className="pr-task-patient-picker">
    {value && <div className="pr-task-selected-patient"><span className="pr-task-patient-avatar"><UserRound size={19}/></span><div><strong>{name}</strong><small>{patient?.data.dob ? 'Born ' + patient.data.dob + ' · ' : ''}Record {value.slice(0, 8)}</small></div><Check size={15}/><button type="button" className="pr-task-link" disabled={disabled} aria-expanded={open} aria-controls={id + '-search'} onClick={() => setOpen(!open)}>{open ? 'Done' : 'Change'}</button></div>}
    {open && <div id={id + '-search'} className="pr-task-patient-search"><label className="pr-task-patient-query" htmlFor={id + '-query'}><Search size={16}/><input id={id + '-query'} aria-label="Search registered patients by name" disabled={disabled} autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search patient name…"/></label><label className="pr-sr-only" htmlFor={id + '-results'}>Choose registered patient</label><select id={id + '-results'} aria-required={required} aria-invalid={Boolean(error)} disabled={disabled || page.loading} value={value} onChange={event => {onChange(event.target.value); if (event.target.value) setOpen(false);}}><option value="">{page.loading ? 'Searching patients…' : 'Choose a patient'}</option>{value && !page.items.some(item => item.id === value) && <option value={value}>{name}</option>}{page.items.map(item => <option value={item.id} key={item.id}>{item.title}{item.data.dob ? ' · ' + item.data.dob : ''} · {item.id.slice(0, 8)}</option>)}</select><small className="pr-task-field-hint" role="status">{page.loading ? 'Loading matching patients…' : page.error ? page.error : !page.items.length ? query ? 'No matching patients. Try their full name.' : 'No patients found in this practice.' : page.next ? 'Showing 25 matches. Type a name to narrow your search.' : page.items.length + ' matching ' + (page.items.length === 1 ? 'patient' : 'patients')}</small></div>}
    {value && selection.value === value && selection.error && <small className="pr-task-field-error" role="alert">{selection.error}</small>}
  </div>;
}
