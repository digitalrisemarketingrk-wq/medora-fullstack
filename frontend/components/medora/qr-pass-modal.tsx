'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  Clock,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  HeartPulse,
  Pill,
  Users,
  Info,
  CheckCircle2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, API_MODE, QRPass } from '@/lib/medora-api';
import { AppContext } from './shared';

interface QRPassModalProps {
  ctx: AppContext;
  open: boolean;
  onClose: () => void;
}

export function QRPassModal({ ctx, open, onClose }: QRPassModalProps) {
  const [accessType, setAccessType] = useState<'temporary' | 'lifetime'>('temporary');
  const [pass, setPass] = useState<QRPass | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [fetchError, setFetchError] = useState<string>('');

  const fetchPass = useCallback(async (typeToFetch = accessType) => {
    setLoading(true);
    setFetchError('');
    try {
      if (API_MODE) {
        const result = await api.generateQRPass(typeToFetch);
        setPass({ ...result, access_type: typeToFetch });
        if (typeToFetch === 'lifetime') {
          setSecondsRemaining(365 * 24 * 3600);
        } else {
          const rem = Math.max(0, Math.floor((result.expires_at * 1000 - Date.now()) / 1000));
          setSecondsRemaining(rem);
        }
      } else {
        // Pure local demo fallback
        const isLife = typeToFetch === 'lifetime';
        const mockExpires = Math.floor(Date.now() / 1000) + (isLife ? 365 * 24 * 3600 : 15 * 60);
        const mockToken = `demo_token_${ctx.data.settings.name.replace(/\s+/g, '_')}_${mockExpires}_${typeToFetch}`;
        const demoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#ffffff"/><rect x="10" y="10" width="30" height="30" fill="#0f172a"/><rect x="15" y="15" width="20" height="20" fill="#ffffff"/><rect x="20" y="20" width="10" height="10" fill="#0f172a"/><rect x="60" y="10" width="30" height="30" fill="#0f172a"/><rect x="65" y="15" width="20" height="20" fill="#ffffff"/><rect x="70" y="20" width="10" height="10" fill="#0f172a"/><rect x="10" y="60" width="30" height="30" fill="#0f172a"/><rect x="15" y="65" width="20" height="20" fill="#ffffff"/><rect x="20" y="70" width="10" height="10" fill="#0f172a"/><rect x="45" y="45" width="10" height="10" fill="#0f172a"/><rect x="65" y="65" width="20" height="20" fill="#0f172a"/></svg>`;
        const fallbackPass: QRPass = {
          token: mockToken,
          expires_at: mockExpires,
          scan_url: `/scan?token=${encodeURIComponent(mockToken)}`,
          qr_svg: demoSvg,
          patient_name: ctx.data.settings.name,
          access_type: typeToFetch,
        };
        setPass(fallbackPass);
        setSecondsRemaining(isLife ? 365 * 24 * 3600 : 15 * 60);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not generate QR Quick-Pass.';
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [ctx.data.settings.name, accessType]);

  const handleAccessTypeChange = (newType: 'temporary' | 'lifetime') => {
    if (newType === accessType) return;
    setAccessType(newType);
    void fetchPass(newType);
  };

  useEffect(() => {
    if (open) {
      void fetchPass(accessType);
    } else {
      setPass(null);
      setSecondsRemaining(0);
      setFetchError('');
    }
  }, [open, fetchPass, accessType]);

  useEffect(() => {
    if (!pass || accessType === 'lifetime') return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((pass.expires_at * 1000 - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [pass, accessType]);

  const copyLink = async () => {
    if (!pass) return;
    const fullUrl = `${window.location.origin}${pass.scan_url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success('Scanner link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(`Scanner link: ${fullUrl}`);
    }
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const isExpired = accessType === 'temporary' && secondsRemaining <= 0 && pass !== null;

  const bloodGroup = ctx.data.settings.blood || 'O+';
  const medsCount = ctx.data.medicines.length;
  const familyCount = ctx.data.family.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="modal-box" style={{ maxWidth: 580, padding: 30 }}>
        <DialogHeader>
          <div className="row flex-start" style={{ gap: 8, marginBottom: 4 }}>
            <span className={'badge ' + (accessType === 'lifetime' ? 'green' : 'amber')}>
              <ShieldCheck size={13} />
              {accessType === 'lifetime' ? 'Permanent Lifetime Grant' : 'Cryptographic Quick-Pass'}
            </span>
            <span className="badge">
              {accessType === 'lifetime' ? 'TTL: Lifetime' : 'TTL: 15 Minutes'}
            </span>
          </div>
          <DialogTitle style={{ fontSize: 23, fontWeight: 650, letterSpacing: '-0.5px' }}>
            Medical Access QR Pass
          </DialogTitle>
          <DialogDescription style={{ fontSize: 13, lineHeight: 1.75, color: '#8a9fbb' }}>
            Choose whether to grant single-session temporary access or connect permanently with your clinician.
          </DialogDescription>
        </DialogHeader>

        {/* Access Type Switcher */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => handleAccessTypeChange('temporary')}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              border: accessType === 'temporary' ? '2px solid #245be8' : '1px solid #dce5f2',
              background: accessType === 'temporary' ? '#f0f5ff' : '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 650, fontSize: 13, color: accessType === 'temporary' ? '#1847be' : '#22324b' }}>
                <Clock size={15} color={accessType === 'temporary' ? '#245be8' : '#738ba8'} />
                Temporary Access
              </span>
              <span className="badge amber" style={{ fontSize: 10, padding: '2px 6px' }}>15 Min</span>
            </div>
            <p style={{ fontSize: 11, color: '#68809f', margin: 0, lineHeight: 1.4 }}>
              Emergency or single consultation. Access expires after 15 minutes.
            </p>
          </button>

          <button
            type="button"
            disabled={API_MODE}
            onClick={() => handleAccessTypeChange('lifetime')}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              border: accessType === 'lifetime' ? '2px solid #168b77' : '1px solid #dce5f2',
              background: accessType === 'lifetime' ? '#ecf9f5' : '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 650, fontSize: 13, color: accessType === 'lifetime' ? '#116a5b' : '#22324b' }}>
                <ShieldCheck size={15} color={accessType === 'lifetime' ? '#168b77' : '#738ba8'} />
                {API_MODE ? 'Ongoing care access' : 'Lifetime Access'}
              </span>
              <span className="badge green" style={{ fontSize: 10, padding: '2px 6px' }}>Permanent</span>
            </div>
            <p style={{ fontSize: 11, color: '#68809f', margin: 0, lineHeight: 1.4 }}>
              {API_MODE ? 'Manage ongoing access in Privacy & access. QR passes are limited to 15 minutes.' : 'Adds your full history to the demonstration care team.'}
            </p>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '45px 0', textAlign: 'center' }}>
            <RefreshCw
              className="animate-spin"
              style={{ margin: '0 auto 12px', color: '#245be8' }}
              size={30}
            />
            <p className="muted small-text">
              Generating secure {accessType === 'lifetime' ? 'lifetime' : '15-minute'} pass…
            </p>
          </div>
        ) : fetchError ? (
          <div style={{ padding: '30px 10px', textAlign: 'center' }}>
            <span
              className="icon-box pink"
              style={{ width: 48, height: 48, margin: '0 auto 14px' }}
            >
              <AlertTriangle size={24} />
            </span>
            <h4 style={{ fontSize: 16, fontWeight: 600 }}>Generation failed</h4>
            <p className="form-error" style={{ margin: '10px auto', maxWidth: 380 }}>
              {fetchError}
            </p>
            <button className="btn primary" onClick={() => void fetchPass()}>
              <RefreshCw size={14} /> Retry generation
            </button>
          </div>
        ) : pass ? (
          <div className="stack" style={{ gap: 18, marginTop: 8 }}>
            {/* Crisp QR Code Container */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  width: 220,
                  height: 220,
                  padding: 16,
                  background: '#ffffff',
                  borderRadius: 16,
                  border: isExpired
                    ? '2px solid #facbd1'
                    : accessType === 'lifetime'
                    ? '2px solid #b7ecd9'
                    : '1px solid #dce5f2',
                  boxShadow: '0 8px 24px rgba(36, 91, 232, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div
                  style={{ width: '100%', height: '100%' }}
                  dangerouslySetInnerHTML={{ __html: pass.qr_svg }}
                />

                {isExpired && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(255, 255, 255, 0.92)',
                      borderRadius: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 16,
                      textAlign: 'center'
                    }}
                  >
                    <AlertTriangle color="#c5344b" size={30} style={{ marginBottom: 6 }} />
                    <strong style={{ color: '#b72641', fontSize: 14 }}>Pass Expired</strong>
                    <p className="muted tiny" style={{ marginTop: 4 }}>
                      Token expired for clinical security.
                    </p>
                  </div>
                )}
              </div>

              {/* Status or Countdown Pill */}
              <div style={{ marginTop: 12 }}>
                {accessType === 'lifetime' ? (
                  <span className="badge green" style={{ fontSize: 12, padding: '6px 14px', gap: 6 }}>
                    <ShieldCheck size={14} />
                    {API_MODE ? 'Ongoing care access' : 'Lifetime Access'} · Valid Indefinitely
                  </span>
                ) : isExpired ? (
                  <button className="btn secondary" onClick={() => void fetchPass('temporary')} style={{ fontSize: 12, height: 34 }}>
                    <RefreshCw size={13} /> Token expired — tap to refresh
                  </button>
                ) : (
                  <span className="badge amber" style={{ fontSize: 12, padding: '6px 12px' }}>
                    <Clock size={13} className="animate-pulse" />
                    Pass expires in: {minutes}:{seconds.toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Emergency Highlights for the Patient */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                background: '#f8faff',
                border: '1px solid #e5edf7',
                borderRadius: 12,
                padding: 12
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e7edf6',
                  borderRadius: 10,
                  padding: '10px 8px',
                  textAlign: 'center'
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#c45275',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                >
                  <HeartPulse size={12} /> Blood
                </span>
                <strong style={{ fontSize: 16, display: 'block', marginTop: 3 }}>{bloodGroup}</strong>
                <small className="tiny muted">Universal care</small>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e7edf6',
                  borderRadius: 10,
                  padding: '10px 8px',
                  textAlign: 'center'
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#158b77',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                >
                  <Pill size={12} /> Medicines
                </span>
                <strong style={{ fontSize: 16, display: 'block', marginTop: 3 }}>
                  {medsCount} Active
                </strong>
                <small className="tiny muted">Instant intake</small>
              </div>

              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e7edf6',
                  borderRadius: 10,
                  padding: '10px 8px',
                  textAlign: 'center'
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#2961df',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                >
                  <Users size={12} /> Contacts
                </span>
                <strong style={{ fontSize: 16, display: 'block', marginTop: 3 }}>
                  {familyCount} Listed
                </strong>
                <small className="tiny muted">Emergency reach</small>
              </div>
            </div>

            {/* Clinician Handshake Note */}
            <div className="sample-note" style={{ marginBottom: 0 }}>
              <Info size={15} />
              <div>
                <strong>
                  {accessType === 'lifetime' ? 'Lifetime Connection Protocol:' : 'Emergency Consent Protocol:'}
                </strong>{' '}
                {accessType === 'lifetime'
                  ? 'Once accepted by the doctor, you will be permanently linked to their patients list with your full medical history. The doctor will appear in your Connected Doctors list, protected by 2-step security.'
                  : 'Only verified Clinicians can unlock your medical history by declaring an emergency or consultation purpose. Access expires after 15 minutes.'}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="row" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn secondary"
                style={{ flex: 1, fontSize: 12, height: 40 }}
                onClick={() => void copyLink()}
              >
                {copied ? <Check size={14} color="#168b77" /> : <Copy size={14} />}
                {copied ? 'Link Copied!' : 'Copy Scanner Link'}
              </button>

              <a
                href={pass.scan_url}
                target="_blank"
                rel="noreferrer"
                className="btn primary"
                style={{ flex: 1, fontSize: 12, height: 40, background: accessType === 'lifetime' ? '#168b77' : undefined, borderColor: accessType === 'lifetime' ? '#168b77' : undefined }}
              >
                <ExternalLink size={14} />
                Open Doctor Scanner
              </a>

              <button
                type="button"
                className="btn ghost"
                style={{ fontSize: 12 }}
                onClick={() => void fetchPass(accessType)}
                title="Generate fresh token"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
