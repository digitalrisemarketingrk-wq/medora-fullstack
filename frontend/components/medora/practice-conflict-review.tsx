'use client';

import {useState} from 'react';
import {practiceApi,type PracticeModule,type PracticeRecord} from '@/lib/practice-api';

export function PracticeConflictReview({record,module,draft,toInput,onResolved}:{record:PracticeRecord;module:PracticeModule;draft:Record<string,string>;toInput:(record:PracticeRecord)=>Record<string,string>;onResolved:(latest:PracticeRecord,data:Record<string,string>)=>void}){
  const[latest,setLatest]=useState<PracticeRecord|null>(null);
  const[choices,setChoices]=useState<Record<string,'mine'|'saved'>>({});
  const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  const before=toInput(record),saved=latest?toInput(latest):{};
  const finalized=!!latest&&['Signed','Issued','Part-paid','Paid','Void','Reconciled','Discharged'].includes(latest.status);
  const conflicts=module.fields.filter(f=>draft[f.key]!==before[f.key]&&saved[f.key]!==before[f.key]&&saved[f.key]!==draft[f.key]);
  const load=async()=>{setBusy(true);setError('');try{setLatest(await practiceApi.get(record.id,record.practice_id));setChoices({});}catch(e){setError(e instanceof Error?e.message:'Could not load the current version');}finally{setBusy(false);}};
  const resolve=()=>{if(!latest)return;const merged={...saved};for(const f of module.fields){if(draft[f.key]!==before[f.key]&&choices[f.key]!=='saved')merged[f.key]=draft[f.key];}onResolved(latest,merged);};
  return <section className="pr-conflict" aria-label="Review concurrent changes"><h3>Your draft is still here</h3><p>Another user changed this record. Review the current version before saving again.</p>{!latest?<button type="button" className="pr-button" onClick={()=>void load()} disabled={busy}>{busy?'Loading current version…':'Review current version'}</button>:<><p>Current saved version: <strong>{latest.version}</strong>. Only your changed fields will be applied. This does not save anything yet.</p>{module.fields.filter(f=>saved[f.key]!==before[f.key]).map(f=><div className="pr-conflict-field" key={f.key}><strong>{f.label}</strong><p>Currently saved: {saved[f.key]||'Not recorded'}</p>{conflicts.some(c=>c.key===f.key)&&<fieldset><legend>Both versions changed this field. Choose the value to use.</legend><label><input type="radio" name={'resolve-'+f.key} checked={choices[f.key]==='mine'} onChange={()=>setChoices(old=>({...old,[f.key]:'mine'}))}/>Keep my draft: {draft[f.key]||'Empty'}</label><label><input type="radio" name={'resolve-'+f.key} checked={choices[f.key]==='saved'} onChange={()=>setChoices(old=>({...old,[f.key]:'saved'}))}/>Use saved value</label></fieldset>}</div>)}{finalized&&<p role="alert">This record has been finalized and cannot be edited. Close this draft and review the saved record.</p>}{latest.branch_id!==record.branch_id&&<p>The branch changed. The merged draft will use the current saved branch; review it in the form.</p>}<button type="button" className="pr-button" disabled={finalized||conflicts.some(f=>!choices[f.key])} onClick={resolve}>Continue with reviewed draft</button></>}{error&&<p role="alert">{error}</p>}</section>;
}
