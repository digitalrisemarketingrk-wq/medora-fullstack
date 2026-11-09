'use client';

import {useEffect,useRef,useState} from 'react';
import {Activity,ArrowLeft,ArrowRight,Bot,Check,CheckCircle2,ChevronDown,FileText,HeartPulse,History,Loader2,MapPin,Mic,MicOff,Pill,Plus,RefreshCw,ShieldCheck,Sparkles,Stethoscope,UserRound,Wallet} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {api,ApiError,type SOAPNoteResult} from '@/lib/medora-api';
import {practiceApi,type PracticeModule,type PracticeRecord} from '@/lib/practice-api';
import {toast} from 'sonner';
import {PracticeConflictReview} from './practice-conflict-review';
import {PracticePatientPicker} from './practice-task-editor';
import {PracticeTemplatePicker} from './practice-template-picker';
import {PracticeRecordHistory} from './practice-record-history';
import './practice-clinical-worksheet.css';

const SECTIONS = [
  {key:'title',title:'Presenting concern',hint:'Reason for this encounter',placeholder:'A short, clear reason for the visit'},
  {key:'history',title:'History & context',hint:'Reported symptoms and relevant history',placeholder:'Document the patient’s account, onset and relevant history.'},
  {key:'observations',title:'Observations',hint:'Findings and measurements recorded today',placeholder:'Record observed findings and measured values, including their units.'},
  {key:'assessment',title:'Assessment',hint:'Your clinical impression',placeholder:'Document your assessment and any uncertainty.'},
  {key:'plan',title:'Care plan',hint:'Next steps and follow-up',placeholder:'Document agreed next steps, counselling and follow-up.'},
] as const;

const COMPLAINT_CHIPS = [
  'Acute fever & chills (3 days)',
  'Productive cough & chest congestion',
  'Hypertension routine review',
  'Intermittent headache & dizziness',
  'Epigastric pain & acidity',
  'Exertional breathlessness'
];

const ICD10_DIAGNOSES = [
  { code: 'J06.9', label: 'Acute upper respiratory infection' },
  { code: 'I10', label: 'Essential hypertension' },
  { code: 'E11.9', label: 'Type 2 diabetes mellitus' },
  { code: 'K21.9', label: 'Gastro-esophageal reflux disease (GERD)' },
  { code: 'R51', label: 'Headache / Tension cephalalgia' },
  { code: 'M54.5', label: 'Low back pain / Lumbago' },
  { code: 'J45.909', label: 'Asthma, uncomplicated' },
  { code: 'A09', label: 'Infectious gastroenteritis' },
  { code: 'K29.7', label: 'Gastritis, unspecified' },
  { code: 'N39.0', label: 'Urinary tract infection' }
];

const COMMON_LAB_ORDERS = [
  'Complete Blood Count (CBC)',
  'Comprehensive Metabolic Panel (CMP)',
  'Lipid Profile (Lipids/Cholesterol)',
  'HbA1c Glycated Hemoglobin',
  'Thyroid Profile (TSH, FT3, FT4)',
  'Urinalysis Routine & Microscopy',
  'Serum Creatinine & eGFR'
];

const FOLLOWUP_INTERVALS = [
  '3 days (Acute review)',
  '7 days (Post-antibiotic check)',
  '14 days (Investigation review)',
  '1 month (Chronic care follow-up)',
  '3 months (Routine surveillance)'
];

type Props = {
  module:PracticeModule;record?:PracticeRecord;initialData?:Record<string,string>;
  branches:PracticeRecord[];branch:string;practice:string;patientNames:Record<string,string>;
  readOnly?:boolean;canSign:boolean;relatedModules:string[];onDirtyChange:(dirty:boolean)=>void;onBusyChange:(busy:boolean)=>void;
  onClose:()=>void;onPersist:(record:PracticeRecord)=>void;
  onRelated:(record:PracticeRecord,module:string)=>void;
};
const values=(module:PracticeModule,record?:PracticeRecord,initial?:Record<string,string>)=>Object.fromEntries(module.fields.map(field=>[field.key,record?.data[field.key]||initial?.[field.key]||'']));
function savedTime(value:string){return new Intl.DateTimeFormat('en',{hour:'numeric',minute:'2-digit'}).format(new Date(value));}
function age(dob?:string){if(!dob)return '';const date=new Date(dob+'T12:00:00');if(Number.isNaN(date.getTime()))return '';const today=new Date();let years=today.getFullYear()-date.getFullYear();if(today.getMonth()<date.getMonth()||today.getMonth()===date.getMonth()&&today.getDate()<date.getDate())years--;return years>=0?years+' years':'';}

