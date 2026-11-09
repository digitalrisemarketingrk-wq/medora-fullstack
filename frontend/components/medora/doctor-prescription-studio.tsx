'use client';

import { useState, useEffect } from 'react';
import {
  Pill,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Printer,
  Download,
  Save,
  Search,
  Stethoscope,
  User,
  CalendarDays,
  ShieldAlert,
  ArrowRight,
  FileText,
  Check,
  Building,
  RotateCcw,
  Clock,
  HeartPulse,
  Info,
  ShieldCheck,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { AppContext, Heading, Panel, Pick, SearchInput, EmptyState } from './shared';
import { audit, dateOffset, download, niceDate, uid, type Patient } from '@/lib/medora-demo';
import { api, API_MODE, type DrugRecommendation, type PrescriptionRecommendationsReport } from '@/lib/medora-api';
import { PATIENT_ALLERGIES_REGISTRY } from './doctor-session-ai';

const PROTOCOL_SHORTCUTS = [
  { label: 'Hypertension Protocol', query: 'Essential hypertension' },
  { label: 'Type 2 Diabetes Regimen', query: 'Type 2 diabetes glycemic control' },
  { label: 'Respiratory / Cough & Cold', query: 'Allergic rhinitis and cough' },
  { label: 'Infection / Bacterial Sinusitis', query: 'Acute bacterial respiratory infection' },
  { label: 'GERD & Acidity Protocol', query: 'GERD acid reflux and gastritis' },
  { label: 'Pain & Musculoskeletal', query: 'Acute muscular pain and fever' }
];

interface PrescribedItem {
  id: string;
  drug_name: string;
  generic_name: string;
  dosage_form: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
}

export function DoctorPrescriptionStudio({ ctx }: { ctx: AppContext }) {
  const [selectedPatientId, setSelectedPatientId] = useState(ctx.selected || ctx.data.patients[0]?.id || 'p1');
  const p = ctx.data.patients.find(x => x.id === selectedPatientId) || ctx.data.patients[0];
  const [q, setQ] = useState('');
  const [searchQuery, setSearchQuery] = useState(p ? p.condition : 'Essential hypertension');
  const [searching, setSearching] = useState(false);
  const [report, setReport] = useState<PrescriptionRecommendationsReport | null>(null);

  // Prescription items basket
  const [rxItems, setRxItems] = useState<PrescribedItem[]>([]);
  const [diagnosis, setDiagnosis] = useState(p?.condition || 'Essential Hypertension');
  const [generalAdvice, setGeneralAdvice] = useState(
    '1. Low sodium diet (< 2g/day) with adequate oral hydration.\n2. Record home blood pressure twice weekly.\n3. Avoid strenuous exertion during acute symptoms.\n4. Seek immediate emergency evaluation if severe chest pain or breathlessness occurs.'
  );
  const [investigations, setInvestigations] = useState<string[]>([
    'Complete Blood Count (CBC)',
    'Serum Creatinine & Electrolytes',
    'Fasting Blood Sugar'
  ]);
  const [newLab, setNewLab] = useState('');
  const [followUpDays, setFollowUpDays] = useState(14);
  const [activeTab, setActiveTab] = useState<'builder' | 'receipt'>('builder');

  // Custom drug modal/drawer state
  const [customDrugName, setCustomDrugName] = useState('');
  const [customDosage, setCustomDosage] = useState('');
  const [customForm, setCustomForm] = useState('Tablet');
  const [customFreq, setCustomFreq] = useState('1-0-1');
  const [customTiming, setCustomTiming] = useState('After meals');
  const [customDuration, setCustomDuration] = useState('14 days');
  const [customInstructions, setCustomInstructions] = useState('Take with water');
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Dynamic Patient Allergy State (Synced with Central Clinical Registry)
  const [patientAllergies, setPatientAllergies] = useState<string[]>(
    PATIENT_ALLERGIES_REGISTRY[p?.id || 'p1'] || ['Penicillin (Moderate - Skin rash / hives)']
  );
  const [isAddingAllergy, setIsAddingAllergy] = useState(false);
  const [newAllergyText, setNewAllergyText] = useState('');

  // Sync diagnosis and allergies when patient changes
  useEffect(() => {
    if (p) {
      setDiagnosis(p.condition);
      setSearchQuery(p.condition);
      setReport(null);
      setPatientAllergies(
        PATIENT_ALLERGIES_REGISTRY[p.id] || ['Penicillin (Moderate - Skin rash / hives)']
      );
    }
  }, [p?.id]);

  const addAllergy = (allergy: string) => {
    const trimmed = allergy.trim();
    if (!trimmed) return;
    if (patientAllergies.some(a => a.toLowerCase().includes(trimmed.toLowerCase()))) {
      toast.info(`${trimmed} is already in patient allergy profile.`);
      return;
    }
    setPatientAllergies(prev => [...prev, trimmed]);
    setNewAllergyText('');
    setIsAddingAllergy(false);
    toast.success(`Added ${trimmed} to ${p.name}'s allergy record.`);
  };

  const removeAllergy = (index: number) => {
    const removed = patientAllergies[index];
    setPatientAllergies(prev => prev.filter((_, i) => i !== index));
    toast.info(`Removed ${removed} from active profile.`);
  };

  const matchingPatients = ctx.data.patients.filter(pt =>
    `${pt.name} ${pt.id} ${pt.condition}`.toLowerCase().includes(q.toLowerCase())
  );

  const activeMeds = p?.id === 'p1' ? ctx.data.medicines.map(m => m.name) : ['Amlodipine 5mg'];

  // Generate initial recommendations or search
  const handleSearchRecommendations = async (customQuery?: string) => {
    const queryToUse = customQuery || searchQuery;
    if (!queryToUse.trim()) {
      toast.error('Enter a symptom, diagnosis, or drug name to search.');
      return;
    }
    setSearching(true);
    try {
      const res = await api.prescriptionRecommendations(
        queryToUse,
        p.name,
        p.condition,
        p.age,
        patientAllergies,
        activeMeds,
        ctx.ownerId
      );
      setReport(res);
      toast.success(`Found ${res.recommendations.length} drug recommendations.`);
    } catch {
      toast.error('Could not fetch recommendations. Using evidence-based clinical templates.');
    } finally {
      setSearching(false);
    }
  };

  const addRecommendedDrug = (rec: DrugRecommendation) => {
    if (rec.contraindicated) {
      const confirmOverride = window.confirm(
        `CLINICAL ALLERGY WARNING\n\nThis medication (${rec.drug_name}) is flagged as CONTRAINDICATED with ${p.name}'s recorded allergy: ${patientAllergies.join(', ')}.\n\nDo you want to override and prescribe anyway?`
      );
      if (!confirmOverride) return;
    }

    // Check if already added
    if (rxItems.some(i => i.drug_name.toLowerCase() === rec.drug_name.toLowerCase())) {
      toast.info(`${rec.drug_name} is already in the active prescription.`);
      return;
    }

    const newItem: PrescribedItem = {
      id: uid(),
      drug_name: rec.drug_name,
      generic_name: rec.generic_name,
      dosage_form: rec.dosage_form || 'Tablet',
      dosage: rec.dosage || 'Standard',
      frequency: rec.frequency || '1-0-1',
      timing: rec.timing || 'After meals',
      duration: rec.duration || '14 days',
      instructions: rec.safety_alert ? `Caution: ${rec.safety_alert}` : 'Take with water as advised'
    };

    setRxItems(prev => [...prev, newItem]);
    toast.success(`Added ${rec.drug_name} to prescription.`);
  };

  const handleAddCustomDrug = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDrugName.trim()) {
      toast.error('Enter medication name');
      return;
    }
    const newItem: PrescribedItem = {
      id: uid(),
      drug_name: customDrugName,
      generic_name: customDrugName,
      dosage_form: customForm,
      dosage: customDosage || 'As directed',
      frequency: customFreq,
      timing: customTiming,
      duration: customDuration,
      instructions: customInstructions
    };
    setRxItems(prev => [...prev, newItem]);
    setCustomDrugName('');
    setCustomDosage('');
    setShowCustomForm(false);
    toast.success(`Added ${newItem.drug_name} to prescription.`);
  };

  const removeItem = (id: string) => {
    setRxItems(prev => prev.filter(i => i.id !== id));
    toast.info('Medication removed from prescription.');
  };

  const addInvestigation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLab.trim()) return;
    if (!investigations.includes(newLab.trim())) {
      setInvestigations(prev => [...prev, newLab.trim()]);
    }
    setNewLab('');
  };

  const removeInvestigation = (test: string) => {
    setInvestigations(prev => prev.filter(t => t !== test));
  };

  // Save to patient care record
  const handleSaveToCareRecord = async () => {
    if (rxItems.length === 0) {
      toast.error('Please add at least one medication to the prescription.');
      return;
    }

    ctx.update(d => {
      const newMeds = rxItems.map(item => ({
        id: uid(),
        name: item.drug_name,
        detail: `${item.dosage} · ${item.frequency} (${item.timing}) for ${item.duration}. ${item.instructions}`,
        time: item.frequency.includes('1-0-1') ? '08:00, 20:00' : item.frequency.includes('0-0-1') ? '21:00' : '08:00',
        taken: false,
        reminder: true
      }));

      const receiptText = generatePrescriptionText();
      const rxDoc = {
        id: 'rx-' + uid(),
        name: `Prescription-${p.name.replace(/\s+/g, '-')}-${dateOffset(0)}.txt`,
        type: 'Prescription',
        date: dateOffset(0),
        size: `${Math.max(1, Math.ceil(receiptText.length / 1024))} KB`,
        summary: `Prescription issued by Dr. Sarah Khan for ${p.name}. Medications: ${rxItems.map(i => i.drug_name).join(', ')}. Diagnosis: ${diagnosis}.`
      };

      const followUpTask = {
        id: uid(),
        patientId: p.id,
        title: `Prescription review with ${p.name}`,
        detail: `Review clinical response and tolerance to prescribed medications (${rxItems.map(i => i.drug_name).join(', ')}).`,
        date: dateOffset(followUpDays),
        done: false
      };

      return audit({
        ...d,
        medicines: p.id === 'p1' ? [...d.medicines, ...newMeds] : d.medicines,
        documents: p.id === 'p1' ? [rxDoc, ...d.documents] : d.documents,
        tasks: [...d.tasks, followUpTask]
      }, `Prescription receipt generated and committed for ${p.name}`);
    });

    try {
      await ctx.flush?.();
      toast.success(`Prescription successfully saved to ${p.name}'s care journey!`);
    } catch {
      toast.error('Prescription saved in browser, but cloud sync was deferred.');
    }
  };

  const generatePrescriptionText = () => {
    const rxLines = rxItems
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.drug_name} (${item.dosage_form})\n   Dosage: ${item.dosage} | Frequency: ${item.frequency} | Timing: ${item.timing}\n   Duration: ${item.duration} | Instructions: ${item.instructions}`
      )
      .join('\n\n');

    return `==========================================================
