'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  UserX,
  Stethoscope,
  Info,
  Building2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { api, API_MODE } from '@/lib/medora-api';
import { AppContext } from './shared';

interface DisconnectDoctorModalProps {
  ctx: AppContext;
  open: boolean;
  doctor: {
    id: string;
    name: string;
    email?: string;
    specialty?: string;
    provider?: string;
  } | null;
  onClose: () => void;
  onSuccess?: (doc: any, reason: string) => void;
}

export function DisconnectDoctorModal({
  ctx,
  open,
  doctor,
  onClose,
  onSuccess
}: DisconnectDoctorModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState<string>('Completed treatment / Care transferred');
  const [confirmPhrase, setConfirmPhrase] = useState<string>('');
  const [consentContinuity, setConsentContinuity] = useState(false);
  const [consentRevoke, setConsentRevoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!doctor) return null;

  const docName = doctor.name || 'Attending Clinician';
  const docEmail = doctor.email || '';
  const docSpecialty = doctor.specialty || 'General practice';
  const docProvider = doctor.provider || 'Medora Care Network';

  const resetForm = () => {
    setStep(1);
    setReason('Completed treatment / Care transferred');
    setConfirmPhrase('');
    setConsentContinuity(false);
    setConsentRevoke(false);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmPhrase.trim().toUpperCase() !== 'DISCONNECT') {
      setError('Please type DISCONNECT exactly to confirm.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleFinalRevoke = async () => {
    if (!consentContinuity || !consentRevoke) {
      setError('Please check and confirm both mandatory consent declarations.');
      return;
    }

    setBusy(true);
    setError('');
    const targetDoc = { ...doctor };
    const selectedReason = reason;

    try {
      if (API_MODE) {
        // Revoke only the canonical recipient supplied by the server.
        await api.disconnectDoctor(doctor.id || docEmail, selectedReason, 'DISCONNECT', true);
      } else {
        // Local demo update
        ctx.update((d) => {
          const newTeam = { ...d.team, [docName]: false };
          const newAccess = d.access.map((a) =>
            a.name === docName || a.id === doctor.id ? { ...a, active: false, scope: `Revoked: ${selectedReason}` } : a
          );
          const newPatients = d.patients.map((p) =>
            p.id === 'p1' ? { ...p, condition: `General health review (Doctor disconnected)` } : p
          );
          const newAudit = [
            {
              id: Math.random().toString(36).slice(2, 10),
              title: `Permanently disconnected ${docName} · Reason: ${selectedReason}`,
              time: 'Just now'
            },
            ...d.audit
          ];
          return {
            ...d,
            team: newTeam,
            access: newAccess,
            patients: newPatients,
            audit: newAudit
          };
        });
      }

      toast.success(`${docName} has been disconnected. Current record access has been revoked.`);
      handleClose();
      onSuccess?.(targetDoc, selectedReason);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Disconnection failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="modal-box" style={{ maxWidth: 560, padding: 28, background: 'var(--card)', color: 'var(--card-foreground)', border: '1px solid var(--border)' }}>
        <DialogHeader>
          <div className="row flex-start" style={{ gap: 8, marginBottom: 6 }}>
            <span className="badge pink" style={{ gap: 5 }}>
              <ShieldAlert size={13} />
              2-Step Security Protocol
            </span>
            <span className="badge" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
              Step {step} of 2
            </span>
          </div>
          <DialogTitle style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.5px' }}>
            {step === 1 ? 'Disconnect Doctor & Revoke Access' : 'Confirm Patient Consent & Waiver'}
          </DialogTitle>
          <DialogDescription style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--muted-foreground)' }}>
            {step === 1
              ? 'Security confirmation to permanently disconnect this clinician from your care circle.'
              : 'Mandatory patient legal consent declarations and care continuity acknowledgment.'}
          </DialogDescription>
        </DialogHeader>

        {/* Doctor Summary Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 14px',
            marginTop: 6
          }}
        >
          <span className="icon-box blue" style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0 }}>
            <Stethoscope size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 15, display: 'block', color: 'var(--foreground)' }}>{docName}</strong>
            <small className="muted" style={{ display: 'block', fontSize: 12, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {docSpecialty} · {docProvider}
            </small>
          </div>
          <span className="badge" style={{ fontSize: 11, background: 'var(--background)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
            {docEmail}
          </span>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#fff2f4',
              border: '1px solid #facbd1',
              color: '#b72641',
              fontSize: 12,
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          /* STEP 1: VERIFICATION & REASON */
          <form onSubmit={handleNextStep} className="stack" style={{ gap: 16, marginTop: 14 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(237, 170, 84, 0.12)',
                border: '1px solid rgba(237, 170, 84, 0.35)',
                color: '#956018',
                fontSize: 12,
                lineHeight: 1.6
              }}
            >
              <strong>Security Protection Notice:</strong>
              <p style={{ margin: '4px 0 0' }}>
                Disconnecting <strong>{docName}</strong> will immediately terminate their access to your medical
                records, active medications, test results, and Copilot consultations. This action will be recorded
                in your immutable compliance log.
              </p>
            </div>

            <label style={{ fontSize: 13, fontWeight: 550, color: 'var(--foreground)' }}>
              Primary Reason for Disconnection
              <div style={{ marginTop: 6 }}>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger style={{ background: 'var(--card)', minHeight: 42, borderColor: 'var(--border)' }}>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Completed treatment / Care transferred">
                      Completed treatment / Care transferred
                    </SelectItem>
                    <SelectItem value="Switching to another primary care physician">
                      Switching to another primary care physician
                    </SelectItem>
                    <SelectItem value="Personal privacy & record access preference">
                      Personal privacy & record access preference
                    </SelectItem>
                    <SelectItem value="Doctor-patient relationship concluded">
                      Doctor-patient relationship concluded
                    </SelectItem>
                    <SelectItem value="Emergency consultation period ended">
                      Emergency consultation period ended
                    </SelectItem>
                    <SelectItem value="Other personal or clinical reason">
                      Other personal or clinical reason
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </label>

            <label style={{ fontSize: 13, fontWeight: 550, color: 'var(--foreground)' }}>
              Security Confirmation Challenge
              <p className="muted small-text" style={{ margin: '4px 0 8px' }}>
                To prevent accidental removal, please type <strong style={{ color: '#b72641' }}>DISCONNECT</strong> in the field below:
              </p>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => {
                  setConfirmPhrase(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Type DISCONNECT"
                style={{
                  fontFamily: 'monospace',
                  letterSpacing: '1px',
                  fontWeight: 600,
                  fontSize: 13,
                  borderColor: confirmPhrase.trim().toUpperCase() === 'DISCONNECT' ? '#10b981' : undefined
                }}
                required
              />
            </label>

            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={confirmPhrase.trim().toUpperCase() !== 'DISCONNECT'}
                style={{ flex: 1, gap: 6 }}
              >
                Proceed to Consent & Waiver (Step 2)
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        ) : (
          /* STEP 2: MANDATORY CONSENT & WAIVER */
          <div className="stack" style={{ gap: 16, marginTop: 14 }}>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div className="row">
                <span className="badge blue" style={{ fontSize: 11, gap: 5 }}>
                  <Lock size={12} />
                  MANDATORY PATIENT CONSENT FORM
                </span>
                <span className="tiny muted">Audit Traceable</span>
              </div>

              {/* Consent 1 */}
              <div className="checkbox-line" style={{ alignItems: 'flex-start', paddingTop: 2 }}>
                <Checkbox
                  id="consent-continuity"
                  checked={consentContinuity}
                  onCheckedChange={(v) => {
                    setConsentContinuity(!!v);
                    if (error) setError('');
                  }}
                  style={{ marginTop: 3 }}
                />
                <label
                  htmlFor="consent-continuity"
                  style={{
                    fontSize: 12,
                    lineHeight: 1.65,
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    fontWeight: 450
                  }}
                >
                  <strong>Continuity of Care Acknowledgment:</strong> I understand that {docName} will no
                  longer be able to monitor my conditions, renew prescriptions, or review emergency summaries.
                  I confirm I am responsible for seeking follow-up medical care if needed.
                </label>
              </div>

              {/* Consent 2 */}
              <div className="checkbox-line" style={{ alignItems: 'flex-start', paddingTop: 2 }}>
                <Checkbox
                  id="consent-revoke"
                  checked={consentRevoke}
                  onCheckedChange={(v) => {
                    setConsentRevoke(!!v);
                    if (error) setError('');
                  }}
                  style={{ marginTop: 3 }}
                />
                <label
                  htmlFor="consent-revoke"
                  style={{
                    fontSize: 12,
                    lineHeight: 1.65,
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    fontWeight: 450
                  }}
                >
                  <strong>Formal Authorization Revocation:</strong> I formally provide my verified consent to
                  terminate all medical data sharing and disconnect {docName} from my Medora care network
                  immediately.
                </label>
              </div>
            </div>

            {/* Signature Box */}
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--card)',
                border: '1px dashed var(--border)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--muted-foreground)'
              }}
            >
              <div className="row">
                <span>
                  Digital Signature: <strong style={{ color: 'var(--foreground)' }}>{ctx.data.settings.name}</strong> (Patient)
                </span>
                <span className="tiny muted">Verified by Active Session</span>
              </div>
            </div>

            {/* Final Actions */}
            <div className="row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => setStep(1)}
                style={{ gap: 6 }}
              >
                <ArrowLeft size={14} /> Back to Step 1
              </button>

              <button
                type="button"
                className="btn danger"
                disabled={!consentContinuity || !consentRevoke || busy}
                onClick={() => void handleFinalRevoke()}
                style={{ flex: 1, minHeight: 42, background: 'var(--destructive)', borderColor: 'var(--destructive)', color: '#ffffff', gap: 6 }}
              >
                {busy ? (
                  'Revoking Access…'
                ) : (
                  <>
                    <UserX size={15} />
                    Confirm Disconnection & Revoke All Access
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
