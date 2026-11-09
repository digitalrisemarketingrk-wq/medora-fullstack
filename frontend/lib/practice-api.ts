'use client';

import {API_MODE, request, type Profile} from './medora-api';
import catalog from './practice-catalog.json';

export type PracticeField = {key:string;label:string;kind:string;required:boolean;options?:string[]};
export type PracticeModule = {key:string;name:string;group:string;description:string;fields:PracticeField[];statuses:string[];transitions:Partial<Record<string,string[]>>;integration?:string|null};
export type PracticeRecord = {id:string;practice_id:string;module:string;branch_id:string;title:string;status:string;data:Record<string,string>;version:number;created_at:string;updated_at:string};
export type PracticePage = {items:PracticeRecord[];next_cursor:string|null;patient_names?:Record<string,string>};
export type PracticeOperationalModule = 'appointments'|'telemedicine'|'ipd'|'pharmacy'|'inventory';
export type PracticeOperationalPage = PracticePage & {complete:boolean;scan_limited:boolean;scanned_count:number;timezone:string;from_date:string|null;to_date:string|null;as_of:string;alerts:Record<string,{low_stock:boolean;expired:boolean;expiring_soon:boolean}>};
export type PracticeOperationalQuery = {practice_id?:string;branch_id?:string;from_date?:string;to_date?:string;cursor?:string;limit?:number};
export type PracticeHistory = {items:{id:string;actor_id:string;action:string;details:Record<string,string|number>;created_at:string}[];next_cursor:string|null};
export type PracticeFinance = {currencies:{currency:string;billed_minor:number;received_minor:number;outstanding_minor:number}[]};
export type PracticeSummary = {counts:{module:string;status:string;count:number}[];activity:{action:string;record_id:string;created_at:string}[]};
export type PracticeBootstrap = {practice_id:string;user:Profile;practices:{id:string;name:string}[];modules:PracticeModule[];branches:PracticeRecord[];capabilities:Record<string,boolean>;permissions:{role:string;read:string[];write:string[];clinical_sign:boolean;finance:boolean}};
export type PracticeWrite = {data:Record<string,string>;branch_id:string;version:number;request_id:string};
export type PracticeCommand = {version:number;request_id:string;status?:string;amount?:string;quantity?:number;patient_id?:string;ward?:string;bed?:string};

const DEMO_KEY = 'medora-practice-demo-v1';
const DEMO_ID = '00000000-0000-4000-8000-000000000001';
function readDemo():PracticeRecord[] {
  if(typeof window==='undefined') return [];
  try {const value:unknown=JSON.parse(localStorage.getItem(DEMO_KEY)||'[]');return Array.isArray(value)?value as PracticeRecord[]:[];}catch{return [];}
}
function persistDemo(records:PracticeRecord[]) {localStorage.setItem(DEMO_KEY,JSON.stringify(records));}
function seedDemo() {
  if(readDemo().length)return;
  const branchId=crypto.randomUUID();const stamp=new Date().toISOString();
  const make=(module:string,title:string,data:Record<string,string>,status:string):PracticeRecord=>({id:crypto.randomUUID(),practice_id:DEMO_ID,module,branch_id:branchId,title,status,data,version:1,created_at:stamp,updated_at:stamp});
  const branch=make('locations','Central clinic',{name:'Central clinic',address:'Fictional demonstration branch',timezone:'Asia/Kolkata',phone:'',hours:'Mon–Fri · 09:00–17:00'},'Active');branch.id=branchId;
  const patient=make('patients','Aarav Shah',{name:'Aarav Shah',dob:'1992-03-14',phone:'Demo contact',email:'aarav@example.test',address:'Synthetic patient record',history:'History awaiting clinician confirmation.',allergies:'Not verified',emergency_contact:''},'Active');
  persistDemo([branch,patient,make('billing','Consultation invoice',{patient_id:patient.id,title:'Consultation invoice',amount:'850',currency:'INR',due_date:new Date().toISOString().slice(0,10),notes:'Synthetic example',_paid_minor:'0'},'Issued'),make('pharmacy','Example medicine batch',{name:'Example medicine batch',batch:'DEMO-001',quantity:'24',unit:'packs',expiry:'2027-12-31',reorder:'10',supplier:'Demonstration supplier'},'Available')]);
}