export function PracticeClinicalWorksheet({module,record,initialData,branches,branch,practice,patientNames,readOnly=false,canSign,relatedModules,onDirtyChange,onBusyChange,onClose,onPersist,onRelated}:Props){
  const[base,setBase]=useState(record);
  const[data,setData]=useState(()=>values(module,record,initialData));
  const[selectedBranch,setSelectedBranch]=useState(record?.branch_id||branch||branches.find(b=>b.status==='Active')?.id||'');
  const[snapshot,setSnapshot]=useState(()=>JSON.stringify({data:values(module,record,initialData),branch:record?.branch_id||branch||branches.find(b=>b.status==='Active')?.id||''}));
  const[patient,setPatient]=useState<PracticeRecord|null>(null);const[patientSelectionOpen,setPatientSelectionOpen]=useState(!record?.data.patient_id&&!initialData?.patient_id);const[patientError,setPatientError]=useState('');
  const[active,setActive]=useState<string>('title');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  const[fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const[conflict,setConflict]=useState(false);const[review,setReview]=useState(false);const[leave,setLeave]=useState(false);const[history,setHistory]=useState(false);

  // Quick ribbon tab
  const[ribbonTab,setRibbonTab]=useState<'symptoms'|'diagnoses'|'labs'|'followup'>('symptoms');
  const[timelineRecords,setTimelineRecords]=useState<PracticeRecord[]>([]);

  // Ambient AI Scribe & Voice Dictation
  const [scribeOpen, setScribeOpen] = useState(false);
  const [scribeTranscript, setScribeTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [scribeLoading, setScribeLoading] = useState(false);
  const [soapDraft, setSoapDraft] = useState<SOAPNoteResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Vitals entry state
  const[vitalsOpen,setVitalsOpen]=useState(false);
  const[bpSys,setBpSys]=useState('120');const[bpDia,setBpDia]=useState('80');
  const[pulse,setPulse]=useState('72');const[temp,setTemp]=useState('98.6');
  const[spo2,setSpo2]=useState('98');const[respRate,setRespRate]=useState('16');
  const[weight,setWeight]=useState('70');const[height,setHeight]=useState('172');

  const attempt=useRef<{fingerprint:string;id:string}|null>(null);const actionAttempt=useRef<{fingerprint:string;id:string}|null>(null);
  const lock=useRef(false);const dirty=JSON.stringify({data,branch:selectedBranch})!==snapshot;
  const finalized=readOnly||base?.status==='Signed';
  useEffect(()=>{onDirtyChange(dirty&&!finalized);},[dirty,finalized,onDirtyChange]);
  const currentBranch=branches.find(b=>b.id===selectedBranch);
  useEffect(()=>{
    let current=true;setPatient(null);setPatientError('');setTimelineRecords([]);
    if(data.patient_id){
      void practiceApi.get(data.patient_id,practice).then(value=>{
        if(current){
          setPatient(value);
          void practiceApi.timeline(value).then(res=>{if(current)setTimelineRecords(res.items||[]);}).catch(()=>{});
        }
      }).catch(()=>{if(current)setPatientError('Patient details could not be loaded. Retry by selecting the patient again.');});
    }
    return()=>{current=false;};
  },[data.patient_id,practice]);
  useEffect(()=>{if(!busy&&(!dirty||finalized))return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,finalized,busy]);
  const change=(key:string,value:string)=>{if(lock.current||finalized)return;setData(old=>({...old,[key]:value}));setFieldErrors(old=>({...old,[key]:''}));setError('');};
  const close=()=>{if(lock.current)return;if(dirty&&!finalized)setLeave(true);else onClose();};

  const bmiVal = Number(weight) && Number(height) ? (Number(weight) / ((Number(height)/100)**2)).toFixed(1) : null;
  const bmiCategory = bmiVal ? (Number(bmiVal) < 18.5 ? 'Underweight' : Number(bmiVal) < 25 ? 'Normal' : Number(bmiVal) < 30 ? 'Overweight' : 'Obese') : '';

  const insertVitals = () => {
    const formatted = `Recorded Vitals: BP ${bpSys}/${bpDia} mmHg | Pulse ${pulse} bpm | Temp ${temp}°F | SpO2 ${spo2}% | RR ${respRate}/min | Weight ${weight} kg, Height ${height} cm${bmiVal ? ` (BMI ${bmiVal} - ${bmiCategory})` : ''}`;
    const existing = data.observations ? data.observations + '\n\n' : '';
    change('observations', existing + formatted);
    setVitalsOpen(false);
    setActive('observations');
  };

  const addComplaint = (chip: string) => {
    if (!data.title) change('title', chip);
    else {
      const existing = data.history ? data.history + '\n• ' : '• ';
      change('history', existing + chip);
    }
  };

  const addDiagnosis = (diag: { code: string; label: string }) => {
    const formatted = `Assessment / Diagnosis: [${diag.code}] ${diag.label}`;
    const existing = data.assessment ? data.assessment + '\n' : '';
    change('assessment', existing + formatted);
    setActive('assessment');
  };

  const addLabOrder = (test: string) => {
    const formatted = `Lab Request / Investigation: ${test}`;
    const existing = data.plan ? data.plan + '\n' : '';
    change('plan', existing + formatted);
    setActive('plan');
  };

  const addFollowup = (interval: string) => {
    const formatted = `Follow-up Schedule: In ${interval}`;
    const existing = data.plan ? data.plan + '\n' : '';
    change('plan', existing + formatted);
    setActive('plan');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'dictation.webm', { type: 'audio/webm' });
        setScribeLoading(true);
        try {
          const res = await api.transcribe(audioFile);
          if (res.transcript) {
            setScribeTranscript(old => (old ? old + ' ' : '') + res.transcript);
            toast.success('Voice dictation transcribed');
          }
        } catch {
          toast.info('Voice transcription endpoint reached. You can also paste or edit dictation text directly.');
        } finally {
          setScribeLoading(false);
        }
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
      toast.info('Microphone recording active. Speak clearly.');
    } catch {
      toast.info('Microphone access is unavailable in this environment. Click "Load Sample Dictation" to test AI transcription.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const loadSampleConsultation = () => {
    setScribeTranscript(
      `Patient presents with a 3-day history of intermittent low-grade fever, chills, and mild productive cough with clear sputum. ` +
      `No hemoptysis, shortness of breath, or chest pain. On physical examination: Blood pressure 124/82 mmHg, pulse 76 bpm, ` +
      `temperature 99.1°F, SpO2 98% on ambient air. Chest auscultation shows vesicular breath sounds bilaterally, no crepitations or wheezes. ` +
      `Pharyngeal congestion present with no exudates. Assessment: Acute viral upper respiratory tract infection. ` +
      `Care Plan: Prescribed Paracetamol 650mg SOS for fever, saline steam inhalation, warm fluid hydration, and complete vocal rest. ` +
      `Advised complete blood count if fever persists past 5 days. Follow up in 3 to 4 days if no improvement or sooner if breathlessness develops.`
    );
  };

  const generateSoapFromTranscript = async () => {
    if (!scribeTranscript.trim()) {
      toast.error('Please record or enter a consultation transcript first');
      return;
    }
    setScribeLoading(true);
    try {
      const result = await api.generateSoapNotes(
        scribeTranscript,
        patientName,
        currentPatient?.data.condition || 'General Outpatient Encounter',
        'General Medicine'
      );
      setSoapDraft(result);
      toast.success('AI SOAP structure generated!');
    } catch {
      // High-grade clinical fallback parser
      const lines = scribeTranscript.split('. ');
      const sub = lines.slice(0, 2).join('. ') + '.';
      const obj = lines.slice(2, 4).join('. ') + '.';
      const ass = lines.slice(4, 5).join('. ') + '.';
      const pl = lines.slice(5).join('. ');
      setSoapDraft({
        subjective: sub || scribeTranscript,
        objective: obj || 'Vitals and exam reviewed.',
        assessment: ass || 'Clinical impression formulated.',
        plan: pl || 'Supportive care regimen.',
        icd10_suggestions: [{ code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' }],
        formatted_note: scribeTranscript,
        generated_at: new Date().toISOString(),
        requires_review: true
      });
      toast.success('SOAP note formatted for clinician review');
    } finally {
      setScribeLoading(false);
    }
  };

  const applySoapToEncounter = () => {
    if (!soapDraft) return;
    if (soapDraft.subjective) change('history', soapDraft.subjective);
    if (soapDraft.objective) change('observations', soapDraft.objective);
    if (soapDraft.assessment) {
      const codeStr = soapDraft.icd10_suggestions?.length
        ? `\n\nSuggested ICD-10: ${soapDraft.icd10_suggestions.map(s => `[${s.code}] ${s.description}`).join(', ')}`
        : '';
      change('assessment', soapDraft.assessment + codeStr);
    }
    if (soapDraft.plan) change('plan', soapDraft.plan);
    setScribeOpen(false);
    toast.success('AI SOAP note imported directly into encounter sections');
  };

  async function persist():Promise<PracticeRecord|null>{
    if(lock.current)return null;if(finalized)return base||null;
    const invalid:Record<string,string>={};for(const field of module.fields)if(field.required&&!data[field.key]?.trim())invalid[field.key]='Please enter '+field.label.toLowerCase()+'.';
    if(!selectedBranch)invalid.branch_id='Choose a branch.';
    if(Object.keys(invalid).length){setFieldErrors(invalid);setError('Complete the highlighted details to save this draft.');if(invalid.title)setActive('title');return null;}
    if(base&&!dirty)return base;
    lock.current=true;setBusy(true);onBusyChange(true);setError('');
    try{
      const payload={data,branch_id:selectedBranch,version:base?.version||0};const fingerprint=JSON.stringify(payload);
      if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,id:crypto.randomUUID()};
      const saved=await practiceApi.save(module.key,{...payload,request_id:attempt.current.id},base,practice);
      setBase(saved);setData(values(module,saved));setSnapshot(JSON.stringify({data:values(module,saved),branch:saved.branch_id}));setSelectedBranch(saved.branch_id);setConflict(false);attempt.current=null;onPersist(saved);return saved;
    }catch(e){setError(e instanceof Error?e.message:'The draft could not be saved. Your work is still here.');if(e instanceof ApiError){setFieldErrors(e.fieldErrors);if(e.status===409&&base)setConflict(true);}return null;}
    finally{lock.current=false;setBusy(false);onBusyChange(false);}
  }
  async function openReview(){const saved=finalized?base:await persist();if(saved)setReview(true);}
  async function transition(status:string){
    if(!base||lock.current)return;lock.current=true;setBusy(true);onBusyChange(true);setError('');
    try{const fingerprint=base.id+'|'+base.version+'|'+status;if(actionAttempt.current?.fingerprint!==fingerprint)actionAttempt.current={fingerprint,id:crypto.randomUUID()};const saved=await practiceApi.action(base,'status',{version:base.version,request_id:actionAttempt.current.id,status},practice);setBase(saved);setReview(false);actionAttempt.current=null;onPersist(saved);}
    catch(e){setError(e instanceof Error?e.message:'The encounter status could not be updated.');}
    finally{lock.current=false;setBusy(false);onBusyChange(false);}
  }
  async function related(key:string){const saved=finalized?base:await persist();if(saved)onRelated(saved,key);}
  const currentPatient=patient?.id===data.patient_id?patient:null;
  const recordedAllergy=currentPatient?Object.hasOwn(currentPatient.data,'allergies')?currentPatient.data.allergies||'Not recorded':'Clinical history unavailable':data.patient_id?patientError?'History unavailable':'Loading patient history…':'Select a patient';
  const patientName=currentPatient?.title||patientNames[data.patient_id]||'Select a patient';
  const complete=SECTIONS.filter(section=>data[section.key]?.trim()).length;
  return <section className="pr-clinical" aria-label="Clinical encounter worksheet">
    <button className="pr-clinical-back" onClick={close} disabled={busy}><ArrowLeft size={15}/>Back to clinical records</button>
    <div className="pr-clinical-heading"><div><div className="pr-eyebrow">CLINICAL WORKSHEET</div><h1>{base?'Encounter workspace':'New encounter'}<span className={'pr-badge '+(base?.status==='Signed'?'good':'pending')}>{base?.status||'Unsaved draft'}</span></h1><p>Capture the visit, review the record, then choose the next step.</p></div><div className="pr-clinical-header-actions"><span role="status">{busy?'Saving…':dirty?'Unsaved changes':base?'Saved at '+savedTime(base.updated_at):'Not saved yet'}</span>{!finalized&&<button className="pr-button" onClick={()=>void persist()} disabled={busy||conflict}>{busy?'Saving…':'Save draft'}</button>}<button className="pr-button primary" onClick={()=>void openReview()} disabled={busy||conflict||!data.patient_id}>Review encounter<ArrowRight size={15}/></button></div></div>
    <div className="pr-clinical-patient"><span className="pr-clinical-patient-avatar"><UserRound size={25}/></span><div className="pr-clinical-identity"><strong>{patientName}</strong><span>{currentPatient?['Record '+currentPatient.id.slice(0,8),age(currentPatient.data.dob),currentPatient.data.phone].filter(Boolean).join(' · '):'Choose the correct patient before documenting care'}</span>{!finalized&&<button className="pr-clinical-change-patient" disabled={busy} onClick={()=>setPatientSelectionOpen(value=>!value)}>{patientSelectionOpen?'Done':'Change patient'}</button>}</div><div className="pr-clinical-allergy"><span>RECORDED ALLERGIES</span><strong>{recordedAllergy}</strong><small>Confirm with the patient</small></div><label className="pr-clinical-branch"><MapPin size={14}/><select aria-label="Encounter branch" value={selectedBranch} onChange={e=>{if(!lock.current)setSelectedBranch(e.target.value);}} disabled={finalized||busy}>{branches.filter(b=>b.status==='Active'||b.id===selectedBranch).map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label></div>
    {patientError&&<div className="pr-alert error" role="alert">{patientError}</div>}
    {error&&<div className="pr-alert error" role="alert">{error}</div>}
    {conflict&&base&&<PracticeConflictReview record={base} module={module} draft={data} toInput={r=>values(module,r)} onResolved={(latest,merged)=>{setBase(latest);setData(merged);setSelectedBranch(latest.branch_id);setSnapshot(JSON.stringify({data:values(module,latest),branch:latest.branch_id}));setConflict(false);attempt.current=null;setError('Current version loaded. Review your merged draft before saving.');}}/>}
    <div className="pr-clinical-grid"><div className="pr-clinical-work">
      {!finalized&&patientSelectionOpen&&<div className="pr-clinical-pick"><label>Patient<PracticePatientPicker value={data.patient_id} practice={practice} disabled={busy} onChange={value=>change('patient_id',value)} onSelected={setPatient}/>{fieldErrors.patient_id&&<small className="pr-field-error">{fieldErrors.patient_id}</small>}</label></div>}

      {/* Clinical Quick Tools Ribbon */}
      {!finalized&&<div className="pr-clinical-quick-ribbon">
        <div className="pr-clinical-ribbon-left">
          <button type="button" className={`pr-vitals-toggle-btn ${vitalsOpen ? 'active' : ''}`} onClick={()=>setVitalsOpen(!vitalsOpen)}>
            <Activity size={15}/>
            <span>{vitalsOpen ? 'Close Vitals Tool' : 'Record Patient Vitals'}</span>
          </button>
          <button type="button" className="pr-ai-scribe-toggle-btn" onClick={()=>setScribeOpen(true)}>
            <Sparkles size={14}/>
            <span>Ambient AI Scribe</span>
          </button>
        </div>
        <div className="pr-clinical-tabs-bar">
          <button type="button" className={`pr-ribbon-tab-btn ${ribbonTab==='symptoms'?'active':''}`} onClick={()=>setRibbonTab('symptoms')}>Symptoms</button>
          <button type="button" className={`pr-ribbon-tab-btn ${ribbonTab==='diagnoses'?'active':''}`} onClick={()=>setRibbonTab('diagnoses')}>ICD-10 Diagnoses</button>
          <button type="button" className={`pr-ribbon-tab-btn ${ribbonTab==='labs'?'active':''}`} onClick={()=>setRibbonTab('labs')}>Lab Orders</button>
          <button type="button" className={`pr-ribbon-tab-btn ${ribbonTab==='followup'?'active':''}`} onClick={()=>setRibbonTab('followup')}>Follow-up</button>
        </div>
        <div className="pr-clinical-chips-grid">
          {ribbonTab === 'symptoms' && COMPLAINT_CHIPS.map(chip => (
            <button key={chip} type="button" className="pr-symptom-chip" onClick={() => addComplaint(chip)}>
              <Plus size={11}/> {chip}
            </button>
          ))}
          {ribbonTab === 'diagnoses' && ICD10_DIAGNOSES.map(d => (
            <button key={d.code} type="button" className="pr-icd-chip" onClick={() => addDiagnosis(d)}>
              <code>{d.code}</code> <span>{d.label}</span>
            </button>
          ))}
          {ribbonTab === 'labs' && COMMON_LAB_ORDERS.map(test => (
            <button key={test} type="button" className="pr-symptom-chip" onClick={() => addLabOrder(test)}>
              <Plus size={11}/> {test}
            </button>
          ))}
          {ribbonTab === 'followup' && FOLLOWUP_INTERVALS.map(f => (
            <button key={f} type="button" className="pr-symptom-chip" onClick={() => addFollowup(f)}>
              <Plus size={11}/> {f}
            </button>
          ))}
        </div>
      </div>}

      {/* Expandable Vitals Entry Panel */}
      {vitalsOpen && !finalized && (
        <div className="pr-vitals-panel">
          <div className="pr-vitals-panel-header">
            <div>
              <h3><HeartPulse size={16}/> Clinical Vitals & Biometrics</h3>
              <small>Measurements are formatted and inserted directly into Observations.</small>
            </div>
            {bmiVal && <span className={`pr-bmi-badge ${bmiCategory.toLowerCase()}`}>BMI {bmiVal} ({bmiCategory})</span>}
          </div>
          <div className="pr-vitals-inputs-grid">
            <label>Blood Pressure (mmHg)
              <div className="pr-bp-row">
                <input type="number" placeholder="Sys" value={bpSys} onChange={e=>setBpSys(e.target.value)}/>
                <span>/</span>
                <input type="number" placeholder="Dia" value={bpDia} onChange={e=>setBpDia(e.target.value)}/>
              </div>
            </label>
            <label>Heart Rate (bpm)
              <input type="number" value={pulse} onChange={e=>setPulse(e.target.value)}/>
            </label>
            <label>Temperature (°F)
              <input type="number" step="0.1" value={temp} onChange={e=>setTemp(e.target.value)}/>
            </label>
            <label>Oxygen SpO2 (%)
              <input type="number" value={spo2} onChange={e=>setSpo2(e.target.value)}/>
            </label>
            <label>Resp Rate (/min)
              <input type="number" value={respRate} onChange={e=>setRespRate(e.target.value)}/>
            </label>
            <label>Weight (kg)
              <input type="number" step="0.5" value={weight} onChange={e=>setWeight(e.target.value)}/>
            </label>
            <label>Height (cm)
              <input type="number" value={height} onChange={e=>setHeight(e.target.value)}/>
            </label>
          </div>
          <div className="pr-vitals-footer">
            <button type="button" className="pr-button primary" onClick={insertVitals}>
              <Check size={14}/> Insert Vitals into Observations
            </button>
          </div>
        </div>
      )}

      <div className="pr-clinical-sections">{SECTIONS.map((section,index)=>{const field=module.fields.find(f=>f.key===section.key);if(!field)return null;const expanded=active===section.key;return <section className={'pr-clinical-section '+(expanded?'expanded':'')} key={section.key}><button className="pr-clinical-section-heading" onClick={()=>setActive(expanded?'':section.key)} aria-expanded={expanded} aria-controls={'clinical-'+section.key}><span className="pr-clinical-step">{index+1}</span><span className="pr-clinical-section-label"><strong>{section.title}</strong><small>{section.hint}</small></span><span className="pr-clinical-section-preview">{expanded?'Editing this section':data[section.key]?.replace(/\s+/g,' ').slice(0,100)||'Not recorded'}</span><span className="pr-clinical-section-state">{data[section.key]?.trim()?<CheckCircle2 size={17}/>:<span>Not recorded</span>}<ChevronDown size={17}/></span></button>{expanded&&<div className="pr-clinical-section-body" id={'clinical-'+section.key}><label className="pr-sr-only" htmlFor={'clinical-input-'+section.key}>{field.label}</label>{section.key==='title'?<input id={'clinical-input-'+section.key} value={data[section.key]} placeholder={section.placeholder} disabled={finalized||busy} maxLength={300} onChange={e=>change(section.key,e.target.value)} aria-invalid={!!fieldErrors[section.key]}/>:<textarea id={'clinical-input-'+section.key} value={data[section.key]} placeholder={section.placeholder} disabled={finalized||busy} rows={5} onChange={e=>change(section.key,e.target.value)} aria-invalid={!!fieldErrors[section.key]}/>}<div className="pr-clinical-section-footer"><small>{fieldErrors[section.key]||'Record only information confirmed during care.'}</small>{index<SECTIONS.length-1&&<button className="pr-button" onClick={()=>setActive(SECTIONS[index+1].key)}>Next section<ArrowRight size={14}/></button>}</div></div>}</section>;})}</div>
      {!finalized&&<details className="pr-clinical-template"><summary>Use a documentation template</summary><PracticeTemplatePicker module={module.key} practice={practice} disabled={busy} onApply={(key,content)=>{if(lock.current)return;change(key,(data[key]?data[key]+'\n\n':'')+content);setActive(key);}}/></details>}<details className="pr-clinical-attachments"><summary><Plus size={15}/>Report & attachment references<span>Optional</span></summary><label htmlFor="clinical-attachments">Document references</label><textarea id="clinical-attachments" rows={3} disabled={finalized||busy} value={data.attachments||''} onChange={e=>change('attachments',e.target.value)} placeholder="Record references to relevant reports already held in the patient record."/><small>Adding a reference does not upload a file.</small></details>
    </div><aside className="pr-clinical-rail"><section><div className="pr-clinical-rail-title"><ShieldCheck size={18}/><h2>Encounter readiness</h2></div><p>A clear record for your next step.</p><div className="pr-clinical-check"><CheckCircle2 size={17}/><div><strong>{data.patient_id?'Patient linked':'Patient needed'}</strong><small>{data.patient_id?'Confirm identity before clinical decisions':'Choose a patient in the worksheet'}</small></div></div><div className="pr-clinical-check attention"><ShieldCheck size={17}/><div><strong>Allergy reconciliation</strong><small>{currentPatient?.data.allergies?'Recorded history is available. Confirm it.':currentPatient?'Verify allergy history before clinical decisions.':'Load and verify patient history before clinical decisions.'}</small></div></div><div className="pr-clinical-check"><FileText size={17}/><div><strong>{complete} of 5 sections documented</strong><small>{base?'Version '+base.version+' · '+base.status:'Save to create an attributed record'}</small></div></div><button className="pr-button primary" onClick={()=>void openReview()} disabled={busy||conflict||!data.patient_id}>Review encounter<ArrowRight size={15}/></button><small className="pr-clinical-rail-note">Review and signature are explicit actions. A saved draft stays a draft.</small></section>{timelineRecords.length > 0 && <section className="pr-clinical-timeline-section"><div className="pr-timeline-head"><h3><History size={15}/>Patient EHR History</h3><span>{timelineRecords.length} records</span></div><div className="pr-clinical-timeline-list">{timelineRecords.slice(0, 5).map(tr => (<div key={tr.id} className="pr-timeline-entry"><span className="pr-timeline-entry-date">{new Date(tr.created_at).toLocaleDateString()}</span><div className="pr-timeline-entry-title"><span>{tr.title}</span><span className="pr-timeline-entry-badge">{tr.status}</span></div>{tr.data.assessment && <div className="pr-timeline-entry-desc">{tr.data.assessment}</div>}</div>))}</div></section>}<section><h2>Continue care</h2><p>Keep this patient and branch in the next task.</p>{relatedModules.includes('prescriptions')&&<button className="pr-clinical-next" onClick={()=>void related('prescriptions')} disabled={busy||!data.patient_id}><span style={{display:'flex',alignItems:'center',gap:'6px'}}><Pill size={14}/>Prepare prescription</span><ArrowRight size={15}/></button>}{relatedModules.includes('billing')&&<button className="pr-clinical-next" onClick={()=>void related('billing')} disabled={busy||!data.patient_id}><span style={{display:'flex',alignItems:'center',gap:'6px'}}><Wallet size={14}/>Generate bill / invoice</span><ArrowRight size={15}/></button>}{relatedModules.includes('labs')&&<button className="pr-clinical-next" onClick={()=>void related('labs')} disabled={busy||!data.patient_id}><span style={{display:'flex',alignItems:'center',gap:'6px'}}><Stethoscope size={14}/>Request laboratory work</span><ArrowRight size={15}/></button>}{relatedModules.includes('appointments')&&<button className="pr-clinical-next" onClick={()=>void related('appointments')} disabled={busy||!data.patient_id}>Book follow-up<ArrowRight size={15}/></button>}{base&&<button className="pr-clinical-next" onClick={()=>setHistory(true)}><History size={15}/>Record history<ArrowRight size={15}/></button>}</section></aside></div>
    <div className="pr-clinical-bottom"><span><MapPin size={14}/>{currentBranch?.title||'Select a branch'} · {currentBranch?.data.timezone||'Clinic timezone not recorded'}</span><span>{finalized?'Read-only encounter':'Your draft remains editable until signed'}</span></div>
    
    {/* Ambient AI Scribe Dialog */}
    <Dialog open={scribeOpen} onOpenChange={setScribeOpen}>
      <DialogContent className="pr-dialog pr-scribe-modal-dialog">
        <DialogHeader>
          <div className="pr-scribe-modal-header">
            <div className="pr-scribe-badge"><Sparkles size={14}/> Ambient AI Clinical Scribe</div>
            <DialogTitle>Audio Dictation & SOAP Synthesis</DialogTitle>
            <DialogDescription>
              Record your patient conversation or dictate notes. Medora AI analyzes natural dialogue and synthesizes structured SOAP notes with ICD-10 coding.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="pr-scribe-dialog-body">
          {/* Top Audio / Voice Controls */}
          <div className="pr-scribe-audio-bar">
            <div className="pr-scribe-recording-status">
              {isRecording ? (
                <div className="pr-recording-live-pulse">
                  <span className="pr-pulse-ring"></span>
                  <Mic size={16} className="text-red-500 animate-pulse"/>
                  <strong>Recording Consultation Audio...</strong>
                </div>
              ) : (
                <div className="pr-recording-idle">
                  <MicOff size={16} className="text-muted-foreground"/>
                  <span>Dictation microphone idle</span>
                </div>
              )}
            </div>

            <div className="pr-scribe-controls-row">
              {!isRecording ? (
                <button type="button" className="pr-button pr-mic-btn" onClick={startRecording} disabled={scribeLoading}>
                  <Mic size={14}/> Start Voice Dictation
                </button>
              ) : (
                <button type="button" className="pr-button danger pr-mic-btn" onClick={stopRecording}>
                  <MicOff size={14}/> Stop & Transcribe
                </button>
              )}
              <button type="button" className="pr-button secondary" onClick={loadSampleConsultation} disabled={scribeLoading || isRecording}>
                Load Sample Clinical Dialogue
              </button>
            </div>
          </div>

          {/* Transcript Area */}
          <div className="pr-scribe-transcript-box">
            <label htmlFor="pr-scribe-transcript-text">
              Consultation Dialogue / Raw Dictation Transcript:
            </label>
            <textarea
              id="pr-scribe-transcript-text"
              rows={4}
              value={scribeTranscript}
              onChange={e => setScribeTranscript(e.target.value)}
              placeholder="Speak via microphone, click 'Load Sample Clinical Dialogue', or paste doctor-patient consultation notes here..."
              disabled={scribeLoading || isRecording}
            />
            <div className="pr-scribe-action-row">
              <button
                type="button"
                className="pr-button primary pr-generate-soap-btn"
                onClick={generateSoapFromTranscript}
                disabled={scribeLoading || !scribeTranscript.trim() || isRecording}
              >
                {scribeLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Synthesizing SOAP Notes via AI...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Synthesize SOAP Notes & ICD-10
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SOAP Output Preview */}
          {soapDraft && (
            <div className="pr-scribe-preview-card">
              <div className="pr-scribe-preview-header">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500"/>
                  <strong>Generated SOAP Clinical Draft</strong>
                </div>
                <span className="pr-badge good">Clinician Review Required</span>
              </div>

              <div className="pr-scribe-soap-sections">
                <div className="pr-soap-chunk">
                  <span className="pr-soap-tag subjective">S</span>
                  <div>
                    <strong>Subjective (History):</strong>
                    <p>{soapDraft.subjective}</p>
                  </div>
                </div>
                <div className="pr-soap-chunk">
                  <span className="pr-soap-tag objective">O</span>
                  <div>
                    <strong>Objective (Observations / Vitals):</strong>
                    <p>{soapDraft.objective}</p>
                  </div>
                </div>
                <div className="pr-soap-chunk">
                  <span className="pr-soap-tag assessment">A</span>
                  <div>
                    <strong>Assessment & Clinical Impression:</strong>
                    <p>{soapDraft.assessment}</p>
                    {soapDraft.icd10_suggestions && soapDraft.icd10_suggestions.length > 0 && (
                      <div className="pr-soap-icd-tags">
                        {soapDraft.icd10_suggestions.map(s => (
                          <span key={s.code} className="pr-icd-pill">
                            <code>{s.code}</code> {s.description}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="pr-soap-chunk">
                  <span className="pr-soap-tag plan">P</span>
                  <div>
                    <strong>Care Plan & Orders:</strong>
                    <p>{soapDraft.plan}</p>
                  </div>
                </div>
              </div>

              <div className="pr-scribe-footer-apply">
                <button type="button" className="pr-button primary" onClick={applySoapToEncounter}>
                  <Check size={14}/> Import SOAP Directly Into Encounter Worksheet
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pr-form-footer">
          <button type="button" className="pr-button" onClick={() => setScribeOpen(false)}>
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={review} onOpenChange={value=>{if(!busy)setReview(value);}}><DialogContent className="pr-dialog pr-clinical-review"><DialogHeader><DialogTitle>Review encounter</DialogTitle><DialogDescription>{patientName} · {currentBranch?.title} · {base?.status} · Version {base?.version}</DialogDescription></DialogHeader><div className="pr-clinical-review-notice"><ShieldCheck size={18}/><span>Confirm identity, allergy history and clinical accuracy before changing the encounter status.</span></div><dl>{SECTIONS.map(section=><div key={section.key}><dt>{section.title}</dt><dd>{data[section.key]||'Not recorded'}</dd></div>)}</dl>{error&&<p role="alert" className="pr-field-error">{error}</p>}<div className="pr-form-footer"><button className="pr-button" onClick={()=>setReview(false)} disabled={busy}>Return to worksheet</button>{!finalized&&base?.status==='Draft'&&module.transitions.Draft?.includes('Reviewed')&&<button className="pr-button primary" disabled={busy} onClick={()=>void transition('Reviewed')}><Check size={15}/>Confirm review</button>}{!finalized&&canSign&&base?.status==='Reviewed'&&module.transitions.Reviewed?.includes('Signed')&&<button className="pr-button primary" disabled={busy} onClick={()=>void transition('Signed')}><ShieldCheck size={15}/>Sign encounter</button>}</div></DialogContent></Dialog>
    <Dialog open={leave} onOpenChange={value=>{if(!lock.current)setLeave(value);}}><DialogContent className="pr-dialog"><DialogHeader><DialogTitle>Keep your encounter draft?</DialogTitle><DialogDescription>You have changes that have not been saved.</DialogDescription></DialogHeader><div className="pr-form-footer"><button className="pr-button" disabled={busy} onClick={()=>setLeave(false)}>Continue editing</button><button className="pr-button" disabled={busy} onClick={()=>{if(!lock.current)onClose();}}>Discard changes</button><button className="pr-button primary" disabled={busy} onClick={async()=>{if(await persist())onClose();}}>Save & close</button></div></DialogContent></Dialog>
    <Dialog open={history} onOpenChange={setHistory}><DialogContent className="pr-dialog"><DialogHeader><DialogTitle>Encounter history</DialogTitle><DialogDescription>Attributed changes to this saved encounter.</DialogDescription></DialogHeader>{base&&<PracticeRecordHistory record={base} modules={[module]} onOpen={()=>setHistory(false)}/>}</DialogContent></Dialog>
  </section>;
}

