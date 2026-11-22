'use client';

import { useState, useEffect, type FormEvent } from 'react';
import {
  HeartPulse,
  Stethoscope,
  Building2,
  Eye,
  EyeOff,
  Check,
  ShieldCheck,
  Sparkles,
  ChevronLeft,
  Copy,
  ArrowRight,
  KeyRound,
  Mail,
  UserCheck,
  type LucideIcon
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast, Toaster } from 'sonner';
import { Brand } from './landing';
import {
  accounts,
  password,
  startSession,
  type Role,
  seed,
  dateOffset
} from '@/lib/medora-demo';
import { API_MODE, api } from '@/lib/medora-api';

interface CredentialPreset {
  role: Role;
  title: string;
  name: string;
  roleBadge: string;
  email: string;
  pass: string;
  icon: LucideIcon;
  themeColor: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}

const ROLES: [Role, string, LucideIcon][] = [
  ['patient', 'Patient', HeartPulse],
  ['doctor', 'Doctor', Stethoscope],
  ['hospital', 'Hospital', Building2]
];

const PRESETS: CredentialPreset[] = [
  {
    role: 'doctor',
    title: 'Doctor / Clinician',
    name: accounts.doctor.name,
    roleBadge: 'Attending Clinician',
    email: accounts.doctor.email,
    pass: password,
    icon: Stethoscope,
    themeColor: '#0d9488',
    badgeBg: '#ccfbf1',
    badgeText: '#0f766e',
    description: 'Access patient records, consultations, clinical notes & emergency quick-pass intake.'
  },
  {
    role: 'hospital',
    title: 'Hospital Coordinator',
    name: accounts.hospital.name,
    roleBadge: 'Care Operations',
    email: accounts.hospital.email,
    pass: password,
    icon: Building2,
    themeColor: '#2563eb',
    badgeBg: '#dbeafe',
    badgeText: '#1d4ed8',
    description: 'Manage clinic capacity, waiting lists, department triage & referrals.'
  },
  {
    role: 'patient',
    title: 'Patient Portal',
    name: accounts.patient.name,
    roleBadge: 'Care Record Holder',
    email: accounts.patient.email,
    pass: password,
    icon: HeartPulse,
    themeColor: '#7c3aed',
    badgeBg: '#ede9fe',
    badgeText: '#6d28d9',
    description: 'View personal timeline, medical documents, appointments & emergency passes.'
  }
];