const qs=(values:Record<string,string|undefined>)=>{const result=new URLSearchParams();for(const[k,v]of Object.entries(values))if(v)result.set(k,v);return result.size?'?'+result.toString():'';};
export const practiceApi={
  async operations(module:PracticeOperationalModule,query:PracticeOperationalQuery={}):Promise<PracticeOperationalPage>{
    if(!API_MODE)throw new Error('Operational views require the authenticated practice backend.');
    return request('/practice/operations/'+module+qs({...query,limit:query.limit===undefined?undefined:String(query.limit)}));
  },
  async get(id:string,practice:string):Promise<PracticeRecord>{
    if(API_MODE)return request('/practice/record/'+id+qs({practice_id:practice}));
    const record=readDemo().find(r=>r.id===id);if(!record)throw new Error('Record not found');return record;
  },
  async clinicalDraft(patient:string,kind:string,practice:string):Promise<{draft:string;requires_review:boolean;source_record_ids:string[]}>{
    if(API_MODE)return request('/practice/patient/'+patient+'/clinical-draft'+qs({practice_id:practice}),{method:'POST',body:JSON.stringify({kind,consent:true})});
    throw new Error('AI drafts require a configured backend provider. No clinical record was created.');
  },
  async history(record:PracticeRecord,cursor?:string):Promise<PracticeHistory>{
    if(API_MODE)return request('/practice/record/'+record.id+'/history'+qs({practice_id:record.practice_id,cursor}));
    return {items:[],next_cursor:null};
  },
  async timeline(record:PracticeRecord,cursor?:string):Promise<PracticePage>{
    if(API_MODE)return request('/practice/patient/'+record.id+'/timeline'+qs({practice_id:record.practice_id,cursor}));
    const rows=readDemo().filter(r=>r.data.patient_id===record.id);const start=cursor?rows.findIndex(r=>r.id===cursor)+1:0;return {items:rows.slice(start,start+25),next_cursor:rows.length>start+25?rows[start+24].id:null};
  },
  async finance(branch?:string,practice?:string):Promise<PracticeFinance>{
    if(API_MODE)return request('/practice/finance'+qs({branch_id:branch,practice_id:practice}));
    const currencies=new Map<string,PracticeFinance['currencies'][number]>();
    for(const record of readDemo().filter(r=>r.module==='billing'&&!['Draft','Void'].includes(r.status)&&(!branch||r.branch_id===branch))){const currency=record.data.currency;const item=currencies.get(currency)||{currency,billed_minor:0,received_minor:0,outstanding_minor:0};const total=Math.round(Number(record.data.amount)*100),paid=Number(record.data._paid_minor||0);item.billed_minor+=total;item.received_minor+=paid;item.outstanding_minor+=total-paid;currencies.set(currency,item);}
    return {currencies:[...currencies.values()]};
  },
  async bootstrap(practice?:string):Promise<PracticeBootstrap>{
    if(API_MODE){const value=await request<PracticeBootstrap>('/practice/bootstrap'+qs({practice_id:practice}));if(!Array.isArray(value.permissions?.read)||!Array.isArray(value.permissions?.write))throw new Error('The practice backend needs to be updated before this workspace can open.');return value;}
    seedDemo();return {practice_id:DEMO_ID,user:{id:DEMO_ID,name:'Dr Maya Patel',email:'demo@example.test',role:'doctor'},practices:[{id:DEMO_ID,name:'Medora demonstration'}],modules:catalog as PracticeModule[],branches:readDemo().filter(r=>r.module==='locations'),capabilities:{messaging:false,insurance:false,laboratory:false,video:false,native_mobile:false},permissions:{role:'owner',read:catalog.map(m=>m.key),write:catalog.map(m=>m.key),clinical_sign:true,finance:true}};
  },
  async list(module:string,branch?:string,cursor?:string,q?:string,practice?:string):Promise<PracticePage>{
    if(API_MODE)return request('/practice/records/'+module+qs({branch_id:branch,cursor,q,practice_id:practice}));
    const records=readDemo().filter(r=>r.module===module&&(!branch||r.branch_id===branch)&&(!q||r.title.toLowerCase().includes(q.toLowerCase())));
    const start=cursor?Math.max(0,records.findIndex(r=>r.id===cursor)+1):0;return {items:records.slice(start,start+25),next_cursor:records.length>start+25?records[start+24].id:null};
  },
  async summary(branch?:string,practice?:string):Promise<PracticeSummary>{
    if(API_MODE)return request('/practice/summary'+qs({branch_id:branch,practice_id:practice}));
    const counts=new Map<string,{module:string;status:string;count:number}>();for(const r of readDemo().filter(r=>!branch||r.branch_id===branch)){const key=r.module+'|'+r.status;const item=counts.get(key)||{module:r.module,status:r.status,count:0};item.count++;counts.set(key,item);}return {counts:[...counts.values()],activity:[]};
  },
  async save(module:string,body:PracticeWrite,record?:PracticeRecord,practice?:string):Promise<PracticeRecord>{
    if(API_MODE)return request(record?'/practice/record/'+record.id+qs({practice_id:practice}):'/practice/records/'+module+qs({practice_id:practice}),{method:record?'PUT':'POST',body:JSON.stringify(body)});
    const records=readDemo();if(record&&records.find(r=>r.id===record.id)?.version!==body.version)throw new Error('Record changed. Reload before saving.');
    const stamp=new Date().toISOString();const value:PracticeRecord={id:record?.id||body.request_id,practice_id:DEMO_ID,module,branch_id:body.branch_id,title:body.data.name||body.data.title||body.data.reason||'Record',status:record?.status||(catalog as PracticeModule[]).find(m=>m.key===module)!.statuses[0],data:{...body.data},version:body.version+1,created_at:record?.created_at||stamp,updated_at:stamp};
    if(module==='locations')value.branch_id=value.id;
    persistDemo([value,...records.filter(r=>r.id!==value.id)]);return value;
  },
  async action(record:PracticeRecord,command:string,body:PracticeCommand,practice?:string):Promise<PracticeRecord>{
    if(API_MODE)return request('/practice/record/'+record.id+'/action/'+command+qs({practice_id:practice}),{method:'POST',body:JSON.stringify(body)});
    const current=readDemo().find(r=>r.id===record.id);if(!current||current.version!==body.version)throw new Error('Record changed. Reload before retrying.');
    const value={...current,data:{...current.data},version:current.version+1,updated_at:new Date().toISOString()};
    if(command==='status'){const definition=(catalog as PracticeModule[]).find(m=>m.key===record.module)!;if(!body.status||!definition.transitions[current.status]?.includes(body.status))throw new Error('Invalid transition');value.status=body.status;}
    if(command==='pay'){const minor=Math.round(Number(body.amount)*100);const paid=Number(value.data._paid_minor||0)+minor;const total=Math.round(Number(value.data.amount)*100);if(!Number.isFinite(minor)||minor<=0||paid>total)throw new Error('Enter an amount within the outstanding balance');value.data._paid_minor=String(paid);value.status=paid===total?'Paid':'Part-paid';}
    if(command==='dispense'){if(!body.quantity||body.quantity>Number(value.data.quantity)||!body.patient_id)throw new Error('Choose a patient and a valid quantity');value.data.quantity=String(Number(value.data.quantity)-body.quantity);}
    if(command==='transfer'){value.data.ward=body.ward||'';value.data.bed=body.bed||'';}
    persistDemo([value,...readDemo().filter(r=>r.id!==value.id)]);return value;
  }
};
