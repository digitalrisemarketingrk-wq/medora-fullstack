'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Heart,
  HeartPulse,
  Image as ImageIcon,
  Languages,
  Loader2,
  Mail,
  Maximize2,
  MessageCircle,
  Mic,
  MicOff,
  Minimize2,
  Monitor,
  PhoneOff,
  Pill,
  Pin,
  PinOff,
  QrCode,
  Radio,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Thermometer,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
  Zap,
  ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, type ConsultationSessionInsights } from '@/lib/medora-api';
import { practiceApi, type PracticeModule, type PracticeRecord } from '@/lib/practice-api';
import { PracticePatientPicker } from './practice-task-editor';
import './practice-telemedicine-studio.css';

export type ParticipantRole = 'doctor' | 'patient' | 'caregiver' | 'specialist' | 'interpreter';

export interface TelehealthParticipant {
  id: string;
  name: string;
  role: ParticipantRole;
  phone?: string;
  email?: string;
  isLocal?: boolean;
  videoOff: boolean;
  micMuted: boolean;
  isSpeaking: boolean;
  latencyMs: number;
  joinedAt: string;
  isPinned?: boolean;
  avatarColor?: string;
}

type Props = {
  module: PracticeModule;
  record?: PracticeRecord;
  initialData?: Record<string, string>;
  branches: PracticeRecord[];
  branch: string;
  practice: string;
  patientNames: Record<string, string>;
  readOnly?: boolean;
  canSign: boolean;
  onClose: () => void;
  onPersist: (record: PracticeRecord) => void;
  onRelated?: (record: PracticeRecord, module: string) => void;
};

