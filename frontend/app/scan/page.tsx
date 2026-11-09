'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  QrCode,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HeartPulse,
  Pill,
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  ArrowRight,
  UserCheck,
  Stethoscope,
  Building2,
  Sparkles,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronLeft,
  Info,
  CalendarDays,
  Users,
  Camera
} from 'lucide-react';
import { CameraScanner } from '@/components/medora/camera-scanner';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast, Toaster } from 'sonner';
import { Brand } from '@/components/medora/landing';
import {
  Panel,
  Heading,
  Metric,
  SampleNote,
  Status
} from '@/components/medora/shared';
import {
  api,
  API_MODE,
  type Profile,
  type QRPassPreview,
  type QRPassIntakeResult
} from '@/lib/medora-api';
import { accounts, password, getSession, startSession } from '@/lib/medora-demo';

function ScannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryToken = searchParams.get('token') || '';

  const [tokenInput, setTokenInput] = useState(queryToken);
  const [activeToken, setActiveToken] = useState(queryToken);

  const [user, setUser] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [preview, setPreview] = useState<QRPassPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>('');

  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [reason, setReason] = useState('Emergency Medical Review');
  const [intaking, setIntaking] = useState(false);
  const [intakeResult, setIntakeResult] = useState<QRPassIntakeResult | null>(null);

  // Check current session
  const checkSession = useCallback(async () => {
    setAuthLoading(true);
    try {
      if (API_MODE) {
        const { user: profile } = await api.me();
        setUser(profile);
      } else {
        const s = getSession();
        if (s) {
          setUser({
            id: 'demo_' + s.role,
            name: s.name,
            email: accounts[s.role].email,
            role: s.role
          });
        } else {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  // Synchronize queryToken with activeToken
  useEffect(() => {
    if (queryToken && queryToken !== activeToken) {
      setTokenInput(queryToken);
      setActiveToken(queryToken);
      setIntakeResult(null);
    }
  }, [queryToken, activeToken]);

  // Load preview when activeToken changes and user is clinician
  useEffect(() => {
    if (!activeToken) {
      setPreview(null);
      setPreviewError('');
      return;
    }

    if (!user || (user.role !== 'doctor' && user.role !== 'hospital')) {
      return;
    }

    let isMounted = true;
    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        if (API_MODE) {
          const res = await api.previewQRPass(activeToken);
          if (isMounted) setPreview(res);
        } else {
          if (isMounted) {
            const isLife = activeToken.includes('lifetime');
            setPreview({
              patient_id: 'p1',
              patient_name: 'Alex Morgan',
              patient_email: 'alex.morgan@example.demo',
              expires_at: Math.floor(Date.now() / 1000) + (isLife ? 365 * 24 * 3600 : 900),
              is_expired: false,
              blood_group: 'O+',
              allergies_count: 1,
              medications_count: 2,
              documents_count: 4,
              access_type: isLife ? 'lifetime' : 'temporary'
            });
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Invalid or expired QR Quick-Pass.';
          setPreviewError(msg);
          toast.error(msg);
        }
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    };

    void loadPreview();
    return () => {
      isMounted = false;
    };
  }, [activeToken, user]);

  // Quick Doctor Login for seamless demonstration
  const handleQuickDoctorLogin = async () => {
    try {
      if (API_MODE) {
        const { user: docUser } = await api.login(accounts.doctor.email, password);
        setUser(docUser);
        toast.success(`Authenticated as ${docUser.name} (${docUser.role})`);
      } else {
        startSession('doctor');
        setUser({
          id: 'demo_doctor',
          name: accounts.doctor.name,
          email: accounts.doctor.email,
          role: 'doctor'
        });
        toast.success(`Authenticated as ${accounts.doctor.name}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Authentication failed');
    }
  };

  // Inspect Token from Search / Input
  const handleInspectToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      toast.error('Please enter a valid Quick-Pass token or scanner URL');
      return;
    }

    let cleanToken = tokenInput.trim();
    if (cleanToken.includes('token=')) {
      try {
        const url = new URL(cleanToken, window.location.origin);
        cleanToken = url.searchParams.get('token') || cleanToken;
      } catch {
        cleanToken = cleanToken.split('token=')[1]?.split('&')[0] || cleanToken;
      }
    }

    setActiveToken(cleanToken);
    setIntakeResult(null);
    router.push(`/scan?token=${encodeURIComponent(cleanToken)}`);
  };

  // Handle scanned token from Live Camera Scanner
  const handleCameraScan = (scannedToken: string) => {
    let cleanToken = scannedToken.trim();
    if (cleanToken.includes('token=')) {
      try {
        const url = new URL(cleanToken, window.location.origin);
        cleanToken = url.searchParams.get('token') || cleanToken;
      } catch {
        cleanToken = cleanToken.split('token=')[1]?.split('&')[0] || cleanToken;
      }
    }
    setTokenInput(cleanToken);
    setActiveToken(cleanToken);
    setIntakeResult(null);
    router.push(`/scan?token=${encodeURIComponent(cleanToken)}`);
  };

  // Generate Demo Pass for 1-Click Fast Testing
  const handleLoadDemoPass = async (type: 'temporary' | 'lifetime' = 'temporary') => {
    try {
      if (API_MODE) {
        toast.info(`Requesting active patient ${type} pass…`);
        const pass = await api.generateQRPass(type);
        setTokenInput(pass.token);
        setActiveToken(pass.token);
        setIntakeResult(null);
        router.push(`/scan?token=${encodeURIComponent(pass.token)}`);
        toast.success(`Patient ${type === 'lifetime' ? 'Lifetime' : 'Temporary'} Quick-Pass loaded`);
      } else {
        const isLife = type === 'lifetime';
        const mockExpires = Math.floor(Date.now() / 1000) + (isLife ? 365 * 24 * 3600 : 15 * 60);
        const mockToken = `demo_token_Alex_Morgan_${mockExpires}_${type}`;
        setTokenInput(mockToken);
        setActiveToken(mockToken);
        setIntakeResult(null);
        router.push(`/scan?token=${encodeURIComponent(mockToken)}`);
        toast.success(`Loaded demo ${type} pass`);
      }
    } catch {
      const mockToken = `demo_token_Alex_Morgan_${Math.floor(Date.now() / 1000) + 900}_${type}`;
      setTokenInput(mockToken);
      setActiveToken(mockToken);
      router.push(`/scan?token=${encodeURIComponent(mockToken)}`);
      toast.info(`Loaded demo ${type} pass`);
    }
  };

  // Perform Intake Handshake
  const handleIntake = async () => {
    if (!consentConfirmed) {
      toast.error('Please confirm the mandatory clinical consent declaration.');
      return;
    }

    setIntaking(true);
    try {
      const isLife = preview?.access_type === 'lifetime' || activeToken.includes('lifetime');
      if (API_MODE) {
        const res = await api.intakeQRPass(activeToken, consentConfirmed, reason, isLife ? 'lifetime' : 'temporary');
        setIntakeResult(res);
        toast.success(`Care record unlocked for ${res.patient_name}`);
      } else {
        // Local demo persistence sync
        try {
          const raw = localStorage.getItem('medora-demo-v1');
          if (raw) {
            const d = JSON.parse(raw);
            if (isLife) {
              d.team = d.team || {};
              d.team['Dr Sarah Khan'] = true;
              d.access = d.access || [];
              const exIdx = d.access.findIndex((a: any) => a.name === 'Dr Sarah Khan');
              if (exIdx >= 0) {
                d.access[exIdx].scope = 'Lifetime care access · Permanently connected';
                d.access[exIdx].active = true;
              } else {
                d.access.unshift({
                  id: 'x-doc-sarah',
                  name: 'Dr Sarah Khan',
                  scope: 'Lifetime care access · Permanently connected',
                  active: true
                });
              }
              d.patients = d.patients || [];
              const patIdx = d.patients.findIndex((p: any) => p.name === 'Alex Morgan' || p.id === 'p1');
              if (patIdx >= 0) {
                d.patients[patIdx].condition = `Lifetime Connected · ${reason}`;
                d.patients[patIdx].lastVisit = new Date().toISOString().slice(0, 10);
              }
              d.audit = d.audit || [];
              d.audit.unshift({
                id: Math.random().toString(36).slice(2, 10),
                title: `Lifetime access accepted by Dr Sarah Khan (doctor) · Permanently connected · Reason: ${reason}`,
                time: 'Just now'
              });
              localStorage.setItem('medora-demo-v1', JSON.stringify(d));
            }
          }
        } catch {}

        setIntakeResult({
          status: 'granted',
          patient_id: 'p1',
          patient_name: preview?.patient_name || 'Alex Morgan',
          reason,
          grant_scope: 'read',
          access_type: isLife ? 'lifetime' : 'temporary',
          summary: {
            patient_name: preview?.patient_name || 'Alex Morgan',
            email: preview?.patient_email || 'alex.morgan@example.demo',
            blood_group: preview?.blood_group || 'O+',
            allergies: ['Penicillin (Moderate - Skin rash / hives)'],
            emergency_contacts: [
              { name: 'Jamie Morgan', relation: 'Partner', age: '32' }
            ],
            active_medications: [
              { id: 'm1', name: 'Vitamin D supplement', detail: '1 tablet daily with food', time: '08:00' },
              { id: 'm2', name: 'Regular prescription', detail: 'Atorvastatin 20mg at bedtime', time: '20:00' }
            ],
            recent_documents: [
              { id: 'd1', name: 'Annual health review.pdf', kind: 'Consultation', uploaded_at: '14 days ago' },
              { id: 'd2', name: 'Blood test report.pdf', kind: 'Lab report', uploaded_at: '7 days ago' },
              { id: 'd3', name: 'Specialist referral.pdf', kind: 'Referral', uploaded_at: '3 days ago' }
            ],
            clinical_notes: [
              {
                id: 'n1',
                title: 'Routine health review',
                body: 'Annual review conducted. Patient concerns reviewed. Regular prescription confirmed.',
                date: '14 days ago'
              }
            ]
          },
          workspace_url: '/doctor'
        });
        toast.success(isLife ? 'Lifetime connection confirmed & full record unlocked' : 'Consent verified & medical summary unlocked');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Intake failed.';
      toast.error(msg);
    } finally {
      setIntaking(false);
    }
  };

  const isClinician = user?.role === 'doctor' || user?.role === 'hospital';

  return (
    <div className="app-main" style={{ minHeight: '100vh', background: '#f7f9fc' }}>
      <Toaster position="bottom-right" richColors />

      {/* Medora App Topbar */}
      <header className="app-topbar">
        <div className="breadcrumb-label">
          <Brand />
          <span>/</span>
          <span>Clinical workspace</span>
          <span>/</span>
          <strong>Emergency Quick-Pass Scanner</strong>
        </div>

        <div className="topbar-actions">
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={'badge ' + (isClinician ? 'green' : 'amber')}>
                {user.role === 'doctor' ? (
                  <Stethoscope size={13} />
                ) : user.role === 'hospital' ? (
                  <Building2 size={13} />
                ) : (
                  <HeartPulse size={13} />
                )}
                <span>
                  {user.name} ({user.role})
                </span>
              </span>
              <a
                href={'/' + user.role}
                className="btn secondary"
                style={{ fontSize: 12, height: 35, padding: '7px 13px', gap: 6 }}
              >
                <ChevronLeft size={14} />
                Return to workspace
              </a>
            </div>
          ) : (
            <a
              href={`/login?redirect=${encodeURIComponent(
                activeToken ? `/scan?token=${activeToken}` : '/scan'
              )}&role=doctor`}
              className="btn primary"
              style={{ fontSize: 12, height: 35, padding: '7px 15px' }}
            >
              Clinician sign in
            </a>
          )}
        </div>
      </header>

      {/* Medora Info Band */}
      <div className="demo-band">
        <ShieldCheck size={13} />
        <strong>EMERGENCY QUICK-PASS SCANNER</strong>
        <span>
          Time-limited cryptographic patient verification · Mandatory clinician consent handshake
        </span>
      </div>

      {/* Main Workspace Content */}
      <main className="app-content">
        {authLoading ? (
          <div className="loading-layout" style={{ padding: '60px 0' }}>
            <Panel style={{ textAlign: 'center', padding: '50px 20px' }}>
              <RefreshCw
                className="animate-spin"
                style={{ margin: '0 auto 14px', color: '#245be8' }}
                size={30}
              />
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Checking clinician credentials</h3>
              <p className="muted small-text" style={{ marginTop: 6 }}>
                Verifying authorization status with the Medora care network…
              </p>
            </Panel>
          </div>
        ) : !user ? (
          /* STATE 1: UNAUTHENTICATED VISITOR */
          <div style={{ maxWidth: 520, margin: '30px auto' }}>
            <Panel style={{ padding: '36px 32px', textAlign: 'center' }}>
              <span
                className="icon-box blue"
                style={{ width: 56, height: 56, margin: '0 auto 16px' }}
              >
                <ShieldAlert size={28} />
              </span>
              <span className="badge amber" style={{ marginBottom: 12 }}>
                CLINICIAN AUTHENTICATION REQUIRED
              </span>
              <h2 style={{ fontSize: 24, fontWeight: 620, letterSpacing: '-0.5px' }}>
                Attending Clinician Verification
              </h2>
              <p
                className="muted"
                style={{ fontSize: 13, lineHeight: 1.8, maxWidth: 430, margin: '10px auto 22px' }}
              >
                Patient Quick-Passes contain sensitive, protected emergency health records. Only
                authenticated clinicians (Doctor or Hospital staff) can perform clinical intake.
              </p>

              {activeToken && (
                <div
                  className="sample-note"
                  style={{ textAlign: 'left', wordBreak: 'break-all', marginBottom: 20 }}
                >
                  <Lock size={15} />
                  <div>
                    <strong>Pass token detected:</strong>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>
                      {activeToken}
                    </div>
                  </div>
                </div>
              )}

              <div className="stack" style={{ gap: 10 }}>
                <button
                  className="btn primary full large"
                  onClick={() => void handleQuickDoctorLogin()}
                >
                  <Stethoscope size={16} />
                  1-Click Doctor Quick-Auth (Dr Sarah Khan)
                </button>

                <a
                  className="btn secondary full"
                  href={`/login?redirect=${encodeURIComponent(
                    activeToken ? `/scan?token=${activeToken}` : '/scan'
                  )}&role=doctor`}
                >
                  Sign in with Doctor credentials
                </a>

                <a
                  className="btn ghost full"
                  style={{ fontSize: 12 }}
                  href={`/login?redirect=${encodeURIComponent(
                    activeToken ? `/scan?token=${activeToken}` : '/scan'
                  )}&role=hospital`}
                >
                  Sign in as Hospital emergency staff
                </a>
              </div>
            </Panel>
          </div>
        ) : !isClinician ? (
          /* STATE 2: AUTHENTICATED AS PATIENT */
          <div style={{ maxWidth: 520, margin: '30px auto' }}>
            <Panel style={{ padding: '36px 32px', textAlign: 'center' }}>
              <span
                className="icon-box pink"
                style={{ width: 56, height: 56, margin: '0 auto 16px' }}
              >
                <AlertTriangle size={28} />
              </span>
              <span className="badge pink" style={{ marginBottom: 12 }}>
                CLINICIAN RESTRICTED ZONE
              </span>
              <h2 style={{ fontSize: 24, fontWeight: 620, letterSpacing: '-0.5px' }}>
                Clinician Access Only
              </h2>
              <p
                className="muted"
                style={{ fontSize: 13, lineHeight: 1.8, maxWidth: 430, margin: '10px auto 22px' }}
              >
                You are currently signed in as <strong>{user.name}</strong> with a{' '}
                <strong>Patient</strong> profile. Quick-Pass scanning and medical intake are reserved
                for attending Doctors and Hospital staff.
              </p>

              <div className="stack" style={{ gap: 10 }}>
                <button
                  className="btn primary full"
                  onClick={() => void handleQuickDoctorLogin()}
                >
                  <Stethoscope size={16} /> Switch to Doctor Account (Dr Sarah Khan)
                </button>

                <a className="btn secondary full" href="/patient">
                  <ChevronLeft size={16} /> Return to Patient Workspace
                </a>
              </div>
            </Panel>
          </div>
        ) : intakeResult ? (
          /* STATE 3: INTAKE UNLOCKED & MEDICAL SUMMARY DISPLAYED */
          <div className="stack" style={{ gap: 24 }}>
            {/* Medora Welcome Banner */}
            <section
              className="welcome-card"
              style={{
                background: 'linear-gradient(108deg,#eaf7f2 3%,#edfbf7 60%,#e8f4f5)',
                borderColor: '#c7ece0'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span className="badge green">
                    <CheckCircle2 size={13} />
                    CARE ACCESS AUTHORIZED & RECORDED
                  </span>
                  <span
                    className={'badge ' + (intakeResult.access_type === 'lifetime' ? 'green' : 'amber')}
                    style={{ gap: 5, padding: '4px 10px', fontSize: 12 }}
                  >
                    {intakeResult.access_type === 'lifetime' ? (
                      <ShieldCheck size={13} />
                    ) : (
                      <Clock size={13} />
                    )}
                    {intakeResult.access_type === 'lifetime'
                      ? 'ACCESS TYPE: LIFETIME (PERMANENT CONNECTION)'
                      : 'ACCESS TYPE: TEMPORARY (15-MIN SESSION)'}
                  </span>
                </div>
                <h2 style={{ color: '#135c4b', fontSize: 23, fontWeight: 620, margin: '8px 0 8px' }}>
                  Medical summary unlocked for {intakeResult.patient_name}
                </h2>
                <p style={{ color: '#3d7769', fontSize: 13, lineHeight: 1.75, maxWidth: 580 }}>
                  {intakeResult.access_type === 'lifetime' ? (
                    <>
                      Lifetime care connection confirmed by <strong>{user.name}</strong> ({user.role}). Encounter purpose:{' '}
                      <strong>{intakeResult.reason}</strong>. <strong>{intakeResult.patient_name}</strong> has been
                      permanently added to your patient directory with full medical history, and you are now in their connected care circle.
                    </>
                  ) : (
                    <>
                      Emergency declaration confirmed by <strong>{user.name}</strong> ({user.role}). Encounter purpose:{' '}
                      <strong>{intakeResult.reason}</strong>. Access Type:{' '}
                      <strong>Temporary emergency review (15-minute session)</strong>. An immutable entry has
                      been written to the patient&apos;s audit trail.
                    </>
                  )}
                </p>

                <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                  <a
                    className="btn primary"
                    href="/doctor"
                    style={{ background: '#168b77', borderColor: '#168b77' }}
                  >
                    <Sparkles size={15} />
                    Open in Doctor Copilot
                  </a>
                  {intakeResult.access_type === 'lifetime' && (
                    <a
                      className="btn secondary"
                      href="/doctor#patients"
                      style={{ background: '#ffffff', borderColor: '#c7ece0', color: '#135c4b', gap: 6 }}
                    >
                      <Users size={15} />
                      View in My Patients List
                    </a>
                  )}
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setIntakeResult(null);
                      setPreview(null);
                      setActiveToken('');
                      setTokenInput('');
                      router.push('/scan');
                    }}
                  >
                    <QrCode size={15} />
                    Scan another patient
                  </button>
                </div>
              </div>

              <div className="welcome-card-art">
                <span className="icon-box teal">
                  <HeartPulse />
                </span>
                <span className="icon-box blue">
                  <Stethoscope />
                </span>
              </div>
            </section>

            {/* Medical Summary Layout */}
            <div className="two-col">
              {/* Left Column: Demographics & Allergies & Emergency Contacts */}
              <div className="stack" style={{ gap: 22 }}>
                <Panel title="Patient profile" sub="Demographics & critical emergency flags">
                  <div className="list-item" style={{ border: 0, padding: '0 0 18px' }}>
                    <span className="avatar large" style={{ background: '#eaf1ff', color: '#2961df' }}>
                      {intakeResult.summary.patient_name.slice(0, 2).toUpperCase()}
                    </span>
                    <div style={{ marginLeft: 14 }}>
                      <h3 style={{ fontSize: 19, fontWeight: 620 }}>
                        {intakeResult.summary.patient_name}
                      </h3>
                      <p className="muted small-text">{intakeResult.summary.email}</p>
                    </div>
                  </div>

                  <dl className="summary-detail" style={{ marginTop: 0 }}>
                    <dt>Blood group</dt>
                    <dd>
                      <strong style={{ fontSize: 16, color: '#c45275' }}>
                        {intakeResult.summary.blood_group || 'O+'}
                      </strong>
                    </dd>

                    <dt>Known drug allergies</dt>
                    <dd>
                      {intakeResult.summary.allergies && intakeResult.summary.allergies.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 5 }}>
                          {intakeResult.summary.allergies.map((a, i) => (
                            <span
                              key={i}
                              className="badge amber"
                              style={{ width: 'fit-content', padding: '6px 10px', fontSize: 12 }}
                            >
                              <AlertTriangle size={13} />
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">Allergy history is not verified. Confirm it with the patient.</span>
                      )}
                    </dd>

                    <dt>Emergency contacts</dt>
                    <dd>
                      {intakeResult.summary.emergency_contacts &&
                      intakeResult.summary.emergency_contacts.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                          {intakeResult.summary.emergency_contacts.map((c, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '9px 12px',
                                background: '#f8faff',
                                border: '1px solid #e5edf7',
                                borderRadius: 8,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <strong>{c.name}</strong>
                                <small className="muted" style={{ display: 'block' }}>
                                  {c.relation}
                                </small>
                              </div>
                              {c.age && <span className="tiny muted">Age: {c.age}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">None recorded</span>
                      )}
                    </dd>
                  </dl>
                </Panel>

                <Panel title="Intake audit trail" sub="Compliance & consent record">
                  <div className="audit-row">
                    <ShieldCheck size={16} />
                    <div>
                      <strong>Emergency intake authorized</strong>
                      <small>
                        Clinician: {user.name} ({user.role}) · Reason: {intakeResult.reason}
                      </small>
                    </div>
                  </div>
                  <div className="audit-row">
                    <UserCheck size={16} />
                    <div>
                      <strong>Patient care record access grant</strong>
                      <small>Scope: Direct read access granted via verified Quick-Pass</small>
                    </div>
                  </div>
                </Panel>
              </div>

              {/* Right Column: Medications, Documents, Notes */}
              <div className="stack" style={{ gap: 22 }}>
                <Panel
                  title="Active medications"
                  sub="Current prescriptions & schedule"
                  action={
                    <span className="badge teal">
                      {intakeResult.summary.active_medications?.length || 0} active
                    </span>
                  }
                >
                  {intakeResult.summary.active_medications &&
                  intakeResult.summary.active_medications.length > 0 ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {intakeResult.summary.active_medications.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            padding: '12px 14px',
                            background: '#fcfdfd',
                            border: '1px solid #e7edf5',
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 12
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="icon-box teal" style={{ width: 30, height: 30 }}>
                                <Pill size={15} />
                              </span>
                              <strong style={{ fontSize: 13 }}>{m.name}</strong>
                            </div>
                            <p
                              className="muted small-text"
                              style={{ marginTop: 6, paddingLeft: 38 }}
                            >
                              {m.detail}
                            </p>
                          </div>
                          <span className="badge" style={{ fontSize: 11 }}>
                            <Clock size={11} />
                            {m.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted small-text">No active medications recorded.</p>
                  )}
                </Panel>

                <Panel title="Recent clinical documents" sub="Stored health records">
                  {intakeResult.summary.recent_documents &&
                  intakeResult.summary.recent_documents.length > 0 ? (
                    <div className="stack" style={{ gap: 8 }}>
                      {intakeResult.summary.recent_documents.map((doc, idx) => (
                        <div className="list-item" key={doc.id || idx}>
                          <span className="icon-box blue" style={{ width: 34, height: 34 }}>
                            <FileText size={16} />
                          </span>
                          <div>
                            <strong>{doc.name}</strong>
                            <small>{doc.kind || 'Medical Record'}</small>
                          </div>
                          <a
                            href="/doctor#documents"
                            className="btn secondary"
                            style={{ fontSize: 11, minHeight: 30, padding: '5px 11px' }}
                          >
                            Review <ExternalLink size={12} />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted small-text">No prior documents found.</p>
                  )}
                </Panel>

                {intakeResult.summary.clinical_notes &&
                  intakeResult.summary.clinical_notes.length > 0 && (
                    <Panel title="Recent clinical notes" sub="Previous consultations">
                      <div className="stack" style={{ gap: 12 }}>
                        {intakeResult.summary.clinical_notes.map((note, idx) => (
                          <div
                            key={note.id || idx}
                            style={{
                              padding: '14px 16px',
                              background: '#f8faff',
                              border: '1px solid #e5edf7',
                              borderRadius: 10
                            }}
                          >
                            <div className="row" style={{ marginBottom: 6 }}>
                              <strong style={{ fontSize: 13 }}>{note.title}</strong>
                              <span className="tiny muted">{note.date}</span>
                            </div>
                            <p
                              className="muted small-text"
                              style={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}
                            >
                              {note.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  )}
              </div>
            </div>
          </div>
        ) : activeToken ? (
          /* STATE 4: TOKEN PRESENT — PREVIEW & MANDATORY CONSENT DECLARATION */
          <div style={{ maxWidth: 660, margin: '10px auto' }}>
            <Heading
              eyebrow="PASSPORT INTAKE HANDSHAKE"
              title="Verify Patient Quick-Pass"
              sub="Inspect cryptographic token details and confirm clinical consent to access care history."
            />

            {previewLoading ? (
              <Panel style={{ textAlign: 'center', padding: '50px 20px' }}>
                <RefreshCw
                  className="animate-spin"
                  style={{ margin: '0 auto 14px', color: '#245be8' }}
                  size={30}
                />
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>Verifying cryptographic signature</h3>
                <p className="muted small-text" style={{ marginTop: 6 }}>
                  Validating 15-minute token signature and decrypting header…
                </p>
              </Panel>
            ) : previewError ? (
              <Panel style={{ textAlign: 'center', padding: '40px 24px' }}>
                <span
                  className="icon-box pink"
                  style={{ width: 52, height: 52, margin: '0 auto 16px' }}
                >
                  <AlertTriangle size={26} />
                </span>
                <h3 style={{ fontSize: 19, fontWeight: 620, color: '#b72641' }}>
                  Invalid or Expired Quick-Pass
                </h3>
                <p
                  className="muted small-text"
                  style={{ maxWidth: 420, margin: '8px auto 20px', lineHeight: 1.8 }}
                >
                  {previewError}
                </p>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setActiveToken('');
                    setTokenInput('');
                    router.push('/scan');
                  }}
                >
                  Scan another pass
                </button>
              </Panel>
            ) : preview ? (
              <Panel
                title="Quick-Pass Verified"
                sub="Patient identity and token validity confirmed."
                action={
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={'badge ' + (preview.access_type === 'lifetime' ? 'green' : 'amber')} style={{ gap: 4 }}>
                      {preview.access_type === 'lifetime' ? <ShieldCheck size={12} /> : <Clock size={12} />}
                      {preview.access_type === 'lifetime' ? 'Lifetime Access' : 'Temporary (15 Min)'}
                    </span>
                    <span className={'badge ' + (preview.is_expired ? 'pink' : 'green')}>
                      {preview.is_expired ? 'Pass Expired' : preview.access_type === 'lifetime' ? 'Permanent Link' : 'Active Pass'}
                    </span>
                  </div>
                }
              >
                {/* Patient Summary Header */}
                <div
                  className="list-item"
                  style={{ border: 0, padding: '6px 0 20px', alignItems: 'center' }}
                >
                  <span
                    className="avatar large"
                    style={{ background: '#eaf1ff', color: '#2961df', fontSize: 20 }}
                  >
                    {preview.patient_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div style={{ flex: 1, marginLeft: 16 }}>
                    <h3 style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.5px' }}>
                      {preview.patient_name}
                    </h3>
                    <p className="muted small-text" style={{ marginTop: 2 }}>
                      {preview.patient_email}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="tiny muted" style={{ display: 'block' }}>
                      Blood group
                    </span>
                    <strong style={{ fontSize: 20, color: '#c45275', letterSpacing: '-0.5px' }}>
                      {preview.blood_group || 'O+'}
                    </strong>
                  </div>
                </div>

                {/* Access Type Notification Banner */}
                <div
                  style={{
                    background: preview.access_type === 'lifetime' ? '#ecfdf5' : '#fffbeb',
                    border: `1px solid ${preview.access_type === 'lifetime' ? '#a7f3d0' : '#fde68a'}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginBottom: 18,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12
                  }}
                >
                  <span
                    className={'icon-box ' + (preview.access_type === 'lifetime' ? 'teal' : 'amber')}
                    style={{ width: 32, height: 32, flexShrink: 0, marginTop: 2 }}
                  >
                    {preview.access_type === 'lifetime' ? <ShieldCheck size={16} /> : <Clock size={16} />}
                  </span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong
                        style={{
                          fontSize: 13,
                          color: preview.access_type === 'lifetime' ? '#065f46' : '#92400e'
                        }}
                      >
                        {preview.access_type === 'lifetime'
                          ? 'Patient Authorized Lifetime Care Access'
                          : 'Temporary Emergency Access (15-Minute TTL)'}
                      </strong>
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        lineHeight: 1.6,
                        margin: '4px 0 0',
                        color: preview.access_type === 'lifetime' ? '#047857' : '#b45309'
                      }}
                    >
                      {preview.access_type === 'lifetime'
                        ? 'Upon intake, this patient will be permanently added to your patient registry with their full medical history, and Dr. Sarah Khan will be listed in their connected care circle.'
                        : 'Access will grant a 15-minute emergency review session without adding the patient to your permanent registry.'}
                    </p>
                  </div>
                </div>

                {/* Metric Summary Cards */}
                <div
                  className="metrics"
                  style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}
                >
                  <Metric
                    label="Allergies"
                    value={preview.allergies_count ?? 'Not verified'}
                    sub="Confirm allergy history with the patient"
                    icon={AlertTriangle}
                    color="amber"
                  />
                  <Metric
                    label="Prescriptions"
                    value={preview.medications_count}
                    sub="Active regimens"
                    icon={Pill}
                    color="teal"
                  />
                  <Metric
                    label="Documents"
                    value={preview.documents_count}
                    sub="Care records"
                    icon={FileText}
                    color="blue"
                  />
                </div>

                {/* Mandatory Consent Declaration Card */}
                <div
                  style={{
                    background: '#f8faff',
                    border: '1px solid #dce8fc',
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 22
                  }}
                >
                  <div className="row" style={{ marginBottom: 14 }}>
                    <span className="badge" style={{ background: '#eaf1ff', color: '#245be8' }}>
                      <Lock size={12} />
                      MANDATORY CLINICAL CONSENT DECLARATION
                    </span>
                    <span className="tiny muted">Audit Logged</span>
                  </div>

                  <label style={{ fontSize: 13, marginBottom: 14 }}>
                    Clinical Encounter Purpose
                    <div style={{ marginTop: 7 }}>
                      <Select value={reason} onValueChange={setReason}>
                        <SelectTrigger
                          aria-label="Clinical encounter purpose"
                          style={{ background: '#fff' }}
                        >
                          <SelectValue placeholder="Select purpose" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Emergency Medical Review">
                            Emergency Medical Review
                          </SelectItem>
                          <SelectItem value="Outpatient Consultation">
                            Outpatient Consultation
                          </SelectItem>
                          <SelectItem value="Inpatient Admission">
                            Inpatient Admission
                          </SelectItem>
                          <SelectItem value="Medication Reconciliation">
                            Medication Reconciliation
                          </SelectItem>
                          <SelectItem value="Clinical Referral & Triage">
                            Clinical Referral & Triage
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </label>

                  <div className="checkbox-line" style={{ alignItems: 'flex-start', paddingTop: 10 }}>
                    <Checkbox
                      id="consent-declaration"
                      checked={consentConfirmed}
                      onCheckedChange={(v) => setConsentConfirmed(!!v)}
                      style={{ marginTop: 3 }}
                    />
                    <label
                      htmlFor="consent-declaration"
                      style={{
                        fontSize: 12,
                        lineHeight: 1.7,
                        color: '#475e7d',
                        cursor: 'pointer',
                        fontWeight: 450
                      }}
                    >
                      {preview.access_type === 'lifetime' ? (
                        <>
                          I declare under clinical duty of care that I am establishing a permanent medical
                          care relationship with this patient. Upon intake, this patient will be permanently added
                          to my patient registry, and their full medical record will be accessible. I confirm
                          patient authorization has been granted.
                        </>
                      ) : (
                        <>
                          I declare under clinical duty of care that I am providing direct medical
                          care / emergency evaluation to this patient, and confirm patient consent has been
                          obtained. I understand this emergency intake will be recorded in the patient&apos;s
                          permanent audit log.
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* Handshake Submission Action */}
                <div className="stack" style={{ gap: 10 }}>
                  <button
                    className="btn primary full large"
                    disabled={!consentConfirmed || intaking || preview.is_expired}
                    onClick={() => void handleIntake()}
                  >
                    {intaking ? (
                      <>
                        <RefreshCw className="animate-spin" size={16} />
                        {preview.access_type === 'lifetime'
                          ? 'Establishing Permanent Care Connection…'
                          : 'Verifying Signature & Granting Care Access…'}
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        {preview.access_type === 'lifetime'
                          ? 'Accept Lifetime Care & Unlock Full Record'
                          : 'Authorize & Unlock Medical Summary'}
                      </>
                    )}
                  </button>

                  <div className="row" style={{ gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ fontSize: 12, height: 38, flex: 1, gap: 6 }}
                      onClick={() => {
                        setActiveToken('');
                        setTokenInput('');
                        router.push('/scan');
                      }}
                    >
                      <Camera size={14} /> Scan with Camera
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ fontSize: 12, height: 38, flex: 1 }}
                      onClick={() => {
                        setActiveToken('');
                        setTokenInput('');
                        router.push('/scan');
                      }}
                    >
                      Cancel Scan
                    </button>
                  </div>
                </div>
              </Panel>
            ) : null}
          </div>
        ) : (
          /* STATE 5: NO TOKEN — SCANNER INTERFACE & TOKEN SEARCH */
          <div style={{ maxWidth: 640, margin: '20px auto' }}>
            <Heading
              eyebrow="CLINICIAN SCANNER READY"
              title="Scan Patient Quick-Pass"
              sub="Ask the patient to open their Medora app and present their Emergency Pass, or scan directly with your camera below."
            />

            {/* Real Camera Scanner with Allowance Request & Real-time Decoding */}
            <CameraScanner onScan={handleCameraScan} />

            <Panel title="Or enter pass token manually" sub="Instant cryptographic intake">
              <form onSubmit={handleInspectToken} style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13 }}>
                  Quick-Pass Token or Scanner URL
                  <div style={{ position: 'relative', marginTop: 8 }}>
                    <input
                      type="text"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="Paste token or /scan?token=..."
                      style={{
                        paddingLeft: 40,
                        fontSize: 13,
                        fontFamily: 'monospace',
                        minHeight: 44
                      }}
                    />
                    <Search
                      size={17}
                      style={{
                        position: 'absolute',
                        left: 13,
                        top: 14,
                        color: '#8b9bb2',
                        pointerEvents: 'none'
                      }}
                    />
                  </div>
                </label>

                <div className="row" style={{ marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="submit"
                    className="btn primary"
                    style={{ flex: 1.2, minHeight: 43 }}
                  >
                    <Search size={15} /> Inspect Pass
                  </button>

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => void handleLoadDemoPass('temporary')}
                    style={{ flex: 1, minHeight: 43 }}
                    title="Load 15-minute emergency demo pass"
                  >
                    <Clock size={15} /> Demo Temporary Pass
                  </button>

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => void handleLoadDemoPass('lifetime')}
                    style={{ flex: 1, minHeight: 43, borderColor: '#168b77', color: '#168b77' }}
                    title="Load permanent lifetime connection demo pass"
                  >
                    <ShieldCheck size={15} /> Demo Lifetime Pass
                  </button>
                </div>
              </form>

              <SampleNote>
                <div>
                  <strong>How Patient Quick-Pass works:</strong>
                  <p style={{ margin: '5px 0 0', lineHeight: 1.75 }}>
                    1. Patient taps <strong>Emergency Pass</strong> in their Medora workspace.
                    <br />
                    2. A 15-minute cryptographically signed QR code is generated.
                    <br />
                    3. Attending clinician allows camera access and scans the patient pass.
                    <br />
                    4. The complete one-shot medical summary unlocks with audit log tracking.
                  </p>
                </div>
              </SampleNote>
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div
          className="app-main"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f7f9fc'
          }}
        >
          <RefreshCw className="animate-spin" size={32} style={{ color: '#245be8' }} />
        </div>
      }
    >
      <ScannerContent />
    </Suspense>
  );
}
