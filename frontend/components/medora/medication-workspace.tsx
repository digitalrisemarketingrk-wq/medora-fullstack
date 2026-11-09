'use client';
import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  Clock,
  Download,
  ExternalLink,
  FileScan,
  Package,
  Pill,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Utensils
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { audit, dateOffset, download, Medicine, niceDate, uid } from '@/lib/medora-demo';
import { emptyMedicationPlan, MedicationPlan } from '@/lib/medora-features';
import { API_MODE, api, type MedicationSafetyReport } from '@/lib/medora-api';
import { AppContext, EmptyState, Heading, Metric, Panel } from './shared';
import { DemoBoundary, FeatureBanner, FeatureDialog, FlowSteps } from './feature-kit';

export function MedicationWorkspace({ ctx }: { ctx: AppContext }) {
  const [dialog, setDialog] = useState<'schedule' | 'safety' | 'import' | 'refill' | null>(null);
  const [selected, setSelected] = useState<Medicine | null>(null);
  const [times, setTimes] = useState('');
  const [stock, setStock] = useState(14);
  const [refillDate, setRefillDate] = useState(dateOffset(7));
  const [reviewDate, setReviewDate] = useState(dateOffset(30));
  const [acknowledged, setAcknowledged] = useState(false);
  const [safetyReport, setSafetyReport] = useState<MedicationSafetyReport | null>(null);
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [safetyError, setSafetyError] = useState('');
  const [importStep, setImportStep] = useState(0);
  const [importName, setImportName] = useState('Sample imported prescription');
  const [importInstructions, setImportInstructions] = useState('Prescription instructions must be entered and checked by the clinician.');
  const [importTime, setImportTime] = useState('08:00');
  const [fileName, setFileName] = useState('Medora sample prescription');
  const fileRef = useRef<HTMLInputElement>(null);
  const today = dateOffset(0);
  const planFor = (m: Medicine): MedicationPlan => ctx.data.features.medicationPlans[m.id] || emptyMedicationPlan(m.time);
  const recordedTimes = (m: Medicine, date: string) => [...new Set(planFor(m).doses[date] || [])].filter(time => planFor(m).times.includes(time));
  const plannedToday = ctx.data.medicines.reduce((total, m) => total + planFor(m).times.length, 0);
  const takenToday = ctx.data.medicines.reduce((total, m) => total + recordedTimes(m, today).length, 0);
  const days = Array.from({ length: 7 }, (_, i) => dateOffset(i - 6));
  const recordedWeek = days.reduce((total, day) => total + ctx.data.medicines.reduce((n, m) => n + recordedTimes(m, day).length, 0), 0);
  const plannedWeek = plannedToday * 7;
  const rate = plannedWeek ? Math.round(recordedWeek / plannedWeek * 100) : 0;
  const changePlan = (id: string, fn: (p: MedicationPlan) => MedicationPlan) => ctx.update(d => { const m = d.medicines.find(x => x.id === id); if (!m) return d; return { ...d, features: { ...d.features, medicationPlans: { ...d.features.medicationPlans, [id]: fn(d.features.medicationPlans[id] || emptyMedicationPlan(m.time)) } } }; });
  const take = (m: Medicine, time: string) => {
    ctx.update(d => { const p = d.features.medicationPlans[m.id] || emptyMedicationPlan(m.time); const recorded = p.doses[today] || []; const next = recorded.includes(time) ? recorded.filter(t => t !== time) : [...recorded, time]; return { ...d, medicines: d.medicines.map(x => x.id === m.id ? { ...x, taken: p.times.every(t => next.includes(t)) } : x), features: { ...d.features, medicationPlans: { ...d.features.medicationPlans, [m.id]: { ...p, doses: { ...p.doses, [today]: next } } } } }; });
  };
  const openSchedule = (m: Medicine) => { const p = planFor(m); setSelected(m); setTimes(p.times.join(', ')); setStock(p.stock); setRefillDate(p.refillDate); setReviewDate(p.reviewDate); setDialog('schedule'); };
  const refill = (m: Medicine) => { const title = 'Discuss refill for ' + m.name; ctx.update(d => { const p = d.features.medicationPlans[m.id] || emptyMedicationPlan(m.time); return audit({ ...d, features: { ...d.features, medicationPlans: { ...d.features.medicationPlans, [m.id]: { ...p, refillRequested: true } } }, tasks: d.tasks.some(t => t.title === title) ? d.tasks : [...d.tasks, { id: uid(), title, detail: 'Sample refill enquiry prepared. Confirm with your care team; no prescription is ordered.', date: p.refillDate, done: false }] }, 'Refill enquiry prepared for ' + m.name); }); toast.success('Refill enquiry saved to your care journey. Nothing was ordered.'); setDialog(null); };
  const runSafetyScan = async () => {
    setSafetyReport(null);
    setSafetyError('');
    setCheckingSafety(true);
    try {
      const res = await api.checkMedicationSafety(
        ctx.data.medicines,
        API_MODE ? undefined : ['Penicillin (Moderate - Skin rash / hives)'],
        ctx.data.settings?.name || 'Patient',
        ctx.ownerId
      );
      setSafetyReport(res);
      if (res.overall_risk === 'high') {
        toast.error('Clinical Alert: Critical drug allergy or interaction contraindication detected!');
      } else if(res.overall_risk==='safe') {
        toast.success('Medication safety audit complete: No critical conflicts found.');
      } else {
        toast.info('Medication review required. Review the reported concerns with your clinician.');
      }
    } catch (e) {
      const message=e instanceof Error?e.message:'Medication verification is unavailable.';
      setSafetyError(message);
      toast.error(message);
    } finally {
      setCheckingSafety(false);
    }
  };

  useEffect(() => {setSafetyReport(null);setSafetyError('');}, [ctx.ownerId,ctx.data.medicines]);

  return (
    <>
      <Heading title="A rhythm for your care." sub="Keep your prescription instructions, dose records, and next review in one place." eyebrow="MEDICATION INTELLIGENCE">
        <button
          className="btn secondary"
          style={{
            borderColor: safetyReport?.overall_risk === 'high' ? '#f87171' : '#10b981',
            color: safetyReport?.overall_risk === 'high' ? '#dc2626' : '#047857',
            background: safetyReport?.overall_risk === 'high' ? '#fef2f2' : '#ecfdf5',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
          onClick={runSafetyScan}
          disabled={checkingSafety}
        >
          {checkingSafety ? <RefreshCw size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
          {checkingSafety ? 'Auditing safety…' : 'AI Safety Audit'}
        </button>
        <button className="btn secondary" onClick={() => { setImportStep(0); setFileName('Medora sample prescription'); setDialog('import'); }}><FileScan size={16}/>Prescription preview</button>
        <button className="btn primary" onClick={() => ctx.open('medicine')}><Plus size={16}/>Add medication</button>
      </Heading>

      {/* Live Drug Interaction & Allergy Safety Scanner Banner */}
      {safetyReport && (
        <div
          style={{
            margin: '12px 0 16px',
            padding: '16px 20px',
            borderRadius: 16,
            background: safetyReport.overall_risk === 'high' ? 'linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%)' : 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
            border: safetyReport.overall_risk === 'high' ? '1.5px solid #fecdd3' : '1.5px solid #a7f3d0',
            boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: safetyReport.overall_risk === 'high' ? '#e11d48' : '#059669',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                }}
              >
                {safetyReport.overall_risk === 'high' ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
              </span>
              <div>
                <strong style={{ fontSize: 13.5, color: safetyReport.overall_risk === 'high' ? '#9f1239' : '#065f46' }}>
                  {safetyReport.overall_risk === 'high' ? 'CRITICAL MEDICATION SAFETY & ALLERGY ALERT' : 'CLINICAL PHARMACOVIGILANCE SAFETY AUDIT: PASS'}
                </strong>
                <p style={{ margin: 0, fontSize: 12, color: '#334155' }}>
                  {safetyReport.summary}
                </p>
              </div>
            </div>

            <button
              className="btn ghost"
              style={{ fontSize: 11, padding: '4px 10px', height: 26, gap: 5, color: '#4f46e5' }}
              onClick={() => setDialog('safety')}
            >
              <ExternalLink size={12} /> View Full Audit
            </button>
          </div>

          {/* Allergy Alerts List */}
          {safetyReport.allergy_alerts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {safetyReport.allergy_alerts.map((al, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #fda4af',
                    borderRadius: 10,
                    padding: '8px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8
                  }}
                >
                  <div>
                    <strong style={{ color: '#be123c', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle size={13} style={{ color: '#be123c' }} /> Allergy Conflict: {al.substance}
                    </strong>
                    <p style={{ margin: '1px 0 0', fontSize: 11.5, color: '#475569' }}>{al.description}</p>
                  </div>
                  <span className="badge" style={{ background: '#ffe4e6', color: '#be123c', fontWeight: 700, fontSize: 10.5 }}>
                    Action: {al.action}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Dietary & Timing Guidelines */}
          {safetyReport.dietary_guidelines.length > 0 && (
            <div style={{ marginTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {safetyReport.dietary_guidelines.map((dg, idx) => (
                <div key={idx} style={{ fontSize: 11.5, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Utensils size={12} color="#059669" />
                  <strong>{dg.medication}:</strong> {dg.timing} ({dg.food_cautions})
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <FeatureBanner icon={Pill} label="TODAY’S MEDICATION PLAN" title={`${takenToday} of ${plannedToday} doses recorded`} tone="teal" action={<div className="banner-progress"><Progress value={plannedToday ? takenToday / plannedToday * 100 : 0}/><span>{today === dateOffset(0) ? 'Your record for today' : today}</span></div>}>A simple place to track what you’ve recorded. Always follow the instructions on your prescription.</FeatureBanner>
      <div className="metrics medication-metrics"><Metric label="Your medications" value={ctx.data.medicines.length} sub="Prescription information" icon={Pill} color="teal"/><Metric label="Recorded this week" value={rate + '%'} sub={`${recordedWeek} of ${plannedWeek} scheduled doses`} icon={Check} color="blue"/><Metric label="Refill plans" value={ctx.data.medicines.filter(m => planFor(m).stock <= 7).length} sub="Sample stock at 7 or below" icon={Package} color="violet"/><Metric label="Safety reviews" value={ctx.data.medicines.filter(m => !planFor(m).safetyReviewed).length} sub="Preview acknowledgement needed" icon={ShieldCheck} color="pink"/></div>
      <div className="medication-layout"><div className="stack">{ctx.data.medicines.map(m => { const p = planFor(m); const taken = recordedTimes(m, today); return <Panel className="medication-plan-card" key={m.id}><div className="medication-plan-heading"><span className="icon-box teal"><Pill/></span><div><h3>{m.name}</h3><p>{m.detail}</p></div><button className="btn ghost" onClick={() => openSchedule(m)}>Edit schedule</button></div><div className="dose-list">{p.times.map(time => <div className={`dose-row ${taken.includes(time) ? 'taken' : ''}`} key={time}><Clock size={18}/><strong>{time}</strong><span>{taken.includes(time) ? 'Recorded as taken' : 'Scheduled dose'}</span><button className={`btn ${taken.includes(time) ? 'secondary' : 'primary'}`} onClick={() => take(m, time)}>{taken.includes(time) ? <><Check size={15}/>Undo record</> : 'Mark as taken'}</button></div>)}</div><div className="medication-plan-footer"><div className="checkbox-line"><Switch id={'med-reminder-' + m.id} checked={m.reminder} onCheckedChange={v => ctx.update(d => ({ ...d, medicines: d.medicines.map(x => x.id === m.id ? { ...x, reminder: v } : x) }))}/><label htmlFor={'med-reminder-' + m.id}><Bell size={15}/>Dose reminder preview</label></div><button className="btn ghost" onClick={() => { setSelected(m); setAcknowledged(p.safetyReviewed); setDialog('safety'); }}><ShieldCheck size={15}/>{p.safetyReviewed ? 'Review acknowledged' : 'Review safety preview'}</button></div></Panel>; })}{!ctx.data.medicines.length && <EmptyState title="Your medication list is ready to build" text="Copy medication names and instructions from your prescription."/>}</div>
        <div className="stack"><Panel title="This week’s dose record" sub="What you have marked in this browser."><div className="adherence-value"><strong>{rate}<span>%</span></strong><span>of scheduled doses recorded</span></div><Progress value={rate}/><div className="adherence-days">{days.map(day => { const count = ctx.data.medicines.reduce((n, m) => n + recordedTimes(m, day).length, 0); return <div key={day}><span className={count ? 'recorded' : ''} aria-label={`${day}: ${count} doses recorded`}>{count ? <Check size={15}/> : <span/>}</span><small>{new Date(day + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short' })}</small></div>; })}</div><p className="settings-note">This is a local tracking record, not a clinical measure of treatment success.</p></Panel><Panel title="Refills & reviews" sub="A little planning before the next step.">{ctx.data.medicines.map(m => { const p = planFor(m); return <div className="refill-row" key={m.id}><div><strong>{m.name}</strong><span className={`badge ${p.stock <= 7 ? 'amber' : 'blue'}`}>{p.stock} sample units</span></div><p>Refill reminder · {niceDate(p.refillDate)}<br/>Prescription review · {niceDate(p.reviewDate)}</p><button className="btn secondary full" disabled={p.refillRequested} onClick={() => { setSelected(m); setDialog('refill'); }}>{p.refillRequested ? <><Check size={15}/>Enquiry prepared</> : 'Prepare refill enquiry'}</button></div>; })}<button className="btn ghost full" onClick={() => { ctx.go('finder'); }}><Package size={15}/>Find a pharmacy</button></Panel></div>
      </div><DemoBoundary>Reminders are previews. Always review prescriptions, doses, and drug safety with your treating clinician.</DemoBoundary>
      <FeatureDialog open={dialog === 'schedule'} onClose={() => setDialog(null)} title="Your medication schedule" description="Copy the times from your prescription. The demo never recommends a dose.">{selected && <form className="dialog-form" onSubmit={e => { e.preventDefault(); const next = times.split(',').map(x => x.trim()).filter(Boolean); if (!next.length || next.some(x => !/^([01]\d|2[0-3]):[0-5]\d$/.test(x))) { toast.error('Enter times as HH:MM, separated by commas.'); return; } const unique = [...new Set(next)].sort(); changePlan(selected.id, p => ({ ...p, times: unique, stock, refillDate, reviewDate })); ctx.update(d => ({ ...d, medicines: d.medicines.map(m => m.id === selected.id ? { ...m, time: unique[0], taken: unique.every(t => (d.features.medicationPlans[m.id]?.doses[today] || []).includes(t)) } : m) })); setDialog(null); toast.success('Schedule and review plan saved'); }}><div className="sharing-document"><Pill size={22}/><strong>{selected.name}</strong></div><label>Dose times<input value={times} onChange={e => setTimes(e.target.value)} placeholder="08:00, 14:00, 20:00" required/><small>HH:MM, separated by commas. Use your prescription times.</small></label><div className="form-grid"><label>Sample units remaining<input type="number" value={stock} min="0" max="1000" required onChange={e => setStock(Number(e.target.value))}/></label><label>Refill reminder<input type="date" value={refillDate} required onChange={e => setRefillDate(e.target.value)}/></label><label>Prescription review<input type="date" value={reviewDate} required onChange={e => setReviewDate(e.target.value)}/></label></div><button className="btn primary"><Check size={16}/>Save schedule</button></form>}</FeatureDialog>
      <FeatureDialog open={dialog === 'safety'} onClose={() => setDialog(null)} title="Medication verification" description="A clinician must reconcile allergy history and verify medications. Automated verification needs a validated drug knowledge source.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="safety-review-card" style={{ background: safetyReport?.overall_risk === 'high' ? '#fff1f2' : '#f0fdf4', borderColor: safetyReport?.overall_risk === 'high' ? '#fecdd3' : '#bbf7d0' }}>
            <span style={{ color: safetyReport?.overall_risk === 'high' ? '#e11d48' : '#059669' }}>
              {safetyReport?.overall_risk === 'high' ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}
            </span>
            <div>
              <strong>{safetyReport?.overall_risk === 'high' ? 'Potential concerns flagged' : safetyReport?.overall_risk==='safe' ? 'Verification completed' : safetyReport ? 'Clinical review required' : 'Medication safety is unverified'}</strong>
              <p role={safetyError?'alert':undefined}>{safetyError||safetyReport?.summary || (checkingSafety?'Verification in progress…':'No medication safety check has been completed.')}</p>
            </div>
          </div>

          <dl className="detail-facts">
            <div><dt>Patient</dt><dd>{ctx.data.settings?.name || 'Alex Mercer'}</dd></div>
            <div><dt>Allergy history</dt><dd>{API_MODE?'Not verified — reconcile with the patient':'Penicillin · synthetic sample'}</dd></div>
            <div><dt>Audit Status</dt><dd>{safetyReport?.overall_risk ? safetyReport.overall_risk.toUpperCase() : 'PENDING'}</dd></div>
          </dl>

          {safetyReport?.allergy_alerts && safetyReport.allergy_alerts.length > 0 && (
            <div>
              <strong style={{ fontSize: 12, color: '#be123c', textTransform: 'uppercase' }}>Allergy Cross-Reactivity Alerts:</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {safetyReport.allergy_alerts.map((al, idx) => (
                  <div key={idx} style={{ padding: '10px 14px', borderRadius: 10, background: '#fff5f5', border: '1px solid #fed7d7' }}>
                    <div style={{ fontWeight: 700, color: '#c53030', fontSize: 13 }}>{al.substance}</div>
                    <div style={{ fontSize: 12, color: '#4a5568', marginTop: 2 }}>{al.description}</div>
                    <div style={{ fontSize: 11.5, color: '#2b6cb0', marginTop: 4 }}><strong>Guidance:</strong> {al.action}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {safetyReport?.dietary_guidelines && safetyReport.dietary_guidelines.length > 0 && (
            <div>
              <strong style={{ fontSize: 12, color: '#2b6cb0', textTransform: 'uppercase' }}>Dietary & Timing Advice:</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {safetyReport.dietary_guidelines.map((dg, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: '#334155', padding: '6px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <strong style={{ color: '#0f172a' }}>{dg.medication}:</strong> {dg.timing} · {dg.food_cautions}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="checkbox-line">
            <Checkbox id="safety-preview-ack" checked={acknowledged} onCheckedChange={v => setAcknowledged(!!v)}/>
            <label htmlFor="safety-preview-ack">I have reviewed these safety findings with my clinician.</label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={runSafetyScan} disabled={checkingSafety}>
              <RefreshCw size={14} className={checkingSafety ? 'animate-spin' : ''} /> Re-scan
            </button>
            <button className="btn primary" disabled={!acknowledged} onClick={() => { if (selected) changePlan(selected.id, p => ({ ...p, safetyReviewed: true })); setDialog(null); toast.success('Safety acknowledgement saved'); }}>
              Save acknowledgement
            </button>
          </div>
        </div>
      </FeatureDialog>
      <FeatureDialog open={dialog === 'refill'} onClose={() => setDialog(null)} title="Prepare a refill enquiry" description="A planning step for your care team. No medicine is ordered.">{selected && <><div className="sharing-document"><Package size={23}/><strong>{selected.name}</strong></div><dl className="detail-facts"><div><dt>Sample stock</dt><dd>{planFor(selected).stock} units recorded</dd></div><div><dt>Reminder date</dt><dd>{niceDate(planFor(selected).refillDate)}</dd></div><div><dt>Request status</dt><dd>Draft only · no pharmacy connected</dd></div></dl><p className="section-intro">Save a care task to discuss the refill and confirm what your care team needs.</p><button className="btn primary" onClick={() => refill(selected)}><ClipboardListIcon/>Save refill enquiry</button></>}</FeatureDialog>
      <FeatureDialog open={dialog === 'import'} onClose={() => setDialog(null)} title="Prescription import preview" description="Explore the scan-to-review flow using a sample. No camera or OCR is connected."><FlowSteps items={['Select', 'Review', 'Save']} active={importStep}/>{importStep === 0 ? <><div className="prescription-preview"><FileScan size={33}/><h3>A prescription, brought into focus.</h3><p>Use a sample document or select a file to preview the flow. Selected files are not read.</p></div><input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" aria-label="Prescription preview file" onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 10 * 1024 * 1024) { setFileName(f.name); setImportStep(1); } else if (f) toast.error('Choose a file smaller than 10 MB.'); e.target.value = ''; }}/><button className="btn primary" onClick={() => setImportStep(1)}><Sparkles size={16}/>Use sample prescription</button><button className="btn secondary" onClick={() => fileRef.current?.click()}>Choose a file for preview</button></> : importStep === 1 ? <form className="dialog-form" onSubmit={e => { e.preventDefault(); ctx.update(d => audit({ ...d, medicines: [...d.medicines, { id: uid(), name: importName, detail: importInstructions, time: importTime, taken: false, reminder: true }] }, 'Prescription preview added to medication list')); setImportStep(2); }}><div className="sharing-document"><FileScan size={22}/><strong>{fileName}</strong></div><DemoBoundary>These fields are sample values, not text extracted from the file. Review and edit before saving.</DemoBoundary><label>Medication name<input value={importName} required onChange={e => setImportName(e.target.value)}/></label><label>Prescription instructions<textarea value={importInstructions} required onChange={e => setImportInstructions(e.target.value)}/></label><label>Reminder time<input type="time" value={importTime} required onChange={e => setImportTime(e.target.value)}/></label><button className="btn primary">Save reviewed preview</button></form> : <div className="success-state"><span className="icon-box teal"><Check/></span><h3>Your sample is in your list.</h3><p>You can now edit its schedule and explore refill planning.</p><button className="btn primary" onClick={() => setDialog(null)}>View medication plan</button></div>}</FeatureDialog>
    </>
  );
}
function ClipboardListIcon() { return <CalendarDays size={16}/>; }
