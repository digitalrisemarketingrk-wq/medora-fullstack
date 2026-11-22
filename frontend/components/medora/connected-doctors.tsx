'use client';

import { useState, useEffect } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  ShieldAlert,
  CalendarDays,
  MessageSquare,
  UserX,
  Plus,
  QrCode,
  MapPin,
  Clock,
  HeartPulse,
  Pill,
  FileText,
  Lock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info,
  ExternalLink
} from 'lucide-react';
import { AppContext, Heading, EmptyState, Metric, Panel } from './shared';
import { providers } from '@/lib/medora-demo';
import { api, API_MODE, AccessList } from '@/lib/medora-api';
import { DisconnectDoctorModal } from './disconnect-doctor-modal';
import { toast } from 'sonner';

export interface DoctorInfo {
  id: string;
  name: string;
  email: string;
  specialty: string;
  provider: string;
  scope: string;
  active: boolean;
  isLifetime: boolean;
  revokedReason?: string;
}

export function ConnectedDoctorsView({ ctx }: { ctx: AppContext }) {
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorInfo | null>(null);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [accessList, setAccessList] = useState<AccessList | null>(null);
  const [accessError, setAccessError] = useState('');
  const [accessRevision, setAccessRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<'active' | 'revoked' | 'security'>('active');
  const [revokedLocally, setRevokedLocally] = useState<Map<string, { doc: DoctorInfo; reason: string }>>(new Map());

  // Load API grants if in API mode
  useEffect(() => {
    if (!API_MODE) return;
    let isMounted = true;
    void api.access().then((res) => {
      if (isMounted) setAccessList(res);
    }).catch(() => {if(isMounted)setAccessError('Your current care permissions could not be loaded. Retry before making access changes.');});
    return () => {
      isMounted = false;
    };
  }, [accessRevision]);

  const isRevokedCheck = (id: string, name: string, email?: string) => {
    if (revokedLocally.has(id)) return true;
    if (email && revokedLocally.has(email.toLowerCase())) return true;
    if (!API_MODE && name && revokedLocally.has(name.toLowerCase())) return true;
    if (!API_MODE && ctx.data.team?.[name] === false) return true;
    return false;
  };

  // 1. Strictly assemble list of ACTIVELY connected and REVOKED doctors
  const activeDoctors: DoctorInfo[] = [];
  const revokedDoctors: DoctorInfo[] = [];
  const seenIds = new Set<string>();

  // Helper to add doctor
  const registerDoc = (doc: DoctorInfo) => {
    const key = (doc.email || doc.id || doc.name).toLowerCase();
    if (seenIds.has(key)) return;
    seenIds.add(key);

    const revoked = isRevokedCheck(doc.id, doc.name, doc.email) || !doc.active || doc.scope.toLowerCase().includes('revoked');
    if (revoked) {
      const localInfo = revokedLocally.get(doc.id) || (doc.email ? revokedLocally.get(doc.email.toLowerCase()) : null) || revokedLocally.get(doc.name.toLowerCase());
      revokedDoctors.push({
        ...doc,
        active: false,
        revokedReason: localInfo?.reason || doc.revokedReason || doc.scope.replace(/^Revoked:\s*/i, '') || 'Revoked by patient'
      });
    } else {
      activeDoctors.push(doc);
    }
  };

  // Check entries in ctx.data.access
  for (const acc of API_MODE ? [] : ctx.data.access || []) {
    const isRev = !acc.active || acc.scope.toLowerCase().includes('revoked');
    registerDoc({
      id: acc.id,
      name: acc.name,
      email: acc.name.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@medora.demo',
      specialty: acc.name.startsWith('Dr ') ? 'Attending Clinician' : 'Care Provider',
      provider: 'Medora Care Network',
      scope: acc.scope,
      active: !isRev,
      isLifetime: acc.scope.toLowerCase().includes('lifetime') || acc.scope.toLowerCase().includes('permanently'),
      revokedReason: isRev ? acc.scope.replace(/^Revoked:\s*/i, '') : undefined
    });
  }

  // In API mode, check sent grants
  if (API_MODE && accessList?.sent) {
    for (const grant of accessList.sent) {
      registerDoc({
        id: grant.recipient_id,
        name: grant.name,
        email: grant.email,
        specialty: 'Attending Clinician',
        provider: 'Medora Care Network',
        scope: grant.scope === 'write' ? 'Read and write access' : 'View only access',
        active: true,
        isLifetime: false
      });
    }
  }

  // Also include any locally revoked doctors that weren't in access list
  revokedLocally.forEach(({ doc, reason }) => {
    const key = (doc.email || doc.id || doc.name).toLowerCase();
    if (!seenIds.has(key)) {
      seenIds.add(key);
      revokedDoctors.push({
        ...doc,
        active: false,
        revokedReason: reason
      });
    }
  });

  const handleOpenDisconnect = (doc: DoctorInfo) => {
    setSelectedDoctor(doc);
    setDisconnectModalOpen(true);
  };

  const handleDisconnectSuccess = (doc: DoctorInfo, reason: string) => {
    if (!doc) return;
    const safeDoc = { ...doc };
    const safeReason = reason || 'Completed treatment / Care transferred';

    // 1. Immediately record in local revoked state so it disappears instantly
    setRevokedLocally((prev) => {
      const next = new Map(prev);
      next.set(safeDoc.id, { doc: safeDoc, reason: safeReason });
      if (safeDoc.email) next.set(safeDoc.email.toLowerCase(), { doc: safeDoc, reason: safeReason });
      if (!API_MODE && safeDoc.name) next.set(safeDoc.name.toLowerCase(), { doc: safeDoc, reason: safeReason });
      return next;
    });

    // 2. Optimistic immediate state update on ctx.data
    if (!API_MODE) ctx.update((prev) => {
      const newTeam = { ...(prev.team || {}) };
      newTeam[safeDoc.name] = false;
      if (safeDoc.name.includes('Sharma') || safeDoc.name.includes('Sarah Khan')) {
        newTeam['Dr. Rajesh Sharma'] = false;
        newTeam['Dr Sarah Khan'] = false;
      }

      let found = false;
      const newAccess = (prev.access || []).map((a) => {
        if (a.name === safeDoc.name || a.id === safeDoc.id) {
          found = true;
          return { ...a, active: false, scope: `Revoked: ${safeReason}` };
        }
        return a;
      });

      if (!found) {
        newAccess.unshift({
          id: safeDoc.id || 'revoked_' + Date.now(),
          name: safeDoc.name,
          scope: `Revoked: ${safeReason}`,
          active: false
        });
      }

      return {
        ...prev,
        team: newTeam,
        access: newAccess,
        audit: [
          {
            id: Math.random().toString(36).slice(2, 10),
            title: `Permanently disconnected ${safeDoc.name} · Reason: ${safeReason}`,
            time: 'Just now'
          },
          ...(prev.audit || [])
        ]
      };
    });

    // 3. Refresh API mode grants and workspace
    if (API_MODE) {
      void api.access().then(setAccessList).catch(() => {});
      void ctx.reload?.();
    }
  };

  return (
    <>
      <Heading
        title="Your Connected Doctors."
        sub="Clinicians with current permission to access your medical history."
        eyebrow="PATIENT CARE CIRCLE"
      >
        <button
          className="btn secondary"
          onClick={() => ctx.open('qr-pass')}
          style={{ gap: 6, fontWeight: 550 }}
        >
          <QrCode size={15} /> Emergency Pass
        </button>
        <button
          className="btn primary"
          onClick={() => ctx.go('finder')}
          style={{ gap: 6, fontWeight: 550 }}
        >
          <Plus size={15} /> Find New Care
        </button>
      </Heading>
      {API_MODE&&!accessList&&!accessError&&<p role="status">Loading your current care permissions…</p>}
      {accessError&&<div className="notice" role="alert"><span>{accessError}</span><button className="btn secondary" onClick={()=>{setAccessError('');setAccessRevision(value=>value+1);}}>Retry</button></div>}

      {/* Hero Overview Metrics Bar */}
      <div className="metrics" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <Metric
          label="Active Connected Clinicians"
          value={activeDoctors.length}
          sub={activeDoctors.length === 1 ? '1 doctor in your care circle' : `${activeDoctors.length} doctors with record access`}
          icon={Stethoscope}
          color="teal"
        />
        <Metric
          label={API_MODE?'Write permissions':'Lifetime Permissions'}
          value={API_MODE?accessList?.sent.filter(grant=>grant.scope==='write').length||0:activeDoctors.filter((d) => d.isLifetime).length}
          sub={API_MODE?'Server-authorized access':'Continuous care authorization'}
          icon={ShieldCheck}
          color="blue"
        />
        <Metric
          label="Patient Revocation Security"
          value="2-Step"
          sub="Explicit confirmation required"
          icon={Lock}
          color="violet"
        />
      </div>

      {/* Interactive Tabs Header */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 14,
          marginBottom: 22,
          flexWrap: 'wrap'
        }}
      >
        <button
          className={`btn ${activeTab === 'active' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveTab('active')}
          style={{ fontSize: 13, gap: 6 }}
        >
          <Stethoscope size={14} />
          Active Care Circle ({activeDoctors.length})
        </button>

        <button
          className={`btn ${activeTab === 'revoked' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveTab('revoked')}
          style={{ fontSize: 13, gap: 6 }}
        >
          <RotateCcw size={14} />
          Revoked Access History ({revokedDoctors.length})
        </button>

        <button
          className={`btn ${activeTab === 'security' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveTab('security')}
          style={{ fontSize: 13, gap: 6 }}
        >
          <ShieldAlert size={14} />
          Security & Consent Guide
        </button>
      </div>

      {/* TAB 1: ACTIVE CARE CIRCLE */}
      {activeTab === 'active' && (
        <>
          {activeDoctors.length > 0 ? (
            <div className="stack" style={{ gap: 20 }}>
              {activeDoctors.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 24,
                    boxShadow: '0 4px 20px -4px rgba(36, 91, 232, 0.06)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Emerald Status Accent Bar */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #10b981 0%, #059669 50%, #3b82f6 100%)'
                    }}
                  />

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Clinician Profile */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ position: 'relative' }}>
                        <span
                          className="avatar large"
                          style={{
                            background: 'rgba(32, 169, 145, 0.12)',
                            color: '#158b77',
                            fontSize: 22,
                            fontWeight: 700,
                            width: 58,
                            height: 58,
                            border: '2px solid rgba(32, 169, 145, 0.25)'
                          }}
                        >
                          {doc.name.replace(/^Dr\s+/, '').slice(0, 2).toUpperCase()}
                        </span>
                        <span
                          style={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            background: '#10b981',
                            color: '#ffffff',
                            borderRadius: '50%',
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                          title="Verified Care Link"
                        >
                          <CheckCircle2 size={13} />
                        </span>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: 20, fontWeight: 650, margin: 0, color: 'var(--foreground)' }}>
                            {doc.name}
                          </h3>
                          <span
                            className="badge green"
                            style={{
                              gap: 5,
                              padding: '4px 10px',
                              fontWeight: 600,
                              fontSize: 12
                            }}
                          >
                            <ShieldCheck size={13} />
                            Permanently Connected
                          </span>
                          {doc.isLifetime && (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(36, 91, 232, 0.1)',
                                color: 'var(--primary)',
                                fontWeight: 600
                              }}
                            >
                              Lifetime Access
                            </span>
                          )}
                        </div>

                        <p
                          className="muted small-text"
                          style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Stethoscope size={13} style={{ color: '#10b981' }} /> {doc.specialty}
                          </span>
                          <span>•</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Building2 size={13} style={{ color: 'var(--primary)' }} /> {doc.provider}
                          </span>
                          <span>•</span>
                          <span>{doc.email}</span>
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        className="btn secondary"
                        style={{ fontSize: 12, height: 38, gap: 6, fontWeight: 550 }}
                        onClick={() => ctx.open('book', providers[0])}
                      >
                        <CalendarDays size={14} /> Book consultation
                      </button>

                      <button
                        className="btn secondary"
                        style={{ fontSize: 12, height: 38, gap: 6, fontWeight: 550 }}
                        onClick={() => ctx.open('compose', { name: doc.name })}
                      >
                        <MessageSquare size={14} /> Message
                      </button>

                      <button
                        className="btn danger"
                        style={{
                          fontSize: 12,
                          height: 38,
                          gap: 6,
                          fontWeight: 600
                        }}
                        onClick={() => handleOpenDisconnect(doc)}
                        title="Disconnect this clinician with 2-step security verification"
                      >
                        <UserX size={14} /> Disconnect doctor
                      </button>
                    </div>
                  </div>

                  {/* Permissions & Care Data Access Pills */}
                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 16,
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Active Permissions:
                      </span>
                      <span className="badge" style={{ fontSize: 11, background: 'var(--muted)', color: 'var(--foreground)' }}>
                        <FileText size={11} style={{ marginRight: 4, color: 'var(--primary)' }} />
                        Clinical Records & History
                      </span>
                      <span className="badge" style={{ fontSize: 11, background: 'var(--muted)', color: 'var(--foreground)' }}>
                        <Pill size={11} style={{ marginRight: 4, color: '#e11d48' }} />
                        Medications & Prescriptions
                      </span>
                      <span className="badge" style={{ fontSize: 11, background: 'var(--muted)', color: 'var(--foreground)' }}>
                        <HeartPulse size={11} style={{ marginRight: 4, color: '#10b981' }} />
                        Doctor Copilot Scribe
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted-foreground)' }}>
                      <Clock size={12} />
                      <span>Authorized via Emergency Quick-Pass</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                background: 'var(--card)',
                border: '1.5px dashed var(--border)',
                borderRadius: 18,
                padding: '48px 28px',
                textAlign: 'center',
                maxWidth: 680,
                margin: '10px auto'
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(36, 91, 232, 0.12) 0%, rgba(32, 169, 145, 0.12) 100%)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px',
                  boxShadow: '0 8px 16px -4px rgba(36, 91, 232, 0.15)'
                }}
              >
                <Stethoscope size={32} />
              </div>

              <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.4px' }}>
                No Connected Doctors Yet
              </h3>

              <p
                className="muted small-text"
                style={{
                  maxWidth: 480,
                  margin: '10px auto 26px',
                  lineHeight: 1.8,
                  fontSize: 13.5
                }}
              >
                When an attending clinician scans your <strong>Lifetime Quick-Pass</strong> and completes the intake handshake, they will be linked to your care circle and displayed here.
              </p>

              {/* 3 Step Visual Guide */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  marginBottom: 28,
                  textAlign: 'left'
                }}
              >
                <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>STEP 1</span>
                  <strong style={{ display: 'block', fontSize: 13, marginTop: 2, color: 'var(--foreground)' }}>Open Emergency Pass</strong>
                  <small className="muted" style={{ fontSize: 11 }}>Tap Emergency Pass in the top navigation bar</small>
                </div>
                <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>STEP 2</span>
                  <strong style={{ display: 'block', fontSize: 13, marginTop: 2, color: 'var(--foreground)' }}>Select Lifetime Access</strong>
                  <small className="muted" style={{ fontSize: 11 }}>Authorize continuous care for your attending GP</small>
                </div>
                <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6' }}>STEP 3</span>
                  <strong style={{ display: 'block', fontSize: 13, marginTop: 2, color: 'var(--foreground)' }}>Doctor Scans & Connects</strong>
                  <small className="muted" style={{ fontSize: 11 }}>Mutual care circle established securely</small>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn primary"
                  style={{ gap: 7, height: 42, padding: '0 20px', fontSize: 13 }}
                  onClick={() => ctx.open('qr-pass')}
                >
                  <QrCode size={16} /> Present Emergency Pass
                </button>
                <button
                  className="btn secondary"
                  style={{ gap: 7, height: 42, padding: '0 20px', fontSize: 13 }}
                  onClick={() => ctx.go('finder')}
                >
                  <MapPin size={16} /> Find Local Providers
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: REVOKED ACCESS HISTORY */}
      {activeTab === 'revoked' && (
        <div>
          {revokedDoctors.length > 0 ? (
            <div className="stack" style={{ gap: 14 }}>
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 10
                }}
              >
                <ShieldAlert size={20} style={{ color: 'var(--destructive)', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--foreground)', lineHeight: 1.6 }}>
                  <strong>Access Terminated:</strong> The following clinicians previously had access to your records. Their cryptographic permissions were revoked upon completion of the 2-step security verification.
                </p>
              </div>

              {revokedDoctors.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span
                      className="avatar"
                      style={{
                        background: 'var(--muted)',
                        color: 'var(--muted-foreground)',
                        fontWeight: 650
                      }}
                    >
                      {doc.name.replace(/^Dr\s+/, '').slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 16, color: 'var(--foreground)' }}>{doc.name}</strong>
                        <span
                          className="badge pink"
                          style={{
                            fontSize: 11
                          }}
                        >
                          Access Revoked
                        </span>
                      </div>
                      <p className="muted small-text" style={{ marginTop: 2 }}>
                        {doc.revokedReason ? `Reason: ${doc.revokedReason}` : 'Disconnected via 2-step confirmation'}
                      </p>
                    </div>
                  </div>

                  <button
                    className="btn secondary"
                    style={{ fontSize: 12, height: 36, gap: 6 }}
                    onClick={() => ctx.open('qr-pass')}
                  >
                    <RotateCcw size={13} /> Reconnect with Pass
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No Revoked Access Records"
              text="You have not disconnected any clinicians. All access revocations will be permanently recorded here for your audit trail."
            />
          )}
        </div>
      )}

      {/* TAB 3: SECURITY & LEGAL SAFEGUARDS */}
      {activeTab === 'security' && (
        <div style={{ maxWidth: 760 }}>
          <Panel title="Patient Data Sovereignty & Security">
            <div className="stack" style={{ gap: 16 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span className="icon-box teal" style={{ width: 38, height: 38, flexShrink: 0 }}>
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>Patient-Owned Access Tokens</strong>
                  <p className="muted small-text" style={{ marginTop: 3, lineHeight: 1.7 }}>
                    Only you hold the authority to grant care access. Quick-Pass tokens use HMAC-SHA256 signatures with distinct lifetime or 15-minute emergency time-to-live restrictions.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span className="icon-box pink" style={{ width: 38, height: 38, flexShrink: 0 }}>
                  <Lock size={20} />
                </span>
                <div>
                  <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>Mandatory 2-Step Revocation Challenge</strong>
                  <p className="muted small-text" style={{ marginTop: 3, lineHeight: 1.7 }}>
                    To eliminate accidental disconnection of your care team, disconnecting a doctor requires typed confirmation of <code>DISCONNECT</code> followed by mandatory legal continuity-of-care consent declarations and a digital signature.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span className="icon-box blue" style={{ width: 38, height: 38, flexShrink: 0 }}>
                  <FileText size={20} />
                </span>
                <div>
                  <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>Immutable Audit Logging</strong>
                  <p className="muted small-text" style={{ marginTop: 3, lineHeight: 1.7 }}>
                    Every intake, viewing session, and disconnection is permanently written to your personal timeline and audit repository, in compliance with healthcare data protection standards.
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* 2-Step Disconnect Doctor Modal */}
      <DisconnectDoctorModal
        ctx={ctx}
        open={disconnectModalOpen}
        doctor={selectedDoctor}
        onClose={() => {
          setDisconnectModalOpen(false);
          setSelectedDoctor(null);
        }}
        onSuccess={(doc, reason) => {
          handleDisconnectSuccess(doc, reason);
        }}
      />
    </>
  );
}
