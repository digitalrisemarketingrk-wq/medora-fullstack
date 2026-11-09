'use client';

import {useEffect,useState} from 'react';
import {BookOpen} from 'lucide-react';
import {practiceApi,type PracticeRecord} from '@/lib/practice-api';

const TEMPLATE_TYPES:Record<string,string>={emr:'Consultation',prescriptions:'Prescription',treatments:'Assessment',consent:'Consent',ipd:'Discharge'};
const TARGET_FIELDS:Record<string,string>={emr:'plan',prescriptions:'medications',treatments:'assessment',consent:'evidence',ipd:'discharge'};

export function PracticeTemplatePicker({module,practice,onApply,disabled=false}:{module:string;practice:string;onApply:(key:string,content:string)=>void;disabled?:boolean}){
  const[templates,setTemplates]=useState<PracticeRecord[]>([]);const[selected,setSelected]=useState('');const[query,setQuery]=useState('');const[error,setError]=useState('');
  useEffect(()=>{let active=true;if(!TEMPLATE_TYPES[module])return;const timer=setTimeout(()=>{void practiceApi.list('templates',undefined,undefined,query,practice).then(page=>{if(active){setTemplates(page.items.filter(r=>r.status==='Published'&&r.data.type===TEMPLATE_TYPES[module]));setError('');}}).catch(()=>{if(active)setError('Templates could not be loaded. You can continue entering this record manually.');});},180);return()=>{active=false;clearTimeout(timer);};},[module,practice,query]);
  if(!TEMPLATE_TYPES[module])return null;
  const chosen=templates.find(r=>r.id===selected);
  return <div className="pr-template-picker"><div><BookOpen size={17}/><strong>Start from a published template</strong></div><p>Template content is added to your draft. Review it for this patient before saving.</p><input disabled={disabled} aria-label="Search published templates by name" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search template name…"/><div className="pr-template-controls"><select disabled={disabled} aria-label="Published template" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a {TEMPLATE_TYPES[module].toLowerCase()} template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.title} · {t.data.specialty}</option>)}</select><button type="button" className="pr-button" disabled={disabled||!chosen} onClick={()=>{if(chosen&&!disabled)onApply(TARGET_FIELDS[module],chosen.data.content);}}>Add to draft</button></div>{error&&<p role="alert">{error}</p>}</div>;
}