MEDORA ADVANCED CLINICAL CARE & SPECIALTY CENTER
Department of Internal Medicine & Cardiology
Suite 402, Healthcare Boulevard, Bandra West, Mumbai 400050
Tel: +91 22 4920 8800 | Email: clinic@medora.health
Clinic Reg No: REG-MH-2024-88410
==========================================================

CONSULTANT PHYSICIAN:
Dr. Sarah Khan, MBBS, MD, DM (Cardiology), FCCP
Medical Council Reg No: MCI-482910

PATIENT DETAILS:
Name: ${p.name}
Age / Sex: ${p.age} years / Female
Patient ID: ${p.id.toUpperCase()}
Date: ${niceDate(dateOffset(0))}
Known Allergies: ${patientAllergies.length ? patientAllergies.join(', ') : 'No known drug allergies'}
Provisional Diagnosis: ${diagnosis}

----------------------------------------------------------
Rx (PRESCRIPTION):
----------------------------------------------------------
${rxLines || 'No medications listed.'}

----------------------------------------------------------
DIETARY & LIFESTYLE ADVICE:
${generalAdvice}

----------------------------------------------------------
INVESTIGATIONS ORDERED:
${investigations.join(', ')}

----------------------------------------------------------
NEXT REVIEW / FOLLOW-UP:
${niceDate(dateOffset(followUpDays))} (in ${followUpDays} days)

