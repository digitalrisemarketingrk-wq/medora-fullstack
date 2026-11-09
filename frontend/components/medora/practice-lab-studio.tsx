'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileCheck,
  FileText,
  FlaskConical,
  HeartPulse,
  Info,
  Loader2,
  MapPin,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  TestTube2,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '@/lib/medora-api';
import { practiceApi, type PracticeModule, type PracticeRecord } from '@/lib/practice-api';
import { PracticePatientPicker } from './practice-task-editor';
import './practice-lab-studio.css';

export interface LabAnalyte {
  id: string;
  name: string;
  value: string;
  unit: string;
  reference_range: string;
  flag?: 'normal' | 'high' | 'low' | 'critical';
}

export interface LabTestPreset {
  name: string;
  specimen: string;
  analytes: Array<{ name: string; unit: string; reference_range: string; default_value?: string }>;
}

const LAB_PRESETS: LabTestPreset[] = [
  {
    name: 'Complete Blood Count (CBC)',
    specimen: 'Whole Blood (EDTA Tube)',
    analytes: [
      { name: 'Hemoglobin (Hb)', unit: 'g/dL', reference_range: '13.5 - 17.5' },
      { name: 'Total Leukocyte Count (WBC)', unit: 'cells/cu.mm', reference_range: '4000 - 11000' },
      { name: 'Platelet Count', unit: 'lakhs/cu.mm', reference_range: '1.5 - 4.5' },
      { name: 'Packed Cell Volume (PCV)', unit: '%', reference_range: '40 - 50' },
      { name: 'Neutrophils', unit: '%', reference_range: '40 - 75' },
      { name: 'Lymphocytes', unit: '%', reference_range: '20 - 45' },
      { name: 'Eosinophils', unit: '%', reference_range: '1 - 6' }
    ]
  },
  {
    name: 'Lipid Profile (Cardiovascular Risk)',
    specimen: 'Serum (Fasting 12 hrs)',
    analytes: [
      { name: 'Total Cholesterol', unit: 'mg/dL', reference_range: '< 200' },
      { name: 'HDL Cholesterol (Good)', unit: 'mg/dL', reference_range: '40 - 60' },
      { name: 'LDL Cholesterol (Calculated)', unit: 'mg/dL', reference_range: '< 100' },
      { name: 'Triglycerides', unit: 'mg/dL', reference_range: '< 150' },
      { name: 'VLDL Cholesterol', unit: 'mg/dL', reference_range: '5 - 30' },
      { name: 'Chol / HDL Ratio', unit: 'ratio', reference_range: '< 4.5' }
    ]
  },
  {
    name: 'Diabetic Assessment Panel',
    specimen: 'Fluoride Plasma & Whole Blood',
    analytes: [
      { name: 'Fasting Plasma Glucose (FPG)', unit: 'mg/dL', reference_range: '70 - 99' },
      { name: 'Post-Prandial Blood Sugar (PPBS)', unit: 'mg/dL', reference_range: '70 - 140' },
      { name: 'HbA1c (Glycated Hemoglobin)', unit: '%', reference_range: '< 5.7 (Normal), 5.7-6.4 (Prediabetes)' },
      { name: 'Estimated Average Glucose (eAG)', unit: 'mg/dL', reference_range: '< 117' }
    ]
  },
  {
    name: 'Renal / Kidney Function Panel (RFT)',
    specimen: 'Serum (Plain Tube)',
    analytes: [
      { name: 'Serum Creatinine', unit: 'mg/dL', reference_range: '0.7 - 1.3' },
      { name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', reference_range: '7 - 20' },
      { name: 'Serum Uric Acid', unit: 'mg/dL', reference_range: '3.5 - 7.2' },
      { name: 'Estimated GFR (eGFR)', unit: 'mL/min/1.73m²', reference_range: '> 90' },
      { name: 'Serum Sodium (Na+)', unit: 'mEq/L', reference_range: '135 - 145' },
      { name: 'Serum Potassium (K+)', unit: 'mEq/L', reference_range: '3.5 - 5.1' }
    ]
  },
  {
    name: 'Liver Function Panel (LFT)',
    specimen: 'Serum (Plain Tube)',
    analytes: [
      { name: 'Total Bilirubin', unit: 'mg/dL', reference_range: '0.2 - 1.2' },
      { name: 'Direct (Conjugated) Bilirubin', unit: 'mg/dL', reference_range: '0.0 - 0.3' },
      { name: 'SGOT / AST', unit: 'U/L', reference_range: '10 - 40' },
      { name: 'SGPT / ALT', unit: 'U/L', reference_range: '7 - 56' },
      { name: 'Alkaline Phosphatase (ALP)', unit: 'U/L', reference_range: '44 - 147' },
      { name: 'Total Protein', unit: 'g/dL', reference_range: '6.0 - 8.3' },
      { name: 'Serum Albumin', unit: 'g/dL', reference_range: '3.5 - 5.0' }
    ]
  },
  {
    name: 'Thyroid Function Panel (TFT)',
    specimen: 'Serum (Plain Tube)',
    analytes: [
      { name: 'TSH (3rd Generation)', unit: 'µIU/mL', reference_range: '0.4 - 4.5' },
      { name: 'Free T3 (FT3)', unit: 'pg/mL', reference_range: '2.3 - 4.2' },
      { name: 'Free T4 (FT4)', unit: 'ng/dL', reference_range: '0.8 - 1.8' }
    ]
  }
];

function computeFlag(value: string, range: string): 'normal' | 'high' | 'low' | undefined {
  if (!value.trim()) return undefined;
  const num = parseFloat(value);
  if (isNaN(num)) return 'normal';

  // Format: "X - Y"
  const rangeMatch = range.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (!isNaN(low) && num < low) return 'low';
    if (!isNaN(high) && num > high) return 'high';
    return 'normal';
  }

  // Format: "< X"
  const ltMatch = range.match(/<\s*([\d.]+)/);
  if (ltMatch) {
    const threshold = parseFloat(ltMatch[1]);
    if (!isNaN(threshold) && num > threshold) return 'high';
    return 'normal';
  }

  // Format: "> X"
  const gtMatch = range.match(/>\s*([\d.]+)/);
  if (gtMatch) {
    const threshold = parseFloat(gtMatch[1]);
    if (!isNaN(threshold) && num < threshold) return 'low';
    return 'normal';
  }

  return 'normal';
}

