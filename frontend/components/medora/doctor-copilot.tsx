'use client';
import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, AudioLines, BrainCircuit, CalendarDays, Check, Copy, Download, FileText, Mic, Network, Pause, Save, Sparkles, Stethoscope, Tag, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { audit, dateOffset, download, niceDate, uid } from '@/lib/medora-demo';
import { AppContext, EmptyState, Heading, Panel, Pick, SearchInput, TabView } from './shared';
import { DemoBoundary } from './feature-kit';
import { api, API_MODE, type SOAPNoteResult } from '@/lib/medora-api';

const outputs = ['Clinical note', 'Referral letter', 'Follow-up plan', 'Patient instructions'];
export function DoctorCopilot({ ctx }: { ctx: AppContext }) {
  const p = ctx.data.patients.find(p => p.id === ctx.selected) || ctx.data.patients[0];
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('Clinical note');
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState<Record<string, boolean>>({});
  const reviewed = !!reviews[tab];
  const [specialty, setSpecialty] = useState('Cardiology');
  const [followDate, setFollowDate] = useState(dateOffset(14));
  const [scribe, setScribe] = useState('Idle');
  const [transcript, setTranscript] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const [soapNote, setSoapNote] = useState<SOAPNoteResult | null>(null);
  const [generatingSoap, setGeneratingSoap] = useState(false);
  const [recordingConsent,setRecordingConsent]=useState(false);
  const recorder=useRef<MediaRecorder|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const recordingTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const generation=useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matching = ctx.data.patients.filter(p => `${p.name} ${p.id} ${p.condition}`.toLowerCase().includes(q.toLowerCase()));
  const drafts = ctx.data.features.clinicalDrafts[p.id] || {};
  const lastNote = ctx.data.notes.filter(n => n.patientId === p.id && !/^(Referral|Follow-up|Patient instructions)/.test(n.title)).at(-1)?.body || '';
  const textFor = (type: string) => drafts[type] ?? (type === 'Clinical note' ? lastNote : '');
  const body = textFor(tab);
  const next = ctx.data.appointments.filter(a => a.patientId === p.id && a.status === 'Confirmed').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
  const history = ctx.data.notes.filter(n => n.patientId === p.id).slice().reverse();
  useEffect(() => { setReviews({}); setBusy(false); setSaved([]); setScribe('Idle'); setTranscript(''); setSoapNote(null); setGeneratingSoap(false); if (timer.current) clearTimeout(timer.current); if (generationTimer.current) clearTimeout(generationTimer.current); return () => { ++generation.current; if(recordingTimer.current)clearTimeout(recordingTimer.current); if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(track=>track.stop()); if (timer.current) clearTimeout(timer.current); if (generationTimer.current) clearTimeout(generationTimer.current); }; }, [p.id]);
  const setDraft = (type: string, value: string) => { setReviews(v => ({ ...v, [type]: false })); ctx.update(d => ({ ...d, features: { ...d.features, clinicalDrafts: { ...d.features.clinicalDrafts, [p.id]: { ...d.features.clinicalDrafts[p.id], [type]: value } } } })); };
  const template = (type: string) => type === 'Clinical note' ? `SUBJECTIVE\n${p.name} attends for ${p.condition.toLowerCase()}.\nPatient concerns: [clinician to complete].\n\nOBJECTIVE\nObservations and findings: [clinician to complete].\n\nASSESSMENT\nClinical assessment: [clinician to complete].\n\nPLAN\nAgreed next steps: [clinician to complete].\nFollow-up details: [clinician to confirm].\n\nScripted draft. Review and complete before use.` : type === 'Referral letter' ? `REFERRAL DRAFT — ${specialty}\n\nPatient: ${p.name} · Demo ID ${p.id.toUpperCase()}\nCare context: ${p.condition}\n\nDear ${specialty} team,\nReason for referral: [clinician to complete].\nRelevant history and findings: [clinician to confirm].\nSupporting records: [select and verify].\nRequested next step: [clinician to complete].\n\nDr. Rajesh Sharma\nScripted demo. No referral has been sent.` : type === 'Follow-up plan' ? `FOLLOW-UP PLAN DRAFT\nPatient: ${p.name}\nReview date: ${niceDate(followDate)}\n\nAgreed care goals: [clinician to complete].\nDocuments to review: [clinician to confirm].\nQuestions to revisit: [add after discussion].\nResponsible care team: [confirm].\n\nNo clinical instructions or treatment recommendations are generated.` : `PATIENT INSTRUCTIONS DRAFT\nFor ${p.name}\n\nWhat we discussed\n[Clinician to enter a plain-language summary.]\n\nYour agreed next steps\n[Clinician to enter and verify instructions.]\n\nYour next appointment\n${next ? `${niceDate(next.date)} at ${next.time} · ${next.provider}` : '[Confirm a date, time, and location.]'}\n\nQuestions you would like to ask\n[Add the patient’s questions.]\n\nScripted template. No medication or treatment advice is supplied.`;
  
  const loadSampleConversation = () => {
    const sample = `Doctor: Good morning ${p.name}, how have you been feeling since our last visit regarding your ${p.condition.toLowerCase()}?\nPatient: Good morning doctor. My energy has been a bit better, but I felt mild breathlessness when climbing the second flight of stairs yesterday. Also my ankles feel slightly puffy in the evening.\nDoctor: Let's check your vitals. Blood pressure today is 134/84 mmHg, pulse is 74 beats per minute regular, oxygen saturation is 98% on room air. Lungs are clear on auscultation bilaterally, no crackles or wheezes. Mild trace pedal edema bilaterally.\nPatient: Is that concerning? I've been taking the morning tablet consistently.\nDoctor: Your vital signs are stable, but the trace fluid retention suggests we should gently review your sodium intake and check kidney markers. Let's arrange a routine renal panel and electrolyte blood test, and continue your daily blood pressure log.\nPatient: Understood doctor. When should I follow up?\nDoctor: In two weeks for a review of the blood tests and ankle swelling. If shortness of breath occurs at rest, contact emergency services immediately.`;
    setTranscript(sample);
    setScribe('Ready');
    toast.success('Sample clinical conversation loaded.');
  };

  const handleGenerateSoap = async () => {
    if (!transcript.trim()) {
      toast.error('Record or enter a consultation transcript first.');
      return;
    }
    const requestGeneration = ++generation.current;
    setGeneratingSoap(true);
    try {
      const result = await api.generateSoapNotes(transcript, p.name, p.condition, specialty, ctx.ownerId);
      if(requestGeneration!==generation.current)return;
      setSoapNote(result);
      toast.success('Ambient SOAP Note generated successfully!');
    } catch (failure) {
      if(requestGeneration!==generation.current)return;
      setSoapNote(null);
      toast.error(failure instanceof Error ? failure.message : 'The clinical scribe is unavailable. Your transcript is still here; try again.');
    } finally {
      if(requestGeneration===generation.current)setGeneratingSoap(false);
    }
  };

  const handleInsertSoap = () => {
    if (!soapNote) return;
    const noteText = `CLINICAL SOAP NOTE — AMBIENT SCRIBE\nPatient: ${p.name} · ${p.age}y · ${p.id.toUpperCase()}\nSpecialty: ${specialty} · Encounter Date: ${niceDate(dateOffset(0))}\n\nSUBJECTIVE\n${soapNote.subjective}\n\nOBJECTIVE\n${soapNote.objective}\n\nASSESSMENT\n${soapNote.assessment}\n\nPLAN\n${soapNote.plan}${soapNote.icd10_suggestions?.length ? `\n\nSUGGESTED ICD-10 CODES:\n${soapNote.icd10_suggestions.map(c => `• [${c.code}] ${c.description}`).join('\n')}` : ''}\n\nReview status: Draft — clinician verification required.`;
    setDraft('Clinical note', noteText);
    setTab('Clinical note');
    toast.success('SOAP note inserted into Clinical Note draft!');
  };

  const generate = async () => {
    setBusy(true); const active=tab; const requestGeneration=generation.current;
    if(!API_MODE){generationTimer.current=setTimeout(()=>{setDraft(active,template(active));setBusy(false);toast.success('Sample draft ready for review');},450);return;}
    try{
      await ctx.flush?.();
      const context=JSON.stringify({patient:p,recordedNotes:ctx.data.notes.filter(n=>n.patientId===p.id),recordedMedication:p.id==='p1'?ctx.data.medicines:[],documentSummaries:p.id==='p1'?ctx.data.documents.map(d=>({name:d.name,summary:d.summary})):[],transcript,specialty,plannedReview:followDate}).slice(0,20000);
      const result=await api.clinical(active,p.name,context,ctx.ownerId);
      if(requestGeneration===generation.current){setDraft(active,result.draft);toast.success('AI draft ready for clinician review');}
    }catch(e){toast.error(e instanceof Error?e.message:'The draft could not be prepared.');}finally{if(requestGeneration===generation.current)setBusy(false);}
  };
  const recordAudio=async()=>{
    if(recorder.current?.state==='recording'){recorder.current.stop();return;}
    if(!recordingConsent){toast.error('Confirm patient consent before recording.');return;}
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){toast.error('Audio recording is unavailable. Enter consultation notes manually.');return;}
    const requestGeneration=generation.current;
    try{
      const audio=await navigator.mediaDevices.getUserMedia({audio:true});
      if(requestGeneration!==generation.current){audio.getTracks().forEach(track=>track.stop());return;}
      stream.current=audio;
      const mime=['audio/webm','audio/mp4','audio/ogg'].find(type=>MediaRecorder.isTypeSupported(type));
      const recording=new MediaRecorder(audio,mime?{mimeType:mime}:undefined);recorder.current=recording;
      const chunks:BlobPart[]=[];let bytes=0;
      recording.ondataavailable=e=>{if(e.data.size){bytes+=e.data.size;chunks.push(e.data);if(bytes>10*1024*1024&&recording.state==='recording')recording.stop();}};
      recording.onstop=()=>{
        audio.getTracks().forEach(track=>track.stop());if(recordingTimer.current)clearTimeout(recordingTimer.current);
        if(requestGeneration!==generation.current)return;
        if(bytes>10*1024*1024){setScribe('Idle');toast.error('Recording exceeds 10 MB. Try a shorter consultation segment.');return;}
        setScribe('Transcribing');
        const file=new File(chunks,'consultation.audio',{type:recording.mimeType.split(';')[0]||'audio/webm'});
        void api.transcribe(file).then(result=>{if(requestGeneration===generation.current){setTranscript(result.transcript);setScribe('Ready');}}).catch(e=>{if(requestGeneration===generation.current){setScribe('Idle');toast.error(e instanceof Error?e.message:'Transcription failed.');}});
      };
      recording.start(1000);setScribe('Recording');recordingTimer.current=setTimeout(()=>{if(recording.state==='recording')recording.stop();},120000);
    }catch{toast.error('Microphone access was not available. You can enter notes manually.');}
  };
  const startScribe = () => { setScribe('Previewing'); setTranscript('Patient: I would like to review my care goals and prepare for my next visit.'); timer.current = setTimeout(() => { setTranscript('Patient: I would like to review my care goals and prepare for my next visit.\n\nClinician: We will record your questions and confirm the relevant documents and appointment details.\n\nScripted conversation. No audio was recorded.'); setScribe('Ready'); }, 900); };
  const saveOutputs = async (types: string[]) => {
    const selected = types.filter(type => textFor(type).trim() && reviews[type]);
    if (!selected.length) { toast.error('Review and acknowledge each draft you want to save.'); return; }
    ctx.update(d => {
      const notes = selected.map(type => ({ id: uid(), patientId: p.id, title: type === 'Referral letter' ? 'Referral to ' + specialty : type === 'Clinical note' ? 'Consultation · ' + p.condition : type + ' · ' + p.name, body: textFor(type), date: dateOffset(0) })).filter(n => !d.notes.some(x => x.patientId === n.patientId && x.title === n.title && x.body === n.body));
      const follow = notes.find(n => n.title.startsWith('Follow-up plan'));
      return audit({ ...d, notes: [...d.notes, ...notes], documents: p.id === 'p1' ? [...notes.map(n => ({ id: 'doc-' + n.id, name: n.title + '.txt', type: n.title.startsWith('Referral') ? 'Referral' : 'Consultation', date: n.date, size: Math.max(1,Math.ceil(n.body.length/1024))+' KB', summary: n.body })), ...d.documents] : d.documents, tasks: follow ? [...d.tasks, { id: uid(), patientId: p.id, title: 'Follow-up with ' + p.name, detail: 'Review the clinician-completed plan and appointment details.', date: followDate, done: false }] : d.tasks }, 'Reviewed documents saved for ' + p.name);
    });
    try{await ctx.flush?.();setSaved(selected);toast.success(`${selected.length} reviewed ${selected.length===1?'draft':'drafts'} saved to the care record`);}catch(e){toast.error(e instanceof Error?e.message:'The drafts could not be saved.');}
  };
  return <><Heading title="More presence. Less paperwork." sub={API_MODE?"Review the person, capture consultation notes, and keep every draft together.":"Review the person, capture a sample conversation, and keep every draft together."} eyebrow="DOCTOR COPILOT"><button className="btn secondary" onClick={() => ctx.go('schedule')}><CalendarDays size={16}/>Clinic schedule</button><button className="btn primary" disabled={!outputs.some(type => reviews[type] && textFor(type).trim())} onClick={() => saveOutputs(outputs)}><Save size={16}/>Save all reviewed drafts</button></Heading>
    <div className="copilot-patient-bar"><SearchInput value={q} onChange={setQ} placeholder="Search patients by name or record ID…"/><label>Select patient<Pick label="Select patient" value={p.name} onChange={v => ctx.setSelected(ctx.data.patients.find(p => p.name === v)?.id || p.id)} options={matching.length ? matching.map(p => p.name) : [p.name]}/></label><span className="badge">{matching.length} matching patients</span></div>
    <div className="copilot-layout"><div className="stack"><Panel className="copilot-patient-summary"><div className="row"><span className="avatar large">{p.initials}</span><span className="badge">{API_MODE?"Patient record":"Demo patient"}</span></div><h2>{p.name}</h2><p>{p.age} years · {p.id.toUpperCase()}</p><dl className="detail-facts"><div><dt>Care reason</dt><dd>{p.condition}</dd></div><div><dt>Recorded allergy</dt><dd>{API_MODE?'Check the patient’s verified allergy record':p.id==='p1'?'Penicillin · Sample':'Not in this sample record'}</dd></div><div><dt>Medication context</dt><dd>{p.id === 'p1' ? ctx.data.medicines.map(m => m.name).join(', ') : 'Review with the patient'}</dd></div><div><dt>Last recorded visit</dt><dd>{niceDate(p.lastVisit)}</dd></div><div><dt>Next appointment</dt><dd>{next ? `${niceDate(next.date)} · ${next.time}` : 'No appointment recorded'}</dd></div></dl><button className="btn secondary full" disabled={!ctx.data.documents.length} onClick={() => ctx.open('document', ctx.data.documents[0])}><FileText size={16}/>Review a document</button><DemoBoundary>{API_MODE?"Recorded information needs clinical verification.":"Fictional summary. No clinical verification has run."}</DemoBoundary></Panel><Panel title="Saved care documents" sub={`${history.length} records for this patient. other patients’ records are separate.`}>{history.slice(0,4).map(n => <details className="saved-clinical-document" key={n.id}><summary><FileText size={16}/><span>{n.title}<small>{niceDate(n.date)}</small></span></summary><p>{n.body}</p></details>)}{!history.length && <EmptyState title="No documents yet" text="Reviewed drafts will appear here."/>}</Panel></div>
      <div className="stack"><Panel className="copilot-scribe"><div className="copilot-scribe-top"><span className="icon-box violet"><AudioLines/></span><div><h2>{API_MODE?'Consultation scribe':'AI scribe preview'}</h2><p>{API_MODE?'Record up to 2 minutes, then review the transcript.':'A scripted conversation, ready to structure.'}</p></div><span className={`scribe-state ${scribe==='Recording'||scribe==='Previewing'?'recording':''}`} role="status">{scribe}</span><button className="btn secondary" disabled={scribe==='Transcribing'||(API_MODE&&!recordingConsent)} onClick={()=>{if(API_MODE){void recordAudio();return;}if(scribe==='Previewing'){if(timer.current)clearTimeout(timer.current);setScribe('Ready');}else startScribe();}}>{scribe==='Recording'||scribe==='Previewing'?<><Pause size={15}/>{API_MODE?'Stop & transcribe':'Pause preview'}</>:<><Mic size={15}/>{API_MODE?'Start recording':'Try scribe demo'}</>}</button></div>{API_MODE&&<div className="checkbox-line service-consent"><Checkbox id="recording-consent" checked={recordingConsent} disabled={scribe==='Recording'} onCheckedChange={v=>setRecordingConsent(!!v)}/><label htmlFor="recording-consent">The patient agrees to recording and processing by the configured transcription provider. Audio is not stored in Medora.</label></div>}{API_MODE?<label className="scribe-transcript">Consultation transcript<textarea aria-label="Consultation transcript" value={transcript} onChange={e=>setTranscript(e.target.value)} placeholder="Record a consultation or enter reviewed notes…" maxLength={30000}/></label>:scribe!=='Idle'&&<div className="scribe-transcript"><p>{transcript}</p>{scribe==='Previewing'&&<Progress value={55}/>}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '14px', alignItems: 'center' }}>
          <button
            className="btn primary"
            disabled={generatingSoap || !transcript.trim() || scribe === 'Recording' || scribe === 'Transcribing'}
            onClick={handleGenerateSoap}
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff', border: 'none', boxShadow: '0 2px 10px rgba(99, 102, 241, 0.25)' }}
          >
            <Sparkles size={16}/>
            {generatingSoap ? 'Synthesizing SOAP Note…' : 'Generate Ambient SOAP Note'}
          </button>
          {!transcript.trim() && (
            <button className="btn ghost" onClick={loadSampleConversation} style={{ fontSize: '13px' }}>
              Load sample conversation
            </button>
          )}
          {!!transcript && scribe !== 'Recording' && scribe !== 'Transcribing' && (
            <button className="btn secondary" onClick={() => {
              setDraft('Clinical note', textFor('Clinical note') + '\n\nCONSULTATION TRANSCRIPT — REVIEW REQUIRED\n' + transcript);
              setTab('Clinical note');
              toast.success('Transcript appended to Clinical note draft.');
            }}>
              <FileText size={16}/>Use in clinical note
            </button>
          )}
        </div>

        {generatingSoap && (
          <div className="soap-loading-state">
            <BrainCircuit size={28} className="spin-slow" style={{ color: '#4f46e5' }}/>
            <div>
              <strong style={{ fontSize: '14px', color: '#1e293b' }}>Ambient Scribe AI is generating structured SOAP Note…</strong>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Extracting subjective complaints, clinical findings, differential assessment, care plan, and ICD-10 suggestions</p>
            </div>
            <Progress value={65} style={{ width: '220px', height: '6px' }}/>
          </div>
        )}

        {soapNote && (
          <div className="copilot-soap-card">
            <div className="copilot-soap-header">
              <div className="soap-header-title">
                <span className="icon-box violet" style={{ width: '36px', height: '36px' }}><BrainCircuit size={20}/></span>
                <div>
                  <h3>Ambient Clinical SOAP Note</h3>
                  <p>AI Scribe Structured · Requires clinician verification before signing</p>
                </div>
              </div>
              <div className="soap-header-actions">
                <button className="btn primary small" onClick={handleInsertSoap} style={{ background: '#4f46e5', color: '#fff', fontSize: '12px', gap: '6px' }}>
                  <ArrowRight size={14}/> Insert into Note Draft
                </button>
                <button className="btn secondary small" onClick={() => {
                  navigator.clipboard.writeText(soapNote.formatted_note || `SUBJECTIVE\n${soapNote.subjective}\n\nOBJECTIVE\n${soapNote.objective}\n\nASSESSMENT\n${soapNote.assessment}\n\nPLAN\n${soapNote.plan}`);
                  toast.success('SOAP note copied to clipboard');
                }} style={{ fontSize: '12px', gap: '4px' }}>
                  <Copy size={13}/> Copy
                </button>
                <button className="btn ghost small" onClick={() => {
                  download(`medora-soap-${p.name.toLowerCase().replace(/\s+/g, '-')}-${dateOffset(0)}.txt`, soapNote.formatted_note || `CLINICAL SOAP NOTE\nPatient: ${p.name}\nSpecialty: ${specialty}\n\nSUBJECTIVE\n${soapNote.subjective}\n\nOBJECTIVE\n${soapNote.objective}\n\nASSESSMENT\n${soapNote.assessment}\n\nPLAN\n${soapNote.plan}`, 'text/plain');
                }} style={{ fontSize: '12px', gap: '4px' }}>
                  <Download size={13}/> Export
                </button>
              </div>
            </div>

            <div className="soap-grid">
              <div className="soap-block s-block">
                <div className="soap-block-header">
                  <span className="soap-badge s">S</span>
                  <strong style={{ fontSize: '13px', color: '#1e293b' }}>Subjective</strong>
                </div>
                <p>{soapNote.subjective}</p>
              </div>

              <div className="soap-block o-block">
                <div className="soap-block-header">
                  <span className="soap-badge o">O</span>
                  <strong style={{ fontSize: '13px', color: '#1e293b' }}>Objective</strong>
                </div>
                <p>{soapNote.objective}</p>
              </div>

              <div className="soap-block a-block">
                <div className="soap-block-header">
                  <span className="soap-badge a">A</span>
                  <strong style={{ fontSize: '13px', color: '#1e293b' }}>Assessment</strong>
                </div>
                <p>{soapNote.assessment}</p>
              </div>

              <div className="soap-block p-block">
                <div className="soap-block-header">
                  <span className="soap-badge p">P</span>
                  <strong style={{ fontSize: '13px', color: '#1e293b' }}>Plan</strong>
                </div>
                <p>{soapNote.plan}</p>
              </div>
            </div>

            {soapNote.icd10_suggestions && soapNote.icd10_suggestions.length > 0 && (
              <div className="soap-icd-bar">
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Tag size={13}/> Suggested ICD-10:
                </span>
                {soapNote.icd10_suggestions.map((icd, idx) => (
                  <span key={idx} className="soap-icd-tag">
                    <strong>{icd.code}</strong> {icd.description}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>
      <Panel className="clinical-output-workspace"><div className="clinical-output-title"><div><h2>One consultation. Every next step.</h2><p>Keep clinical and patient-facing drafts in the same workflow.</p></div><span className="badge">Editable drafts</span></div><TabView items={outputs} value={tab} onChange={v => { if(busy)return;setTab(v); setReviews({});setSaved([]); }}>{tab === 'Referral letter' && <label className="output-context-field">Referral specialty<Pick label="Copilot referral specialty" value={specialty} onChange={v => { setSpecialty(v); setReviews(r => ({ ...r, 'Referral letter': false })); }} options={['Cardiology','Dermatology','General practice','Mental wellbeing','Physiotherapy']}/></label>}{tab === 'Follow-up plan' && <label className="output-context-field">Planned review date<input type="date" value={followDate} onChange={e => { setFollowDate(e.target.value); setReviews(r => ({ ...r, 'Follow-up plan': false })); }} min={dateOffset(0)} required/></label>}<div className="draft-toolbar"><div><span className="icon-box small"><FileText size={16}/></span><strong>{tab}</strong></div><button className="btn primary" disabled={busy} onClick={generate}><Sparkles size={15}/>{busy?'Preparing draft…':API_MODE?'Generate with AI':'Generate sample draft'}</button></div><label className="sr-only" htmlFor="copilot-output">{tab} draft</label><textarea id="copilot-output" className="clinical-draft-editor" value={body} onChange={e => setDraft(tab, e.target.value)} placeholder={`Write your ${tab.toLowerCase()}, or generate a sample template…`}/><div className="draft-footer"><span>{body.length} characters · {API_MODE?'Saved to your account':'Draft stays in this browser'}</span><button className="btn ghost" disabled={!body.trim()} onClick={() => download('medora-' + tab.toLowerCase().replaceAll(' ','-') + '.txt', `CLINICIAN DRAFT — REVIEW REQUIRED\n${p.name}\n\n${body}`, 'text/plain')}><Download size={15}/>Export draft</button></div></TabView><div className="draft-review-check"><Checkbox id="copilot-review-complete" checked={reviewed} onCheckedChange={v => setReviews(r => ({ ...r, [tab]: !!v }))}/><label htmlFor="copilot-review-complete">I have reviewed and completed this draft. Each document must be reviewed before saving.</label></div><div className="clinical-save-row"><p>{API_MODE?"Review every draft. Referrals are saved here for your workflow.":"Sample templates never diagnose, prescribe, or send referrals."}</p><button className="btn primary" disabled={!reviewed || !body.trim()} onClick={() => saveOutputs([tab])}><Check size={16}/>Save to care record</button></div>{saved.length > 0 && <div className="clinical-save-success" role="status"><Check size={22}/><div><strong>Saved to the care record</strong><p>{saved.join(' · ')}</p></div><button className="btn secondary" onClick={() => ctx.go('notes')}>View saved documents</button></div>}</Panel>
      </div></div><DemoBoundary>{API_MODE?"AI drafts can contain errors. The clinician must verify each document before saving or using it.":"All tools are scripted previews. No microphone, clinical AI, prescribing service, or healthcare record system is connected."}</DemoBoundary>
  </>;
}
