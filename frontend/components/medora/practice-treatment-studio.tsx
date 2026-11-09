'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  HeartPulse,
  ListTodo,
  MapPin,
  Pill,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { practiceApi, type PracticeModule, type PracticeRecord } from '@/lib/practice-api';
import './practice-treatment-studio.css';

export interface TreatmentMilestone {
  id: string;
  stage_name: string;
  description: string;
  completed: boolean;
}

const DEFAULT_MILESTONES: TreatmentMilestone[] = [
  { id: 'm-1', stage_name: 'Phase 1: Diagnostic Assessment & Vitals Clearance', description: 'Confirm baseline vitals, allergy review, and diagnostic results.', completed: true },
  { id: 'm-2', stage_name: 'Phase 2: Primary Clinical Procedure / Intervention', description: 'Perform planned therapeutic intervention according to clinical guidelines.', completed: false },
  { id: 'm-3', stage_name: 'Phase 3: Immediate Post-Intervention Monitoring', description: 'Monitor recovery, pain score assessment, and post-op wound care.', completed: false },
  { id: 'm-4', stage_name: 'Phase 4: Rehabilitation & Long-Term Follow-up', description: 'Lifestyle counselling, medication adherence check, and milestone evaluation.', completed: false }
];

type Props = {
  module: PracticeModule;
  record?: PracticeRecord;
  initialData?: Record<string, string>;
  branches: PracticeRecord[];
  branch: string;
  practice: string;
  patientNames: Record<string, string>;
  readOnly?: boolean;
  canSign: boolean;
  onClose: () => void;
  onPersist: (record: PracticeRecord) => void;
  onRelated?: (record: PracticeRecord, module: string) => void;
};