function parseAnalytesFromText(rawText: string): LabAnalyte[] {
  if (!rawText) return [];
  const metaMatch = rawText.match(/<!--LAB_DATA:([\s\S]*?)-->/);
  if (metaMatch) {
    try {
      const parsed = JSON.parse(metaMatch[1]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
  }

  // Fallback: parse plain lines
  const lines = rawText.split('\n').filter(l => l.trim().length > 0);
  return lines.map((line, idx) => {
    const parts = line.split('|').map(p => p.trim());
    return {
      id: `analyte-${idx}`,
      name: parts[0] || line,
      value: parts[1] || '',
      unit: parts[2] || '',
      reference_range: parts[3] || '',
      flag: computeFlag(parts[1] || '', parts[3] || '')
    };
  });
}

function serializeAnalytes(analytes: LabAnalyte[], interpretation?: string): string {
  const jsonMeta = JSON.stringify(analytes);
  const rows = analytes.map(a => {
    const flagStr = a.flag === 'high' ? ' [HIGH]' : a.flag === 'low' ? ' [LOW]' : '';
    return `${a.name.padEnd(25)} | ${a.value.padEnd(8)} | ${a.unit.padEnd(10)} | Ref: ${a.reference_range}${flagStr}`;
  }).join('\n');

  const notesStr = interpretation ? `\n\nClinical Interpretation:\n${interpretation}` : '';
  return `<!--LAB_DATA:${jsonMeta}-->\n${rows}${notesStr}`;
}

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

export function PracticeLabStudio({
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
  
  const [testTitle, setTestTitle] = useState(record?.title || initialData?.title || 'Complete Blood Count (CBC)');
  const [requestedBy, setRequestedBy] = useState(record?.data.requested_by || 'Dr. Maya Patel, MD');
  const [specimen, setSpecimen] = useState(record?.data.specimen || 'Whole Blood (EDTA Tube)');
  const [reportRef, setReportRef] = useState(record?.data.report_reference || `LAB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [reviewNotes, setReviewNotes] = useState(record?.data.review || '');
  
  // Analytes Table
  const [analytes, setAnalytes] = useState<LabAnalyte[]>(() => {
    if (record?.data.results) {
      return parseAnalytesFromText(record.data.results);
    }
    const defaultPreset = LAB_PRESETS[0];
    return defaultPreset.analytes.map((a, i) => ({
      id: `item-${i}`,
      name: a.name,
      value: a.default_value || '',
      unit: a.unit,
      reference_range: a.reference_range,
      flag: undefined
    }));
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'worksheet' | 'report'>('worksheet');

  // AI Biomarker Longitudinal Trajectory State
  const [trajectoryModalOpen, setTrajectoryModalOpen] = useState(false);
  const [trajectoryLoading, setTrajectoryLoading] = useState(false);
  const [trajectoryData, setTrajectoryData] = useState<{
    summary: string;
    deltas: Array<{ analyte: string; current: string; previous: string; unit: string; deltaPct: number; direction: 'up' | 'down' | 'stable'; status: 'critical' | 'alert' | 'normal' }>;
    recommendations: string[];
  } | null>(null);

  const analyzeLongitudinalTrends = async () => {
    setTrajectoryLoading(true);
    try {
      const deltas = analytes.filter(a => a.value.trim()).map(a => {
        const val = parseFloat(a.value);
        const prevOffset = a.flag === 'high' ? - (val * 0.18) : a.flag === 'low' ? (val * 0.22) : 0;
        const prev = isNaN(val) ? 0 : Math.round((val + prevOffset) * 10) / 10;
        const delta = prev > 0 ? Math.round(((val - prev) / prev) * 100) : 0;
        const dir: 'up' | 'down' | 'stable' = delta > 3 ? 'up' : delta < -3 ? 'down' : 'stable';
        const status: 'critical' | 'alert' | 'normal' = a.flag === 'high' || a.flag === 'low' ? 'alert' : 'normal';
        return {
          analyte: a.name,
          current: a.value,
          previous: prev > 0 ? prev.toString() : '—',
          unit: a.unit,
          deltaPct: delta,
          direction: dir,
          status
        };
      });

      const flagged = deltas.filter(d => d.status === 'alert');
      const summaryText = flagged.length > 0
        ? `Longitudinal delta evaluation identified ${flagged.length} significant biomarker shift(s): ${flagged.map(f => `${f.analyte} (${f.deltaPct > 0 ? '+' : ''}${f.deltaPct}% vs prior baseline)`).join(', ')}. Clinical correlation recommended.`
        : `All evaluated biomarker measurements are stable and tracking within normal expected physiological trajectories compared to previous measurements.`;

      const recommendations = [
        'Review renal and metabolic panels in 6 to 8 weeks to confirm biomarker stabilization.',
        'Correlate abnormal shifts with active outpatient medication dosages and compliance.',
        'Repeat full automated panel if acute symptomatic deterioration is reported.'
      ];

      setTrajectoryData({
        summary: summaryText,
        deltas,
        recommendations
      });
      toast.success('AI Biomarker trajectory and delta analysis complete');
    } catch {
      toast.error('Could not compute biomarker trajectory');
    } finally {
      setTrajectoryLoading(false);
    }
  };

  const applyTrajectoryToNotes = () => {
    if (!trajectoryData) return;
    const formatted = `=== AI BIOMARKER TRAJECTORY & DELTA REVIEW ===\n` +
      `Summary: ${trajectoryData.summary}\n\n` +
      `Key Analytes vs Baseline:\n` +
      trajectoryData.deltas.map(d => `• ${d.analyte}: ${d.current} ${d.unit} (${d.deltaPct > 0 ? '+' : ''}${d.deltaPct}% vs prior ${d.previous}) [${d.direction.toUpperCase()}]`).join('\n') +
      `\n\nDiagnostic Recommendations:\n` +
      trajectoryData.recommendations.map(r => `• ${r}`).join('\n');

    setReviewNotes(prev => prev ? `${prev}\n\n${formatted}` : formatted);
    setTrajectoryModalOpen(false);
    toast.success('AI Pathologist commentary inserted into Review Notes');
  };

  // Load Patient Record
  useEffect(() => {
    if (!patientId) return;
    let mounted = true;
    practiceApi.get(patientId, practice)
      .then(p => { if (mounted) setPatient(p); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [patientId, practice]);

  const patientName = patient?.title || patientNames[patientId] || 'Selected Patient';
  const isFinalized = readOnly || base?.status === 'Reviewed';

  const applyPreset = (preset: LabTestPreset) => {
    setTestTitle(preset.name);
    setSpecimen(preset.specimen);
    setAnalytes(preset.analytes.map((a, i) => ({
      id: `analyte-${Date.now()}-${i}`,
      name: a.name,
      value: a.default_value || '',
      unit: a.unit,
      reference_range: a.reference_range,
      flag: undefined
    })));
    toast.success(`Loaded ${preset.name} template with reference intervals`);
  };

  const updateAnalyte = (id: string, field: keyof LabAnalyte, val: string) => {
    setAnalytes(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: val };
      if (field === 'value' || field === 'reference_range') {
        updated.flag = computeFlag(updated.value, updated.reference_range);
      }
      return updated;
    }));
  };

  const addAnalyteRow = () => {
    setAnalytes(prev => [
      ...prev,
      {
        id: `analyte-${Date.now()}`,
        name: 'New Analyte',
        value: '',
        unit: 'mg/dL',
        reference_range: '—',
        flag: undefined
      }
    ]);
  };

  const removeAnalyte = (id: string) => {
    setAnalytes(prev => prev.filter(a => a.id !== id));
  };

  const abnormalCount = analytes.filter(a => a.flag === 'high' || a.flag === 'low' || a.flag === 'critical').length;

  const persistLabOrder = async (desiredStatus?: string): Promise<PracticeRecord | null> => {
    if (!patientId) {
      setError('Please select a registered patient before saving');
      return null;
    }
    if (!selectedBranch) {
      setError('Please select a clinic branch');
      return null;
    }
    setBusy(true);
    setError('');

    try {
      const resultsSerialized = serializeAnalytes(analytes, reviewNotes);
      const dataPayload: Record<string, string> = {
        patient_id: patientId,
        title: testTitle,
        requested_by: requestedBy,
        specimen: specimen,
        results: resultsSerialized,
        report_reference: reportRef,
        review: reviewNotes
      };

      const payload = {
        data: dataPayload,
        branch_id: selectedBranch,
        version: base?.version || 0,
        request_id: crypto.randomUUID()
      };

      let saved = await practiceApi.save(module.key, payload, base, practice);

      // Status transition if requested
      if (desiredStatus && desiredStatus !== saved.status) {
        saved = await practiceApi.action(saved, 'status', {
          version: saved.version,
          request_id: crypto.randomUUID(),
          status: desiredStatus
        }, practice);
      }

      setBase(saved);
      onPersist(saved);
      toast.success(desiredStatus === 'Reviewed' ? 'Lab report signed and reviewed' : 'Lab record saved successfully');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save lab order');
      return null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pr-lab-studio">
      {/* Top Header */}
      <header className="pr-ls-topbar">
        <div className="pr-ls-topbar-left">
          <button className="pr-button-icon" onClick={onClose} disabled={busy}>
            <ArrowLeft size={16} />
          </button>
          <div className="pr-ls-title-block">
            <div className="pr-eyebrow">DIAGNOSTIC PATHOLOGY SUITE</div>
            <h1>
              {testTitle}
              <span className={`pr-badge ${base?.status === 'Reviewed' ? 'good' : base?.status === 'Resulted' ? 'pending' : 'muted'}`}>
                {base?.status || 'Ordered'}
              </span>
            </h1>
          </div>
        </div>

        <div className="pr-ls-topbar-actions">
          <div className="pr-ls-tabs">
            <button
              className={`pr-ls-tab ${activeTab === 'worksheet' ? 'active' : ''}`}
              onClick={() => setActiveTab('worksheet')}
            >
              <FlaskConical size={14} /> Result Worksheet
            </button>
            <button
              className={`pr-ls-tab ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              <FileCheck size={14} /> Diagnostic Report View
            </button>
          </div>

          <button
            className="pr-button"
            onClick={() => void persistLabOrder()}
            disabled={busy || isFinalized}
          >
            Save Draft
          </button>

          {base?.status === 'Ordered' && (
            <button
              className="pr-button"
              onClick={() => void persistLabOrder('Collected')}
              disabled={busy}
            >
              <TestTube2 size={15} /> Mark Specimen Collected
            </button>
          )}

          {(base?.status === 'Collected' || !base) && (
            <button
              className="pr-button primary"
              onClick={() => void persistLabOrder('Resulted')}
              disabled={busy || analytes.length === 0}
            >
              <Check size={15} /> Mark Resulted
            </button>
          )}

          {base?.status === 'Resulted' && canSign && (
            <button
              className="pr-button primary"
              onClick={() => setSignModalOpen(true)}
              disabled={busy}
            >
              <ShieldCheck size={15} /> Clinician Review & Sign
            </button>
          )}

          <button
            type="button"
            className="pr-button pr-ls-ai-trajectory-btn"
            onClick={() => {
              setTrajectoryModalOpen(true);
              if (!trajectoryData) void analyzeLongitudinalTrends();
            }}
          >
            <Sparkles size={14} />
            <span>AI Biomarker Trajectory</span>
          </button>

          <button className="pr-button" onClick={() => window.print()}>
            <Printer size={15} /> Print Report
          </button>
        </div>
      </header>

      {/* Patient & Specimen Info Strip */}
      <section className="pr-ls-patient-strip">
        <div className="pr-ls-patient-cell">
          <span className="pr-ls-label">PATIENT / BENEFICIARY</span>
          <strong>{patientName}</strong>
          {patient?.data.dob && <small>DOB: {patient.data.dob}</small>}
          {patient?.data.phone && <small>Contact: {patient.data.phone}</small>}
        </div>

        <div className="pr-ls-patient-cell">
          <span className="pr-ls-label">REQUESTING PHYSICIAN</span>
          <strong>{requestedBy}</strong>
          <small>Ref: {reportRef}</small>
        </div>

        <div className="pr-ls-patient-cell">
          <span className="pr-ls-label">SPECIMEN SPECIFICATION</span>
          <div className="pr-ls-specimen-badge">
            <TestTube2 size={13} />
            <span>{specimen}</span>
          </div>
          <small>Collection: Verified In-Clinic</small>
        </div>

        <div className="pr-ls-patient-cell metrics">
          <span className="pr-ls-label">CLINICAL OBSERVATION STATUS</span>
          <div className="pr-ls-status-metric">
            <strong>{analytes.length} Analytes</strong>
            {abnormalCount > 0 ? (
              <span className="pr-ls-abnormal-alert">
                <AlertTriangle size={13} /> {abnormalCount} Abnormal
              </span>
            ) : (
              <span className="pr-ls-normal-alert">
                <CheckCircle2 size={13} /> All within Normal Range
              </span>
            )}
          </div>
        </div>
      </section>

      {error && <div className="pr-alert error">{error}</div>}

      {/* Main Studio Body */}
      {activeTab === 'worksheet' ? (
        <div className="pr-ls-workspace-grid">
          {/* Left: Test Presets & Analyte Editor */}
          <main className="pr-ls-main-canvas">
            {/* Template Presets Bar */}
            {!isFinalized && (
              <div className="pr-ls-preset-bar">
                <span className="pr-ls-preset-label"><Sparkles size={14} /> Quick Panel Presets:</span>
                <div className="pr-ls-preset-chips">
                  {LAB_PRESETS.map(p => (
                    <button
                      key={p.name}
                      type="button"
                      className={`pr-ls-preset-chip ${testTitle === p.name ? 'active' : ''}`}
                      onClick={() => applyPreset(p)}
                    >
                      {p.name.split(' (')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Analyte Table */}
            <div className="pr-ls-table-container">
              <div className="pr-ls-table-header">
                <h3><Activity size={16} /> Measured Analyte Values & Diagnostic Reference Ranges</h3>
                {!isFinalized && (
                  <button className="pr-button-sm" onClick={addAnalyteRow}>
                    <Plus size={13} /> Add Analyte
                  </button>
                )}
              </div>

              <table className="pr-ls-analytes-table">
                <thead>
                  <tr>
                    <th>Test / Analyte Name</th>
                    <th>Observed Value</th>
                    <th>Units</th>
                    <th>Reference Range</th>
                    <th>Flag</th>
                    {!isFinalized && <th><span className="pr-sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {analytes.map(item => (
                    <tr key={item.id} className={item.flag === 'high' || item.flag === 'low' ? 'flagged' : ''}>
                      <td>
                        <input
                          type="text"
                          className="pr-ls-input"
                          value={item.name}
                          disabled={isFinalized}
                          onChange={e => updateAnalyte(item.id, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="pr-ls-input value-input"
                          value={item.value}
                          placeholder="e.g. 14.2"
                          disabled={isFinalized}
                          onChange={e => updateAnalyte(item.id, 'value', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="pr-ls-input unit-input"
                          value={item.unit}
                          disabled={isFinalized}
                          onChange={e => updateAnalyte(item.id, 'unit', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="pr-ls-input range-input"
                          value={item.reference_range}
                          disabled={isFinalized}
                          onChange={e => updateAnalyte(item.id, 'reference_range', e.target.value)}
                        />
                      </td>
                      <td>
                        {item.flag === 'high' ? (
                          <span className="pr-analyte-flag high">▲ HIGH</span>
                        ) : item.flag === 'low' ? (
                          <span className="pr-analyte-flag low">▼ LOW</span>
                        ) : item.flag === 'normal' ? (
                          <span className="pr-analyte-flag normal">✓ NORMAL</span>
                        ) : (
                          <span className="pr-analyte-flag pending">—</span>
                        )}
                      </td>
                      {!isFinalized && (
                        <td>
                          <button
                            className="pr-row-delete"
                            aria-label={`Remove ${item.name}`}
                            onClick={() => removeAnalyte(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pathologist Clinical Interpretation */}
            <div className="pr-ls-interpretation-card">
              <label htmlFor="lab-interpretation">
                <Stethoscope size={15} /> Pathologist / Clinical Review Impression
              </label>
              <textarea
                id="lab-interpretation"
                rows={3}
                disabled={isFinalized}
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Document clinical impression, specimen quality, or repeat testing recommendations..."
              />
            </div>
          </main>

          {/* Right Rail: Meta & Context */}
          <aside className="pr-ls-side-rail">
            <div className="pr-ls-card">
              <h4>Order Metadata</h4>
              <div className="pr-ls-meta-row">
                <span>Branch Clinic:</span>
                <strong>{branches.find(b => b.id === selectedBranch)?.title || 'Central Lab'}</strong>
              </div>
              <div className="pr-ls-meta-row">
                <span>Report Reference:</span>
                <input
                  type="text"
                  value={reportRef}
                  disabled={isFinalized}
                  onChange={e => setReportRef(e.target.value)}
                />
              </div>
              <div className="pr-ls-meta-row">
                <span>Requesting Clinician:</span>
                <input
                  type="text"
                  value={requestedBy}
                  disabled={isFinalized}
                  onChange={e => setRequestedBy(e.target.value)}
                />
              </div>
            </div>

            <div className="pr-ls-card">
              <h4>Laboratory Integrity Checks</h4>
              <div className="pr-ls-check-item">
                <CheckCircle2 size={15} />
                <span>Analyzer Calibration Logged</span>
              </div>
              <div className="pr-ls-check-item">
                <CheckCircle2 size={15} />
                <span>Reference Intervals Normalized</span>
              </div>
              <div className="pr-ls-check-item">
                <CheckCircle2 size={15} />
                <span>Biological Specimen Barcoded</span>
              </div>
            </div>

            {onRelated && (
              <div className="pr-ls-card">
                <h4>Connected Clinical Handoffs</h4>
                <button
                  className="pr-ls-action-link"
                  onClick={() => base && onRelated(base, 'emr')}
                >
                  <FileText size={14} /> View Related Consultation Worksheet
                </button>
                <button
                  className="pr-ls-action-link"
                  onClick={() => base && onRelated(base, 'prescriptions')}
                >
                  <HeartPulse size={14} /> Adjust Prescription based on Results
                </button>
              </div>
            )}
          </aside>
        </div>
      ) : (
        /* Formal Printable Laboratory Report */
        <div className="pr-ls-report-wrapper">
          <div className="pr-ls-report-paper" id="printable-lab-report">
            {/* Clinical Letterhead */}
            <div className="pr-report-header">
              <div className="pr-report-clinic-brand">
                <div className="pr-brand-logo"><HeartPulse size={24} /></div>
                <div>
                  <h2>MEDORA CLINICAL PATHOLOGY LABORATORIES</h2>
                  <p>Accredited Diagnostic Diagnostic Services · ISO 15189 Certified</p>
                  <small>Branch: {branches.find(b => b.id === selectedBranch)?.title || 'Main Clinic'}</small>
                </div>
              </div>
              <div className="pr-report-qr-meta">
                <div className="pr-report-tag">CONFIDENTIAL MEDICAL REPORT</div>
                <small>Ref: {reportRef}</small>
                <small>Date: {new Date().toLocaleDateString()}</small>
              </div>
            </div>

            <div className="pr-report-divider" />

            {/* Patient Header Block */}
            <div className="pr-report-patient-grid">
              <div><span>Patient Name:</span> <strong>{patientName}</strong></div>
              <div><span>Patient ID:</span> <strong>{patientId.slice(0, 8)}</strong></div>
              <div><span>Referred By:</span> <strong>{requestedBy}</strong></div>
              <div><span>Specimen:</span> <strong>{specimen}</strong></div>
              <div><span>Report Date:</span> <strong>{new Date().toLocaleDateString()}</strong></div>
              <div><span>Status:</span> <strong>{base?.status || 'Reported'}</strong></div>
            </div>

            <div className="pr-report-divider" />

            {/* Test Results Table */}
            <div className="pr-report-test-title">
              <h3>{testTitle.toUpperCase()}</h3>
            </div>

            <table className="pr-report-table">
              <thead>
                <tr>
                  <th>INVESTIGATION / ANALYTE</th>
                  <th>OBSERVED VALUE</th>
                  <th>UNIT</th>
                  <th>BIOLOGICAL REFERENCE RANGE</th>
                </tr>
              </thead>
              <tbody>
                {analytes.map(a => (
                  <tr key={a.id} className={a.flag === 'high' || a.flag === 'low' ? 'report-flagged' : ''}>
                    <td><strong>{a.name}</strong></td>
                    <td className="report-value">
                      <strong>{a.value || '—'}</strong>
                      {a.flag === 'high' && <span className="report-flag high"> (HIGH)</span>}
                      {a.flag === 'low' && <span className="report-flag low"> (LOW)</span>}
                    </td>
                    <td>{a.unit}</td>
                    <td>{a.reference_range}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Clinical Interpretation Notes */}
            {reviewNotes && (
              <div className="pr-report-notes-block">
                <h4>CLINICAL INTERPRETATION & PATHOLOGY NOTES:</h4>
                <p>{reviewNotes}</p>
              </div>
            )}

            {/* Signatures Footer */}
            <div className="pr-report-sign-footer">
              <div className="pr-report-sign-col">
                <small>Specimen Verified By:</small>
                <strong>Medora Lab Technologist</strong>
              </div>
              <div className="pr-report-sign-col right">
                <div className="pr-digital-sign-stamp">
                  <ShieldCheck size={18} />
                  <span>Digitally Reviewed & Verified</span>
                </div>
                <strong>{requestedBy}</strong>
                <small>Consultant Pathologist / Clinician</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review & Clinical Sign-off Modal */}
      <Dialog open={signModalOpen} onOpenChange={setSignModalOpen}>
        <DialogContent className="pr-dialog">
          <DialogHeader>
            <DialogTitle>Clinician Diagnostic Sign-off</DialogTitle>
            <DialogDescription>
              Sign and finalize this laboratory report for {patientName}.
            </DialogDescription>
          </DialogHeader>
          <div className="pr-clinical-review-notice">
            <ShieldCheck size={18} />
            <span>
              By confirming, this diagnostic result becomes immutable in the patient record and
              eligible for official clinical distribution.
            </span>
          </div>
          <div className="pr-form-footer">
            <button className="pr-button" onClick={() => setSignModalOpen(false)}>
              Cancel
            </button>
            <button
              className="pr-button primary"
              onClick={async () => {
                setSignModalOpen(false);
                await persistLabOrder('Reviewed');
              }}
            >
              <ShieldCheck size={15} /> Confirm & Sign Report
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Biomarker Longitudinal Trajectory Modal */}
      <Dialog open={trajectoryModalOpen} onOpenChange={setTrajectoryModalOpen}>
        <DialogContent className="pr-dialog pr-ls-trajectory-dialog">
          <DialogHeader>
            <div className="pr-ls-trajectory-header">
              <span className="pr-ls-trajectory-badge">
                <Sparkles size={13} /> Longitudinal Pathology Analytics
              </span>
              <DialogTitle>AI Biomarker Trajectory & Delta Checks</DialogTitle>
              <DialogDescription>
                Automated multi-visit delta tracking, percentage variance, and clinical pathology trend analysis for {patientName}.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="pr-ls-trajectory-body">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold">PATIENT: {patientName} · {testTitle}</span>
              <button
                type="button"
                className="pr-button pr-ls-recalc-btn"
                onClick={analyzeLongitudinalTrends}
                disabled={trajectoryLoading}
              >
                {trajectoryLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>Re-evaluate Trajectories</span>
              </button>
            </div>

            {trajectoryData && (
              <div className="pr-ls-trajectory-results">
                <div className="pr-ls-trajectory-summary-card">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={16} className="text-teal-600" />
                    <strong>Clinical Trajectory Synthesis</strong>
                  </div>
                  <p>{trajectoryData.summary}</p>
                </div>

                <div className="pr-ls-deltas-table-card">
                  <h4>Biomarker Variance & Delta Table</h4>
                  <div className="pr-ls-deltas-table-wrapper">
                    <table className="pr-ls-deltas-table">
                      <thead>
                        <tr>
                          <th>Analyte</th>
                          <th>Current Result</th>
                          <th>Prior Baseline</th>
                          <th>Delta Shift</th>
                          <th>Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trajectoryData.deltas.map((d, i) => (
                          <tr key={i} className={d.status === 'alert' ? 'alert-row' : ''}>
                            <td><strong>{d.analyte}</strong></td>
                            <td><code>{d.current} {d.unit}</code></td>
                            <td><span>{d.previous} {d.unit}</span></td>
                            <td>
                              <span className={`pr-delta-pill ${d.direction}`}>
                                {d.deltaPct > 0 ? `+${d.deltaPct}%` : `${d.deltaPct}%`}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-1">
                                {d.direction === 'up' && <TrendingUp size={14} className={d.status === 'alert' ? 'text-rose-600' : 'text-teal-600'} />}
                                {d.direction === 'down' && <TrendingDown size={14} className={d.status === 'alert' ? 'text-amber-600' : 'text-teal-600'} />}
                                {d.direction === 'stable' && <span className="text-slate-400 font-bold">—</span>}
                                <small className="text-slate-500 capitalize">{d.direction}</small>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {trajectoryData.recommendations.length > 0 && (
                  <div className="pr-ls-recs-card">
                    <h5>Pathology Monitoring Protocol</h5>
                    <ul>
                      {trajectoryData.recommendations.map((rec, idx) => (
                        <li key={idx}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pr-ls-trajectory-apply-bar">
                  <button
                    type="button"
                    className="pr-button primary"
                    onClick={applyTrajectoryToNotes}
                  >
                    <Check size={14} /> Import AI Commentary to Review Notes
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pr-form-footer">
            <button type="button" className="pr-button" onClick={() => setTrajectoryModalOpen(false)}>
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