export function Login() {
  const [role, setRole] = useState<Role>('patient');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [signUp, setSignUp] = useState(false);
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demoAllowed, setDemoAllowed] = useState(true);
  const [notice, setNotice] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('role');
    const auto = params.get('auto');
    const targetRole: Role = (r === 'doctor' || r === 'hospital' || r === 'patient') ? r : 'patient';
    if (r === 'doctor' || r === 'hospital' || r === 'patient') {
      setRole(targetRole);
    }
    if (auto === 'true' || auto === '1') {
      void enterDemoForRole(targetRole);
    }
    if (API_MODE) {
      void api
        .capabilities()
        .then((c) => {
          if (typeof c.demo_accounts === 'boolean') {
            setDemoAllowed(c.demo_accounts);
          }
        })
        .catch(() => {});
    }
  }, []);

  const getRedirect = (defaultRole: string) => {
    try {
      const r = new URLSearchParams(window.location.search).get('redirect');
      return r && r.startsWith('/') ? r : '/' + defaultRole;
    } catch {
      return '/' + defaultRole;
    }
  };

  const copyText = (text: string, label: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`Copied ${label} to clipboard`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const applyPreset = (preset: CredentialPreset, autoFocus = true) => {
    setRole(preset.role);
    setEmail(preset.email);
    setPass(preset.pass);
    setError('');
    setNotice('');
    setSignUp(false);
    toast.success(`Loaded credentials for ${preset.name} (${preset.title})`);
  };

  const enterDemoForRole = async (targetRole: Role) => {
    setBusy(true);
    setError('');
    setNotice('');
    setRole(targetRole);
    setEmail(accounts[targetRole].email);
    setPass(password);

    try {
      if (API_MODE) {
        const { user } = await api.login(accounts[targetRole].email, password);
        window.location.assign(getRedirect(user.role));
      } else {
        startSession(targetRole);
        const r = new URLSearchParams(window.location.search).get('redirect');
        if (r && r.startsWith('/')) window.location.assign(r);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setBusy(false);
    }
  };

  const enterDemo = async () => {
    await enterDemoForRole(role);
  };

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (signUp && !consent) {
      setError('Please confirm your consent to create an account.');
      return;
    }

    if (API_MODE && signUp && role !== 'patient') {
      setError(
        'Doctor and hospital accounts must be provisioned by an administrator. Contact your organisation.'
      );
      return;
    }

    setBusy(true);
    try {
      if (API_MODE) {
        if (signUp) {
          const result = await api.signup(email, pass, name, consent);
          if (result.requires_confirmation || !result.user) {
            setNotice('Check your email to confirm your account, then sign in.');
            setSignUp(false);
            setBusy(false);
            return;
          }
          window.location.assign(getRedirect(result.user.role));
        } else {
          const { user } = await api.login(email, pass);
          window.location.assign(getRedirect(user.role));
        }
      } else {
        if (signUp) {
          const base = seed();
          const initials = name
            .split(' ')
            .map((x) => x[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          const data =
            role === 'patient'
              ? {
                  ...base,
                  team: {},
                  access: [],
                  appointments: [],
                  medicines: [],
                  documents: [],
                  notes: [],
                  family: [],
                  messages: [],
                  tasks: [
                    {
                      id: 't1',
                      title: 'Complete your health profile',
                      detail: 'Add your care details and emergency contact.',
                      done: false,
                      date: dateOffset(0)
                    }
                  ],
                  patients: [
                    {
                      id: 'p1',
                      name,
                      age: 0,
                      initials,
                      condition: 'New Patient Record',
                      lastVisit: dateOffset(0),
                      email,
                      risk: 'Low'
                    }
                  ],
                  audit: [
                    {
                      id: Math.random().toString(36).slice(2, 10),
                      title: 'Medora care account created for ' + name,
                      time: 'Just now'
                    }
                  ],
                  settings: { ...base.settings, name, location: 'London, UK' }
                }
              : {
                  ...base,
                  team: {},
                  access: [],
                  patients: [],
                  appointments: [],
                  notes: [],
                  messages: [],
                  audit: [
                    {
                      id: Math.random().toString(36).slice(2, 10),
                      title: 'Clinical workspace initialized for ' + name,
                      time: 'Just now'
                    }
                  ],
                  settings: { ...base.settings, name }
                };
          localStorage.setItem('medora-demo-v1', JSON.stringify(data));
        } else if (
          email.toLowerCase().trim() !== accounts[role].email ||
          pass !== password
        ) {
          setError('Use the demo credentials below for this workspace.');
          setBusy(false);
          return;
        }
        startSession(role);
        const r = new URLSearchParams(window.location.search).get('redirect');
        if (r && r.startsWith('/')) window.location.assign(r);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.');
      setBusy(false);
    }
  };

  const currentPreset = PRESETS.find((p) => p.role === role) || PRESETS[0];

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="login-page">
        {/* Left Visual Column */}
        <div className="login-visual">
          <Brand />
          <div className="login-story">
            <span className="eyebrow">YOUR HEALTHCARE, CONNECTED.</span>
            <h1>
              A little clarity.
              <br />
              A lot more
              <br />
              <span>peace of mind.</span>
            </h1>
            <p>
              One thoughtful place for you
              <br />
              and the people who care for you.
            </p>
            <div className="login-story-card">
              <span className="icon-box">
                <HeartPulse />
              </span>
              <div>
                <strong>Care is a journey.</strong>
                <small>You don’t have to navigate it alone.</small>
              </div>
            </div>
            <div className="login-story-checks">
              <span>
                <Check size={16} />
                Your care in one place
              </span>
              <span>
                <Check size={16} />
                A space for every care team
              </span>
              <span>
                <Check size={16} />
                Designed around people
              </span>
            </div>
          </div>
          <span className="login-bottom">Built for London. Designed for everyone.</span>
          <img
            className="login-skyline"
            src="/london-panorama.webp"
            alt="London skyline"
          />
        </div>

        {/* Right Form Area */}
        <main className="login-form-area" style={{ overflowY: 'auto' }}>
          <a className="back-link" href="/">
            <ChevronLeft size={16} />
            Back to Medora
          </a>

          <div className="login-form-card" style={{ maxWidth: 520, margin: '24px auto' }}>
            <span className="badge">
              <Sparkles size={13} />
              {API_MODE ? 'YOUR SECURE WORKSPACE' : 'FRONTEND DEMO'}
            </span>
            <h1>{signUp ? 'Find your space.' : 'Welcome back.'}</h1>
            <p className="muted">
              {signUp
                ? API_MODE
                  ? 'Create your personal care account.'
                  : 'Set up a local demo profile.'
                : 'Choose your workspace and step inside.'}
            </p>

            {/* Role Switcher Tabs */}
            <Tabs
              value={role}
              onValueChange={(r) => {
                setRole(r as Role);
                setEmail('');
                setPass('');
                setError('');
                setNotice('');
              }}
            >
              <TabsList className="login-role-tabs">
                {ROLES.map(([id, label, Icon]) => (
                  <TabsTrigger key={id} value={id}>
                    <Icon size={17} />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Active Role Quick Auto-Fill Hint */}
            {!signUp && demoAllowed && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 13px',
                  borderRadius: 10,
                  backgroundColor: currentPreset.badgeBg,
                  border: `1px solid ${currentPreset.badgeBg}`,
                  marginBottom: 16,
                  fontSize: 12,
                  color: currentPreset.badgeText
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 500 }}>
                  <currentPreset.icon size={15} style={{ color: currentPreset.themeColor }} />
                  <span>
                    Demo {currentPreset.title}:{' '}
                    <strong style={{ fontFamily: 'monospace' }}>{currentPreset.email}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => applyPreset(currentPreset)}
                  style={{
                    background: 'white',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: currentPreset.badgeText,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  Auto-Fill
                </button>
              </div>
            )}

            {/* Main Login / Signup Form */}
            <form onSubmit={login} suppressHydrationWarning>
              {signUp && (
                <label>
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="Your full name"
                    autoComplete="name"
                    suppressHydrationWarning
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                  placeholder={accounts[role].email}
                  autoComplete="username"
                  suppressHydrationWarning
                />
              </label>

              <label>
                Password
                <div className="password-input">
                  <input
                    type={show ? 'text' : 'password'}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    required
                    minLength={signUp ? 12 : 8}
                    maxLength={128}
                    placeholder="Enter your password"
                    autoComplete={signUp ? 'new-password' : 'current-password'}
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    aria-label={show ? 'Hide password' : 'Show password'}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              {signUp && (
                <div className="checkbox-line">
                  <Checkbox
                    id="account-consent"
                    checked={consent}
                    onCheckedChange={(v) => setConsent(!!v)}
                  />
                  <label htmlFor="account-consent">
                    {API_MODE
                      ? 'I consent to creating my Medora account and storing records I choose to add.'
                      : 'I understand this creates a sample profile in this browser.'}
                  </label>
                </div>
              )}

              {notice && (
                <p className="sample-note" role="status">
                  {notice}
                </p>
              )}

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}

              <button className="btn primary full large" disabled={busy} style={{ minHeight: 46 }}>
                {busy
                  ? 'Signing in…'
                  : signUp
                    ? API_MODE
                      ? 'Create account'
                      : 'Create demo profile'
                    : `Log in to ${role} workspace`}
              </button>
            </form>

            {/* DEMO CREDENTIALS SECTION FOR DOCTOR, HOSPITAL & PATIENT */}
            {demoAllowed && (
              <div
                style={{
                  marginTop: 28,
                  padding: 18,
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <ShieldCheck size={18} style={{ color: '#0d9488' }} />
                    <strong style={{ fontSize: 13, color: '#1e293b' }}>
                      Workspace Demo Credentials
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      backgroundColor: '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: 12,
                      color: '#64748b',
                      fontWeight: 500
                    }}
                  >
                    Click to load & enter
                  </span>
                </div>

                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                  Select or fill credentials below for clinical, hospital operations, or patient access:
                </p>

                {/* Grid of Preset Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PRESETS.map((preset) => {
                    const isSelected = role === preset.role;
                    const IconComp = preset.icon;

                    return (
                      <div
                        key={preset.role}
                        style={{
                          border: isSelected
                            ? `2px solid ${preset.themeColor}`
                            : '1px solid #e2e8f0',
                          borderRadius: 10,
                          backgroundColor: isSelected ? 'white' : '#ffffff',
                          padding: '12px 14px',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected
                            ? `0 2px 8px ${preset.themeColor}22`
                            : '0 1px 2px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 8
                          }}
                        >
                          {/* Role Icon & Title */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: preset.badgeBg,
                                color: preset.themeColor
                              }}
                            >
                              <IconComp size={18} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ fontSize: 13, color: '#0f172a' }}>
                                  {preset.title}
                                </strong>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    backgroundColor: preset.badgeBg,
                                    color: preset.badgeText
                                  }}
                                >
                                  {preset.roleBadge}
                                </span>
                              </div>
                              <span style={{ fontSize: 11, color: '#64748b' }}>
                                {preset.name}
                              </span>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => applyPreset(preset)}
                              style={{
                                border: '1px solid #cbd5e1',
                                background: isSelected ? '#f1f5f9' : 'white',
                                color: '#334155',
                                padding: '5px 10px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Populate email and password into form"
                            >
                              <UserCheck size={13} /> Fill
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void enterDemoForRole(preset.role)}
                              style={{
                                border: 'none',
                                background: preset.themeColor,
                                color: 'white',
                                padding: '5px 10px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                              }}
                              title={`Directly sign in to ${preset.title}`}
                            >
                              <span>Enter</span>
                              <ArrowRight size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Credential Data Lines */}
                        <div
                          style={{
                            marginTop: 10,
                            paddingTop: 8,
                            borderTop: '1px dashed #e2e8f0',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 14,
                            fontSize: 11
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Mail size={12} style={{ color: '#94a3b8' }} />
                            <span style={{ color: '#64748b' }}>Email:</span>
                            <code
                              style={{
                                color: '#0f172a',
                                fontWeight: 600,
                                backgroundColor: '#f1f5f9',
                                padding: '1px 5px',
                                borderRadius: 4
                              }}
                            >
                              {preset.email}
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(preset.email, `${preset.title} Email`, `${preset.role}-email`)
                              }
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: 2,
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Copy email"
                            >
                              {copiedKey === `${preset.role}-email` ? (
                                <Check size={12} style={{ color: '#10b981' }} />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <KeyRound size={12} style={{ color: '#94a3b8' }} />
                            <span style={{ color: '#64748b' }}>Pass:</span>
                            <code
                              style={{
                                color: '#0f172a',
                                fontWeight: 600,
                                backgroundColor: '#f1f5f9',
                                padding: '1px 5px',
                                borderRadius: 4
                              }}
                            >
                              {preset.pass}
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(preset.pass, 'Password', `${preset.role}-pass`)
                              }
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: 2,
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Copy password"
                            >
                              {copiedKey === `${preset.role}-pass` ? (
                                <Check size={12} style={{ color: '#10b981' }} />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 12,
                    fontSize: 11,
                    color: '#64748b'
                  }}
                >
                  <span>Common Password: <strong style={{ color: '#0f172a' }}>{password}</strong></span>
                  <span>Full HIPAA / NHS mock datasets included</span>
                </div>
              </div>
            )}

            {/* Account Toggle */}
            <p className="login-toggle" style={{ marginTop: 22 }}>
              {signUp ? 'Already have an account?' : 'New to Medora?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setSignUp(!signUp);
                  setError('');
                  setNotice('');
                }}
              >
                {signUp ? 'Log in' : 'Create account'}
              </button>
            </p>

            <p className="login-disclaimer">
              {API_MODE
                ? 'Access is checked by the server. Doctor and hospital roles require administrator provisioning.'
                : 'Sample data and scripted AI. No real bookings or healthcare connections.'}
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