export function PracticeTreatmentStudio({
  module,
  record,
  initialData,
  branches,
  branch,
  practice,
  patientNames,
  readOnly = false,
  canSign,
  onClose,
  onPersist,
  onRelated
}: Props) {
  const [base, setBase] = useState(record);
  const [patientId, setPatientId] = useState(record?.data.patient_id || initialData?.patient_id || '');
  const [patient, setPatient] = useState<PracticeRecord | null>(null);
  const [selectedBranch, setSelectedBranch] = useState(record?.branch_id || branch || branches[0]?.id || '');

  const [title, setTitle] = useState(record?.title || initialData?.title || 'Comprehensive Care & Treatment Plan');
  const [goals, setGoals] = useState(record?.data.goals || initialData?.goals || 'Achieve clinical symptom remission, normal vital parameters, and improve quality of life.');
  const [procedure, setProcedure] = useState(record?.data.procedure || '');
  const [assessment, setAssessment] = useState(record?.data.assessment || '');
  const [progress, setProgress] = useState(record?.data.progress || '');
  const [reviewDate, setReviewDate] = useState(record?.data.review_date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));

  const [milestones, setMilestones] = useState<TreatmentMilestone[]>(() => {
    if (record?.data.procedure && record.data.procedure.includes('<!--MILESTONES:')) {
      const match = record.data.procedure.match(/<!--MILESTONES:([\s\S]*?)-->/);
      if (match) {
        try { return JSON.parse(match[1]); } catch {}
      }
    }
    return DEFAULT_MILESTONES;
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'planner' | 'document'>('planner');

  // Load Patient
  useEffect(() => {
    if (!patientId) return;
    let mounted = true;
    practiceApi.get(patientId, practice)
      .then(p => { if (mounted) setPatient(p); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [patientId, practice]);

  const patientName = patient?.title || patientNames[patientId] || 'Care Beneficiary';
  const isFinalized = readOnly || base?.status === 'Completed';

  const completedCount = milestones.filter(m => m.completed).length;
  const progressPercent = Math.round((completedCount / (milestones.length || 1)) * 100);

  const toggleMilestone = (id: string) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, completed: !m.completed } : m));
  };

  const addMilestoneRow = () => {
    setMilestones(prev => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        stage_name: `Phase ${prev.length + 1}: Custom Clinical Milestone`,
        description: 'Document procedural target...',
        completed: false
      }
    ]);
  };

  const persistTreatment = async (desiredStatus?: string): Promise<PracticeRecord | null> => {
    if (!patientId || !selectedBranch) {
      setError('Please select patient and branch');
      return null;
    }
    setBusy(true);
    setError('');

    try {
      const milestoneMeta = `<!--MILESTONES:${JSON.stringify(milestones)}-->\n`;
      const fullProcedure = milestoneMeta + procedure;

      const dataPayload: Record<string, string> = {
        patient_id: patientId,
        title,
        goals,
        procedure: fullProcedure,
        assessment,
        progress,
        review_date: reviewDate
      };

      const payload = {
        data: dataPayload,
        branch_id: selectedBranch,
        version: base?.version || 0,
        request_id: crypto.randomUUID()
      };

      let saved = await practiceApi.save(module.key, payload, base, practice);

      if (desiredStatus && desiredStatus !== saved.status) {
        saved = await practiceApi.action(saved, 'status', {
          version: saved.version,
          request_id: crypto.randomUUID(),
          status: desiredStatus
        }, practice);
      }

      setBase(saved);
      onPersist(saved);
      toast.success(desiredStatus ? `Plan updated to ${desiredStatus}` : 'Treatment plan saved');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save treatment plan');
      return null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pr-treatment-studio">
      {/* Top Header */}
      <header className="pr-trm-topbar">
        <div className="pr-trm-topbar-left">
          <button className="pr-button-icon" onClick={onClose} disabled={busy}>
            <ArrowLeft size={16} />
          </button>
          <div className="pr-trm-title-block">
            <div className="pr-eyebrow">CLINICAL TREATMENT PLAN & PROCEDURE PROTOCOL</div>
            <h1>
              {title}
              <span className={`pr-badge ${base?.status === 'Completed' ? 'good' : base?.status === 'Active' ? 'pending' : 'muted'}`}>
                {base?.status || 'Planned'}
              </span>
            </h1>
          </div>
        </div>

        <div className="pr-trm-topbar-actions">
          <div className="pr-trm-tabs">
            <button
              className={`pr-trm-tab ${activeTab === 'planner' ? 'active' : ''}`}
              onClick={() => setActiveTab('planner')}
            >
              <ListTodo size={14} /> Protocol Planner
            </button>
            <button
              className={`pr-trm-tab ${activeTab === 'document' ? 'active' : ''}`}
              onClick={() => setActiveTab('document')}
            >
              <FileCheck size={14} /> Care Plan Document
            </button>
          </div>

          <button
            className="pr-button"
            onClick={() => void persistTreatment()}
            disabled={busy || isFinalized}
          >
            Save Draft
          </button>

          {base?.status === 'Planned' && (
            <button
              className="pr-button primary"
              onClick={() => void persistTreatment('Active')}
              disabled={busy}
            >
              <Check size={15} /> Activate Care Protocol
            </button>
          )}

          {base?.status === 'Active' && (
            <button
              className="pr-button primary"
              onClick={() => void persistTreatment('Completed')}
              disabled={busy}
            >
              <CheckCircle2 size={15} /> Complete Treatment Plan
            </button>
          )}

          <button className="pr-button" onClick={() => window.print()}>
            <Printer size={15} /> Print Plan
          </button>
        </div>
      </header>

      {/* Patient & Goal Strip */}
      <section className="pr-trm-patient-strip">
        <div className="pr-trm-strip-cell">
          <span className="pr-trm-label">PATIENT / BENEFICIARY</span>
          <strong>{patientName}</strong>
          {patient?.data.dob && <small>DOB: {patient.data.dob}</small>}
          {patient?.data.allergies && <small className="pr-alert-text">Allergies: {patient.data.allergies}</small>}
        </div>

        <div className="pr-trm-strip-cell progress">
          <span className="pr-trm-label">MILESTONE EXECUTION PROGRESS</span>
          <div className="pr-trm-progress-bar">
            <div className="pr-trm-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <small>{completedCount} of {milestones.length} Phases Completed ({progressPercent}%)</small>
        </div>

        <div className="pr-trm-strip-cell">
          <span className="pr-trm-label">SCHEDULED RE-EVALUATION DATE</span>
          <div className="pr-trm-date-tag">
            <Calendar size={13} />
            <span>{new Date(reviewDate).toLocaleDateString()}</span>
          </div>
          <small>Next Clinical Review Session</small>
        </div>
      </section>

      {error && <div className="pr-alert error">{error}</div>}

      {/* Main Grid or Document View */}
      {activeTab === 'planner' ? (
        <div className="pr-trm-grid">
          {/* Main Column */}
          <main className="pr-trm-main-col">
            {/* Milestones Checklist */}
            <div className="pr-trm-card">
              <div className="pr-trm-card-header">
                <h3><ListTodo size={16} /> Clinical Milestones & Procedural Phases</h3>
                {!isFinalized && (
                  <button className="pr-button-sm" onClick={addMilestoneRow}>
                    <Plus size={13} /> Add Phase
                  </button>
                )}
              </div>

              <div className="pr-trm-milestones-list">
                {milestones.map((m, index) => (
                  <div key={m.id} className={`pr-trm-milestone-row ${m.completed ? 'completed' : ''}`}>
                    <label className="pr-milestone-checkbox">
                      <input
                        type="checkbox"
                        checked={m.completed}
                        disabled={isFinalized}
                        onChange={() => toggleMilestone(m.id)}
                      />
                      <span className="pr-checkbox-custom" />
                    </label>

                    <div className="pr-milestone-info">
                      <input
                        type="text"
                        className="pr-milestone-title-input"
                        value={m.stage_name}
                        disabled={isFinalized}
                        onChange={e => {
                          const val = e.target.value;
                          setMilestones(prev => prev.map(item => item.id === m.id ? { ...item, stage_name: val } : item));
                        }}
                      />
                      <input
                        type="text"
                        className="pr-milestone-desc-input"
                        value={m.description}
                        disabled={isFinalized}
                        onChange={e => {
                          const val = e.target.value;
                          setMilestones(prev => prev.map(item => item.id === m.id ? { ...item, description: val } : item));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Clinical Goals & Objectives */}
            <div className="pr-trm-card">
              <label htmlFor="trm-goals">
                <HeartPulse size={15} /> Primary Clinical Goals & Desired Outcomes
              </label>
              <textarea
                id="trm-goals"
                rows={3}
                disabled={isFinalized}
                value={goals}
                onChange={e => setGoals(e.target.value)}
                placeholder="Target health outcomes, symptom reduction, physical metrics..."
              />
            </div>

            {/* Procedural Record */}
            <div className="pr-trm-card">
              <label htmlFor="trm-procedure">
                <Stethoscope size={15} /> Operative / Procedural Documentation & Technique
              </label>
              <textarea
                id="trm-procedure"
                rows={4}
                disabled={isFinalized}
                value={procedure}
                onChange={e => setProcedure(e.target.value)}
                placeholder="Record surgical steps, therapeutic modalities, dental tooth chart, or physical therapy regime..."
              />
            </div>

            {/* Progress Notes */}
            <div className="pr-trm-card">
              <label htmlFor="trm-progress">
                <Activity size={15} /> Longitudinal Treatment Progress & Patient Feedback
              </label>
              <textarea
                id="trm-progress"
                rows={3}
                disabled={isFinalized}
                value={progress}
                onChange={e => setProgress(e.target.value)}
                placeholder="Record session notes, patient compliance, pain scale progression..."
              />
            </div>
          </main>

          {/* Right Rail */}
          <aside className="pr-trm-rail">
            <div className="pr-trm-rail-card">
              <h4>Review & Scheduling</h4>
              <label>Next Review Date:
                <input
                  type="date"
                  value={reviewDate}
                  disabled={isFinalized}
                  onChange={e => setReviewDate(e.target.value)}
                />
              </label>
              <div className="pr-trm-quick-dates">
                <button type="button" onClick={() => setReviewDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))}>+1 Week</button>
                <button type="button" onClick={() => setReviewDate(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))}>+2 Weeks</button>
                <button type="button" onClick={() => setReviewDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))}>+1 Month</button>
              </div>
            </div>

            {onRelated && (
              <div className="pr-trm-rail-card">
                <h4>Connected Clinical Handoffs</h4>
                <button
                  className="pr-trm-link-btn"
                  onClick={() => base && onRelated(base, 'appointments')}
                >
                  <Clock size={14} /> Schedule Follow-up Appointment
                </button>
                <button
                  className="pr-trm-link-btn"
                  onClick={() => base && onRelated(base, 'prescriptions')}
                >
                  <Pill size={14} /> Prescribe Supportive Medications
                </button>
                <button
                  className="pr-trm-link-btn"
                  onClick={() => base && onRelated(base, 'billing')}
                >
                  <FileText size={14} /> Invoice Treatment Protocol Fee
                </button>
              </div>
            )}
          </aside>
        </div>
      ) : (
        /* Formal Printable Treatment Plan Document */
        <div className="pr-trm-report-wrap" id="printable-treatment-plan">
          <div className="pr-trm-paper">
            <div className="pr-trm-paper-header">
              <div className="pr-report-clinic-brand">
                <div className="pr-brand-logo"><HeartPulse size={24} /></div>
                <div>
                  <h2>MEDORA SPECIALTY CLINIC & HEALTHCARE</h2>
                  <p>Comprehensive Clinical Care Protocol & Procedure Plan</p>
                  <small>Branch: {branches.find(b => b.id === selectedBranch)?.title || 'Central Facility'}</small>
                </div>
              </div>
              <div className="pr-report-qr-meta">
                <div className="pr-report-tag">TREATMENT PROTOCOL PLAN</div>
                <small>Plan ID: {base?.id.slice(0, 8)}</small>
                <small>Status: {base?.status || 'Active'}</small>
              </div>
            </div>

            <div className="pr-report-divider" />

            <div className="pr-report-patient-grid">
              <div><span>Patient Name:</span> <strong>{patientName}</strong></div>
              <div><span>Patient ID:</span> <strong>{patientId.slice(0, 8)}</strong></div>
              <div><span>Procedure/Plan:</span> <strong>{title}</strong></div>
              <div><span>Next Review:</span> <strong>{new Date(reviewDate).toLocaleDateString()}</strong></div>
            </div>

            <div className="pr-report-divider" />

            <div className="pr-trm-summary-body">
              <h3>PRIMARY CLINICAL GOALS</h3>
              <p>{goals}</p>

              <h3>MILESTONES & PHASES</h3>
              <div className="pr-trm-doc-milestones">
                {milestones.map(m => (
                  <div key={m.id} className="pr-trm-doc-row">
                    <span>{m.completed ? '☑' : '☐'}</span>
                    <div>
                      <strong>{m.stage_name}</strong>
                      <small>{m.description}</small>
                    </div>
                  </div>
                ))}
              </div>

              <h3>PROCEDURAL RECORD & TECHNIQUE</h3>
              <p>{procedure || 'Protocol details documented above.'}</p>

              <h3>PROGRESSION & RECOVERY MONITORING</h3>
              <p>{progress || 'Routine review and evaluation scheduled.'}</p>
            </div>

            <div className="pr-report-sign-footer">
              <div className="pr-report-sign-col">
                <small>Patient Informed & Consented:</small>
                <strong>{patientName}</strong>
              </div>
              <div className="pr-report-sign-col right">
                <div className="pr-digital-sign-stamp">
                  <ShieldCheck size={18} />
                  <span>Authorized Specialist Doctor</span>
                </div>
                <strong>Consultant Specialist</strong>
                <small>Department of Clinical Care</small>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
