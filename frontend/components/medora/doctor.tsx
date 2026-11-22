'use client';
import {useState,useEffect} from 'react';
import {CalendarDays,Users,FileText,Sparkles,Plus,Clock,Stethoscope,ClipboardCheck,Download,Mic,Square,Check,Send,Network,Search,UserX,QrCode,ShieldAlert,Trash2,Pill,AudioLines} from 'lucide-react';
import {Table,TableHeader,TableRow,TableHead,TableBody,TableCell} from '@/components/ui/table';
import {toast} from 'sonner';
import {API_MODE,api} from '@/lib/medora-api';
import {DoctorCopilot} from './doctor-copilot';
import {DoctorPrescriptionStudio} from './doctor-prescription-studio';
import {DoctorSessionAI} from './doctor-session-ai';
import {uid,dateOffset,niceDate,providers,download,audit,type Patient} from '@/lib/medora-demo';
import {AppContext,Panel,Heading,Metric,AppointmentCard,SampleNote,Pick,SearchInput,Status,EmptyState,TabView} from './shared';

export function DoctorViews({ctx,view}:{ctx:AppContext,view:string}){
  useEffect(()=>{if(API_MODE&&view==='prescriptions')window.location.replace('/practice#prescriptions');},[view]);
  if(view==='patients')return <PatientDirectory ctx={ctx}/>;
  if(view==='schedule')return <Schedule ctx={ctx}/>;
  if(view==='session')return ctx.data.patients.length?<DoctorSessionAI ctx={ctx}/>:<EmptyState title="No patient record is open" text="Open an authorized patient record before starting a consultation." action={<a className="btn primary" href="/practice#emr">Open clinical records</a>}/>;
  if(view==='consultation')return ctx.data.patients.length?<DoctorCopilot ctx={ctx}/>:<EmptyState title="No patient record is open" text="Open a record shared with your account in Privacy & access, or scan a patient QR pass." action={<a className="btn primary" href="/scan">Scan patient pass</a>}/>;
  if(view==='prescriptions')return API_MODE?<EmptyState title="Opening prescriptions" text="Prepare, review and sign prescriptions in your practice workspace." action={<a className="btn primary" href="/practice#prescriptions">Open prescriptions</a>}/>:<DoctorPrescriptionStudio ctx={ctx}/>;
  if(view==='notes')return <Notes ctx={ctx}/>;
  if(view==='referrals')return <Referrals ctx={ctx}/>;
  return <DoctorDashboard ctx={ctx}/>;
}

