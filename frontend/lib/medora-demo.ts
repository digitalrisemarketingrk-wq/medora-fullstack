'use client';
import {useEffect,useState,useCallback} from 'react';
import {API_MODE,api} from './medora-api';
import {useRemoteWorkspace} from './use-workspace';
import {createFeatureState,mergeFeatureState,emptyMedicationPlan,FeatureState} from './medora-features';
export type Role='patient'|'doctor'|'hospital';
export const accounts={patient:{email:'patient@medora.demo',name:'Rahul Sharma',initials:'RS'},doctor:{email:'doctor@medora.demo',name:'Dr. Rajesh Sharma',initials:'RS'},hospital:{email:'hospital@medora.demo',name:'Apollo City Clinic',initials:'AC'}};
export const password='Medora123!';
export const dateOffset=(offset:number)=>{const d=new Date();d.setDate(d.getDate()+offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
export const niceDate=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
export const uid=()=>Math.random().toString(36).slice(2,10);
export type Appointment={id:string,patientId:string,patient:string,doctor:string,specialty:string,provider:string,date:string,time:string,mode:string,status:string,reason:string,prep:string[]};
export type Patient={id:string,name:string,age:number,initials:string,condition:string,lastVisit:string,email:string,risk:string};
export type CareTask={patientId?:string,id:string,title:string,detail:string,done:boolean,date:string};
export type Doc={id:string,name:string,type:string,date:string,size:string,summary:string,storagePath?:string,mime?:string,analysisStatus?:'pending'|'analysed',indexed?:boolean,deleting?:boolean,findings?:string[],glossary?:{term:string,meaning:string}[]};
export type Medicine={id:string,name:string,detail:string,time:string,taken:boolean,reminder:boolean};
export type Message={id:string,to:string,body:string,time:string,kind:string};
export type DemoData={features:FeatureState,team:Record<string,boolean>,appointments:Appointment[],patients:Patient[],tasks:CareTask[],documents:Doc[],medicines:Medicine[],family:{id:string,name:string,relation:string,age:string}[],notes:{id:string,patientId:string,title:string,body:string,date:string}[],messages:Message[],access:{id:string,name:string,scope:string,active:boolean}[],audit:{id:string,title:string,time:string}[],waiting:{id:string,name:string,specialty:string,days:number,risk:string,status:string}[],programmes:{id:string,title:string,participants:number,active:boolean}[],settings:{name:string,location:string,blood:string,language:string,largeText:boolean,highContrast:boolean,readAloud:boolean,simple:boolean,notifications:boolean,treatment:boolean,sharing:boolean,research:boolean}};
export function seed():DemoData{return{features:createFeatureState(),team:{'Dr. Rajesh Sharma':true,'Dr. Amit Patel':true,'Dr. Priya Nair':false,'Dr. Aisha Rahman':true},
  patients:[
    ['p1','Rahul Sharma',34,'RS','Type 2 Diabetes & Essential Hypertension','Low'],
    ['p2','Ananya Gupta',42,'AG','Primary Hypothyroidism & Vitamin D Deficiency','Medium'],
    ['p3','Vikram Patel',56,'VP','Coronary Artery Disease - Post-PTCA LAD Stent','High'],
    ['p4','Pooja Verma',28,'PV','Bronchial Allergic Asthma & Seasonal Rhinitis','Low'],
    ['p5','Mohammed Riaz',63,'MR','Mixed Dyslipidemia & Bilateral Knee Osteoarthritis','Medium']
  ].map(([id,name,age,initials,condition,risk])=>({id:id as string,name:name as string,age:age as number,initials:initials as string,condition:condition as string,lastVisit:dateOffset(-12),email:(name as string).toLowerCase().replace(' ','.')+'@example.demo',risk:risk as string})),
  appointments:[
    {id:'a1',patientId:'p1',patient:'Rahul Sharma',doctor:'Dr. Rajesh Sharma',specialty:'General practice',provider:'Apollo City Clinic',date:dateOffset(0),time:'09:30',mode:'In person',status:'Confirmed',reason:'Diabetes & Hypertension Review (Token #01)',prep:['Fasting blood sugar log','Home BP readings']},
    {id:'a2',patientId:'p2',patient:'Ananya Gupta',doctor:'Dr. Rajesh Sharma',specialty:'General practice',provider:'Apollo City Clinic',date:dateOffset(0),time:'10:00',mode:'In person',status:'Checked in',reason:'Thyroid profile & fatigue follow-up (Token #02)',prep:['Suburban Diagnostics thyroid report']},
    {id:'a3',patientId:'p3',patient:'Vikram Patel',doctor:'Dr. Amit Patel',specialty:'Cardiology',provider:'Apollo City Clinic',date:dateOffset(0),time:'10:30',mode:'In person',status:'Confirmed',reason:'Post-PTCA Cardiology review (Token #03)',prep:['Recent 12-lead ECG','Apollo discharge summary']},
    {id:'a4',patientId:'p4',patient:'Pooja Verma',doctor:'Dr. Rajesh Sharma',specialty:'General practice',provider:'Apollo City Clinic',date:dateOffset(0),time:'11:00',mode:'In person',status:'Confirmed',reason:'Asthma control & wheeze follow-up (Token #04)',prep:['Peak flow meter diary','Current inhaler']},
    {id:'a5',patientId:'p5',patient:'Mohammed Riaz',doctor:'Dr. Rajesh Sharma',specialty:'General practice',provider:'Apollo City Clinic',date:dateOffset(0),time:'11:30',mode:'In person',status:'Confirmed',reason:'Bilateral knee pain & lipid review (Token #05)',prep:['Knee X-ray films','Fasting lipid report']},
    {id:'a6',patientId:'p1',patient:'Rahul Sharma',doctor:'Dr. Rajesh Sharma',specialty:'General practice',provider:'Apollo City Clinic',date:dateOffset(1),time:'10:30',mode:'In person',status:'Confirmed',reason:'Annual preventive review & diet plan',prep:[]},
    {id:'a7',patientId:'p1',patient:'Rahul Sharma',doctor:'Dr. Rajesh Sharma',specialty:'General practice',provider:'Apollo City Clinic',date:dateOffset(-14),time:'09:30',mode:'In person',status:'Completed',reason:'Routine metabolic consultation',prep:['Bring current medication list']},
    {id:'a8',patientId:'p2',patient:'Ananya Gupta',doctor:'Dr. Rajesh Sharma',specialty:'General practice',provider:'Apollo City Clinic',date:dateOffset(-21),time:'10:00',mode:'In person',status:'Completed',reason:'Thyroid medication adjustment visit',prep:[]},
    {id:'a9',patientId:'p3',patient:'Vikram Patel',doctor:'Dr. Amit Patel',specialty:'Cardiology',provider:'Apollo City Clinic',date:dateOffset(-14),time:'11:00',mode:'In person',status:'Completed',reason:'Routine post-angioplasty check',prep:[]},
    {id:'a10',patientId:'p4',patient:'Pooja Verma',doctor:'Dr. Rajesh Sharma',specialty:'General practice',provider:'Apollo City Clinic',date:dateOffset(-10),time:'11:30',mode:'In person',status:'Completed',reason:'Acute wheeze evaluation & nebulization',prep:[]},
    {id:'a11',patientId:'p5',patient:'Mohammed Riaz',doctor:'Dr. Rajesh Sharma',specialty:'General practice',provider:'Apollo City Clinic',date:dateOffset(-18),time:'12:00',mode:'In person',status:'Completed',reason:'Knee stiffness & joint mobility review',prep:[]}
  ],
  tasks:[
    {id:'t1',patientId:'p1',title:'Fasting blood sugar & HbA1c panel test',detail:'Complete lab test before your upcoming review consultation with Dr. Sharma.',done:false,date:dateOffset(1)},
    {id:'t2',patientId:'p1',title:'Record 3-day home BP chart',detail:'Log morning and evening blood pressure in diary before Dr. Sharma consultation.',done:false,date:dateOffset(3)},
    {id:'t3',patientId:'p2',title:'Morning fasting Thyronorm compliance log',detail:'Take Thyronorm 50 mcg strictly on empty stomach with plain water 30 mins before tea.',done:true,date:dateOffset(2)},
    {id:'t4',patientId:'p2',title:'Schedule 6-week repeat TSH blood draw',detail:'Book follow-up thyroid and Vitamin D3 panel at Suburban Diagnostics.',done:false,date:dateOffset(10)},
    {id:'t5',patientId:'p3',title:'Daily resting pulse & BP record',detail:'Log morning resting heart rate before taking Met XL 25mg.',done:false,date:dateOffset(1)},
    {id:'t6',patientId:'p3',title:'Schedule 6-month treadmill stress test (TMT)',detail:'Confirm treadmill stress test and 2D-Echo appointment with Dr. Amit Patel.',done:true,date:dateOffset(14)},
    {id:'t7',patientId:'p4',title:'Daily Peak Expiratory Flow (PEFR) log',detail:'Record morning and evening peak flow readings before and after Foracort inhaler.',done:false,date:dateOffset(2)},
    {id:'t8',patientId:'p4',title:'Warm water mouth rinse after inhaler',detail:'Rinse mouth and gargle after each steroid inhaler puff to prevent candidiasis.',done:true,date:dateOffset(0)},
    {id:'t9',patientId:'p5',title:'Daily 15-minute quadriceps isometric exercise',detail:'Perform knee strengthening isometric exercises as demonstrated by physiotherapy.',done:false,date:dateOffset(1)},
    {id:'t10',patientId:'p5',title:'Repeat fasting lipid profile test',detail:'Complete follow-up lipid profile after 8 weeks of Atorvastatin 20mg.',done:false,date:dateOffset(5)}
  ],
  documents:[
    {id:'d1',name:'Fasting Glucose & HbA1c Report.pdf',type:'Lab report',date:dateOffset(-5),size:'185 KB',summary:'Diagnostic report from SRL Diagnostics for Rahul Sharma. Fasting blood sugar is 126 mg/dL (target < 100). Glycated Hemoglobin (HbA1c) is 7.1% (target < 7.0%). Kidney function (Serum Creatinine 0.92 mg/dL, eGFR > 90) is optimal. Continue Metformin 500mg SR and regular aerobic exercise.',findings:['Fasting Blood Glucose: 126 mg/dL (Elevated, Ref: 70-99)','HbA1c: 7.1% (Suboptimal, Target: < 7.0%)','Serum Creatinine: 0.92 mg/dL (Normal)','eGFR: > 90 mL/min/1.73m2 (Optimal)'],glossary:[{term:'HbA1c',meaning:'3-month average of blood glucose level.'},{term:'eGFR',meaning:'Estimated glomerular filtration rate measuring kidney efficiency.'}]},
    {id:'d2',name:'Comprehensive Lipid Profile.pdf',type:'Lab report',date:dateOffset(-12),size:'142 KB',summary:'Dr. Lal PathLabs diagnostic panel for Rahul Sharma. Total Cholesterol 192 mg/dL, Triglycerides 158 mg/dL, HDL (Good) 46 mg/dL, LDL (Bad) 114 mg/dL. Cardiovascular risk index within moderate clinical control.',findings:['Total Cholesterol: 192 mg/dL (Desirable < 200)','Triglycerides: 158 mg/dL (Borderline High)','HDL: 46 mg/dL (Optimal > 40)','LDL: 114 mg/dL (Borderline, Target < 100)']},
    {id:'d3',name:'Thyroid Function & Anti-TPO Panel.pdf',type:'Lab report',date:dateOffset(-21),size:'160 KB',summary:'Suburban Diagnostics endocrine evaluation for Ananya Gupta. Serum TSH is elevated at 6.8 uIU/mL (Ref: 0.4-4.2 uIU/mL). Free T4 is 0.92 ng/dL. Anti-TPO antibodies positive at 124 IU/mL confirming autoimmune thyroiditis. Serum 25-OH Vitamin D deficient at 14.2 ng/mL.',findings:['Serum TSH: 6.8 uIU/mL (Elevated, Ref: 0.4-4.2)','Free T4: 0.92 ng/dL (Low Normal, Ref: 0.8-1.8)','Anti-TPO: 124 IU/mL (Positive, Ref: < 35)','25-OH Vitamin D: 14.2 ng/mL (Deficient < 20)'],glossary:[{term:'TSH',meaning:'Thyroid Stimulating Hormone produced by the pituitary gland.'},{term:'Anti-TPO',meaning:'Autoantibodies attacking thyroid peroxidase enzyme.'}]},
    {id:'d4',name:'12-Lead ECG & 2D-Echocardiogram.pdf',type:'Cardiology',date:dateOffset(-14),size:'310 KB',summary:'Apollo Heart Institute non-invasive cardiac evaluation for Vikram Patel. Resting ECG shows normal sinus rhythm at 68 bpm; previous ischemic changes resolved post-PTCA. 2D Echo demonstrates preserved LVEF 55%, mild concentric LV hypertrophy, and Grade 1 diastolic dysfunction with no wall motion abnormality at rest.',findings:['Sinus Rhythm: 68 bpm regular, normal axis','LVEF: 55% (Preserved systolic function)','Left Ventricle: Mild concentric hypertrophy (IVSd 11.5mm)','Wall Motion: No regional wall motion abnormality at rest'],glossary:[{term:'LVEF',meaning:'Left Ventricular Ejection Fraction; normal is 50-70%.'},{term:'PTCA',meaning:'Percutaneous Transluminal Coronary Angioplasty with stent.'}]},
    {id:'d5',name:'Spirometry & Pulmonary Function Test.pdf',type:'Pulmonology',date:dateOffset(-10),size:'225 KB',summary:'Metropolis Healthcare spirometry study for Pooja Verma. Pre-bronchodilator FEV1 is 2.38 L (74% predicted). Post-bronchodilator FEV1 increases to 2.76 L (86% predicted) showing +380 mL (+16% improvement), establishing significant reversible airway obstruction diagnostic of bronchial asthma.',findings:['Pre-bronchodilator FEV1: 2.38 L (74% predicted)','Post-bronchodilator FEV1: 2.76 L (86% predicted)','Bronchodilator Reversibility: +16% (+380 mL, Diagnostic)','PEFR: 380 L/min'],glossary:[{term:'FEV1',meaning:'Forced Expiratory Volume in 1 second measuring airflow limitation.'},{term:'Reversibility',meaning:'Improvement in airway caliber after bronchodilator inhalation.'}]},
    {id:'d6',name:'Standing Knee Digital Radiographs (AP & Lat).pdf',type:'Radiology',date:dateOffset(-18),size:'290 KB',summary:'Weight-bearing radiographs of both knees for Mohammed Riaz. Symmetric moderate narrowing of medial joint compartments (Right > Left). Small marginal osteophytes along tibial plateaus with subchondral sclerosis. Grade II Kellgren-Lawrence Osteoarthritis.',findings:['Medial Joint Space: Moderate narrowing bilaterally','Osteophytes: Marginal spurring along tibial plateaus','Subchondral Bone: Sclerosis along medial weight-bearing surfaces','Classification: Grade II Kellgren-Lawrence Osteoarthritis'],glossary:[{term:'Osteoarthritis',meaning:'Degenerative joint disease involving cartilage loss and bone spur formation.'},{term:'Kellgren-Lawrence',meaning:'Standard radiological severity scale from Grade 0 to Grade 4.'}]}
  ],
  medicines:[
    {id:'m1',name:'Telma 40 Tablet (Telmisartan 40mg)',detail:'1 tablet once daily in the morning after breakfast.',time:'08:00',taken:false,reminder:true},
    {id:'m2',name:'Glycomet 500 SR (Metformin 500mg)',detail:'1 tablet twice daily with meals (1-0-1).',time:'09:00',taken:false,reminder:true},
    {id:'m3',name:'Pan-D Capsule (Pantoprazole + Domperidone)',detail:'1 capsule empty stomach in morning before food.',time:'07:00',taken:true,reminder:true},
    {id:'m4',name:'Dolo 650 Tablet (Paracetamol 650mg)',detail:'SOS: 1 tablet when fever > 100°F or body ache occurs.',time:'14:00',taken:false,reminder:false},
    {id:'m5',name:'Thyronorm 50 mcg Tablet (Levothyroxine)',detail:'1 tablet once daily on empty stomach 30 mins before morning beverage.',time:'06:30',taken:true,reminder:true},
    {id:'m6',name:'Uprise-D3 60K Capsule (Cholecalciferol 60,000 IU)',detail:'1 capsule once weekly on Sunday morning with milk.',time:'10:00',taken:false,reminder:true},
    {id:'m7',name:'Shelcal 500 Tablet (Calcium 500mg + Vit D3)',detail:'1 tablet once daily after lunch.',time:'14:00',taken:false,reminder:true},
    {id:'m8',name:'Ecosprin 75 Tablet (Aspirin 75mg)',detail:'1 tablet once daily after lunch.',time:'13:30',taken:true,reminder:true},
    {id:'m9',name:'Clopilet 75 Tablet (Clopidogrel 75mg)',detail:'1 tablet once daily after lunch (DAPT regimen).',time:'13:30',taken:true,reminder:true},
    {id:'m10',name:'Atorva 40 Tablet (Atorvastatin 40mg)',detail:'1 tablet once daily at bedtime for plaque stabilization.',time:'21:30',taken:false,reminder:true},
    {id:'m11',name:'Met XL 25 Tablet (Metoprolol Succinate 25mg)',detail:'1 tablet once daily in the morning after breakfast.',time:'08:30',taken:false,reminder:true},
    {id:'m12',name:'Foracort 200 Inhaler (Budesonide + Formoterol)',detail:'1 puff twice daily with spacer; rinse mouth with warm water after use.',time:'08:00',taken:true,reminder:true},
    {id:'m13',name:'Montair-LC Tablet (Montelukast + Levocetirizine)',detail:'1 tablet once daily at bedtime for allergy control.',time:'21:00',taken:false,reminder:true},
    {id:'m14',name:'Asthalin 100mcg Inhaler (Salbutamol)',detail:'2 puffs SOS for sudden wheezing or acute breathlessness.',time:'12:00',taken:false,reminder:false},
    {id:'m15',name:'Atorva 20 Tablet (Atorvastatin 20mg)',detail:'1 tablet once daily at bedtime for mixed dyslipidemia.',time:'21:30',taken:false,reminder:true},
    {id:'m16',name:'Cartigen Forte Tablet (Glucosamine + Chondroitin)',detail:'1 tablet once daily in morning after breakfast.',time:'10:00',taken:false,reminder:true},
    {id:'m17',name:'Volini Gel (Diclofenac Topical Gel)',detail:'Apply gently to bilateral knee joints twice daily; do not rub vigorously.',time:'20:00',taken:false,reminder:false}
  ],
  family:[
    {id:'f1',name:'Priya Sharma',relation:'Partner',age:'32'},
    {id:'f2',name:'Aarav Sharma',relation:'Son',age:'7'},
    {id:'f3',name:'Ramesh Gupta',relation:'Father',age:'71'}
  ],
  notes:[
    {id:'n1',patientId:'p1',title:'Routine Diabetes & Hypertension Review',body:'Reason for visit: 3-month glycemic and BP review.\nVitals: BP 134/84 mmHg, Pulse 74 bpm regular, BMI 24.2.\nFasting glucose: 126 mg/dL, HbA1c: 7.1%.\nCardiovascular: S1 S2 heard, chest clear.\nPlan: Continue Telma 40 OD morning and Glycomet 500 SR BD with meals. Low glycemic index diet, brisk walk 30 mins daily.\nDr. Rajesh Sharma, MD (Medicine).',date:dateOffset(-14)},
    {id:'n2',patientId:'p1',title:'Baseline Metabolic & Cardiovascular Assessment',body:'Initial intake: 34-year-old male presenting for preventive corporate health check.\nComplaints: Mild postprandial fatigue, occasional tension headaches.\nFamily History: Father diagnosed with Type 2 Diabetes and CAD at age 48.\nVitals: BP 142/90 mmHg (elevated), Pulse 78 bpm, Weight 76 kg, BMI 24.8.\nAdvised: Fasting blood glucose, HbA1c, lipid panel, serum creatinine, and baseline ECG. Started initial lifestyle interventions.\nDr. Rajesh Sharma, MD (Medicine).',date:dateOffset(-45)},
    {id:'n3',patientId:'p2',title:'Primary Hypothyroidism & Vitamin D Deficiency Review',body:'Reason for visit: Review of persistent lethargy, cold intolerance, and weight gain.\nVitals: BP 118/76 mmHg, Pulse 66 bpm regular, Temp 98.2°F, Weight 64.5 kg, BMI 25.1.\nLab review: Serum TSH 6.8 uIU/mL (Elevated), Free T4 0.92 ng/dL, 25-OH Vitamin D 14.2 ng/mL (Deficient).\nThyroid palpation: Diffuse non-tender thyromegaly without palpable nodules.\nPlan: Increase Thyronorm to 50 mcg OD empty stomach (at least 30 mins before morning beverage). Start Uprise-D3 60,000 IU once weekly with milk for 8 weeks. Shelcal 500mg OD post-lunch.\nReview: Repeat serum TSH and Vit D after 6 weeks.\nDr. Rajesh Sharma, MD (Medicine).',date:dateOffset(-21)},
    {id:'n4',patientId:'p2',title:'Initial Consultation for Fatigue & Weight Changes',body:'42-year-old female executive presenting with 6-month history of insidious fatigue, dry skin, and constipation.\nPhysical Exam: Mild periorbital puffiness, delayed relaxation phase of deep tendon reflexes.\nAdvised: Complete thyroid profile (Free T3, Free T4, TSH), Anti-TPO antibodies, Vitamin D3, and complete blood count.\nDr. Rajesh Sharma, MD (Medicine).',date:dateOffset(-60)},
    {id:'n5',patientId:'p3',title:'Post-PTCA LAD Stent & Dual Antiplatelet Cardiology Review',body:'Reason for visit: 3-month post-angioplasty cardiology follow-up.\nHistory: Status post drug-eluting stent (DES 3.0 x 18 mm) to proximal LAD. Denies angina, exertional dyspnea, orthopnea, or palpitation. Walking 45 minutes daily without discomfort.\nVitals: BP 122/78 mmHg, Heart Rate 68 bpm regular sinus, SpO2 99% room air.\nExam: Heart sounds normal, no murmurs or gallop rhythm. Chest clear bilaterally. No peripheral edema.\nEchocardiogram: LVEF 55%, mild concentric LVH, no regional wall motion abnormality.\nPlan: Continue DAPT: Ecosprin 75mg OD + Clopilet 75mg OD after lunch. Atorva 40mg HS for aggressive plaque stabilization. Met XL 25mg OD morning.\nFollow-up: 6-month treadmill stress test (TMT) scheduled.\nDr. Rajesh Sharma & Dr. Amit Patel (Cardiology).',date:dateOffset(-14)},
    {id:'n6',patientId:'p3',title:'Cath Lab Revascularization Follow-up Note',body:'56-year-old male reviewed following acute coronary syndrome (Unstable Angina) and successful coronary stenting.\nPuncture site: Right radial access healed cleanly, no hematoma or pseudoaneurysm.\nCardiac rehabilitation: Advised graded exercise protocol. Strictly avoid unmonitored heavy lifting.\nDr. Amit Patel, DM (Cardiology).',date:dateOffset(-75)},
    {id:'n7',patientId:'p4',title:'Bronchial Allergic Asthma & Rhinitis Follow-Up',body:'Reason for visit: Follow-up of seasonal wheezing and nocturnal dry cough.\nVitals: BP 112/72 mmHg, Pulse 76 bpm, SpO2 99% room air, Respiratory Rate 16/min.\nChest Auscultation: Bilateral vesicular breath sounds, no active wheezes or crackles. Peak Flow Meter (PEFR): 380 L/min (baseline personal best 420 L/min).\nENT: Mild bilateral inferior turbinate congestion, pale nasal mucosa consistent with allergic rhinitis.\nPlan: Continue Foracort 200 Inhaler (Budesonide 200mcg + Formoterol 6mcg) 1 puff BD with spacer. Advised warm water mouth rinse after inhalation. Montair-LC (Montelukast + Levocetirizine) 1 tab HS for 14 days. Asthalin Inhaler 100mcg 2 puffs SOS for emergency bronchospasm.\nDr. Rajesh Sharma, MD (Medicine).',date:dateOffset(-10)},
    {id:'n8',patientId:'p4',title:'Emergency OPD Triage - Acute Bronchial Spasm',body:'Presented with acute cough, chest tightness, and audible wheezing triggered by house dust and humidity shift.\nExam: Bilateral expiratory polyphonic rhonchi. SpO2 94% on room air.\nNebulized with Levolin + Budecort in clinic. SpO2 improved to 99%, wheezing resolved.\nPrescribed regular controller inhaler with spacer.\nDr. Rajesh Sharma, MD (Medicine).',date:dateOffset(-35)},
    {id:'n9',patientId:'p5',title:'Bilateral Knee Osteoarthritis & Mixed Dyslipidemia Review',body:'Reason for visit: Chronic bilateral knee stiffness and follow-up of elevated lipid panel.\nHistory: 63-year-old male with persistent medial knee joint aching on climbing stairs and standing > 20 minutes. Morning stiffness ~15 minutes.\nVitals: BP 138/86 mmHg, Pulse 72 bpm, Weight 78 kg, BMI 27.6.\nMusculoskeletal Exam: Bilateral crepitus on passive knee flexion. Tenderness over medial joint lines. No joint effusion or erythema. Range of motion 0 - 120 degrees.\nX-Ray Review: Bilateral medial compartment joint space narrowing, subchondral sclerosis, small marginal tibial osteophytes (Grade II Kellgren-Lawrence).\nLipid Review: Total Chol 228 mg/dL, LDL 146 mg/dL, Triglycerides 174 mg/dL. Uric acid 5.8 mg/dL.\nPlan: Tab Atorva 20mg HS for dyslipidemia. Dolo 650mg TDS PRN for joint pain flares (avoid systemic NSAIDs given age and BP). Tab Cartigen Forte OD. Quadriceps isometric strengthening exercises with physiotherapy; avoid floor sitting and squatting.\nDr. Rajesh Sharma, MD (Medicine).',date:dateOffset(-18)},
    {id:'n10',patientId:'p5',title:'Initial Geriatric Assessment & Musculoskeletal Review',body:'63-year-old retired bank official presenting with gradual onset knee pain over 9 months.\nAdvised weight-bearing bilateral knee X-rays (AP and Lateral), comprehensive lipid profile, serum uric acid, and renal function test.\nDr. Rajesh Sharma, MD (Medicine).',date:dateOffset(-50)}
  ],
  messages:[
    {id:'msg1',to:'Rahul Sharma',body:'Your OPD appointment with Dr. Rajesh Sharma is confirmed for today 09:30 AM (Token #01). Please bring your fasting sugar log.',time:'09:15',kind:'Appointment reminder'},
    {id:'msg2',to:'Ananya Gupta',body:'Token #02 called. Please proceed to Consultation Room 2 with Dr. Rajesh Sharma for your Thyroid review.',time:'09:55',kind:'Appointment reminder'},
    {id:'msg3',to:'Vikram Patel',body:'Cardiology review confirmed with Dr. Amit Patel & Dr. Rajesh Sharma for 10:30 AM (Token #03). Please bring your recent ECG report.',time:'10:15',kind:'Appointment reminder'},
    {id:'msg4',to:'Pooja Verma',body:'Your asthma consultation is confirmed for today 11:00 AM (Token #04). Please carry your peak flow meter log.',time:'10:45',kind:'Appointment reminder'},
    {id:'msg5',to:'Mohammed Riaz',body:'Appointment confirmed for today 11:30 AM (Token #05). Knee digital radiographs received by Apollo City Clinic.',time:'11:15',kind:'Appointment reminder'}
  ],
  access:[
    {id:'x1',name:'Dr. Rajesh Sharma',scope:'Health records',active:true},
    {id:'x2',name:'Apollo City Clinic',scope:'Shared documents',active:true},
    {id:'x3',name:'Dr. Amit Patel',scope:'Cardiology consultations',active:true},
    {id:'x4',name:'Priya Sharma',scope:'Appointments only',active:false}
  ],
  audit:[
    {id:'v1',title:'Demo account created',time:'Today, 08:00'},
    {id:'v2',title:'5 Indian clinical patient records fully seeded',time:'Today, 08:05'}
  ],
  waiting:[
    {id:'w1',name:'Vikram Patel',specialty:'Cardiology',days:2,risk:'High',status:'Waiting'},
    {id:'w2',name:'Ananya Gupta',specialty:'General practice',days:1,risk:'Medium',status:'Waiting'},
    {id:'w3',name:'Mohammed Riaz',specialty:'General practice',days:1,risk:'Medium',status:'Waiting'},
    {id:'w4',name:'Pooja Verma',specialty:'Pulmonology',days:1,risk:'Low',status:'Waiting'},
    {id:'w5',name:'Rahul Sharma',specialty:'General practice',days:1,risk:'Low',status:'In consultation'}
  ],
  programmes:[
    {id:'pr1',title:'Diabetes Lifestyle & Nutrition Care',participants:84,active:true},
    {id:'pr2',title:'Hypertension & Heart Health Screening',participants:62,active:true},
    {id:'pr3',title:'Thyroid & Endocrine Patient Support Circle',participants:48,active:true},
    {id:'pr4',title:'Asthma & Respiratory Airway Wellness Program',participants:36,active:true},
    {id:'pr5',title:'Healthy Joints & Senior Mobility Clinic',participants:52,active:true}
  ],
  settings:{name:'Rahul Sharma',location:'Bandra West, Mumbai',blood:'B+',language:'English',largeText:false,highContrast:false,readAloud:false,simple:false,notifications:true,treatment:true,sharing:true,research:false}
};}
const DATA_KEY='medora-demo-v1';const SESSION_KEY='medora-demo-session';
export const startSession=(role:Role)=>{localStorage.setItem(SESSION_KEY,JSON.stringify({role,name:accounts[role].name}));window.location.assign('/'+role);};
export const endSession=async()=>{if(API_MODE)await api.logout();localStorage.removeItem(SESSION_KEY);window.location.assign('/login');};
export function getSession():{role:Role,name:string}|null{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}}
export function hydrateDemoData(saved?:Partial<DemoData>|null):DemoData {
  const original=seed();
  if(!saved)return original;
  const features=mergeFeatureState(saved.features);
  const today=dateOffset(0);
  const medicines=(Array.isArray(saved.medicines)?saved.medicines:original.medicines).map(m=>{
    let plan=features.medicationPlans[m.id]||emptyMedicationPlan(m.time);
    if(!saved.features){
      plan={...plan,times:[m.time],doses:m.taken?{[today]:[m.time]}:{}};
    }
    features.medicationPlans[m.id]=plan;
    return {...m,taken:plan.times.length>0&&plan.times.every(t=>(plan.doses[today]||[]).includes(t))};
  });
  return {...original,...saved,settings:{...original.settings,...saved.settings},features,medicines};
}
export function useDemo(enabled=true){const[data,setData]=useState<DemoData|null>(null);useEffect(()=>{if(!enabled)return;try{const s=localStorage.getItem(DATA_KEY);setData(hydrateDemoData(s?JSON.parse(s):null));}catch{setData(seed());}const onStorage=(e:StorageEvent)=>{if(e.key===DATA_KEY&&e.newValue){try{setData(hydrateDemoData(JSON.parse(e.newValue)));}catch{}}};window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage);},[enabled]);useEffect(()=>{if(enabled&&data)try{localStorage.setItem(DATA_KEY,JSON.stringify(data));}catch{}},[data,enabled]);const update=useCallback((fn:(prev:DemoData)=>DemoData)=>setData(p=>p?fn(p):p),[]);const reset=()=>setData(seed());return{data,update,reset};}
export const download=(name:string,content:string,type='application/json')=>{const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
export const audit=(data:DemoData,title:string)=>({...data,audit:[{id:uid(),title,time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})},...data.audit]});
export const providers=[{id:'c1',name:'Apollo City Clinic',doctor:'Dr. Rajesh Sharma',specialty:'General practice',initials:'RS',type:'Consultation',distance:'0.8 km',address:'Bandra West, Mumbai',fee:'₹500 (OPD Fee)',accessible:true,languages:'English, Hindi, Marathi',rating:'4.9',slots:['09:00','10:30','11:30','14:00']},{id:'c2',name:'Apex Heart & Cardiology Institute',doctor:'Dr. Amit Patel',specialty:'Cardiology',initials:'AP',type:'Private',distance:'1.2 km',address:'Indiranagar, Bengaluru',fee:'₹1,200',accessible:true,languages:'English, Hindi, Kannada',rating:'4.9',slots:['09:30','14:00','15:30']},{id:'c3',name:'Kaya & Bloom Skin Care Clinic',doctor:'Dr. Priya Nair',specialty:'Dermatology',initials:'PN',type:'Private',distance:'1.7 km',address:'Koregaon Park, Pune',fee:'₹800',accessible:true,languages:'English, Hindi, Marathi',rating:'4.8',slots:['10:00','12:00','16:00']},{id:'c4',name:'City Dental Care Studio',doctor:'Dr. Aisha Rahman',specialty:'Dentistry',initials:'AR',type:'Community',distance:'2.1 km',address:'Connaught Place, New Delhi',fee:'₹600',accessible:false,languages:'English, Hindi, Urdu',rating:'4.8',slots:['09:00','11:00','15:00']},{id:'c5',name:'Apollo Jan Aushadhi & Pharmacy',doctor:'Suresh Joshi',specialty:'Pharmacy',initials:'SJ',type:'Community',distance:'0.4 km',address:'Bandra West, Mumbai',fee:'₹150 (Jan Aushadhi Generic Rates)',accessible:true,languages:'English, Hindi, Marathi',rating:'4.7',slots:['10:00','13:00','17:00']},{id:'c6',name:'MindCare & Wellness Centre',doctor:'Dr. Vikram Sen',specialty:'Mental wellbeing',initials:'VS',type:'Private',distance:'2.3 km',address:'Salt Lake, Kolkata',fee:'₹1,000',accessible:true,languages:'English, Hindi, Bengali',rating:'4.9',slots:['10:30','14:30','16:00']}];

export function useWorkspace(ownerId?:string){
  const demo=useDemo(!API_MODE);
  const remote=useRemoteWorkspaceEnabled(ownerId);
  return API_MODE?remote:{...demo,user:null,status:demo.data?"saved" as const:"loading" as const,error:"",accept:undefined,flush:undefined,mutate:undefined,reload:undefined};
}
function useRemoteWorkspaceEnabled(ownerId?:string){return useRemoteWorkspace(ownerId,API_MODE);}
