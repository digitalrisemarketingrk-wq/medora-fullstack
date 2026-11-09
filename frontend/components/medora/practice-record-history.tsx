'use client';

import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {FileText,History,Printer} from 'lucide-react';
import {API_MODE} from '@/lib/medora-api';
import {practiceApi,type PracticeRecord,type PracticeModule,type PracticeHistory,type PracticePage,type PracticeFinance} from '@/lib/practice-api';

export function PracticeRecordHistory({record,modules,onOpen}:{record:PracticeRecord;modules:PracticeModule[];onOpen:(record:PracticeRecord)=>void}){
  const[history,setHistory]=useState<PracticeHistory>({items:[],next_cursor:null});
  const[timeline,setTimeline]=useState<PracticePage>({items:[],next_cursor:null});
  const[busy,setBusy]=useState(true);const[error,setError]=useState('');
  useEffect(()=>{let active=true;void Promise.all([practiceApi.history(record),record.module==='patients'?practiceApi.timeline(record):Promise.resolve({items:[],next_cursor:null})]).then(([audit,care])=>{if(active){setHistory(audit);setTimeline(care);setBusy(false);}}).catch(e=>{if(active){setError(e instanceof Error?e.message:'Could not load history');setBusy(false);}});return()=>{active=false;};},[record]);
  const more=async(kind:'history'|'timeline')=>{setBusy(true);setError('');try{if(kind==='history'){const page=await practiceApi.history(record,history.next_cursor||undefined);setHistory(old=>({items:[...old.items,...page.items],next_cursor:page.next_cursor}));}else{const page=await practiceApi.timeline(record,timeline.next_cursor||undefined);setTimeline(old=>({items:[...old.items,...page.items],next_cursor:page.next_cursor}));}}catch(e){setError(e instanceof Error?e.message:'Could not load more history');}finally{setBusy(false);}};
  return <div className="pr-history">{error&&<p role="alert" className="pr-alert error">{error}</p>}{record.module==='patients'&&<section><h3><FileText size={16}/>Longitudinal care history</h3><p>Appointments, encounters, prescriptions, results and other records linked to this patient across your practice.</p>{timeline.items.map(r=><button className="pr-timeline-link" key={r.id} onClick={()=>onOpen(r)}><span><strong>{r.title}</strong><small>{modules.find(m=>m.key===r.module)?.name} · {r.status}</small></span><time>{new Date(r.created_at).toLocaleDateString()}</time></button>)}{!busy&&!timeline.items.length&&<p>No linked care records yet.</p>}{timeline.next_cursor&&<button className="pr-button" onClick={()=>void more('timeline')} disabled={busy}>Load older care records</button>}</section>}<section><h3><History size={16}/>Record audit trail</h3>{history.items.map(event=><div className="pr-history-event" key={event.id}><div><strong>{event.action==='pay'?'Payment recorded':event.action==='dispense'?'Stock dispensed':event.action==='status'?'Status updated':event.action}</strong><small>Actor {event.actor_id.slice(0,8)} · {new Date(event.created_at).toLocaleString()}</small>{Object.entries(event.details).map(([key,value])=><small key={key}>{key.replaceAll('_',' ')}: {String(value)}</small>)}</div></div>)}{!API_MODE&&<p>Audit events are available with the backend. This is a browser demonstration.</p>}{history.next_cursor&&<button className="pr-button" disabled={busy} onClick={()=>void more('history')}>Load earlier changes</button>}</section>{busy&&<p role="status">Loading history…</p>}</div>;
}

export function PracticeFinancialInsights({branch,practice}:{branch:string;practice:string}){
  const[data,setData]=useState<PracticeFinance|null>(null);const[error,setError]=useState('');
  useEffect(()=>{let active=true;void practiceApi.finance(branch||undefined,practice).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load balances');});return()=>{active=false;};},[branch,practice]);
  return <section className="pr-finance-report"><h2>Invoice balances</h2><p>Issued invoices and recorded receipts, grouped by currency. Draft and void invoices are excluded.</p>{error&&<p role="alert">{error}</p>}{data?.currencies.map(item=><div className="pr-finance-currency" key={item.currency}>{(['billed_minor','received_minor','outstanding_minor'] as const).map((key,i)=><div key={key}><span>{['Issued total','Payments recorded','Outstanding'][i]}</span><strong>{new Intl.NumberFormat('en',{style:'currency',currency:item.currency}).format(item[key]/100)}</strong></div>)}</div>)}{data&&!data.currencies.length&&<p>No issued invoices in this branch scope.</p>}</section>;
}

export function PracticePrintButton({record,modules}:{record:PracticeRecord;modules:PracticeModule[]}){
  const[printing,setPrinting]=useState(false);
  useEffect(()=>{if(!printing)return;const done=()=>setPrinting(false);window.addEventListener('afterprint',done);const timer=setTimeout(()=>{window.print();setPrinting(false);},100);return()=>{clearTimeout(timer);window.removeEventListener('afterprint',done);};},[printing]);
  const definition=modules.find(m=>m.key===record.module);
  return <><button className="pr-button" onClick={()=>setPrinting(true)}><Printer size={15}/>Print saved record</button>{printing&&createPortal(<div className="pr-print-document"><header><h1>Medora · {definition?.name}</h1><p>{record.title}</p></header><p>Record: {record.id} · Version {record.version} · {record.status}</p><p>Last saved: {new Date(record.updated_at).toLocaleString()}</p>{record.module==='billing'&&<p>Recorded payments: {new Intl.NumberFormat('en',{style:'currency',currency:record.data.currency}).format(Number(record.data._paid_minor||0)/100)}</p>}<dl>{definition?.fields.map(f=><div key={f.key}><dt>{f.label}</dt><dd>{record.data[f.key]||'Not recorded'}</dd></div>)}</dl><footer>Copy of the saved practice record. Clinical decisions require clinician review.</footer></div>,document.body)}</>;
}