function DoctorDashboard({ctx}:{ctx:AppContext}){
  const doctorDisplayName = (ctx.profile?.name && !/sarah|khan/i.test(ctx.profile.name)) ? ctx.profile.name : 'Dr. Rajesh Sharma';
  const isDoctor = (docName?: string) => {
    const current = doctorDisplayName.toLowerCase().replace('.', '');
    const target = (docName || '').toLowerCase().replace('.', '');
    return target === current || target.includes('rajesh') || target.includes('sharma') || target.includes('sarah') || target.includes('khan');
  };

  const myAppts = ctx.data.appointments.filter(a => isDoctor(a.doctor) && a.status !== 'Cancelled');
  const today = myAppts.filter(a => a.date === dateOffset(0));
  const upcoming = myAppts.filter(a => a.date > dateOffset(0)).sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
  const completed = myAppts.filter(a => a.date === dateOffset(0) && a.status === 'Completed').length;

  return <>
    <Heading title={API_MODE ? 'Welcome, ' + doctorDisplayName + '.' : 'Good morning, Dr. Sharma.'} sub="A clearer picture of your day, so you can focus on your patients." eyebrow="YOUR CLINICAL WORKSPACE">
      <a className="btn secondary" href="/scan"><QrCode size={15}/>Scan Patient Pass</a>
      <button className="btn primary" onClick={()=>ctx.go('session')}><AudioLines size={15}/>Live Session AI</button>
      <button className="btn secondary" onClick={()=>ctx.go('prescriptions')}><Pill size={15}/>Rx Studio & AI</button>
      <button className="btn secondary" onClick={()=>ctx.go('schedule')}><CalendarDays size={15}/>View my schedule</button>
      <button className="btn ghost" onClick={()=>ctx.go('consultation')}><Sparkles size={15}/>Doctor Copilot</button>
    </Heading>

    <section className="welcome-card">
      <div>
        <span className="badge"><Stethoscope size={12}/>TODAY’S CLINIC</span>
        <h2>A little more prepared for every patient.</h2>
        <p>Your schedule, patient summaries and clinical notes are together. Start with your next consultation.</p>
        <button className="btn primary" onClick={()=>{const a=today.find(a=>a.status!=='Completed')||upcoming[0];if(a){ctx.setSelected(a.patientId);ctx.go('consultation');}}}>Prepare next consultation</button>
      </div>
      <div className="welcome-card-art">
        <span className="icon-box violet"><FileText/></span>
        <span className="icon-box blue"><Stethoscope/></span>
        <span className="icon-box teal"><Users/></span>
      </div>
    </section>

    <div className="metrics">
      <Metric label="Appointments today" value={today.length} sub={upcoming.length ? `${upcoming.length} upcoming scheduled` : "Your scheduled consultations"} icon={CalendarDays}/>
      <Metric label="Completed visits" value={completed} sub="Today’s recorded visits" icon={ClipboardCheck} color="teal"/>
      <Metric label="Your patients" value={ctx.data.patients.length} sub={ctx.data.patients.length===1?'1 registered patient':`${ctx.data.patients.length} patients in directory`} icon={Users} color="violet"/>
      <Metric label="Clinical notes" value={ctx.data.notes.length} sub="Saved in this workspace" icon={FileText} color="pink"/>
    </div>

    <div className="two-col">
      <Panel title="Your clinic consultations" sub="Keep each consultation moving." action={<button className="btn ghost" onClick={()=>ctx.go('schedule')}>View schedule</button>}>
        {today.length ? (
          <div className="stack" style={{gap:10}}>
            {today.map(a=><div className="list-item" key={a.id}>
              <span className="avatar small">{ctx.data.patients.find(p=>p.id===a.patientId)?.initials || a.patient.split(' ').map((x:string)=>x[0]).slice(0,2).join('').toUpperCase()}</span>
              <div>
                <strong>{a.patient}</strong>
                <small>{a.time} · {a.reason}</small>
              </div>
              <button className="btn secondary" onClick={()=>{ctx.setSelected(a.patientId);ctx.go('consultation');}}>
                {a.status==='Completed'?'View record':'Prepare visit'}
              </button>
            </div>)}
          </div>
        ) : null}

        {upcoming.length ? (
          <div style={{marginTop: today.length ? 18 : 0}}>
            {today.length > 0 && <h4 style={{fontSize:11,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10,fontWeight:600}}>Upcoming patient bookings</h4>}
            <div className="stack" style={{gap:10}}>
              {upcoming.map(a=><div className="list-item" key={a.id}>
                <span className="avatar small">{ctx.data.patients.find(p=>p.id===a.patientId)?.initials || a.patient.split(' ').map((x:string)=>x[0]).slice(0,2).join('').toUpperCase()}</span>
                <div>
                  <strong>{a.patient}</strong>
                  <small>{niceDate(a.date)} at {a.time} · {a.reason}</small>
                </div>
                <button className="btn secondary" onClick={()=>{ctx.setSelected(a.patientId);ctx.go('consultation');}}>
                  Prepare visit
                </button>
              </div>)}
            </div>
          </div>
        ) : null}

        {!today.length && !upcoming.length && (
          <EmptyState title="No consultations scheduled" text="Your clinic calendar is clear. Patient bookings will appear here." action={<a className="btn secondary" href="/scan"><QrCode size={14}/>Scan patient pass</a>}/>
        )}
      </Panel>
      <div className="stack">
        <Panel title="Your clinical companion">
          <span className="icon-box violet"><Sparkles/></span>
          <h3 style={{fontSize:17,marginTop:17}}>Less admin between you and care.</h3>
          <p className="settings-note">Explore sample patient summaries, editable notes, a scribe preview and referral preparation.</p>
          <button className="btn primary full" style={{marginTop:20}} onClick={()=>ctx.go('consultation')}>Open Doctor Copilot</button>
        </Panel>
        <Panel title="Recent notes">
          {ctx.data.notes.length ? ctx.data.notes.slice(-3).reverse().map(n=><div className="list-item" key={n.id}>
            <span className="icon-box"><FileText/></span>
            <div>
              <strong>{n.title}</strong>
              <small>{ctx.data.patients.find(p=>p.id===n.patientId)?.name} · {niceDate(n.date)}</small>
            </div>
          </div>) : (
            <p className="muted small-text" style={{marginTop:10}}>No saved consultation notes yet.</p>
          )}
        </Panel>
      </div>
    </div>
  </>;
}

