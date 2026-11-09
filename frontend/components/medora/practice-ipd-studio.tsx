'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  HeartPulse,
  LogOut,
  MapPin,
  Pill,
  Printer,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  UserRound
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { practiceApi, type PracticeModule, type PracticeRecord } from '@/lib/practice-api';
import './practice-ipd-studio.css';

const WARDS = [
  'ICU / Critical Care Bay',
  'Male Medical Ward',
  'Female Surgical Ward',
  'Pediatric Care Wing',
  'Post-Operative Recovery',
  'Deluxe Private Suite'
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

export function PracticeIpdStudio({
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

  const [reason, setReason] = useState(record?.title || initialData?.title || 'Acute Inpatient Admission');
  const [ward, setWard] = useState(record?.data.ward || initialData?.ward || 'Male Medical Ward');
  const [bed, setBed] = useState(record?.data.bed || initialData?.bed || 'Bed 104');
  const [admittedAt, setAdmittedAt] = useState(record?.data.admitted_at || initialData?.admitted_at || new Date().toISOString().slice(0, 16));
  
  const [nursingNotes, setNursingNotes] = useState(record?.data.nursing_notes || '');
  const [procedureNotes, setProcedureNotes] = useState(record?.data.procedure || '');
  const [dischargeSummary, setDischargeSummary] = useState(record?.data.discharge || '');

  // Discharge composer modal state
  const [dischargeModalOpen, setDischargeModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferWard, setTransferWard] = useState(ward);
  const [transferBed, setTransferBed] = useState(bed);

  // Discharge specific fields
  const [conditionAtDischarge, setConditionAtDischarge] = useState('Clinically Stable & Ambulatory');
  const [dischargeMedications, setDischargeMedications] = useState('Continue prescribed oral medications as advised.');
  const [followupAdvice, setFollowupAdvice] = useState('Review in Outpatient Department in 7 days or SOS if symptoms worsen.');

  const [activeTab, setActiveTab] = useState<'chart' | 'summary'>('chart');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Load Patient
  useEffect(() => {
    if (!patientId) return;
    let mounted = true;
    practiceApi.get(patientId, practice)
      .then(p => { if (mounted) setPatient(p); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [patientId, practice]);

  const patientName = patient?.title || patientNames[patientId] || 'Inpatient Beneficiary';
  const isDischarged = base?.status === 'Discharged';

  const persistIpd = async (): Promise<PracticeRecord | null> => {
    if (!patientId || !selectedBranch) {
      setError('Please select patient and branch');
      return null;
    }
    setBusy(true);
    setError('');

    try {
      const dataPayload: Record<string, string> = {
        patient_id: patientId,
        title: reason,
        ward,
        bed,
        admitted_at: admittedAt,
        nursing_notes: nursingNotes,
        procedure: procedureNotes,
        discharge: dischargeSummary
      };

      const payload = {
        data: dataPayload,
        branch_id: selectedBranch,
        version: base?.version || 0,
        request_id: crypto.randomUUID()
      };

      const saved = await practiceApi.save(module.key, payload, base, practice);
      setBase(saved);
      onPersist(saved);
      toast.success('Inpatient record saved');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save inpatient record');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async () => {
    if (!base) return;
    setBusy(true);
    try {
      const updated = await practiceApi.action(base, 'transfer', {
        version: base.version,
        request_id: crypto.randomUUID(),
        ward: transferWard,
        bed: transferBed
      }, practice);
      setBase(updated);
      setWard(transferWard);
      setBed(transferBed);
      setTransferModalOpen(false);
      onPersist(updated);
      toast.success(`Transferred patient to ${transferWard} - ${transferBed}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete transfer');
    } finally {
      setBusy(false);
    }
  };

  const handleDischargeConfirm = async () => {
    if (!base) return;
    setBusy(true);
    try {
      const composedDischarge = `DISCHARGE SUMMARY:\nCondition: ${conditionAtDischarge}\n\nHospital Course & Clinical Summary:\n${dischargeSummary || nursingNotes}\n\nDischarge Medications:\n${dischargeMedications}\n\nFollow-up & Instructions:\n${followupAdvice}`;

      // Save discharge summary text first
      const dataPayload = {
        ...base.data,
        discharge: composedDischarge
      };

      const savedWithSummary = await practiceApi.save(module.key, {
        data: dataPayload,
        branch_id: base.branch_id,
        version: base.version,
        request_id: crypto.randomUUID()
      }, base, practice);

      // Now call discharge action
      const discharged = await practiceApi.action(savedWithSummary, 'status', {
        version: savedWithSummary.version,
        request_id: crypto.randomUUID(),
        status: 'Discharged'
      }, practice);

      setBase(discharged);
      setDischargeSummary(composedDischarge);
      setDischargeModalOpen(false);
      onPersist(discharged);
      toast.success('Patient discharged and bed released');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete discharge');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pr-ipd-studio">
      {/* Top Header */}
      <header className="pr-ipd-topbar">
        <div className="pr-ipd-topbar-left">
          <button className="pr-button-icon" onClick={onClose} disabled={busy}>
            <ArrowLeft size={16} />
          </button>
          <div className="pr-ipd-title-block">
            <div className="pr-eyebrow">INPATIENT ADMISSIONS & BED MANAGEMENT</div>
            <h1>
              {ward} · {bed}
              <span className={`pr-badge ${base?.status === 'Discharged' ? 'good' : 'pending'}`}>
                {base?.status || 'Admitted'}
              </span>
            </h1>
          </div>
        </div>

        <div className="pr-ipd-topbar-actions">
          <div className="pr-ipd-tabs">
            <button
              className={`pr-ipd-tab ${activeTab === 'chart' ? 'active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              <BedDouble size={14} /> Clinical Bed Chart
            </button>
            <button
              className={`pr-ipd-tab ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              <FileCheck size={14} /> Discharge Document
            </button>
          </div>

          <button
            className="pr-button"
            onClick={() => void persistIpd()}
            disabled={busy || isDischarged}
          >
            Save Chart
          </button>

          {!isDischarged && base && (
            <button
              className="pr-button"
              onClick={() => setTransferModalOpen(true)}
              disabled={busy}
            >
              <BedDouble size={14} /> Transfer Bed
            </button>
          )}

          {!isDischarged && base && (
            <button
              className="pr-button primary"
              onClick={() => setDischargeModalOpen(true)}
              disabled={busy}
            >
              <LogOut size={15} /> Compose Discharge Summary
            </button>
          )}

          <button className="pr-button" onClick={() => window.print()}>
            <Printer size={15} /> Print Chart
          </button>
        </div>
      </header>

      {/* Patient & Admission Meta Strip */}
      <section className="pr-ipd-patient-strip">
        <div className="pr-ipd-strip-cell">
          <span className="pr-ipd-label">INPATIENT BENEFICIARY</span>
          <strong>{patientName}</strong>
          {patient?.data.dob && <small>DOB: {patient.data.dob}</small>}
          {patient?.data.allergies && <small className="pr-alert-text">Allergies: {patient.data.allergies}</small>}
        </div>

        <div className="pr-ipd-strip-cell">
          <span className="pr-ipd-label">WARD & BED LOCATION</span>
          <div className="pr-ipd-bed-tag">
            <Building size={14} /> <strong>{ward}</strong> · {bed}
          </div>
          <small>Branch: {branches.find(b => b.id === selectedBranch)?.title || 'Central Clinic'}</small>
        </div>

        <div className="pr-ipd-strip-cell">
          <span className="pr-ipd-label">ADMISSION REASON & TIMESTAMP</span>
          <strong>{reason}</strong>
          <small><Clock size={12} /> Admitted: {new Date(admittedAt).toLocaleString()}</small>
        </div>

        <div className="pr-ipd-strip-cell status">
          <span className="pr-ipd-label">CURRENT INPATIENT STATUS</span>
          <div className="pr-ipd-status-pill">
            <Activity size={15} />
            <strong>{base?.status === 'Discharged' ? 'Discharged / Bed Released' : 'Active Inpatient Occupancy'}</strong>
          </div>
        </div>
      </section>

      {error && <div className="pr-alert error">{error}</div>}

      {/* Main Bed Chart or Formal Summary */}
      {activeTab === 'chart' ? (
        <div className="pr-ipd-grid">
          {/* Main Chart Column */}
          <main className="pr-ipd-chart-col">
            <div className="pr-ipd-panel">
              <div className="pr-ipd-panel-title">
                <h3><Stethoscope size={16} /> Clinical Rounds & Attending Physician Notes</h3>
                <span className="pr-ipd-badge">Physician Documentation</span>
              </div>
              <textarea
                rows={4}
                disabled={isDischarged}
                value={procedureNotes}
                onChange={e => setProcedureNotes(e.target.value)}
                placeholder="Record daily clinical observations, diagnosis progress, procedures performed, or consultations..."
              />
            </div>

            <div className="pr-ipd-panel">
              <div className="pr-ipd-panel-title">
                <h3><HeartPulse size={16} /> Nursing & ICU Monitoring Log</h3>
                <span className="pr-ipd-badge">Vital Monitoring</span>
              </div>
              <textarea
                rows={4}
                disabled={isDischarged}
                value={nursingNotes}
                onChange={e => setNursingNotes(e.target.value)}
                placeholder="Record vital signs (BP, SpO2, Temperature), fluid balance, medication administration, or nursing remarks..."
              />
            </div>

            {dischargeSummary && (
              <div className="pr-ipd-panel discharge-highlight">
                <div className="pr-ipd-panel-title">
                  <h3><FileCheck size={16} /> Recorded Discharge Summary</h3>
                  <span className="pr-ipd-badge green">Discharge Documented</span>
                </div>
                <div className="pr-ipd-summary-view">
                  <pre>{dischargeSummary}</pre>
                </div>
              </div>
            )}
          </main>

          {/* Right Rail */}
          <aside className="pr-ipd-rail">
            <div className="pr-ipd-rail-card">
              <h4>Bed Allocation Details</h4>
              <label>Ward Section:
                <select
                  disabled={isDischarged || !!base}
                  value={ward}
                  onChange={e => setWard(e.target.value)}
                >
                  {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>

              <label>Bed Identifier:
                <input
                  type="text"
                  disabled={isDischarged || !!base}
                  value={bed}
                  onChange={e => setBed(e.target.value)}
                />
              </label>

              <label>Admission Timestamp:
                <input
                  type="datetime-local"
                  disabled={isDischarged}
                  value={admittedAt}
                  onChange={e => setAdmittedAt(e.target.value)}
                />
              </label>
            </div>

            <div className="pr-ipd-rail-card">
              <h4>Clinical Hand-offs</h4>
              {onRelated && (
                <>
                  <button
                    className="pr-ipd-link-btn"
                    onClick={() => base && onRelated(base, 'emr')}
                  >
                    <FileText size={14} /> Open Linked Clinical Worksheet
                  </button>
                  <button
                    className="pr-ipd-link-btn"
                    onClick={() => base && onRelated(base, 'prescriptions')}
                  >
                    <Pill size={14} /> Inpatient Prescription Studio
                  </button>
                  <button
                    className="pr-ipd-link-btn"
                    onClick={() => base && onRelated(base, 'labs')}
                  >
                    <Activity size={14} /> Request Inpatient Diagnostics
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* Formal Printable Discharge Summary */
        <div className="pr-ipd-report-wrap" id="printable-ipd-summary">
          <div className="pr-ipd-paper">
            <div className="pr-ipd-paper-header">
              <div className="pr-report-clinic-brand">
                <div className="pr-brand-logo"><HeartPulse size={24} /></div>
                <div>
                  <h2>MEDORA INPATIENT & SURGICAL HOSPITAL</h2>
                  <p>Inpatient Clinical Services · Department of Hospital Medicine</p>
                  <small>Facility: {branches.find(b => b.id === selectedBranch)?.title || 'Main Hospital'}</small>
                </div>
              </div>
              <div className="pr-report-qr-meta">
                <div className="pr-report-tag">INPATIENT DISCHARGE SUMMARY</div>
                <small>Record ID: {base?.id.slice(0, 8)}</small>
                <small>Discharge Date: {new Date().toLocaleDateString()}</small>
              </div>
            </div>

            <div className="pr-report-divider" />

            <div className="pr-report-patient-grid">
              <div><span>Patient Name:</span> <strong>{patientName}</strong></div>
              <div><span>Patient ID:</span> <strong>{patientId.slice(0, 8)}</strong></div>
              <div><span>Admitted At:</span> <strong>{new Date(admittedAt).toLocaleString()}</strong></div>
              <div><span>Discharge Date:</span> <strong>{new Date().toLocaleDateString()}</strong></div>
              <div><span>Ward & Bed:</span> <strong>{ward} · {bed}</strong></div>
              <div><span>Primary Admission:</span> <strong>{reason}</strong></div>
            </div>

            <div className="pr-report-divider" />

            <div className="pr-ipd-summary-body">
              <h3>HOSPITAL COURSE & CLINICAL PROCEDURES</h3>
              <p>{procedureNotes || 'Managed conservatively with vital sign monitoring and supportive pharmacotherapy.'}</p>

              <h3>NURSING OBSERVATIONS & RECOVERY PROGRESS</h3>
              <p>{nursingNotes || 'Routine vital signs recorded. Patient tolerated normal diet and oral medications.'}</p>

              <h3>FINAL DISCHARGE SUMMARY & ADVICE</h3>
              <pre>{dischargeSummary || 'Patient discharged in stable condition. Advised follow-up in Outpatient Department.'}</pre>
            </div>

            <div className="pr-report-sign-footer">
              <div className="pr-report-sign-col">
                <small>Ward Sister / Nurse Incharge:</small>
                <strong>Medora Nursing Staff</strong>
              </div>
              <div className="pr-report-sign-col right">
                <div className="pr-digital-sign-stamp">
                  <ShieldCheck size={18} />
                  <span>Verified Clinical Discharge</span>
                </div>
                <strong>Attending Consultant Physician</strong>
                <small>Department of Inpatient Medicine</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bed Transfer Modal */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="pr-dialog">
          <DialogHeader>
            <DialogTitle>Transfer Inpatient Bed</DialogTitle>
            <DialogDescription>
              Transfer {patientName} from {ward} ({bed}) to a new location.
            </DialogDescription>
          </DialogHeader>
          <div className="pr-form">
            <label>Destination Ward:
              <select value={transferWard} onChange={e => setTransferWard(e.target.value)}>
                {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
            <label>Destination Bed:
              <input value={transferBed} onChange={e => setTransferBed(e.target.value)} />
            </label>
          </div>
          <div className="pr-form-footer">
            <button className="pr-button" onClick={() => setTransferModalOpen(false)}>Cancel</button>
            <button className="pr-button primary" onClick={handleTransfer} disabled={busy}>
              Confirm Bed Transfer
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discharge Summary Composer Modal */}
      <Dialog open={dischargeModalOpen} onOpenChange={setDischargeModalOpen}>
        <DialogContent className="pr-dialog pr-dialog-wide">
          <DialogHeader>
            <DialogTitle>Compose Inpatient Discharge Summary</DialogTitle>
            <DialogDescription>
              Finalize clinical documentation and release bed {bed} for {patientName}.
            </DialogDescription>
          </DialogHeader>
          <div className="pr-form">
            <label>Condition at Discharge:
              <input
                value={conditionAtDischarge}
                onChange={e => setConditionAtDischarge(e.target.value)}
              />
            </label>
            <label>Hospital Course & Summary:
              <textarea
                rows={3}
                value={dischargeSummary}
                onChange={e => setDischargeSummary(e.target.value)}
                placeholder="Summary of hospital stay, treatments, and clinical response..."
              />
            </label>
            <label>Discharge Medications:
              <textarea
                rows={2}
                value={dischargeMedications}
                onChange={e => setDischargeMedications(e.target.value)}
              />
            </label>
            <label>Follow-up Instructions:
              <textarea
                rows={2}
                value={followupAdvice}
                onChange={e => setFollowupAdvice(e.target.value)}
              />
            </label>
          </div>
          <div className="pr-form-footer">
            <button className="pr-button" onClick={() => setDischargeModalOpen(false)}>Cancel</button>
            <button className="pr-button primary" onClick={handleDischargeConfirm} disabled={busy}>
              <LogOut size={14} /> Finalize Discharge & Release Bed
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