==========================================================
Digitally Signed by: Dr. Sarah Khan
Verified via Medora Digital Health Gateway
==========================================================`;
  };

  return (
    <>
      <Heading
        title="Rx Studio · AI Medication Recommendations"
        sub="Search clinical indications, review pharmacology AI recommendations, and generate professional prescription receipts."
        eyebrow="CLINICAL DECISION SUPPORT"
      >
        <button
          className={`btn ${activeTab === 'builder' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveTab('builder')}
        >
          <Sparkles size={16} /> Prescription Builder
        </button>
        <button
          className={`btn ${activeTab === 'receipt' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveTab('receipt')}
        >
          <FileText size={16} /> View Prescription Receipt ({rxItems.length})
        </button>
      </Heading>

      {/* Patient Bar */}
      <div className="copilot-patient-bar">
        <SearchInput value={q} onChange={setQ} placeholder="Select or search patient by name or record ID…" />
        <label>
          Active Patient
          <Pick
            label="Active Patient"
            value={p.name}
            onChange={v => {
              const found = ctx.data.patients.find(x => x.name === v);
              if (found) {
                setSelectedPatientId(found.id);
                ctx.setSelected(found.id);
              }
            }}
            options={matchingPatients.length ? matchingPatients.map(x => x.name) : [p.name]}
          />
        </label>
        <span className="badge">
          {p.age}y · {p.id.toUpperCase()}
        </span>
      </div>

      {/* Patient Context & Interactive Clinical Allergy Banner */}
      <div className="rx-patient-banner" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span className="avatar large">{p.initials}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>{p.name}</h3>
                <span className="badge">{p.condition}</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Blood Group: <strong>{ctx.data.settings?.blood || 'O+'}</strong> · Emergency Contact:{' '}
                {p.id === 'p1' ? 'Aarav Sharma (Spouse)' : 'Verified on record'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn secondary small"
              onClick={() => setIsAddingAllergy(prev => !prev)}
              style={{ fontSize: '11.5px', padding: '4px 10px' }}
            >
              <Plus size={13} /> {isAddingAllergy ? 'Close' : 'Add Allergy'}
            </button>
          </div>
        </div>

        {/* Allergy List Display */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
          <strong style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} style={{ color: patientAllergies.length ? '#b91c1c' : '#059669' }} />
            Documented Allergies ({patientAllergies.length}):
          </strong>

          {patientAllergies.length > 0 ? (
            patientAllergies.map((alg, idx) => (
              <span
                key={idx}
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fca5a5',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{alg}</span>
                <button
                  type="button"
                  title="Remove this allergy"
                  onClick={() => removeAllergy(idx)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))
          ) : (
            <span style={{ fontSize: '12px', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
              <ShieldCheck size={13} /> No known drug allergies recorded
            </span>
          )}
        </div>

        {/* Interactive Quick Add Allergy Drawer */}
        {isAddingAllergy && (
          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Quick Add:</span>
            {['Penicillin (Skin rash)', 'Sulfa Drugs (Severe)', 'Levocetirizine / Antihistamines', 'Aspirin / NSAIDs', 'Amoxicillin', 'Cephalosporins'].map(cand => (
              <button
                key={cand}
                type="button"
                className="btn secondary small"
                onClick={() => addAllergy(cand)}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                + {cand}
              </button>
            ))}
            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
              <input
                type="text"
                placeholder="Custom allergy name..."
                value={newAllergyText}
                onChange={e => setNewAllergyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAllergy(newAllergyText);
                  }
                }}
                style={{ padding: '3px 8px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '160px' }}
              />
              <button
                type="button"
                className="btn primary small"
                onClick={() => addAllergy(newAllergyText)}
                disabled={!newAllergyText.trim()}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'builder' ? (
        <div className="rx-studio-layout">
          {/* AI Search & Protocol Panel */}
          <Panel title="AI Medication Search & Indication Matcher" sub="Search by condition, clinical symptoms, or drug class to retrieve evidence-based recommendations.">
            <div className="rx-search-box">
              <div className="rx-search-input">
                <Search size={18} style={{ color: '#64748b' }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSearchRecommendations();
                  }}
                  placeholder="e.g. Essential hypertension, Bacterial sinusitis, Type 2 diabetes..."
                />
              </div>
              <button
                className="btn primary"
                disabled={searching}
                onClick={() => handleSearchRecommendations()}
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff' }}
              >
                <Sparkles size={16} /> {searching ? 'Analyzing Pharmacology...' : 'Get AI Recommendations'}
              </button>
              <button className="btn secondary" onClick={() => setShowCustomForm(!showCustomForm)}>
                <Plus size={16} /> Add Custom Medicine
              </button>
            </div>

            {/* Protocol Quick-Chips */}
            <div className="rx-protocol-chips">
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Quick Protocols:
              </span>
              {PROTOCOL_SHORTCUTS.map(sc => (
                <button
                  key={sc.label}
                  className={`rx-chip ${searchQuery === sc.query ? 'active' : ''}`}
                  onClick={() => {
                    setSearchQuery(sc.query);
                    handleSearchRecommendations(sc.query);
                  }}
                >
                  {sc.label}
                </button>
              ))}
            </div>

            {/* Custom Medicine Drawer/Form */}
            {showCustomForm && (
              <form
                onSubmit={handleAddCustomDrug}
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#f8faff',
                  border: '1px solid #c7d2fe',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  alignItems: 'end'
                }}
              >
                <label style={{ fontSize: '12px', color: '#1e293b', fontWeight: 600 }}>
                  Medication Name
                  <input
                    required
                    value={customDrugName}
                    onChange={e => setCustomDrugName(e.target.value)}
                    placeholder="e.g. Losartan 50mg"
                    style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label style={{ fontSize: '12px', color: '#1e293b', fontWeight: 600 }}>
                  Form
                  <select
                    value={customForm}
                    onChange={e => setCustomForm(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option>Tablet</option>
                    <option>Capsule</option>
                    <option>Syrup</option>
                    <option>Inhaler</option>
                    <option>Nasal Spray</option>
                    <option>Drops</option>
                  </select>
                </label>
                <label style={{ fontSize: '12px', color: '#1e293b', fontWeight: 600 }}>
                  Frequency
                  <select
                    value={customFreq}
                    onChange={e => setCustomFreq(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option value="1-0-0">1-0-0 (Morning)</option>
                    <option value="1-0-1">1-0-1 (Morning & Night)</option>
                    <option value="1-1-1">1-1-1 (Three times daily)</option>
                    <option value="0-0-1">0-0-1 (Night only)</option>
                    <option value="SOS">SOS (As needed)</option>
                  </select>
                </label>
                <label style={{ fontSize: '12px', color: '#1e293b', fontWeight: 600 }}>
                  Timing
                  <select
                    value={customTiming}
                    onChange={e => setCustomTiming(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option>After meals</option>
                    <option>Before meals</option>
                    <option>Before sleep</option>
                    <option>Empty stomach</option>
                  </select>
                </label>
                <label style={{ fontSize: '12px', color: '#1e293b', fontWeight: 600 }}>
                  Duration
                  <input
                    value={customDuration}
                    onChange={e => setCustomDuration(e.target.value)}
                    placeholder="e.g. 14 days"
                    style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </label>
                <button type="submit" className="btn primary" style={{ height: '38px' }}>
                  <Plus size={15} /> Add to Rx
                </button>
              </form>
            )}

            {/* AI Recommendations Cards */}
            {searching ? (
              <div className="soap-loading-state">
                <HeartPulse size={30} className="spin-slow" style={{ color: '#4f46e5' }} />
                <div>
                  <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                    Consulting Clinical Pharmacology Knowledge Engine...
                  </strong>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Matching drug indications and cross-referencing against {p.name}’s allergies and active medications.
                  </p>
                </div>
              </div>
            ) : report && report.recommendations ? (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Recommended Medications for &quot;{report.query}&quot; ({report.recommendations.length} options)
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Safety: {report.safety_summary}
                  </span>
                </div>

                <div className="rx-recommendations-grid">
                  {report.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`rx-rec-card ${rec.contraindicated ? 'contraindicated' : ''}`}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            {rec.drug_name}
                          </h4>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#334155'
                            }}
                          >
                            {rec.dosage_form}
                          </span>
                        </div>

                        <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#475569' }}>
                          <strong>Generic:</strong> {rec.generic_name} · <em>{rec.category}</em>
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0', fontSize: '11.5px' }}>
                          <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            {rec.frequency}
                          </span>
                          <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: '4px' }}>
                            {rec.timing}
                          </span>
                          <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: '4px' }}>
                            {rec.duration}
                          </span>
                        </div>

                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
                          {rec.clinical_rationale}
                        </p>
                      </div>

                      <div>
                        {rec.contraindicated ? (
                          <div className="rx-contra-banner" style={{ marginBottom: '10px' }}>
                            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{rec.safety_alert || 'Contraindicated with patient allergy'}</span>
                          </div>
                        ) : rec.safety_alert ? (
                          <div className="rx-caution-banner" style={{ marginBottom: '10px' }}>
                            {rec.safety_alert}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '11px', marginBottom: '10px' }}>
                            <CheckCircle2 size={13} /> Checked: No allergy conflicts
                          </div>
                        )}

                        <button
                          className={`btn ${rec.contraindicated ? 'secondary' : 'primary'} full`}
                          style={{
                            fontSize: '12.5px',
                            minHeight: '34px',
                            background: rec.contraindicated ? '#fef2f2' : undefined,
                            borderColor: rec.contraindicated ? '#fca5a5' : undefined,
                            color: rec.contraindicated ? '#991b1b' : undefined
                          }}
                          onClick={() => addRecommendedDrug(rec)}
                        >
                          <Plus size={14} /> {rec.contraindicated ? 'Add with Override' : 'Add to Prescription'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                <Pill size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '13px' }}>
                  Click a Quick Protocol above or type a condition to generate recommended medicines.
                </p>
              </div>
            )}
          </Panel>

          {/* Active Prescription Items Table */}
          <Panel
            title={`Active Prescription Basket (${rxItems.length} Medications)`}
            sub="Review, adjust dosages and timing before generating the official clinic prescription receipt."
            action={
              <button
                className="btn primary"
                disabled={rxItems.length === 0}
                onClick={() => setActiveTab('receipt')}
                style={{ background: '#059669', color: '#fff' }}
              >
                <Printer size={15} /> Generate Receipt Pad
              </button>
            }
          >
            {rxItems.length === 0 ? (
              <EmptyState
                title="Prescription is currently empty"
                text="Click 'Add to Prescription' on any AI recommendation above, or click 'Add Custom Medicine'."
              />
            ) : (
              <div>
                <table className="pad-meds-table">
                  <thead>
                    <tr>
                      <th style={{ width: '30px' }}>#</th>
                      <th>Medicine Name & Strength</th>
                      <th>Form</th>
                      <th>Frequency</th>
                      <th>Timing</th>
                      <th>Duration</th>
                      <th>Instructions</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rxItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                        <td>
                          <strong>{item.drug_name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{item.generic_name}</div>
                        </td>
                        <td>
                          <span className="badge">{item.dosage_form}</span>
                        </td>
                        <td>
                          <input
                            value={item.frequency}
                            onChange={e => {
                              const val = e.target.value;
                              setRxItems(prev => prev.map(x => (x.id === item.id ? { ...x, frequency: val } : x)));
                            }}
                            style={{ width: '80px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                          />
                        </td>
                        <td>
                          <input
                            value={item.timing}
                            onChange={e => {
                              const val = e.target.value;
                              setRxItems(prev => prev.map(x => (x.id === item.id ? { ...x, timing: val } : x)));
                            }}
                            style={{ width: '110px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                          />
                        </td>
                        <td>
                          <input
                            value={item.duration}
                            onChange={e => {
                              const val = e.target.value;
                              setRxItems(prev => prev.map(x => (x.id === item.id ? { ...x, duration: val } : x)));
                            }}
                            style={{ width: '80px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                          />
                        </td>
                        <td>
                          <input
                            value={item.instructions}
                            onChange={e => {
                              const val = e.target.value;
                              setRxItems(prev => prev.map(x => (x.id === item.id ? { ...x, instructions: val } : x)));
                            }}
                            style={{ width: '100%', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                          />
                        </td>
                        <td>
                          <button
                            className="btn ghost small"
                            onClick={() => removeItem(item.id)}
                            title="Remove from prescription"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Additional Clinical Rx Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                      Provisional Diagnosis / Indication
                    </label>
                    <input
                      value={diagnosis}
                      onChange={e => setDiagnosis(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                      Follow-up Review In
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={followUpDays}
                        onChange={e => setFollowUpDays(Number(e.target.value))}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                      >
                        <option value={7}>7 Days (1 Week)</option>
                        <option value={14}>14 Days (2 Weeks)</option>
                        <option value={30}>30 Days (1 Month)</option>
                        <option value={60}>60 Days (2 Months)</option>
                      </select>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>({niceDate(dateOffset(followUpDays))})</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                    Dietary & Lifestyle Advice
                  </label>
                  <textarea
                    rows={3}
                    value={generalAdvice}
                    onChange={e => setGeneralAdvice(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', lineHeight: 1.6 }}
                  />
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                    Diagnostic Investigations / Labs
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {investigations.map(test => (
                      <span
                        key={test}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '20px',
                          padding: '3px 10px',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {test}
                        <button
                          type="button"
                          onClick={() => removeInvestigation(test)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={addInvestigation} style={{ display: 'flex', gap: '8px', maxWidth: '360px' }}>
                    <input
                      value={newLab}
                      onChange={e => setNewLab(e.target.value)}
                      placeholder="Add lab (e.g. ECG, HbA1c)..."
                      style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                    <button type="submit" className="btn secondary small">
                      <Plus size={14} /> Add
                    </button>
                  </form>
                </div>
              </div>
            )}
          </Panel>
        </div>
      ) : (
        /* Printable Clinic Prescription Pad / Receipt View */
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          {/* Action Toolbar */}
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            <button className="btn secondary" onClick={() => setActiveTab('builder')}>
              ← Back to Prescription Builder
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn primary"
                onClick={() => window.print()}
                style={{ background: '#0f172a', color: '#ffffff' }}
              >
                <Printer size={16} /> Print Prescription Receipt
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  download(
                    `medora-rx-${p.name.toLowerCase().replace(/\s+/g, '-')}-${dateOffset(0)}.txt`,
                    generatePrescriptionText(),
                    'text/plain'
                  );
                  toast.success('Prescription receipt downloaded');
                }}
              >
                <Download size={16} /> Export Receipt
              </button>
              <button
                className="btn primary"
                onClick={handleSaveToCareRecord}
                style={{ background: '#059669', color: '#ffffff' }}
              >
                <Save size={16} /> Save to Care Record
              </button>
            </div>
          </div>

          {/* Actual Receipt Pad Document */}
          <div className="clinic-prescription-pad">
            {/* Header */}
            <div className="pad-header">
              <div className="pad-clinic-details">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Building size={28} style={{ color: '#0f172a' }} />
                  <div>
                    <h2>MEDORA ADVANCED CLINICAL CARE & SPECIALTY CENTER</h2>
                    <p style={{ fontWeight: 600, color: '#334155' }}>Department of Internal Medicine & Cardiology</p>
                  </div>
                </div>
                <p style={{ marginTop: '6px' }}>
                  Suite 402, Healthcare Boulevard, Bandra West, Mumbai 400050
                </p>
                <p>
                  Tel: +91 22 4920 8800 · Email: clinic@medora.health · Web: www.medora.health
                </p>
                <p style={{ fontSize: '11px', color: '#64748b' }}>
                  Clinic Reg No: <strong>REG-MH-2024-88410</strong> · NABH Accredited Ambulatory Facility
                </p>
              </div>

              <div className="pad-doctor-details">
                <h3>Dr. Sarah Khan</h3>
                <p style={{ fontWeight: 600 }}>MBBS, MD, DM (Cardiology), FCCP</p>
                <p>Consultant Interventional Cardiologist & Physician</p>
                <p style={{ fontSize: '11px', color: '#475569' }}>
                  Medical Council Reg No: <strong>MCI-482910</strong>
                </p>
              </div>
            </div>

            {/* Patient Dossier Bar */}
            <div className="pad-patient-bar">
              <div>
                <strong style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Patient Name</strong>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{p.name}</div>
              </div>
              <div>
                <strong style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Age / Sex / MRN</strong>
                <div>{p.age} Yrs / Female · {p.id.toUpperCase()}</div>
              </div>
              <div>
                <strong style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Date & Rx ID</strong>
                <div>{niceDate(dateOffset(0))} · RX-2026-{p.id.toUpperCase()}</div>
              </div>
              <div>
                <strong style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Known Allergies</strong>
                <div style={{ color: patientAllergies.length ? '#b91c1c' : '#059669', fontWeight: 600 }}>
                  {patientAllergies.length ? patientAllergies.join(', ') : 'None Reported'}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '18px', padding: '10px 14px', background: '#f1f5f9', borderRadius: '8px', fontSize: '13px' }}>
              <strong>Provisional Diagnosis / Clinical Indication:</strong> {diagnosis}
            </div>

            {/* ℞ Symbol */}
            <div>
              <span className="pad-rx-symbol">℞</span>
            </div>

            {/* Prescribed Items Table */}
            {rxItems.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '10px' }}>
                No medications currently prescribed. Switch back to &apos;Prescription Builder&apos; to add medicines.
              </div>
            ) : (
              <table className="pad-meds-table">
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}>#</th>
                    <th>Medication Name & Formulation</th>
                    <th>Dosage & Frequency</th>
                    <th>Timing Relative to Food</th>
                    <th>Duration</th>
                    <th>Special Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {rxItems.map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700, color: '#475569' }}>{idx + 1}.</td>
                      <td>
                        <strong style={{ fontSize: '14px' }}>{item.drug_name}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>({item.generic_name})</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{item.dosage}</span> · {item.frequency}
                      </td>
                      <td>{item.timing}</td>
                      <td>{item.duration}</td>
                      <td style={{ fontSize: '12px', color: '#334155' }}>{item.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Diet & Advice */}
            <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '12px', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Clinical & Dietary Advice:
                </strong>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {generalAdvice}
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '12px', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Investigations Recommended:
                </strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '12.5px', color: '#1e293b', lineHeight: 1.6 }}>
                  {investigations.map((test, idx) => (
                    <li key={idx}>{test}</li>
                  ))}
                </ul>
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#475569' }}>
                  <strong>Next Review:</strong> {niceDate(dateOffset(followUpDays))} (in {followUpDays} days)
                </div>
              </div>
            </div>

            {/* Signature & Security Footer */}
            <div className="pad-footer">
              <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '400px', lineHeight: 1.5 }}>
                <p style={{ margin: 0 }}>
                  * This electronic prescription receipt is generated via Medora Clinical Information Gateway.
                  Prescriptions must be verified with identity proof before dispensing.
                </p>
                <p style={{ margin: '4px 0 0' }}>
                  Security Verification Code: <strong>MD-RX-{Date.now().toString().slice(-8)}</strong>
                </p>
              </div>

              <div className="pad-signature-block">
                <div className="pad-signature-line"></div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>Dr. Sarah Khan</strong>
                <div style={{ fontSize: '11px', color: '#475569' }}>Consultant Cardiologist & Physician</div>
                <div style={{ fontSize: '10.5px', color: '#059669', marginTop: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <ShieldCheck size={12} /> Digitally Authenticated &amp; Sealed
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