export function PatientDirectory({ctx}:{ctx:AppContext}){
  const [q,setQ]=useState(ctx.query);
  const [filter,setFilter]=useState('All patients');
  useEffect(()=>setQ(ctx.query),[ctx.query]);

  const hasDisconnected = ctx.data.patients.some(p => p.condition?.toLowerCase().includes('disconnected') || p.condition?.toLowerCase().includes('revoked'));

  const handleRemovePatient = async (p: Patient) => {
    if (!window.confirm(`Remove ${p.name} from your active patient registry?`)) return;
    try {
      if (API_MODE) {
        await api.removeDoctorPatient(p.id);
        ctx.update(d => ({ ...d, patients: d.patients.filter(x => x.id !== p.id) }));
        void ctx.reload?.();
      } else {
        ctx.update(d => ({ ...d, patients: d.patients.filter(x => x.id !== p.id) }));
      }
      toast.success(`${p.name} removed from your patient directory.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not remove patient.';
      toast.error(msg);
    }
  };

  const handleClearDisconnected = async () => {
    try {
      if (API_MODE) {
        await api.clearInactiveDoctorPatients();
        ctx.update(d => ({ ...d, patients: d.patients.filter(x => !x.condition?.toLowerCase().includes('revoked') && !x.condition?.toLowerCase().includes('disconnected')) }));
        void ctx.reload?.();
      } else {
        ctx.update(d => ({ ...d, patients: d.patients.filter(x => !x.condition?.toLowerCase().includes('revoked') && !x.condition?.toLowerCase().includes('disconnected')) }));
      }
      toast.success('Cleared disconnected patients from your directory.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear disconnected patients.';
      toast.error(msg);
    }
  };

  const handleClearAll = () => {
    if (!window.confirm('Clear all patients from your active registry? You can reconnect patients anytime by scanning their QR Quick-Pass.')) return;
    ctx.update(d => ({ ...d, patients: [] }));
    toast.success('Patient registry cleared.');
  };

  const list=ctx.data.patients.filter(p=>(filter==='All patients'||p.risk===filter)&&(p.name+' '+p.id+' '+p.condition).toLowerCase().includes(q.toLowerCase()));

  return <>
    <Heading title="People, not just records." sub="Find a patient, review their care, and prepare the next step." eyebrow={ctx.role==='doctor'?'MY PATIENTS':'PATIENT DIRECTORY'}>
      <a className="btn secondary" href="/scan" style={{gap:6}}><QrCode size={15}/>Scan QR pass</a>
      {hasDisconnected && <button className="btn secondary" onClick={() => void handleClearDisconnected()} style={{gap:6,color:'#e11d48'}}><UserX size={15}/>Clear disconnected</button>}
      {ctx.data.patients.length > 0 && <button className="btn secondary" onClick={handleClearAll} style={{gap:6}}><Trash2 size={15}/>Clear registry</button>}
      <button className="btn secondary" onClick={()=>download('medora-demo-patients.csv','Name,Age,Reason,Email\n'+ctx.data.patients.map(p=>[p.name,p.age,p.condition,p.email].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n'),'text/csv')}><Download size={15}/>Export list</button>
      <button className="btn primary" onClick={()=>ctx.open('patient')}><Plus size={15}/>Register patient</button>
    </Heading>

    {ctx.data.patients.length === 0 ? (
      <div className="empty-state" style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--card)', borderRadius: 16, border: '1.5px dashed var(--border)', maxWidth: 680, margin: '20px auto' }}>
        <div className="icon-box blue" style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: 18 }}>
          <Users size={32} />
        </div>
        <h3 style={{ fontSize: 21, fontWeight: 650, color: 'var(--foreground)' }}>No Patients In Your Registry Yet</h3>
        <p className="muted" style={{ maxWidth: 460, margin: '10px auto 24px', fontSize: 13.5, lineHeight: 1.7 }}>
          Patients who connect with your clinician account using an emergency QR Quick-Pass or grant care permissions will automatically appear in your active registry.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a className="btn primary" href="/scan" style={{ gap: 7, height: 42, padding: '0 20px', fontSize: 13 }}>
            <QrCode size={16} /> Scan Patient Quick-Pass
          </a>
          <button className="btn secondary" onClick={() => ctx.open('patient')} style={{ gap: 7, height: 42, padding: '0 20px', fontSize: 13 }}>
            <Plus size={16} /> Register Patient Manually
          </button>
        </div>
      </div>
    ) : (
      <>
        <div className="filter-bar">
          <SearchInput value={q} onChange={setQ} placeholder="Search patients by name or care reason…"/>
          <Pick label="Follow-up priority" value={filter} onChange={setFilter} options={['All patients','Low','Medium','High']}/>
        </div>
        <SampleNote>{API_MODE?"Registered records and manually assigned follow-up priorities. No automated clinical risk assessment is performed.":"Fictional profiles and operational priority labels. No clinical risk assessment is performed."}</SampleNote>
        {list.length ? (
          <div className="data-table">
            <Table>
              <TableHeader>
                <TableRow>
                  {['Patient','Age','Care reason','Last visit','Follow-up priority','Actions'].map(x=><TableHead key={x}>{x}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(p=>{
                  const isRevoked = p.condition?.toLowerCase().includes('disconnected') || p.condition?.toLowerCase().includes('revoked');
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="patient-cell">
                          <span className="avatar">{p.initials}</span>
                          <div>
                            <strong>{p.name}</strong>
                            <small>Record ID · {p.id.toUpperCase()}</small>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{p.age}</TableCell>
                      <TableCell>
                        {isRevoked ? (
                          <span className="badge pink" style={{ gap: 4, fontSize: 11 }}>
                            <ShieldAlert size={12} /> {p.condition}
                          </span>
                        ) : (
                          p.condition
                        )}
                      </TableCell>
                      <TableCell>{niceDate(p.lastVisit)}</TableCell>
                      <TableCell><Status value={p.risk}/></TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button className="btn secondary" onClick={()=>{ctx.setSelected(p.id);if(ctx.role==='doctor')ctx.go('consultation');else ctx.open('compose',p);}}>
                            {ctx.role==='doctor'?'Open patient':'Contact patient'}
                          </button>
                          <button
                            className="btn ghost"
                            style={{ color: '#e11d48', padding: '6px 8px' }}
                            title="Remove patient from registry"
                            onClick={() => void handleRemovePatient(p)}
                          >
                            <UserX size={15} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState title="No matching patients" text="Try a different name or priority filter."/>
        )}
      </>
    )}
  </>;
}

function Schedule({ctx}:{ctx:AppContext}){
  const [day,setDay]=useState(dateOffset(0));
  const [status,setStatus]=useState('All appointments');
  const [allDates,setAllDates]=useState(false);
  const doctorDisplayName = (ctx.profile?.name && !/sarah|khan/i.test(ctx.profile.name)) ? ctx.profile.name : 'Dr. Rajesh Sharma';
  const isDoc = (docName?: string) => {
    const current = doctorDisplayName.toLowerCase().replace('.', '');
    const target = (docName || '').toLowerCase().replace('.', '');
    return target === current || target.includes('rajesh') || target.includes('sharma') || target.includes('sarah') || target.includes('khan');
  };

  const myAppts = ctx.data.appointments.filter(a => isDoc(a.doctor));
  const items = myAppts.filter(a => (allDates || a.date === day) && (status === 'All appointments' || a.status === status)).sort((a,b)=>(a.date + a.time).localeCompare(b.date + b.time));

  return <>
    <Heading title="Your day, clearly planned." sub="Review each visit and open the patient record when you’re ready." eyebrow="MY SCHEDULE">
      <button className="btn primary" onClick={()=>ctx.open('book',providers[0])}><Plus size={15}/>Add appointment</button>
    </Heading>
    <div className="filter-bar">
      <label className="small-text">Clinic date<input type="date" value={day} disabled={allDates} onChange={e=>{setDay(e.target.value);setAllDates(false);}}/></label>
      <Pick label="Appointment status" value={status} onChange={setStatus} options={['All appointments','Confirmed','Checked in','In consultation','Completed','Cancelled']}/>
      <button className={"btn " + (!allDates && day === dateOffset(0) ? "primary" : "secondary")} onClick={()=>{setDay(dateOffset(0));setAllDates(false);}}>Today</button>
      <button className={"btn " + (!allDates && day === dateOffset(1) ? "primary" : "secondary")} onClick={()=>{setDay(dateOffset(1));setAllDates(false);}}>Tomorrow</button>
      <button className={"btn " + (allDates ? "primary" : "secondary")} onClick={()=>setAllDates(v => !v)}>{allDates ? "Filtered by date" : "All dates"}</button>
    </div>
    <div className="equal-cols">
      {items.map(a=><Panel key={a.id}>
        <div className="row">
          <span className="badge"><Clock size={12}/>{niceDate(a.date)} · {a.time}</span>
          <Status value={a.status}/>
        </div>
        <div className="list-item" style={{marginTop:10}}>
          <span className="avatar">{ctx.data.patients.find(p=>p.id===a.patientId)?.initials || a.patient.split(' ').map((x:string)=>x[0]).slice(0,2).join('').toUpperCase()}</span>
          <div>
            <strong>{a.patient}</strong>
            <small>{a.reason} · {a.mode}</small>
          </div>
        </div>
        <div className="row" style={{marginTop:18}}>
          <button className="btn secondary" onClick={()=>ctx.open('appointment',a)}>Booking details</button>
          <button className="btn primary" disabled={a.status==='Cancelled'} onClick={()=>{ctx.setSelected(a.patientId);if(a.status!=='Completed')ctx.update(d=>({...d,appointments:d.appointments.map(x=>x.id===a.id?{...x,status:'In consultation'}:x)}));ctx.go('consultation');}}>
            {a.status==='Completed'?'Review visit':'Start consultation'}
          </button>
        </div>
      </Panel>)}
    </div>
    {!items.length&&<EmptyState title="No appointments found" text={myAppts.length ? `You have ${myAppts.length} appointments across your schedule.` : "Try another day or add a sample booking."} action={myAppts.length && !allDates ? <button className="btn secondary" onClick={()=>setAllDates(true)}>View all appointments</button> : undefined}/>}
  </>;
}

function Notes({ctx}:{ctx:AppContext}){
  const [q,setQ]=useState('');
  const notes=ctx.data.notes.filter(n=>(n.title+' '+n.body+' '+ctx.data.patients.find(p=>p.id===n.patientId)?.name).toLowerCase().includes(q.toLowerCase())).slice().reverse();

  return <>
    <Heading title="The detail, kept together." sub="Review saved consultation notes and patient follow-ups." eyebrow="CLINICAL NOTES">
      <button className="btn primary" onClick={()=>ctx.go('consultation')}><Plus size={15}/>Write a note</button>
    </Heading>
    <div className="filter-bar">
      <SearchInput value={q} onChange={setQ} placeholder="Search notes or patient names…"/>
    </div>
    <div className="stack">
      {notes.map(n=><Panel key={n.id}>
        <div className="row">
          <div>
            <h3 style={{fontSize:16}}>{n.title}</h3>
            <p className="settings-note">{ctx.data.patients.find(p=>p.id===n.patientId)?.name} · {niceDate(n.date)}</p>
          </div>
          <button className="btn secondary" onClick={()=>{ctx.setSelected(n.patientId);ctx.go('consultation');}}>Open patient</button>
        </div>
        <p className="note-preview">{n.body}</p>
        <button className="btn ghost" onClick={()=>download('medora-demo-note-'+n.id+'.txt',n.body,'text/plain')}>
          <Download size={14}/>Download note
        </button>
      </Panel>)}
    </div>
    {!notes.length&&<EmptyState title="No notes found" text="Try another search or draft a new note."/>}
  </>;
}

function Referrals({ctx}:{ctx:AppContext}){
  const items=ctx.data.notes.filter(n=>n.title.startsWith('Referral'));

  return <>
    <Heading title="Keep the next step connected." sub="Prepare referrals and follow-up tasks for your sample patients." eyebrow="REFERRALS & FOLLOW-UPS">
      <button className="btn primary" onClick={()=>ctx.open('referral')}><Plus size={15}/>Create referral</button>
    </Heading>
    <SampleNote>{API_MODE?"Referral drafts are saved privately to the care record. No provider is contacted automatically.":"Referral drafts remain in this browser. No provider is contacted."}</SampleNote>
    <div className="filter-bar">
      <Pick label="Referral patient" value={ctx.data.patients.find(p=>p.id===ctx.selected)?.name||ctx.data.patients[0]?.name||'Select a patient'} onChange={v=>ctx.setSelected(ctx.data.patients.find(p=>p.name===v)?.id||'p1')} options={ctx.data.patients.map(p=>p.name)}/>
    </div>
    {items.length ? (
      <div className="equal-cols">
        {items.map(n=><Panel key={n.id}>
          <span className="badge">Draft referral</span>
          <h3 style={{fontSize:18,marginTop:18}}>{n.title}</h3>
          <p className="settings-note">{ctx.data.patients.find(p=>p.id===n.patientId)?.name} · {niceDate(n.date)}</p>
          <p className="note-preview">{n.body}</p>
          <button className="btn secondary" onClick={()=>download('medora-demo-referral.txt',n.title+'\n\n'+n.body,'text/plain')}>Download draft</button>
        </Panel>)}
      </div>
    ) : (
      <EmptyState title="A clear next step starts here" text="Create a referral draft and a linked follow-up task." action={<button className="btn primary" onClick={()=>ctx.open('referral')}>Create referral</button>}/>
    )}
  </>;
}
