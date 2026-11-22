"use client";
import { useState } from 'react';
import {
  HeartPulse,
  Stethoscope,
  Building2,
  CalendarDays,
  FileText,
  ShieldCheck,
  Sparkles,
  MapPin,
  Users,
  Pill,
  Check,
  Menu,
  X,
  Play,
  BrainCircuit,
  Globe2,
  Network,
  Plus,
  Send,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function Brand() {
  return (
    <a href="/" className="brand" aria-label="Medora home">
      <img src="/medora-mark.png" alt="" width="42" height="32" />
      <span>
        Medora<span className="brand-period">.</span>
      </span>
    </a>
  );
}

export const featureList = [
  [
    'Doctor Copilot & Ambient Scribe',
    'Transcribe voice consultations into structured SOAP notes and ICD-10 codes in seconds.',
    Stethoscope
  ],
  [
    'Indian Prescription Studio',
    'Typeahead across 250,000+ Indian brands and salts with 1-0-1 frequency chips and Jan Aushadhi alternatives.',
    Pill
  ],
  [
    'Smart OPD Queues & Tokens',
    'Real-time waiting room triage, token management, and smooth patient intake.',
    CalendarDays
  ],
  [
    'Medical Document & Lab AI',
    'Plain-language summaries of pathology reports, blood tests, and diagnostic scans.',
    FileText
  ],
  [
    'Referrals & Care Follow-ups',
    'Fast digital specialist referral letters and automated patient care regimens.',
    BrainCircuit
  ],
  [
    'Regional Multilingual Voice',
    'Consultations and patient summaries in English, Hindi, and regional languages.',
    Globe2
  ]
] as const;

const spaces = [
  [
    'doctor',
    'DOCTORS & CLINICIANS',
    'More time for patients. Less time on notes.',
    'A clearer workspace for consultation notes, fast prescriptions, and follow-ups.',
    Stethoscope,
    [
      'Transcribe consultations with Doctor Copilot',
      'Instant Indian medicine typeahead (Dolo, Augmentin, etc.)',
      'Draft referrals and discharge summaries in seconds'
    ]
  ],
  [
    'patient',
    'PATIENTS & FAMILIES',
    'Clear medical records in plain language.',
    'Understand lab reports, track daily medicines, and keep emergency passes ready.',
    HeartPulse,
    [
      'Plain-language lab report summaries',
      'Prescription reminders & dosing schedules',
      'Instant Emergency QR Pass for hospital intake'
    ]
  ],
  [
    'hospital',
    'POLYCLINICS & HOSPITALS',
    'Calmer OPD queues and staff coordination.',
    'Keep your front-desk, appointments, and waiting lists moving together.',
    Building2,
    [
      'Manage live OPD token queues & waiting room',
      'Coordinate multi-doctor consultation rooms',
      'DPDP Act & HIPAA data privacy compliance'
    ]
  ]
] as const;

export function Landing() {
  const [role, setRole] = useState('doctor');
  const [mobile, setMobile] = useState(false);
  const [faq, setFaq] = useState(0);
  const [trialSubmitted, setTrialSubmitted] = useState(false);
  const [trialForm, setTrialForm] = useState({
    name: '',
    phone: '',
    city: '',
    specialty: 'General Practice / Internal Medicine',
    problem: 'Spending 1-2 hours typing notes after OPD'
  });

  const patient = role === 'patient';
  const doctor = role === 'doctor';

  const handleTrialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTrialSubmitted(true);
  };

  return (
    <div className="landing">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* Navigation */}
      <header className="marketing-nav">
        <Brand />
        <nav className={mobile ? 'mobile-open' : ''} aria-label="Main navigation">
          {[
            ['The platform', 'platform'],
            ['For doctors', 'journeys'],
            ['Features', 'features'],
            ['Request trial', 'trial-request'],
            ['FAQs', 'questions']
          ].map(([label, id]) => (
            <a key={id} href={'#' + id} onClick={() => setMobile(false)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <a className="text-link" href="/login">
            Log in
          </a>
          <a
            className="btn secondary"
            href="#trial-request"
            style={{ fontSize: '13px', padding: '8px 14px' }}
          >
            Request free trial
          </a>
          <a className="btn primary" href="/login?role=doctor&auto=true">
            Doctor Demo (1-Tap)
          </a>
          <button
            className="mobile-menu"
            aria-label="Toggle navigation"
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main id="main">
        {/* Hero Section */}
        <section className="hero" id="platform">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              AI-POWERED CLINICAL COPILOT & CLINIC MANAGEMENT
            </div>
            <h1>
              More time for patients.
              <br />
              Less time on <span>notes.</span>
            </h1>
            <p className="hero-description">
              Turn patient consultations into structured clinical SOAP notes, write prescriptions with
              instant Indian drug suggestions and manage OPD queues without friction. Built for modern
              doctors and clinics.
            </p>
            <div className="hero-buttons">
              <a className="btn primary large" href="/login?role=doctor&auto=true">
                <Sparkles size={16} /> Try Doctor Demo (1-Tap)
              </a>
              <a className="btn secondary large" href="#trial-request">
                <Send size={16} /> Request Free Trial
              </a>
            </div>
            <div className="hero-footnote">
              <ShieldCheck size={17} />
              Built for modern clinics. AI drafts are suggestions — the doctor reviews everything.
            </div>
            <div className="hero-mini-tags">
              <span>Doctor Copilot & Scribe</span>
              <span>Instant Indian Rx</span>
              <span>Live OPD Queues</span>
              <span>1-Tap Demo Access</span>
            </div>
          </div>

          {/* Interactive Preview Window */}
          <div className="hero-product">
            <div className="preview-top">
              <span className="preview-label">
                <Sparkles size={15} /> Clinical Decision Support & Scribe
              </span>
              <span className="badge">Interactive preview</span>
            </div>

            <div className="preview-window">
              <div className="preview-bar">
                <Brand />
                <span className="avatar small">{doctor ? 'RS' : patient ? 'RM' : 'AC'}</span>
              </div>
              <div className="preview-body">
                <span className="overline">
                  {doctor
                    ? 'YOUR CLINICAL WORKSPACE'
                    : patient
                      ? 'YOUR CARE OVERVIEW'
                      : 'YOUR CLINIC OPERATIONS'}
                </span>
                <h2>
                  {doctor
                    ? 'Hello, Dr. Sharma'
                    : patient
                      ? 'Hello, Rahul'
                      : 'Hello, Apollo Care Clinic'}
                </h2>
                <p>
                  {doctor
                    ? 'A clearer picture. Better prepared. 2 hours saved on notes.'
                    : patient
                      ? 'Your next step, made clearer.'
                      : 'One team. A smoother OPD day.'}
                </p>

                <div className="preview-ai">
                  <span className="icon-box violet">
                    <Sparkles />
                  </span>
                  <div>
                    <strong>
                      {doctor
                        ? 'Next Consultation SOAP Draft Ready'
                        : patient
                          ? 'Your Care Plan & Prescription Ready'
                          : 'Morning OPD Queue Triage Ready'}
                    </strong>
                    <small>
                      {doctor
                        ? 'Ambient consultation transcribed. ICD-10 & Rx drafted for review.'
                        : patient
                          ? 'Blood test summarized with medication instructions.'
                          : '38 patients scheduled across 4 specialty OPDs.'}
                    </small>
                  </div>
                </div>

                <div className="preview-stats">
                  <div>
                    <CalendarDays />
                    <strong>{role === 'hospital' ? '38' : '04'}</strong>
                    <span>
                      {role === 'hospital'
                        ? 'Patients in OPD queue'
                        : 'Upcoming consultations'}
                    </span>
                  </div>
                  <div>
                    <FileText />
                    <strong>{role === 'hospital' ? '12' : '08'}</strong>
                    <span>
                      {role === 'hospital'
                        ? 'Clinicians on duty'
                        : 'Prescriptions drafted'}
                    </span>
                  </div>
                </div>

                <div className="preview-appointment">
                  <span className="icon-box blue">
                    <CalendarDays />
                  </span>
                  <div>
                    <strong>
                      {doctor
                        ? 'Next Consultation'
                        : patient
                          ? 'OPD Consultation'
                          : 'Active OPD Queue'}
                    </strong>
                    <small>
                      {doctor
                        ? 'Rahul Sharma · OPD Token #12 (10:30 AM)'
                        : patient
                          ? 'Dr. Rajesh Sharma · Today, 10:30 AM'
                          : '38 booked · 4 awaiting check-in'}
                    </small>
                  </div>
                  <Check className="check-circle" size={18} />
                </div>

                <div className="preview-journey">
                  <div className="row">
                    <strong>
                      {doctor
                        ? 'Clinical Consultation Flow'
                        : patient
                          ? 'Care Journey'
                          : 'Clinic Activity'}
                    </strong>
                    <span className="muted">In progress</span>
                  </div>
                  <p>
                    {doctor
                      ? 'Diabetes & Hypertension Review'
                      : patient
                        ? 'Annual Health Review'
                        : 'Morning OPD Session'}
                  </p>
                  <div className="journey-track">
                    <span />
                    <span />
                    <span className="faded" />
                    <span className="faded" />
                  </div>
                  <div className="row tiny">
                    <span>Listen</span>
                    <span>Draft SOAP</span>
                    <span>Prescribe</span>
                    <span>Follow up</span>
                  </div>
                </div>
              </div>
            </div>

            <Tabs value={role} onValueChange={setRole} className="hero-role-tabs">
              <TabsList>
                {spaces.map(([id, , , , Icon]) => (
                  <TabsTrigger value={id} key={id}>
                    <Icon size={16} />
                    {id === 'doctor'
                      ? 'Doctor (Recommended)'
                      : id.charAt(0).toUpperCase() + id.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="floating-note">
              <span className="icon-box teal">
                <Check size={18} />
              </span>
              <div>
                <strong>Everything feels connected.</strong>
                <small>1-Tap Doctor Demo · Pre-loaded clinical cases</small>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Strip */}
        <div className="platform-strip">
          <span>ONE PLATFORM. BUILT FOR MODERN CLINICAL WORKFLOWS.</span>
          {[
            [Stethoscope, 'Doctor Copilot & Scribe'],
            [Pill, 'Indian Rx & Formulary'],
            [Building2, 'OPD Queues & Triage'],
            [HeartPulse, 'Patient Records & Timeline']
          ].map(([Icon, text]: any) => (
            <div key={text}>
              <Icon />
              {text}
            </div>
          ))}
        </div>

        {/* Who it's for */}
        <section id="journeys" className="marketing-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">BUILT FOR CLINICAL EXCELLENCE</div>
              <h2>
                Care works better
                <br />
                when it works together.
              </h2>
            </div>
            <p>
              A focused workspace designed around doctor speed.
              <br />
              Cut administrative fatigue and stay on schedule.
            </p>
          </div>

          <div className="role-cards">
            {spaces.map(([id, label, title, desc, Icon, items], i) => (
              <article key={id} className={'role-card role-card-' + i}>
                <div className="row">
                  <span className="role-number">0{i + 1}</span>
                  <Icon size={27} />
                </div>
                <span className="overline">FOR {label}</span>
                <h3>{title}</h3>
                <p>{desc}</p>
                <ul>
                  {items.map((x) => (
                    <li key={x}>
                      <Check size={15} />
                      {x}
                    </li>
                  ))}
                </ul>
                <a className="btn secondary" href={`/login?role=${id}&auto=true`}>
                  {id === 'doctor' ? 'Try Doctor Demo (1-Tap)' : `Explore ${id} demo`}
                </a>
              </article>
            ))}
          </div>
        </section>

        {/* Clinical Journey Steps */}
        <section className="journey-section">
          <div className="journey-intro">
            <span className="eyebrow">A CLEARER WAY THROUGH CLINICAL CARE</span>
            <h2>
              From first symptom
              <br />
              to signed prescription.
            </h2>
            <p>
              Doctors shouldn’t have to spend evening hours catching up on EHR paperwork. Medora
              captures consultations and generates drafts in real time.
            </p>
            <a href="/login?role=doctor&auto=true" className="btn primary">
              Try Doctor Demo (1-Tap)
            </a>
          </div>

          <div className="journey-steps">
            {[
              [
                'Listen & Record',
                'Speak naturally during patient consultation. Medora listens and extracts symptoms.',
                Stethoscope
              ],
              [
                'Instant SOAP Note',
                'Auto-draft Subjective, Objective, Assessment, and Plan with ICD-10 suggestions.',
                FileText
              ],
              [
                'Smart Rx Suggestion',
                'Typeahead across Indian brand names and generic salts with standard 1-0-1 chips.',
                Pill
              ],
              [
                'Review & Sign',
                'The doctor retains complete control. Review, edit, and export in 1 click.',
                ShieldCheck
              ]
            ].map(([title, desc, Icon]: any, i) => (
              <div className="journey-step" key={title}>
                <span className="step-num">0{i + 1}</span>
                <span className="icon-box">
                  <Icon />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="marketing-section features-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE DOCTOR COPILOT PLATFORM</div>
              <h2>
                All the clinical tools.
                <br />
                Finally in one place.
              </h2>
            </div>
            <p>
              Explore doctor-first features with pre-loaded clinical cases.
              <br />
              Interactive demo. Zero setup required.
            </p>
          </div>

          <div className="feature-grid">
            {featureList.map(([title, desc, Icon], i) => (
              <a
                href="/login?role=doctor&auto=true"
                className="feature-item"
                key={title}
              >
                <span className={'icon-box ' + ['blue', 'teal', 'violet'][i % 3]}>
                  <Icon size={21} />
                </span>
                <div>
                  <span className="feature-index">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Lead Capture: Request Free Trial & Feedback Form */}
        <section id="trial-request" className="marketing-section" style={{ background: '#f8fafd' }}>
          <div className="section-heading">
            <div>
              <div className="eyebrow">PILOT MEDORA IN YOUR PRACTICE</div>
              <h2>
                Request a free clinic trial.
                <br />
                Tell us your biggest daily problem.
              </h2>
            </div>
            <p>
              We set up custom templates for your clinic.
              <br />
              14-day free pilot. Direct WhatsApp activation.
            </p>
          </div>

          <div
            style={{
              maxWidth: '640px',
              margin: '0 auto',
              background: '#ffffff',
              padding: '32px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
            }}
          >
            {trialSubmitted ? (
              <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#e8f7f1',
                    color: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Trial Request Received!
                </h3>
                <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                  Thank you, <strong>{trialForm.name || 'Doctor'}</strong>. Our clinical onboarding team
                  will message you on WhatsApp (<strong>{trialForm.phone || 'your phone number'}</strong>)
                  within 15 minutes to configure your clinic trial.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <a className="btn primary" href="/login?role=doctor&auto=true">
                    Explore Demo While Waiting
                  </a>
                  <button className="btn secondary" onClick={() => setTrialSubmitted(false)}>
                    Submit Another Query
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTrialSubmit} style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    Doctor / Clinic Name *
                    <input
                      required
                      value={trialForm.name}
                      onChange={(e) => setTrialForm({ ...trialForm, name: e.target.value })}
                      placeholder="e.g. Dr. Rajesh Sharma"
                      style={{ marginTop: '6px' }}
                    />
                  </label>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    WhatsApp Mobile Number *
                    <input
                      required
                      type="tel"
                      value={trialForm.phone}
                      onChange={(e) => setTrialForm({ ...trialForm, phone: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                      style={{ marginTop: '6px' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    City / Location
                    <input
                      value={trialForm.city}
                      onChange={(e) => setTrialForm({ ...trialForm, city: e.target.value })}
                      placeholder="e.g. Mumbai, Bengaluru, Pune"
                      style={{ marginTop: '6px' }}
                    />
                  </label>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    Specialty / Practice Type
                    <select
                      value={trialForm.specialty}
                      onChange={(e) => setTrialForm({ ...trialForm, specialty: e.target.value })}
                      style={{
                        width: '100%',
                        marginTop: '6px',
                        padding: '11px 13px',
                        borderRadius: '10px',
                        border: '1px solid var(--input)',
                        background: '#ffffff',
                        fontSize: '14px'
                      }}
                    >
                      <option>General Practice / Internal Medicine</option>
                      <option>Pediatrics</option>
                      <option>Cardiology</option>
                      <option>Dermatology</option>
                      <option>Orthopedics</option>
                      <option>Polyclinic / Day Hospital</option>
                    </select>
                  </label>
                </div>

                <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  What is your biggest daily clinic challenge?
                  <select
                    value={trialForm.problem}
                    onChange={(e) => setTrialForm({ ...trialForm, problem: e.target.value })}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      padding: '11px 13px',
                      borderRadius: '10px',
                      border: '1px solid var(--input)',
                      background: '#ffffff',
                      fontSize: '14px'
                    }}
                  >
                    <option>Spending 1-2 hours typing notes after OPD</option>
                    <option>Crowded waiting rooms & patient queue management</option>
                    <option>Writing prescriptions quickly with standard brand names</option>
                    <option>Organizing patient lab reports and follow-up tracking</option>
                    <option>Patient communication and appointment scheduling</option>
                  </select>
                </label>

                <div style={{ marginTop: '8px' }}>
                  <button type="submit" className="btn primary full large">
                    <MessageCircle size={17} /> Request Free Clinic Trial on WhatsApp
                  </button>
                  <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginTop: '10px' }}>
                    Free 14-day clinic pilot · No credit card required · Sample data only
                  </p>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Privacy & Clinical AI Disclaimer Band */}
        <section className="privacy-band">
          <ShieldCheck size={46} />
          <div>
            <span className="eyebrow">CLINICAL SAFETY FIRST · DPDP & PRIVACY ALIGNED</span>
            <h2>AI drafts are suggestions. The doctor reviews everything.</h2>
            <p>
              Medora never replaces clinical judgment. Every note, diagnosis, and prescription draft
              requires explicit clinician review and sign-off before being saved. Pre-loaded with
              synthetic sample data only.
            </p>
          </div>
          <a className="btn secondary" href="/login?role=doctor&auto=true">
            Try Sample Patients
          </a>
        </section>

        {/* FAQ Section */}
        <section className="marketing-section faq-section" id="questions">
          <div>
            <div className="eyebrow">COMMON CLINICIAN QUESTIONS</div>
            <h2>
              Before you
              <br />
              step inside.
            </h2>
            <p className="muted">
              Honest details about this demo,
              <br />
              our AI safety, and privacy policies.
            </p>
          </div>

          <div className="faq-list">
            {[
              [
                'Can I try the doctor workspace right now?',
                'Yes. Tap "Doctor Demo (1-Tap)" to log in instantly with 1 click. The demo is pre-loaded with synthetic patient consultations (Rahul Sharma, Aarav Patel) so you can test Doctor Copilot, Indian medicine typeahead, and clinical notes immediately without typing passwords.'
              ],
              [
                'What works in this demo?',
                'Interactive demo with sample data. You can test Doctor Copilot, generate consultation SOAP notes, write prescriptions with Indian medicine typeahead, manage OPD queues, and inspect document summaries. Live AI runs on pre-loaded sample patients with safe usage limits.'
              ],
              [
                'Is this connected to real clinic or hospital databases?',
                'No. This demo runs on synthetic sample data. No real patient data is stored or accessed. In accordance with India’s Digital Personal Data Protection (DPDP) Act, live patient onboarding and EMR sync are enabled only after your clinic signs up for a verified trial.'
              ],
              [
                'How does Doctor Copilot protect clinical accuracy?',
                'AI drafts are decision-support suggestions only. The doctor reviews, edits, and signs off on every note, prescription, and referral before saving. The AI never prescribes or finalizes records autonomously.'
              ],
              [
                'Can I test it directly on my mobile or WhatsApp?',
                'Yes. Medora is lightweight, fast-loading, and fully responsive on mobile devices and inside WhatsApp’s in-app browser. Doctors can test the complete workflow on their phone without installing an app.'
              ]
            ].map(([q, a], i) => (
              <div className="faq-item" key={q}>
                <button
                  onClick={() => setFaq(faq === i ? -1 : i)}
                  aria-expanded={faq === i}
                >
                  <span>{q}</span>
                  {faq === i ? <X size={18} /> : <Plus size={18} />}
                </button>
                {faq === i && <p>{a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="final-cta">
          <div className="eyebrow">SPEND LESS TIME TYPING. SPEND MORE TIME WITH PATIENTS.</div>
          <h2>
            Your next chapter
            <br />
            in care starts here.
          </h2>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
            <a className="btn white large" href="/login?role=doctor&auto=true">
              <Sparkles size={16} /> Try Doctor Demo (1-Tap)
            </a>
            <a
              className="btn secondary large"
              href="#trial-request"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                borderColor: 'rgba(255,255,255,0.3)'
              }}
            >
              Request Free Clinic Trial
            </a>
          </div>
          <p style={{ marginTop: '16px' }}>
            Three demo workspaces. Pre-loaded with sample Indian clinical scenarios.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="marketing-footer">
        <Brand />
        <span>Care, thoughtfully connected. Built for modern clinics.</span>
        <span>© 2026 Medora · Clinical AI Platform</span>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a href="/login?role=doctor&auto=true">Doctor Demo</a>
          <a href="#trial-request">Request Trial</a>
        </div>
      </footer>
    </div>
  );
}
