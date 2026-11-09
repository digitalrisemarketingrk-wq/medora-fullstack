import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require = createRequire(root + '/package.json');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
process.env.TZ = 'UTC';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/') || (specifier.startsWith('.') && /\.(ts|tsx)$/.test(context.parentURL || ''))) {
      const base = specifier.startsWith('@/') ? root + '/' + specifier.slice(2) : path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      const filename = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx'].map(ext => base + ext).find(f => fs.existsSync(f) && fs.statSync(f).isFile());
      if (filename) return { url: pathToFileURL(filename).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (/\.(ts|tsx)$/.test(url)) return { format: 'module', source: ts.transpileModule(fs.readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, shortCircuit: true };
    return nextLoad(url, context);
  }
});
const { seed, hydrateDemoData, dateOffset } = await import(pathToFileURL(root + '/lib/medora-demo.ts'));
const { buildVisitCalendar, parseCalendarEntry } = await import(pathToFileURL(root + '/lib/medora-calendar.ts'));
const { filterCareProviders, resolveBookingProvider } = await import(pathToFileURL(root + '/lib/medora-care.ts'));
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
const data = seed();
const filter = { ...data.features.carePreferences, query: '', specialty: 'All specialties', savedOnly: false, mapArea: 'All areas' };
check('Service search and language preference combine', () => assert.deepEqual(filterCareProviders({...filter, query:'  blood TEST ',language:'Hindi'}).map(p=>p.id), ['c7']));
check('Accessibility and area filter combine', () => assert.deepEqual(filterCareProviders({...filter, mapArea:'Camden',accessible:true}).map(p=>p.id), ['c9','c8']));
check('Walk-in options exclude diagnostic-only providers', () => assert.deepEqual(filterCareProviders({...filter,availability:'Walk-in enquiry'}).map(p=>p.id).sort(), ['c1','c5','c8','c9']));
check('Urgency filter selects the sample urgent-care service', () => assert.deepEqual(filterCareProviders({...filter,urgency:'Urgent care enquiry'}).map(p=>p.id), ['c9']));
check('Saved providers and incompatible funding return empty results', () => assert.deepEqual(filterCareProviders({...filter,savedOnly:true,savedProviders:['c7'],funding:'NHS'}), []));
check('Diagnostic rescheduling retains its provider', () => assert.equal(resolveBookingProvider({doctor:'Diagnostic reception team'},true).id,'c7'));
check('Imported calendar rescheduling retains original care team and time', () => { const p=resolveBookingProvider({doctor:'External care team',provider:'External clinic',time:'06:15'},true); assert.equal(p.name,'External clinic');assert.equal(p.doctor,'External care team');assert.ok(p.slots.includes('06:15')); });
const visit={...data.appointments[0],provider:'Clinique Éléonore, London; reception', reason:'Review notes; bring records, questions and a literal \\n.\n'+'患者 records '.repeat(30)};
check('Calendar export/import preserves event details and Unicode', () => { const text=buildVisitCalendar(visit);const parsed=parseCalendarEntry(text); assert.equal(parsed.date,visit.date);assert.equal(parsed.time,visit.time);assert.equal(parsed.clinic,visit.provider);assert.equal(parsed.description,'Fictional Medora appointment. '+visit.doctor+'. '+visit.reason);for(const line of text.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);assert.ok(text.includes('BEGIN:VALARM')); });
check('Calendar reminder can be excluded', () => assert.ok(!buildVisitCalendar(visit,false).includes('VALARM')));
check('Calendar reads first event only and handles UTC', () => { const parsed=parseCalendarEntry('BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261003T183000Z\nSUMMARY:First visit\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20261005T090000\nSUMMARY:Second visit\nEND:VEVENT\nEND:VCALENDAR');assert.equal(parsed.title,'First visit');assert.equal(parsed.time,'18:30'); });
check('Calendar rejects impossible dates and times', () => { for(const raw of ['20260231T090000','20261003T240000','20261003T126000','20261003T120061'])assert.throws(()=>parseCalendarEntry('BEGIN:VEVENT\nDTSTART:'+raw+'\nEND:VEVENT'));assert.throws(()=>parseCalendarEntry('no event')); });
check('Legacy saved data survives feature migration', () => { const old={...data,features:undefined,settings:{...data.settings,name:'Demo Migration'},medicines:[{...data.medicines[0],time:'07:30',taken:true}]};const h=hydrateDemoData(old);assert.equal(h.settings.name,'Demo Migration');assert.equal(h.appointments.length,data.appointments.length);assert.deepEqual(h.features.medicationPlans.m1.doses[dateOffset(0)],['07:30']); });
check('Yesterday’s dose record is not carried forward as taken', () => { const saved={...data,medicines:[{...data.medicines[0],taken:true}],features:{...data.features,medicationPlans:{m1:{...data.features.medicationPlans.m1,doses:{[dateOffset(-1)]:['08:00']}}}}};assert.equal(hydrateDemoData(saved).medicines[0].taken,false); });
const patient = await import(pathToFileURL(root + '/components/medora/patient.tsx'));
const doctor = await import(pathToFileURL(root + '/components/medora/doctor.tsx'));
const hospital = await import(pathToFileURL(root + '/components/medora/hospital.tsx'));
const ctx = {role:'patient',data,update:()=>{},go:()=>{},open:()=>{},selected:'p1',setSelected:()=>{},query:''};
const expected = {finder:'Find your kind of care.',documents:'From paperwork to perspective.',medications:'A rhythm for your care.',family:'Your circle, cared for.',appointments:'Your next visit, in focus.'};
for(const [view,title] of Object.entries(expected))check('Initial frontend render: '+view,()=> { const html=renderToStaticMarkup(React.createElement(patient.PatientViews,{ctx,view}));assert.ok(html.includes(title),title);assert.ok(!html.includes('Invalid Date')); });
check('Initial frontend render: Doctor Copilot',()=> {const html=renderToStaticMarkup(React.createElement(doctor.DoctorViews,{ctx:{...ctx,role:'doctor'},view:'consultation'}));assert.ok(html.includes('More presence. Less paperwork.'));assert.ok(html.includes('Each document must be reviewed before saving.'));});
check('Hospital appointment view remains available',()=> {const html=renderToStaticMarkup(React.createElement(hospital.HospitalViews,{ctx:{...ctx,role:'hospital'},view:'appointments'}));assert.ok(html.includes('Alex Morgan'));});
for(const view of ['dashboard','patients','schedule','consultation','notes','referrals'])check('Empty professional workspace: '+view,()=>{const html=renderToStaticMarkup(React.createElement(doctor.DoctorViews,{ctx:{...ctx,role:'doctor',data:{...data,patients:[],appointments:[],notes:[],documents:[],tasks:[]}},view}));assert.ok(html.length>0);});
console.log(`${checks} source and rendering checks passed. These are not browser or visual tests.`);