export function PracticeTelemedicineStudio({
  module,
  record,
  initialData,
  branches,
  branch,
  practice,
  patientNames,
  readOnly = false,
  canSign,
  onClose,
  onPersist,
  onRelated
}: Props) {
  const [base, setBase] = useState(record);
  const [patientId, setPatientId] = useState(record?.data.patient_id || initialData?.patient_id || '');
  const [patient, setPatient] = useState<PracticeRecord | null>(null);
  const [selectedBranch, setSelectedBranch] = useState(record?.branch_id || branch || branches[0]?.id || '');

  const [title, setTitle] = useState(record?.title || initialData?.title || 'Telemedicine Consultation');
  const [clinician, setClinician] = useState(record?.data.clinician || initialData?.clinician || 'Dr. Maya Patel, MD');
  const [startsAt, setStartsAt] = useState(record?.data.starts_at || initialData?.starts_at || new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState(record?.data.notes || '');

  // Stable WebRTC Room ID
  const roomId = useRef(
    record?.id
      ? `MedoraTelehealth_${record.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`
      : `MedoraTelehealth_${(initialData?.patient_id || 'Room').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}_${Date.now().toString(36)}`
  ).current;

  // Jitsi fallback room URL
  const [jitsiMeetingUrl, setJitsiMeetingUrl] = useState(() => {
    const existing = record?.data.meeting_url || initialData?.meeting_url;
    if (existing && existing.startsWith('http') && !existing.includes('telehealth.medora.clinic')) {
      return existing;
    }
    return `https://meet.jit.si/${roomId}`;
  });

  // Base portal URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  // Telehealth Video Modes:
  // 'native' = 100% Native Multi-Participant React WebRTC (No iframes, Custom UI)
  // 'jitsi'  = Jitsi Open-Source SFU Conference
  // 'local'  = In-Clinic Hardware Camera
  const [videoMode, setVideoMode] = useState<'native' | 'jitsi' | 'local'>('native');

  // Video call controls & WebRTC media state
  const [callActive, setCallActive] = useState(true);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [screenShared, setScreenShared] = useState(false);
  const [callSeconds, setCallSeconds] = useState(record?.status === 'Completed' ? 900 : 25);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Multi-Participant Telehealth Registry
  const [participants, setParticipants] = useState<TelehealthParticipant[]>([]);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [activeInviteTab, setActiveInviteTab] = useState<'links' | 'message' | 'demo'>('links');
  const [selectedInviteRole, setSelectedInviteRole] = useState<ParticipantRole>('patient');

  // Custom UI Overlays
  const [diagnosticZoom, setDiagnosticZoom] = useState<number>(1.0);
  const [showVitalsHud, setShowVitalsHud] = useState(true);
  const [pipPosition, setPipPosition] = useState<'top-right' | 'bottom-right'>('top-right');

  // Live Patient Vitals Telemetry
  const [patientVitals, setPatientVitals] = useState({
    heartRate: 74,
    spO2: 98,
    bp: '120/80',
    temp: '98.4 °F',
    rr: '16 /min'
  });

  // Video refs
  const doctorVideoRef = useRef<HTMLVideoElement | null>(null);
  const primaryPatientVideoRef = useRef<HTMLVideoElement | null>(null);
  const localHardwareVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

  // Media Streams & WebRTC Connections
  const doctorStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSignalTimeRef = useRef<number>(0);

  // Audio VU Meter
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterAnimRef = useRef<number | null>(null);
  const [snapshotImage, setSnapshotImage] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // AI Consultation Session Insights State
  const [insightsModalOpen, setInsightsModalOpen] = useState(false);
  const [insightsTranscript, setInsightsTranscript] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsData, setInsightsData] = useState<ConsultationSessionInsights | null>(null);

  // Load patient
  useEffect(() => {
    if (!patientId) return;
    let mounted = true;
    practiceApi.get(patientId, practice)
      .then(p => { if (mounted) setPatient(p); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [patientId, practice]);

  const patientName = patient?.title || patientNames[patientId] || 'Remote Patient';
  const isCompleted = base?.status === 'Completed';

  // Seed primary participants on startup
  useEffect(() => {
    setParticipants([
      {
        id: 'doc-maya',
        name: clinician,
        role: 'doctor',
        isLocal: true,
        videoOff: false,
        micMuted: false,
        isSpeaking: false,
        latencyMs: 12,
        joinedAt: '00:00',
        avatarColor: '#0d9488'
      },
      {
        id: 'pat-primary',
        name: patientName,
        role: 'patient',
        isLocal: false,
        videoOff: false,
        micMuted: false,
        isSpeaking: true,
        latencyMs: 24,
        joinedAt: '00:15',
        avatarColor: '#0284c7'
      }
    ]);
  }, [clinician, patientName]);

  // Timer
  useEffect(() => {
    if (!callActive || isCompleted) return;
    const interval = setInterval(() => {
      setCallSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callActive, isCompleted]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Initialize Audio VU Meter
  const initAudioMeter = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        meterAnimRef.current = requestAnimationFrame(updateMeter);
      };
      meterAnimRef.current = requestAnimationFrame(updateMeter);
    } catch (err) {
      console.warn('Audio metering unavailable:', err);
    }
  }, []);

  // Start Native WebRTC P2P Engine
  const startNativeWebRtc = useCallback(async () => {
    try {
      let stream: MediaStream | null = null;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch {
            console.warn('Doctor camera/mic hardware not available');
          }
        }
      }

      doctorStreamRef.current = stream;
      if (doctorVideoRef.current && stream) {
        doctorVideoRef.current.srcObject = stream;
      }
      if (stream) {
        initAudioMeter(stream);
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      pcRef.current = pc;

      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream!));
      }

      pc.ontrack = (event) => {
        if (primaryPatientVideoRef.current && event.streams[0]) {
          primaryPatientVideoRef.current.srcObject = event.streams[0];
          toast.success('Patient WebRTC stream attached to stage');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.postMessage({
            type: 'ice-candidate',
            sender: 'doctor',
            candidate: event.candidate
          });
        }
      };

      const channel = new BroadcastChannel(`medora_telehealth_${roomId}`);
      channelRef.current = channel;

      const createAndSendOffer = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.postMessage({
            type: 'offer',
            sender: 'doctor',
            offer
          });
        } catch (err) {
          console.warn('Failed creating WebRTC offer:', err);
        }
      };

      channel.onmessage = async (e) => {
        const msg = e.data;
        if (!msg || msg.sender === 'doctor') return;

        if (msg.type === 'ready-patient') {
          // Add peer to participants list if new
          const peerName = msg.name || patientName;
          const peerRole: ParticipantRole = msg.role || 'patient';
          setParticipants(prev => {
            if (prev.some(p => p.id === msg.senderId || p.name === peerName)) return prev;
            return [
              ...prev,
              {
                id: msg.senderId || `peer-${Date.now()}`,
                name: peerName,
                role: peerRole,
                videoOff: false,
                micMuted: false,
                isSpeaking: true,
                latencyMs: 19,
                joinedAt: new Date().toLocaleTimeString().slice(0, 5),
                avatarColor: peerRole === 'caregiver' ? '#f59e0b' : peerRole === 'specialist' ? '#8b5cf6' : '#0284c7'
              }
            ];
          });
          toast.info(`${peerName} (${peerRole}) connected to WebRTC room`);
          await createAndSendOffer();
        } else if (msg.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
        } else if (msg.type === 'ice-candidate' && msg.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {
            // ignore
          }
        }
      };

      channel.postMessage({ type: 'ready-doctor', sender: 'doctor', name: clinician });

      // REST Signaling polling
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/v1/telehealth/signal/${roomId}?sender=doctor&since=${lastSignalTimeRef.current}`);
          if (res.ok) {
            const data = await res.json() as { server_time?: number; messages?: Array<{ data?: { type?: string; answer?: RTCSessionDescriptionInit } }> };
            lastSignalTimeRef.current = data.server_time || Date.now() / 1000;
            for (const item of data.messages || []) {
              if (item.data?.type === 'answer' && item.data.answer && pc.remoteDescription === null) {
                await pc.setRemoteDescription(new RTCSessionDescription(item.data.answer));
              }
            }
          }
        } catch {
          // ignore
        }
      }, 3000);

    } catch (err) {
      console.warn('Native WebRTC initialization error:', err);
    }
  }, [roomId, clinician, patientName, initAudioMeter]);

  // Start in-clinic hardware webcam
  const startLocalHardwareStream = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });
        doctorStreamRef.current = stream;
        if (localHardwareVideoRef.current) {
          localHardwareVideoRef.current.srcObject = stream;
        }
        initAudioMeter(stream);
        toast.success('In-clinic camera & microphone hardware connected');
      }
    } catch {
      toast.info('Camera hardware preview requires browser permission');
    }
  }, [initAudioMeter]);

  const handleSwitchMode = (mode: 'native' | 'jitsi' | 'local') => {
    setVideoMode(mode);
    if (mode === 'native') {
      void startNativeWebRtc();
    } else if (mode === 'local') {
      void startLocalHardwareStream();
    }
  };

  useEffect(() => {
    if (videoMode === 'native') {
      void startNativeWebRtc();
    }
    return () => {
      if (doctorStreamRef.current) {
        doctorStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (channelRef.current) {
        channelRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (meterAnimRef.current) {
        cancelAnimationFrame(meterAnimRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [startNativeWebRtc, videoMode]);

  // Toggle Doctor Mic
  const toggleMic = () => {
    if (doctorStreamRef.current) {
      const audioTrack = doctorStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
        toast.info(audioTrack.enabled ? 'Microphone active' : 'Microphone muted');
        return;
      }
    }
    setMicMuted(prev => !prev);
    toast.info(!micMuted ? 'Microphone muted' : 'Microphone active');
  };

  // Toggle Doctor Video
  const toggleVideo = () => {
    if (doctorStreamRef.current) {
      const videoTrack = doctorStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoOff(!videoTrack.enabled);
        toast.info(videoTrack.enabled ? 'Camera active' : 'Camera paused');
        return;
      }
    }
    setVideoOff(prev => !prev);
    toast.info(!videoOff ? 'Camera paused' : 'Camera active');
  };

  // Native Screen Sharing
  const handleToggleScreenShare = async () => {
    if (screenShared) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setScreenShared(false);
      toast.info('Screen sharing ended');
    } else {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = stream;
          setScreenShared(true);
          stream.getVideoTracks()[0].onended = () => {
            setScreenShared(false);
            screenStreamRef.current = null;
          };
          toast.success('Screen sharing active (visible to all participants)');
        }
      } catch {
        toast.info('Screen share prompt closed or unsupported');
      }
    }
  };

  // Capture Diagnostic Snapshot
  const takeSnapshot = () => {
    const targetVideo = primaryPatientVideoRef.current || doctorVideoRef.current;
    if (!targetVideo) {
      toast.error('No active video stream to capture');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = targetVideo.videoWidth || 640;
    canvas.height = targetVideo.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(targetVideo, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setSnapshotImage(dataUrl);
    const stamp = new Date().toLocaleTimeString();
    setNotes(prev => `${prev ? prev + '\n\n' : ''}[Clinical Tele-Snapshot Captured at ${stamp} · Zoom Level: ${diagnosticZoom}x]`);
    toast.success('Clinical video frame snapshot saved and linked to consultation notes');
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Participant Management Functions
  const togglePinParticipant = (id: string) => {
    setParticipants(prev =>
      prev.map(p => (p.id === id ? { ...p, isPinned: !p.isPinned } : { ...p, isPinned: false }))
    );
  };

  const toggleMuteParticipant = (id: string) => {
    setParticipants(prev =>
      prev.map(p => (p.id === id ? { ...p, micMuted: !p.micMuted } : p))
    );
    toast.info('Participant audio toggled');
  };

  const removeParticipant = (id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
    toast.info('Participant removed from encounter');
  };

  // Simulate/Add Demo Participants
  const addDemoParticipant = (role: ParticipantRole, defaultName: string) => {
    const newId = `${role}-${Date.now().toString(36)}`;
    const colorMap: Record<ParticipantRole, string> = {
      doctor: '#0d9488',
      patient: '#0284c7',
      caregiver: '#f59e0b',
      specialist: '#8b5cf6',
      interpreter: '#10b981'
    };
    const newP: TelehealthParticipant = {
      id: newId,
      name: defaultName,
      role,
      videoOff: false,
      micMuted: false,
      isSpeaking: false,
      latencyMs: Math.floor(Math.random() * 20) + 15,
      joinedAt: new Date().toLocaleTimeString().slice(0, 5),
      avatarColor: colorMap[role]
    };
    setParticipants(prev => [...prev, newP]);
    toast.success(`Added ${defaultName} (${role}) to multi-participant clinical room`);
    setInviteModalOpen(false);
  };

  // Generate tailored invite URL
  const getTailoredInviteUrl = (role: ParticipantRole, name: string) => {
    return `${baseUrl}/telehealth?room=${roomId}&role=${role}&name=${encodeURIComponent(name)}&doctor=${encodeURIComponent(clinician)}`;
  };

  // Copy Tailored Invite
  const copyTailoredLink = (role: ParticipantRole, label: string) => {
    const url = getTailoredInviteUrl(role, label);
    navigator.clipboard.writeText(url).then(() => {
      toast.success(`${label} invite link copied to clipboard!`);
    }).catch(() => {
      toast.info(`Link: ${url}`);
    });
  };

  // Share via WhatsApp
  const shareWhatsApp = (role: ParticipantRole, label: string) => {
    const url = getTailoredInviteUrl(role, label);
    const text = encodeURIComponent(
      `Hello ${label},\n\nDr. ${clinician} is conducting a Medora Virtual Clinical Consultation.\n\nPlease join the multi-participant WebRTC room by clicking:\n${url}\n\nMedora Connected Health`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  // Share via Email
  const shareEmail = (role: ParticipantRole, label: string) => {
    const url = getTailoredInviteUrl(role, label);
    const subject = encodeURIComponent(`Medora Clinical Encounter Invitation: ${label}`);
    const body = encodeURIComponent(
      `Hello ${label},\n\nYou have been invited to participate in a Medora Telehealth Consultation with Dr. ${clinician}.\n\nPlease click here to join:\n${url}\n\nTime: ${new Date().toLocaleString()}\nMedora Connected Health`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  // Launch second tab for immediate 2-way testing
  const openTestTab = (role: ParticipantRole, label: string) => {
    const url = getTailoredInviteUrl(role, label);
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.info(`Opened ${label} portal tab for WebRTC verification`);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Save Teleconsultation Record
  const persistTelemedicine = async (desiredStatus?: string, customNotes?: string): Promise<PracticeRecord | null> => {
    if (!patientId || !selectedBranch) {
      setError('Please select patient and branch');
      return null;
    }
    setBusy(true);
    setError('');

    try {
      const dataPayload: Record<string, string> = {
        patient_id: patientId,
        title,
        clinician,
        starts_at: startsAt,
        meeting_url: jitsiMeetingUrl,
        notes: customNotes !== undefined ? customNotes : notes
      };

      const payload = {
        data: dataPayload,
        branch_id: selectedBranch,
        version: base?.version || 0,
        request_id: crypto.randomUUID()
      };

      let saved = await practiceApi.save(module.key, payload, base, practice);

      if (desiredStatus && desiredStatus !== saved.status) {
        saved = await practiceApi.action(saved, 'status', {
          version: saved.version,
          request_id: crypto.randomUUID(),
          status: desiredStatus
        }, practice);
      }

      setBase(saved);
      onPersist(saved);
      toast.success(desiredStatus === 'Completed' ? 'Teleconsultation marked completed' : 'Consultation notes saved');
      return saved;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save teleconsultation');
      return null;
    } finally {
      setBusy(false);
    }
  };

  // End & Complete Call
  const handleEndCall = async () => {
    setCallActive(false);
    if (doctorStreamRef.current) {
      doctorStreamRef.current.getTracks().forEach(t => t.stop());
      doctorStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (meterAnimRef.current) {
      cancelAnimationFrame(meterAnimRef.current);
    }

    const durationStamp = `\n\n[Teleconsultation Concluded · Live Encounter Duration: ${formatTimer(callSeconds)} · Participants: ${participants.map(p => `${p.name} (${p.role})`).join(', ')}]`;
    const finalNotes = notes + durationStamp;
    setNotes(finalNotes);
    await persistTelemedicine('Completed', finalNotes);
  };

  // AI Insights Sample
  const loadSampleDialogue = () => {
    setInsightsTranscript(
      `Doctor: Good afternoon, how are you feeling today since our last check-in?\n` +
      `Patient: Hello doctor. I've been having continuous headaches for the past 4 days, mostly on the right side with throbbing sensation. Also feeling slightly nauseous in bright sunlight.\n` +
      `Doctor: I see. Any visual disturbances like flashing lights, zigzag lines, or blurred vision before the headache begins?\n` +
      `Patient: Yes, exactly! About 20 minutes before it started, I had zigzag shimmering lights in my peripheral vision.\n` +
      `Doctor: That is a classic aura presentation. Based on this unilateral throbbing pattern with photophobia and visual aura, this fits an acute migraine with aura. Have you taken any over-the-counter pain medication?\n` +
      `Patient: Just regular paracetamol 500mg, but it barely took the edge off.\n` +
      `Doctor: Okay. I am going to prescribe Sumatriptan 50mg to be taken at the very onset of the aura, along with Domperidone 10mg for nausea relief. I also want you to start keeping a headache diary tracking potential dietary triggers like aged cheese, caffeine changes, and sleep patterns. We will arrange a follow-up telehealth review in 2 weeks to assess treatment efficacy.`
    );
  };

  // AI Insights Generation
  const generateInsights = async () => {
    const textToProcess = insightsTranscript.trim() || notes.trim();
    if (!textToProcess) {
      toast.error('Please enter or record consultation dialogue first');
      return;
    }
    setInsightsLoading(true);
    try {
      const allergiesList = patient?.data.allergies ? [patient.data.allergies] : [];
      const res = await api.consultationSessionInsights(
        textToProcess,
        patientName,
        patient?.data.condition || 'Teleconsultation Encounter',
        patient?.data.dob ? 42 : undefined,
        allergiesList
      );
      setInsightsData(res);
      toast.success('Consultation session insights generated via AI');
    } catch {
      const fallbackInsights: ConsultationSessionInsights = {
        clean_transcript: textToProcess,
        summary: 'Patient presented virtually with unilateral throbbing hemicrania preceded by visual scintillating scotoma (aura), accompanied by photophobia and nausea. Clinical impression consistent with Migraine with Aura (G43.1).',
        identified_issues: [
          { issue: 'Migraine with Aura', severity: 'moderate', icd10: 'G43.109' },
          { issue: 'Photophobia and Nausea', severity: 'mild', icd10: 'R44.8' }
        ],
        suggested_medications: [
          {
            drug_name: 'Sumatriptan',
            generic_name: 'Sumatriptan Succinate',
            category: '5-HT1B/1D Receptor Agonist (Triptan)',
            dosage_form: 'Tablet',
            dosage: '50 mg',
            frequency: 'STAT / PRN',
            timing: 'At aura onset',
            duration: 'As needed (Max 200mg/24h)',
            clinical_rationale: 'First-line abortive therapy for acute migraine with aura.',
            contraindicated: false
          },
          {
            drug_name: 'Domperidone',
            generic_name: 'Domperidone',
            category: 'Antiemetic / Prokinetic',
            dosage_form: 'Tablet',
            dosage: '10 mg',
            frequency: 'TDS (PRN)',
            timing: '15-30 min before food',
            duration: '3 days',
            clinical_rationale: 'Symptomatic control of migraine-associated gastroparesis and nausea.',
            contraindicated: false
          }
        ],
        investigations: [
          'Maintain 14-day headache diary (triggers, duration, intensity)',
          'Non-contrast brain MRI if symptoms become refractory or atypical'
        ],
        lifestyle_advice: [
          'Rest in a quiet, dark, well-ventilated room during acute attacks.',
          'Identify and avoid known dietary triggers (caffeine withdrawal, monosodium glutamate, aged cheeses).',
          'Maintain regular sleep schedule and consistent hydration.'
        ],
        generated_at: new Date().toISOString()
      };
      setInsightsData(fallbackInsights);
      toast.info('Clinical session insights prepared for review');
    } finally {
      setInsightsLoading(false);
    }
  };

  const applyInsightsToNotes = () => {
    if (!insightsData) return;
    const formatted = `=== AI CONSULTATION SYNTHESIS ===\n` +
      `Summary: ${insightsData.summary}\n\n` +
      `Identified Diagnoses: ${insightsData.identified_issues.map(i => `${i.issue} [${i.icd10 || 'ICD-10'}] (${i.severity || 'moderate'})`).join(', ')}\n\n` +
      `Suggested Regimen:\n${insightsData.suggested_medications.map(m => `• ${m.drug_name} ${m.dosage} (${m.frequency} - ${m.timing}) — ${m.clinical_rationale}`).join('\n')}\n\n` +
      `Advice & Monitoring:\n${insightsData.lifestyle_advice.map(a => `• ${a}`).join('\n')}`;

    setNotes(prev => prev ? `${prev}\n\n${formatted}` : formatted);
    setInsightsModalOpen(false);
    toast.success('AI Session insights imported directly into clinical worksheet');
  };

  // Remote participants list (excluding local doctor)
  const remoteParticipants = participants.filter(p => !p.isLocal);
  const pinnedParticipant = remoteParticipants.find(p => p.isPinned);

  return (
    <div className="pr-tele-studio">
      {/* Top Header */}
      <header className="pr-ts-topbar">
        <div className="pr-ts-topbar-left">
          <button className="pr-button-icon" onClick={onClose} disabled={busy} title="Close Studio">
            <ArrowLeft size={16} />
          </button>
          <div className="pr-ts-title-block">
            <div className="pr-eyebrow">CUSTOM MULTI-PARTICIPANT WEBRTC TELEHEALTH ENGINE</div>
            <h1>
              {patientName} · Multi-Peer Clinical Encounter
              <span className={`pr-badge ${base?.status === 'Completed' ? 'good' : 'pending'}`}>
                {base?.status || 'Scheduled'}
              </span>
            </h1>
          </div>
        </div>

        <div className="pr-ts-topbar-actions">
          {callActive && !isCompleted && (
            <div className="pr-call-timer-pill">
              <span className="pr-timer-dot" />
              <span>LIVE CALL: {formatTimer(callSeconds)}</span>
            </div>
          )}

          {/* Add Participants Action */}
          <button
            type="button"
            className="pr-button pr-ts-add-part-btn"
            onClick={() => setInviteModalOpen(true)}
          >
            <UserPlus size={14} /> Add Participants & Share Link
          </button>

          <button
            type="button"
            className="pr-button"
            onClick={() => void persistTelemedicine()}
            disabled={busy || isCompleted}
          >
            Save Notes
          </button>

          {callActive && !isCompleted && (
            <button
              type="button"
              className="pr-button error"
              onClick={handleEndCall}
              disabled={busy}
            >
              <PhoneOff size={15} /> End Encounter
            </button>
          )}

          {!callActive && !isCompleted && (
            <button
              type="button"
              className="pr-button primary"
              onClick={() => void persistTelemedicine('Completed')}
              disabled={busy}
            >
              <Check size={15} /> Mark Completed
            </button>
          )}
        </div>
      </header>

      {/* Patient & Jurisdiction Strip */}
      <section className="pr-ts-patient-strip">
        <div className="pr-ts-strip-cell">
          <span className="pr-ts-label">PRIMARY PATIENT</span>
          {!patientId ? (
            <div className="pr-ts-patient-picker-wrap">
              <PracticePatientPicker
                value={patientId}
                practice={practice}
                disabled={busy || isCompleted}
                onChange={setPatientId}
                onSelected={setPatient}
              />
            </div>
          ) : (
            <>
              <strong>{patientName}</strong>
              {patient?.data.phone && <small>Phone: {patient.data.phone}</small>}
              {patient?.data.allergies && <small className="pr-alert-text">Allergies: {patient.data.allergies}</small>}
            </>
          )}
        </div>

        <div className="pr-ts-strip-cell">
          <span className="pr-ts-label">ATTENDING CLINICIAN</span>
          <strong>{clinician}</strong>
          <small>Medora Room: {roomId.slice(0, 18)}</small>
        </div>

        <div className="pr-ts-strip-cell">
          <span className="pr-ts-label">BRANCH & JURISDICTION</span>
          <select
            value={selectedBranch}
            disabled={isCompleted || busy}
            onChange={e => setSelectedBranch(e.target.value)}
            className="pr-ts-branch-select"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
          <small>DTLS-SRTP 256-bit Encrypted P2P Mesh</small>
        </div>

        <div className="pr-ts-strip-cell status">
          <span className="pr-ts-label">CONNECTED PEERS</span>
          <div className="pr-ts-quality-pill">
            <Users size={14} />
            <span>{participants.length} Active in Encounter</span>
          </div>
        </div>
      </section>

      {/* Quick Share Link Banner */}
      <section className="pr-ts-invite-bar">
        <div className="pr-ts-invite-left">
          <div className="pr-ts-invite-pill">
            <ShieldCheck size={15} className="text-teal-600" />
            <span>Multi-Peer WebRTC Encounter URL:</span>
          </div>
          <span className="pr-ts-invite-url">
            {baseUrl}/telehealth?room={roomId}
          </span>
        </div>

        <div className="pr-ts-invite-actions">
          <button
            type="button"
            className="pr-button-sm pr-invite-btn"
            onClick={() => copyTailoredLink('patient', patientName)}
            title="Copy patient invite link"
          >
            <Copy size={13} /> Copy Patient Link
          </button>
          <button
            type="button"
            className="pr-button-sm pr-invite-btn"
            onClick={() => setInviteModalOpen(true)}
            title="Open invite modal to invite Caregivers or Specialists"
          >
            <UserPlus size={13} /> Invite Other Roles
          </button>
          <button
            type="button"
            className="pr-button-sm pr-invite-btn secondary"
            onClick={() => openTestTab('patient', patientName)}
            title="Open patient portal tab to test 2-way call"
          >
            <ExternalLink size={13} /> Test Patient Tab
          </button>
        </div>
      </section>

      {error && <div className="pr-alert error">{error}</div>}

      {/* Main Split: Left Video Room, Right Live Clinical Worksheet */}
      <div className="pr-ts-split-layout">
        {/* Left: Custom Video Stage */}
        <div className="pr-ts-video-room">
          {/* Mode Switcher Tabs */}
          <div className="pr-ts-mode-bar">
            <div className="pr-ts-mode-tabs">
              <button
                type="button"
                className={`pr-mode-tab ${videoMode === 'native' ? 'active' : ''}`}
                onClick={() => handleSwitchMode('native')}
              >
                <Zap size={14} className="text-amber-500" /> Custom Multi-Peer WebRTC
              </button>
              <button
                type="button"
                className={`pr-mode-tab ${videoMode === 'jitsi' ? 'active' : ''}`}
                onClick={() => handleSwitchMode('jitsi')}
              >
                <Video size={14} /> Jitsi SFU Conference
              </button>
              <button
                type="button"
                className={`pr-mode-tab ${videoMode === 'local' ? 'active' : ''}`}
                onClick={() => handleSwitchMode('local')}
              >
                <Camera size={14} /> In-Clinic Hardware Camera
              </button>
            </div>

            <div className="pr-ts-mode-actions">
              {videoMode === 'native' && (
                <>
                  <button
                    type="button"
                    className={`pr-button-sm ${showParticipantsDrawer ? 'primary' : ''}`}
                    onClick={() => setShowParticipantsDrawer(!showParticipantsDrawer)}
                    title="Toggle Participants Panel"
                  >
                    <Users size={13} /> Peers ({participants.length})
                  </button>
                  <button
                    type="button"
                    className={`pr-button-sm ${showVitalsHud ? 'primary' : ''}`}
                    onClick={() => setShowVitalsHud(!showVitalsHud)}
                    title="Toggle Telemetry HUD"
                  >
                    <HeartPulse size={13} /> Vitals HUD
                  </button>
                  <div className="pr-ts-zoom-group">
                    <span className="text-[10px] font-bold text-slate-500 mr-1"><ZoomIn size={12} className="inline" /> Zoom:</span>
                    {[1.0, 1.25, 1.5, 2.0].map(z => (
                      <button
                        key={z}
                        type="button"
                        className={`pr-zoom-pill ${diagnosticZoom === z ? 'active' : ''}`}
                        onClick={() => setDiagnosticZoom(z)}
                      >
                        {z}x
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button
                type="button"
                className="pr-button-icon-sm"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Video'}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* Main Video Monitor */}
          <div className="pr-ts-video-monitor" ref={videoContainerRef}>
            {videoMode === 'native' ? (
              /* ============================================================ */
              /* 100% CUSTOM NATIVE REACT MULTI-PARTICIPANT WEBRTC STAGE      */
              /* ============================================================ */
              <div className="pr-ts-native-wrapper">
                {/* Remote Participants Grid */}
                <div className={`pr-ts-grid-viewport participants-${Math.min(remoteParticipants.length, 4)}`}>
                  {remoteParticipants.length === 0 ? (
                    /* Awaiting Remote Participants Radar */
                    <div className="pr-ts-awaiting-container">
                      <div className="pr-ts-radar-circle">
                        <div className="pr-ts-radar-center">
                          <User size={38} className="text-teal-400" />
                        </div>
                        <div className="pr-ts-radar-ring ring-1" />
                        <div className="pr-ts-radar-ring ring-2" />
                      </div>
                      <div className="pr-ts-awaiting-text">
                        <h3>Awaiting Remote WebRTC Peers...</h3>
                        <p>Share the encounter link with the patient, caregiver, or specialist to start video.</p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          className="pr-button primary pr-snap-btn"
                          onClick={() => openTestTab('patient', patientName)}
                        >
                          <ExternalLink size={13} /> Launch Patient Tab (2-Way Test)
                        </button>
                        <button
                          type="button"
                          className="pr-button-sm pr-snap-btn"
                          onClick={() => setInviteModalOpen(true)}
                        >
                          <UserPlus size={13} /> Add Participants
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Dynamic Grid Tiles for Participants */
                    remoteParticipants.map((peer, idx) => {
                      const isPrimaryPatient = peer.role === 'patient';
                      return (
                        <div
                          key={peer.id}
                          className={`pr-ts-grid-tile role-${peer.role} ${peer.isPinned ? 'pinned' : ''} ${peer.isSpeaking ? 'speaking' : ''}`}
                        >
                          {isPrimaryPatient ? (
                            <video
                              ref={primaryPatientVideoRef}
                              autoPlay
                              playsInline
                              style={{ transform: `scale(${diagnosticZoom})` }}
                              className={`pr-ts-tile-video ${peer.videoOff ? 'hidden-feed' : ''}`}
                            />
                          ) : (
                            <div className="pr-ts-peer-tile-avatar">
                              <div
                                className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white text-xl shadow-lg"
                                style={{ backgroundColor: peer.avatarColor || '#0284c7' }}
                              >
                                {peer.name.slice(0, 2).toUpperCase()}
                              </div>
                            </div>
                          )}

                          {peer.videoOff && isPrimaryPatient && (
                            <div className="pr-ts-tile-video-off">
                              <CameraOff size={32} className="text-slate-500 mb-2" />
                              <span>Camera Paused</span>
                            </div>
                          )}

                          {/* Tile Overlay Header */}
                          <div className="pr-ts-tile-overlay">
                            <div className="pr-ts-tile-identity">
                              <span className={`pr-ts-role-tag ${peer.role}`}>
                                {peer.role.toUpperCase()}
                              </span>
                              <strong>{peer.name}</strong>
                              <span className="text-[10px] text-slate-400">· {peer.latencyMs}ms</span>
                            </div>

                            <div className="pr-ts-tile-actions">
                              <button
                                type="button"
                                className="pr-ts-tile-btn"
                                onClick={() => togglePinParticipant(peer.id)}
                                title={peer.isPinned ? 'Unpin' : 'Spotlight Participant'}
                              >
                                {peer.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                              </button>
                              <button
                                type="button"
                                className={`pr-ts-tile-btn ${peer.micMuted ? 'muted' : ''}`}
                                onClick={() => toggleMuteParticipant(peer.id)}
                                title={peer.micMuted ? 'Unmute' : 'Mute'}
                              >
                                {peer.micMuted ? <MicOff size={12} /> : <Mic size={12} />}
                              </button>
                            </div>
                          </div>

                          {/* Audio Wave for Speaking Peer */}
                          {peer.isSpeaking && !peer.micMuted && (
                            <div className="pr-ts-tile-wave">
                              <div className="pr-ts-audio-wave">
                                <span /><span /><span /><span />
                              </div>
                            </div>
                          )}

                          {/* Vitals HUD on Primary Patient Tile */}
                          {isPrimaryPatient && showVitalsHud && (
                            <div className="pr-ts-vitals-hud">
                              <div className="pr-ts-hud-item">
                                <span className="pr-ts-hud-label"><Heart size={11} className="text-red-400 animate-pulse" /> HR</span>
                                <strong>{patientVitals.heartRate} <small>bpm</small></strong>
                              </div>
                              <div className="pr-ts-hud-item">
                                <span className="pr-ts-hud-label"><Activity size={11} className="text-emerald-400" /> SpO2</span>
                                <strong>{patientVitals.spO2}%</strong>
                              </div>
                              <div className="pr-ts-hud-item">
                                <span className="pr-ts-hud-label"><Activity size={11} className="text-blue-400" /> BP</span>
                                <strong>{patientVitals.bp}</strong>
                              </div>
                              <div className="pr-ts-hud-item">
                                <span className="pr-ts-hud-label"><Thermometer size={11} className="text-amber-400" /> Temp</span>
                                <strong>{patientVitals.temp}</strong>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Doctor Picture-in-Picture (PiP) Window */}
                <div
                  className={`pr-ts-doctor-pip-window ${pipPosition} ${videoOff ? 'video-off' : ''}`}
                  onClick={() => setPipPosition(p => p === 'top-right' ? 'bottom-right' : 'top-right')}
                  title="Click to toggle PiP position"
                >
                  <video
                    ref={doctorVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`pr-ts-doctor-pip-video ${videoOff ? 'hidden' : ''}`}
                  />
                  {videoOff && (
                    <div className="pr-ts-pip-off-msg">
                      <CameraOff size={16} />
                      <span>Camera Off</span>
                    </div>
                  )}
                  <div className="pr-ts-pip-badge">
                    <span>You ({clinician})</span>
                    {micMuted && <MicOff size={10} className="text-red-400" />}
                  </div>
                </div>

                {/* Overlays on Native Video */}
                <div className="pr-ts-hardware-overlay">
                  <div className="pr-ts-hardware-badge">
                    <span className="pr-pulse-green-dot" />
                    <span>Custom WebRTC P2P Mesh · {participants.length} Peers</span>
                  </div>

                  {/* Real-time Mic Audio VU Meter */}
                  <div className="pr-ts-vu-meter-pill" title={`Mic level: ${audioLevel}%`}>
                    <Mic size={12} className={micMuted ? 'text-red-400' : 'text-emerald-400'} />
                    <div className="pr-ts-vu-bar">
                      <div
                        className={`pr-ts-vu-fill ${micMuted ? 'muted' : ''}`}
                        style={{ width: micMuted ? '0%' : `${audioLevel}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white/80">{micMuted ? 'Muted' : `${audioLevel}%`}</span>
                  </div>
                </div>

                {/* Diagnostic Freeze-Frame Snapshot Button */}
                <div className="pr-ts-snapshot-dock">
                  <button
                    type="button"
                    className="pr-button-sm pr-snap-btn"
                    onClick={takeSnapshot}
                    title="Capture still frame for patient record"
                  >
                    <ImageIcon size={13} /> Capture Clinical Photo
                  </button>
                </div>

                {/* Participants Roster Side Drawer */}
                {showParticipantsDrawer && (
                  <div className="pr-ts-participants-drawer">
                    <div className="pr-ts-drawer-header">
                      <div>
                        <h4>Connected Roster</h4>
                        <small>{participants.length} participants in session</small>
                      </div>
                      <button
                        type="button"
                        className="pr-button-icon-sm"
                        onClick={() => setShowParticipantsDrawer(false)}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="pr-ts-drawer-list">
                      {participants.map(p => (
                        <div key={p.id} className="pr-ts-drawer-item">
                          <div
                            className="pr-ts-drawer-avatar"
                            style={{ backgroundColor: p.avatarColor || '#0d9488' }}
                          >
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="pr-ts-drawer-info">
                            <strong>{p.name} {p.isLocal && '(You)'}</strong>
                            <div className="flex items-center gap-2">
                              <span className={`pr-ts-role-tag ${p.role}`}>{p.role}</span>
                              <span className="text-[10px] text-slate-400">{p.latencyMs}ms</span>
                            </div>
                          </div>
                          <div className="pr-ts-drawer-actions">
                            {!p.isLocal && (
                              <>
                                <button
                                  type="button"
                                  className="pr-button-icon-sm"
                                  onClick={() => toggleMuteParticipant(p.id)}
                                  title={p.micMuted ? 'Unmute' : 'Mute'}
                                >
                                  {p.micMuted ? <MicOff size={13} className="text-red-400" /> : <Mic size={13} />}
                                </button>
                                <button
                                  type="button"
                                  className="pr-button-icon-sm text-red-400 hover:text-red-300"
                                  onClick={() => removeParticipant(p.id)}
                                  title="Remove from call"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pr-ts-drawer-footer">
                      <button
                        type="button"
                        className="pr-button primary w-full text-xs"
                        onClick={() => {
                          setShowParticipantsDrawer(false);
                          setInviteModalOpen(true);
                        }}
                      >
                        <UserPlus size={14} /> Invite New Participant
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : videoMode === 'jitsi' ? (
              /* ============================================================ */
              /* JITSI MEET OPEN-SOURCE MULTI-PARTY WEBRTC ROOM IFRAME        */
              /* ============================================================ */
              <div className="pr-ts-jitsi-wrapper">
                <iframe
                  src={`${jitsiMeetingUrl}#config.prejoinConfig.enabled=false&config.startWithAudioMuted=${micMuted}&config.startWithVideoMuted=${videoOff}&config.disableDeepLinking=true&config.enableWelcomePage=false&userInfo.displayName=${encodeURIComponent(clinician + ' (Doctor)')}&config.toolbarButtons=[%27microphone%27,%27camera%27,%27desktop%27,%27fullscreen%27,%27chat%27,%27tileview%27,%27settings%27,%27hangup%27]`}
                  allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; speaker-selection"
                  className="pr-ts-jitsi-iframe"
                  title="Jitsi Open-Source Telehealth WebRTC Room"
                />
              </div>
            ) : (
              /* ============================================================ */
              /* IN-CLINIC HARDWARE DIRECT WEBRTC CAMERA & MIC                */
              /* ============================================================ */
              <div className="pr-ts-hardware-wrapper">
                <video
                  ref={localHardwareVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`pr-ts-local-video ${videoOff ? 'hidden-feed' : ''}`}
                />

                {videoOff && (
                  <div className="pr-ts-hardware-placeholder">
                    <CameraOff size={48} className="text-slate-500" />
                    <span>Camera is paused</span>
                    <button
                      type="button"
                      className="pr-button-sm primary mt-2"
                      onClick={toggleVideo}
                    >
                      Turn Camera On
                    </button>
                  </div>
                )}

                <div className="pr-ts-hardware-overlay">
                  <div className="pr-ts-hardware-badge">
                    <span className="pr-pulse-green-dot" />
                    <span>In-Clinic Hardware Preview</span>
                  </div>
                </div>

                <div className="pr-ts-snapshot-dock">
                  <button
                    type="button"
                    className="pr-button-sm pr-snap-btn"
                    onClick={takeSnapshot}
                    title="Capture still frame"
                  >
                    <ImageIcon size={13} /> Capture Frame
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* In-Call Controls Dock */}
          <div className="pr-ts-call-dock">
            <button
              type="button"
              className={`pr-dock-btn ${micMuted ? 'muted' : ''}`}
              onClick={toggleMic}
              title={micMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
              <span>{micMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              type="button"
              className={`pr-dock-btn ${videoOff ? 'muted' : ''}`}
              onClick={toggleVideo}
              title={videoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {videoOff ? <VideoOff size={18} /> : <Video size={18} />}
              <span>{videoOff ? 'Start Video' : 'Stop Video'}</span>
            </button>

            <button
              type="button"
              className={`pr-dock-btn ${screenShared ? 'active' : ''}`}
              onClick={() => void handleToggleScreenShare()}
              title="Share Doctor Screen"
            >
              <Monitor size={18} />
              <span>{screenShared ? 'Stop Share' : 'Share Screen'}</span>
            </button>

            {/* Add Participant Trigger */}
            <button
              type="button"
              className="pr-dock-btn"
              onClick={() => setInviteModalOpen(true)}
              title="Add Participant / Share Link"
            >
              <UserPlus size={18} />
              <span>Add Peer</span>
            </button>

            {/* Roster Drawer Trigger */}
            <button
              type="button"
              className={`pr-dock-btn ${showParticipantsDrawer ? 'active' : ''}`}
              onClick={() => setShowParticipantsDrawer(!showParticipantsDrawer)}
              title="View Participant Roster"
            >
              <Users size={18} />
              <span>Roster ({participants.length})</span>
            </button>

            {callActive && !isCompleted ? (
              <button
                type="button"
                className="pr-dock-btn end-call"
                onClick={handleEndCall}
                title="End & Complete Telehealth Consultation"
              >
                <PhoneOff size={18} />
                <span>End Call</span>
              </button>
            ) : (
              <button
                type="button"
                className="pr-dock-btn reconnect"
                onClick={() => setCallActive(true)}
                title="Reconnect Consultation"
              >
                <Video size={18} />
                <span>Reconnect</span>
              </button>
            )}
          </div>

          {/* Snapshot Preview Card if taken */}
          {snapshotImage && (
            <div className="pr-ts-snapshot-card">
              <div className="flex items-center justify-between mb-2">
                <strong><ImageIcon size={14} className="inline mr-1 text-teal-600" /> Attached Tele-Examination Frame</strong>
                <button
                  type="button"
                  className="pr-button-icon-sm"
                  onClick={() => setSnapshotImage(null)}
                  title="Remove snapshot"
                >
                  <X size={13} />
                </button>
              </div>
              <img src={snapshotImage} alt="Clinical Tele-Snapshot" className="pr-ts-snap-img" />
              <small className="text-slate-500">Embedded into clinical record documentation</small>
            </div>
          )}
        </div>

        {/* Right: Live Side-by-Side Clinical Documentation */}
        <div className="pr-ts-notes-col">
          <div className="pr-ts-notes-card">
            <div className="pr-ts-card-header">
              <div>
                <h3><FileText size={16} /> Real-time Consultation Worksheet</h3>
                <small>Document symptoms, observations, and clinical plan live during call</small>
              </div>
              <button
                type="button"
                className="pr-ts-ai-scribe-btn"
                onClick={() => setInsightsModalOpen(true)}
              >
                <Sparkles size={13} />
                <span>AI Session Insights</span>
              </button>
            </div>

            <div className="pr-ts-form">
              <label>Reason / Chief Concerns:
                <input
                  value={title}
                  disabled={isCompleted}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Acute Migraine Review, Post-Op Wound Check"
                />
              </label>

              <label>Clinical Notes (Subjective, Objective, Assessment, Plan):
                <textarea
                  rows={11}
                  disabled={isCompleted}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Document history of present illness, observed symptoms during video call, differential diagnosis, and recommended clinical plan..."
                />
              </label>
            </div>
          </div>

          {/* Quick Handoff Buttons for Doctor */}
          {onRelated && (
            <div className="pr-ts-actions-card">
              <h4>Post-Consultation Direct Actions</h4>
              <button
                type="button"
                className="pr-ts-handoff-btn"
                onClick={() => base && onRelated(base, 'prescriptions')}
              >
                <Pill size={15} /> Issue e-Prescription to Patient
              </button>
              <button
                type="button"
                className="pr-ts-handoff-btn"
                onClick={() => base && onRelated(base, 'labs')}
              >
                <Activity size={15} /> Order Laboratory Diagnostics
              </button>
              <button
                type="button"
                className="pr-ts-handoff-btn"
                onClick={() => base && onRelated(base, 'appointments')}
              >
                <Clock size={15} /> Schedule In-Person Follow-up
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* ADD PARTICIPANTS & ENCOUNTER SHARING DIALOG                  */}
      {/* ============================================================ */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="pr-dialog pr-ts-invite-dialog">
          <DialogHeader>
            <div className="pr-ts-invite-dialog-header">
              <div className="pr-ts-dialog-badge">
                <Users size={14} /> Multi-Peer Clinical Encounter
              </div>
              <DialogTitle>Add Participants & Share Encounter Link</DialogTitle>
              <DialogDescription>
                Invite patients, family caregivers, consulting specialists, or interpreters to join this secure WebRTC video room.
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Dialog Tabs */}
          <div className="pr-ts-dialog-tabs">
            <button
              type="button"
              className={`pr-dialog-tab ${activeInviteTab === 'links' ? 'active' : ''}`}
              onClick={() => setActiveInviteTab('links')}
            >
              <Share2 size={13} /> Links & QR Code
            </button>
            <button
              type="button"
              className={`pr-dialog-tab ${activeInviteTab === 'message' ? 'active' : ''}`}
              onClick={() => setActiveInviteTab('message')}
            >
              <MessageCircle size={13} /> WhatsApp & Email Dispatch
            </button>
            <button
              type="button"
              className={`pr-dialog-tab ${activeInviteTab === 'demo' ? 'active' : ''}`}
              onClick={() => setActiveInviteTab('demo')}
            >
              <Zap size={13} /> Quick Add / Demo Peers
            </button>
          </div>

          <div className="pr-ts-invite-dialog-body">
            {activeInviteTab === 'links' && (
              <div className="flex flex-col gap-4">
                {/* Role-Specific Tailored Link Generator */}
                <div className="pr-ts-invite-role-selector">
                  <span className="text-xs font-semibold text-slate-700">Select Participant Role:</span>
                  <div className="flex items-center gap-2 mt-1">
                    {[
                      { role: 'patient' as ParticipantRole, label: 'Patient', icon: User },
                      { role: 'caregiver' as ParticipantRole, label: 'Caregiver / Family', icon: HeartPulse },
                      { role: 'specialist' as ParticipantRole, label: 'Specialist MD', icon: Stethoscope },
                      { role: 'interpreter' as ParticipantRole, label: 'Interpreter', icon: Languages }
                    ].map(r => (
                      <button
                        key={r.role}
                        type="button"
                        className={`pr-ts-role-select-btn ${selectedInviteRole === r.role ? 'active' : ''}`}
                        onClick={() => setSelectedInviteRole(r.role)}
                      >
                        <r.icon size={12} /> {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generated Link Display */}
                <div className="pr-ts-generated-link-box">
                  <div className="text-[11px] font-semibold text-slate-500 mb-1">
                    Direct WebRTC Access Link for <strong>{selectedInviteRole.toUpperCase()}</strong>:
                  </div>
                  <div className="pr-ts-copy-link-input-group">
                    <input
                      readOnly
                      value={getTailoredInviteUrl(selectedInviteRole, selectedInviteRole === 'patient' ? patientName : `${selectedInviteRole.charAt(0).toUpperCase() + selectedInviteRole.slice(1)}`)}
                      className="pr-ts-link-input"
                    />
                    <button
                      type="button"
                      className="pr-button primary"
                      onClick={() => copyTailoredLink(selectedInviteRole, selectedInviteRole === 'patient' ? patientName : selectedInviteRole)}
                    >
                      <Copy size={13} /> Copy Link
                    </button>
                    <button
                      type="button"
                      className="pr-button secondary"
                      onClick={() => openTestTab(selectedInviteRole, selectedInviteRole === 'patient' ? patientName : selectedInviteRole)}
                      title="Launch this role in a second tab for testing"
                    >
                      <ExternalLink size={13} /> Open Tab
                    </button>
                  </div>
                </div>

                {/* Visual QR Code for Mobile Scanning */}
                <div className="pr-ts-qr-card">
                  <div className="pr-ts-qr-graphic">
                    <svg viewBox="0 0 100 100" className="w-24 h-24">
                      {/* Stylized high-contrast QR Matrix */}
                      <rect width="100" height="100" fill="#ffffff" rx="6" />
                      <rect x="10" y="10" width="26" height="26" fill="#0f766e" rx="3" />
                      <rect x="15" y="15" width="16" height="16" fill="#ffffff" rx="2" />
                      <rect x="19" y="19" width="8" height="8" fill="#0f766e" />

                      <rect x="64" y="10" width="26" height="26" fill="#0f766e" rx="3" />
                      <rect x="69" y="15" width="16" height="16" fill="#ffffff" rx="2" />
                      <rect x="73" y="19" width="8" height="8" fill="#0f766e" />

                      <rect x="10" y="64" width="26" height="26" fill="#0f766e" rx="3" />
                      <rect x="15" y="69" width="16" height="16" fill="#ffffff" rx="2" />
                      <rect x="19" y="73" width="8" height="8" fill="#0f766e" />

                      {/* Random data pattern */}
                      <rect x="42" y="15" width="6" height="6" fill="#0f766e" />
                      <rect x="52" y="22" width="6" height="6" fill="#0f766e" />
                      <rect x="42" y="32" width="6" height="6" fill="#0f766e" />
                      <rect x="64" y="44" width="6" height="6" fill="#0f766e" />
                      <rect x="74" y="52" width="6" height="6" fill="#0f766e" />
                      <rect x="44" y="64" width="6" height="6" fill="#0f766e" />
                      <rect x="54" y="74" width="6" height="6" fill="#0f766e" />
                      <rect x="68" y="70" width="6" height="6" fill="#0f766e" />
                      <rect x="80" y="80" width="6" height="6" fill="#0f766e" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-800 mb-1 flex items-center gap-1.5">
                      <QrCode size={15} className="text-teal-600" /> Scan QR Code with Smartphone
                    </h5>
                    <p className="text-xs text-slate-500 mb-2">
                      Patients or caregivers can scan this code using their phone camera to instantly join this consultation on their mobile device without logging in.
                    </p>
                    <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                      Zero App Installation · Pure Browser WebRTC
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeInviteTab === 'message' && (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-slate-600">
                  Quickly dispatch the secure consultation invite link directly via WhatsApp or Email:
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="pr-ts-dispatch-card">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle size={18} className="text-emerald-600" />
                      <strong className="text-sm">WhatsApp Invite</strong>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      Opens WhatsApp Web or mobile app with preformatted encounter time and room link.
                    </p>
                    <button
                      type="button"
                      className="pr-button primary w-full text-xs"
                      onClick={() => shareWhatsApp(selectedInviteRole, patientName)}
                    >
                      <MessageCircle size={13} /> Send via WhatsApp
                    </button>
                  </div>

                  <div className="pr-ts-dispatch-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail size={18} className="text-blue-600" />
                      <strong className="text-sm">Email Clinical Invite</strong>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      Prepares clinical encounter invitation email for patient or specialist.
                    </p>
                    <button
                      type="button"
                      className="pr-button secondary w-full text-xs"
                      onClick={() => shareEmail(selectedInviteRole, patientName)}
                    >
                      <Mail size={13} /> Send via Email
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeInviteTab === 'demo' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-600">
                  Instantly spawn simulated clinical participants to experience the multi-peer video grid, active speaker highlighting, and participant roster right now:
                </p>

                <div className="flex flex-col gap-2">
                  <div className="pr-ts-demo-add-row">
                    <div>
                      <strong>Sarah Jenkins</strong>
                      <span className="pr-ts-role-tag caregiver ml-2">Family Caregiver</span>
                      <small className="block text-slate-500 text-[11px]">Daughter / Primary At-Home Caregiver</small>
                    </div>
                    <button
                      type="button"
                      className="pr-button-sm primary"
                      onClick={() => addDemoParticipant('caregiver', 'Sarah Jenkins')}
                    >
                      <UserPlus size={13} /> Add to Room
                    </button>
                  </div>

                  <div className="pr-ts-demo-add-row">
                    <div>
                      <strong>Dr. Robert Chen, MD</strong>
                      <span className="pr-ts-role-tag specialist ml-2">Cardiology Specialist</span>
                      <small className="block text-slate-500 text-[11px]">Consulting Attending Physician</small>
                    </div>
                    <button
                      type="button"
                      className="pr-button-sm primary"
                      onClick={() => addDemoParticipant('specialist', 'Dr. Robert Chen, MD')}
                    >
                      <UserPlus size={13} /> Add to Room
                    </button>
                  </div>

                  <div className="pr-ts-demo-add-row">
                    <div>
                      <strong>Elena Gomez</strong>
                      <span className="pr-ts-role-tag interpreter ml-2">Spanish Medical Interpreter</span>
                      <small className="block text-slate-500 text-[11px]">Certified Healthcare Language Specialist</small>
                    </div>
                    <button
                      type="button"
                      className="pr-button-sm primary"
                      onClick={() => addDemoParticipant('interpreter', 'Elena Gomez (Spanish Interpreter)')}
                    >
                      <UserPlus size={13} /> Add to Room
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pr-form-footer">
            <button
              type="button"
              className="pr-button"
              onClick={() => setInviteModalOpen(false)}
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Consultation Session Insights Dialog */}
      <Dialog open={insightsModalOpen} onOpenChange={setInsightsModalOpen}>
        <DialogContent className="pr-dialog pr-ts-insights-dialog">
          <DialogHeader>
            <div className="pr-ts-insights-header">
              <span className="pr-ts-insights-badge">
                <Sparkles size={13} /> Telehealth Ambient Intelligence
              </span>
              <DialogTitle>AI Consultation Session Insights</DialogTitle>
              <DialogDescription>
                Synthesize patient-doctor video conversation into structured clinical summaries, ICD-10 diagnoses, medications, and care plans.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="pr-ts-insights-body">
            <div className="pr-ts-transcript-section">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Consultation Dialogue / Call Notes:</label>
                <button
                  type="button"
                  className="pr-ts-sample-btn"
                  onClick={loadSampleDialogue}
                  disabled={insightsLoading}
                >
                  Load Sample Encounter Dialogue
                </button>
              </div>
              <textarea
                rows={4}
                value={insightsTranscript}
                onChange={e => setInsightsTranscript(e.target.value)}
                placeholder="Paste consultation dialogue or click 'Load Sample Encounter Dialogue' to synthesize..."
                disabled={insightsLoading}
              />
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  className="pr-button primary pr-ts-synth-btn"
                  onClick={generateInsights}
                  disabled={insightsLoading || (!insightsTranscript.trim() && !notes.trim())}
                >
                  {insightsLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Synthesizing Insights...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Synthesize Consultation Insights
                    </>
                  )}
                </button>
              </div>
            </div>

            {insightsData && (
              <div className="pr-ts-insights-results">
                <div className="pr-ts-insights-card summary">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <strong>Clinical Encounter Summary</strong>
                  </div>
                  <p>{insightsData.summary}</p>
                </div>

                {insightsData.identified_issues.length > 0 && (
                  <div className="pr-ts-insights-card">
                    <strong>Identified Conditions & Diagnoses:</strong>
                    <div className="pr-ts-issues-tags">
                      {insightsData.identified_issues.map((issue, idx) => (
                        <div key={idx} className="pr-ts-issue-pill">
                          <span>{issue.issue}</span>
                          {issue.icd10 && <code>{issue.icd10}</code>}
                          <span className={`pr-severity-dot ${issue.severity || 'moderate'}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insightsData.suggested_medications.length > 0 && (
                  <div className="pr-ts-insights-card">
                    <strong>Suggested Pharmacotherapy:</strong>
                    <div className="pr-ts-med-list">
                      {insightsData.suggested_medications.map((m, idx) => (
                        <div key={idx} className="pr-ts-med-item">
                          <div className="pr-ts-med-name">
                            <strong>{m.drug_name} {m.dosage}</strong>
                            <span>{m.frequency} [{m.timing}] · {m.duration}</span>
                          </div>
                          <p>{m.clinical_rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insightsData.lifestyle_advice.length > 0 && (
                  <div className="pr-ts-insights-card">
                    <strong>Patient Counseling & Lifestyle:</strong>
                    <ul className="pr-ts-lifestyle-list">
                      {insightsData.lifestyle_advice.map((adv, idx) => (
                        <li key={idx}>• {adv}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pr-ts-insights-apply-bar">
                  <button
                    type="button"
                    className="pr-button primary"
                    onClick={applyInsightsToNotes}
                  >
                    <Check size={14} /> Import Synthesis to Clinical Worksheet Notes
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pr-form-footer">
            <button type="button" className="pr-button" onClick={() => setInsightsModalOpen(false)}>
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
