'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  ExternalLink,
  HeartPulse,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  ShieldCheck,
  Stethoscope,
  User,
  Video,
  VideoOff,
  Volume2
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function PatientTelehealthPage() {
  const [roomId, setRoomId] = useState('');
  const [patientName, setPatientName] = useState('Patient');
  const [role, setRole] = useState<'patient' | 'caregiver' | 'specialist' | 'interpreter'>('patient');
  const [clinician, setClinician] = useState('Dr. Maya Patel, MD');
  const [callActive, setCallActive] = useState(true);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Parse room from search params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('room') || 'MedoraTelehealth_Encounter';
      setRoomId(room);
      const r = (params.get('role') || 'patient') as 'patient' | 'caregiver' | 'specialist' | 'interpreter';
      setRole(r);
      const name = params.get('name') || params.get('patient') || (r === 'caregiver' ? 'Family Caregiver' : r === 'specialist' ? 'Consulting Specialist' : r === 'interpreter' ? 'Medical Interpreter' : 'Patient');
      setPatientName(name);
      const doc = params.get('doctor');
      if (doc) setClinician(doc);
    }
  }, []);

  // Timer
  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => setCallSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  const formatTimer = (total: number) => {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize WebRTC P2P connection
  useEffect(() => {
    if (!roomId) return;
    let isCancelled = false;

    const initWebRTC = async () => {
      try {
        // 1. Get user media (patient webcam + mic)
        let stream: MediaStream | null = null;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch {
            // fallback audio only or mock
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch {
              console.warn('Media devices not accessible on this device');
            }
          }
        }
        if (isCancelled) return;

        localStreamRef.current = stream;
        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Setup RTCPeerConnection
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
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setIsConnected(true);
            toast.success('Connected live with ' + clinician);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && channelRef.current) {
            channelRef.current.postMessage({
              type: 'ice-candidate',
              sender: 'patient',
              candidate: event.candidate
            });
          }
        };

        // 3. BroadcastChannel signaling
        const channel = new BroadcastChannel(`medora_telehealth_${roomId}`);
        channelRef.current = channel;

        channel.onmessage = async (e) => {
          const msg = e.data;
          if (!msg || msg.sender === 'patient') return;

          if (msg.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.postMessage({
              type: 'answer',
              sender: 'patient',
              answer
            });
            setIsConnected(true);
          } else if (msg.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
            setIsConnected(true);
          } else if (msg.type === 'ice-candidate' && msg.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch {
              // candidate addition error ignored
            }
          } else if (msg.type === 'ready-doctor') {
            // Send our ready signal
            channel.postMessage({
              type: 'ready-patient',
              sender: 'patient',
              senderId: `peer-${Date.now().toString(36)}`,
              name: patientName,
              role
            });
          }
        };

        // Announce patient is ready in room
        channel.postMessage({
          type: 'ready-patient',
          sender: 'patient',
          senderId: `peer-${Date.now().toString(36)}`,
          name: patientName,
          role
        });

      } catch (err) {
        console.error('WebRTC init failed:', err);
      }
    };

    void initWebRTC();

    return () => {
      isCancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (channelRef.current) {
        channelRef.current.close();
      }
    };
  }, [roomId, clinician]);

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    } else {
      setMicMuted(prev => !prev);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoOff(!videoTrack.enabled);
      }
    } else {
      setVideoOff(prev => !prev);
    }
  };

  const handleEndCall = () => {
    setCallActive(false);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    toast.info('Consultation session ended');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Toaster position="top-right" richColors />

      {/* Top Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-600/20 text-teal-400 flex items-center justify-center font-bold">
            <HeartPulse size={20} />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wider text-teal-400 uppercase">
              Medora Telehealth · {role.toUpperCase()} PORTAL
            </div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Virtual Consultation with {clinician}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-full text-xs">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{isConnected ? 'P2P WebRTC HD Connected' : 'Waiting for Doctor'}</span>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-full text-xs font-bold">
            {formatTimer(callSeconds)}
          </div>
        </div>
      </header>

      {/* Main Video Area */}
      <main className="flex-1 p-6 flex flex-col max-w-6xl w-full mx-auto">
        <div className="relative flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center min-h-[460px]">
          {/* Main Remote Feed (Doctor) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${!isConnected ? 'hidden' : ''}`}
          />

          {!isConnected && (
            <div className="flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-teal-500/10 border-2 border-teal-500/40 flex items-center justify-center text-teal-400 animate-pulse">
                  <Stethoscope size={44} />
                </div>
                <div className="absolute inset-0 rounded-full border border-teal-500/20 animate-ping" />
              </div>
              <div className="max-w-md">
                <h2 className="text-lg font-bold text-white mb-1">Connecting to {clinician}...</h2>
                <p className="text-xs text-slate-400">
                  Your secure, encrypted 1-on-1 WebRTC video channel is active. Once Dr. Maya Patel begins the call, their video will appear here.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-300">
                <ShieldCheck size={14} className="text-teal-400" />
                <span>Encrypted P2P Room ID: <strong>{roomId.slice(0, 18)}</strong></span>
              </div>
            </div>
          )}

          {/* Remote Doctor Overlay */}
          {isConnected && (
            <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <strong className="text-white">{clinician}</strong>
              <span className="text-slate-400">· Attending Physician</span>
            </div>
          )}

          {/* Patient Self-View PiP */}
          <div className="absolute bottom-5 right-5 w-44 h-28 bg-slate-950 border-2 border-teal-500/60 rounded-xl overflow-hidden shadow-2xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${videoOff ? 'hidden' : ''}`}
            />
            {videoOff && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500 text-[10px]">
                <CameraOff size={20} className="mb-1" />
                <span>Camera Paused</span>
              </div>
            )}
            <div className="absolute bottom-1 left-2 bg-black/60 px-1.5 py-0.5 rounded text-[9px] font-semibold text-white">
              You ({patientName})
            </div>
          </div>
        </div>

        {/* In-Call Controls Dock */}
        <div className="mt-4 flex items-center justify-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-3 max-w-lg mx-auto w-full shadow-lg">
          <button
            type="button"
            onClick={toggleMic}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              micMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
            <span>{micMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            type="button"
            onClick={toggleVideo}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              videoOff ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {videoOff ? <VideoOff size={18} /> : <Video size={18} />}
            <span>{videoOff ? 'Start Video' : 'Stop Video'}</span>
          </button>

          <button
            type="button"
            onClick={handleEndCall}
            className="flex flex-col items-center gap-1 px-5 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition shadow-md"
          >
            <PhoneOff size={18} />
            <span>Leave Visit</span>
          </button>
        </div>
      </main>
    </div>
  );
}
