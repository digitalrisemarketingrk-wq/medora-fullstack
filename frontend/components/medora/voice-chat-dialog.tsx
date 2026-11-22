'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  X,
  FileText,
  Pause,
  Play,
  RotateCcw,
  Languages,
  ArrowRight,
  Database,
  Cpu,
  User,
  Send,
  Zap,
  Cloud,
  Plus,
  MessagesSquare,
  CheckCircle2,
  Scan,
  FlaskConical,
  Stethoscope,
  Pill,
  HeartPulse,
  Minus,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { toast } from 'sonner';
import { api, type ChatCitation } from '@/lib/medora-api';
import { AppContext } from './shared';
import {
  INDIAN_LANGUAGES,
  type VoiceLanguage,
  SpeechEngine,
  VoiceActivityDetector,
  cleanTextForSpeech
} from '@/lib/voice-speech';

export interface VoiceTurn {
  id: string;
  queryNumber: number;
  userQuery: string;
  reply: string;
  model: 'gemini' | 'groq';
  timestamp: string;
  citations: ChatCitation[];
  suggestions: string[];
  sources: { id: string; name: string }[];
}

interface VoiceChatDialogProps {
  ctx: AppContext;
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const VOICE_PRESETS = [
  { id: 'aria', name: 'Aria (Natural Calm Female · Recommended)', gender: 'female' as const, voiceKeyword: 'aria' },
  { id: 'jenny', name: 'Jenny (Natural Warm Female)', gender: 'female' as const, voiceKeyword: 'jenny' },
  { id: 'guy', name: 'Christopher / Guy (Natural Clear Male)', gender: 'male' as const, voiceKeyword: 'guy' },
  { id: 'neerja', name: 'Neerja (Indian English HD)', gender: 'female' as const, voiceKeyword: 'neerja' },
  { id: 'auto', name: 'System Default Neural', gender: 'female' as const, voiceKeyword: 'auto' }
];

function AudioSpectrumVisualizer({
  status,
  micVolume,
  activePhrase
}: {
  status: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted';
  micVolume: number;
  activePhrase: string;
}) {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    let animId: number;
    const loop = () => {
      setTicks((t) => (t + 1) % 360);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const barCount = 24;
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
      const bellWeight = 1 - centerDist * 0.55;
      let height = 3.5;
      if (status === 'listening') {
        const wave = Math.sin((ticks * 8 + i * 22) * (Math.PI / 180));
        height = Math.max(3.5, Math.min(28, (6 + Math.abs(wave) * 14 + micVolume * 36) * bellWeight));
      } else if (status === 'speaking') {
        const wave1 = Math.sin((ticks * 10 + i * 25) * (Math.PI / 180));
        const wave2 = Math.cos((ticks * 6 + i * 14) * (Math.PI / 180));
        height = Math.max(4, Math.min(30, (9 + (Math.abs(wave1) * 13 + Math.abs(wave2) * 8)) * bellWeight));
      } else if (status === 'thinking') {
        const pulse = (Math.sin((ticks * 4 + i * 13) * (Math.PI / 180)) + 1) / 2;
        height = Math.max(3.5, (4 + pulse * 12) * bellWeight);
      }
      return height;
    });
  }, [ticks, status, micVolume]);

  const solidBarColor =
    status === 'listening'
      ? '#059669'
      : status === 'speaking'
      ? '#245be8'
      : status === 'thinking'
      ? '#7c3aed'
      : '#cbd5e1';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', margin: '6px 0 2px' }}>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'center', height: 34, width: '100%' }}>
        {bars.map((h: number, i: number) => (
          <span
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 3,
              background: solidBarColor,
              opacity: status === 'idle' ? 0.35 : 1,
              transition: status === 'idle' ? 'height 0.25s ease' : 'none'
            }}
          />
        ))}
      </div>
      {activePhrase && status === 'speaking' && (
        <div
          style={{
            maxWidth: '92%',
            margin: '4px 0 1px',
            padding: '2px 10px',
            background: '#eaf1ff',
            border: '1px solid #c7d8fa',
            borderRadius: 12,
            fontSize: 10.5,
            color: '#245be8',
            fontWeight: 500,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontWeight: 700, marginRight: 4 }}>Speaking:</span>
          &ldquo;{activePhrase}&rdquo;
        </div>
      )}
    </div>
  );
}

export function VoiceChatDialog({ ctx, open, onClose, initialQuery }: VoiceChatDialogProps) {
  const [selectedLang, setSelectedLang] = useState<VoiceLanguage>(INDIAN_LANGUAGES[0]); // default English (Natural HD)
  const [selectedVoicePreset, setSelectedVoicePreset] = useState<string>('aria');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'groq'>('gemini');
  const [voiceSpeedMode, setVoiceSpeedMode] = useState<'instant' | 'cloud'>('instant');
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted'>('idle');

  // Window Display Mode: 'docked' (default bottom-right) | 'minimized' (compact capsule) | 'modal' (centered)
  const [viewMode, setViewMode] = useState<'docked' | 'minimized' | 'modal'>('docked');
  const [mounted, setMounted] = useState(false);

  // Multi-Turn Queries System
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [activeTab, setActiveTab] = useState<number | 'all'>('all');

  // Active Current Utterance
  const [currentUtterance, setCurrentUtterance] = useState<string>('');
  const currentUtteranceRef = useRef<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [activePhrase, setActivePhrase] = useState<string>('');
  const [micVolume, setMicVolume] = useState<number>(0);
  const [autoListen, setAutoListen] = useState<boolean>(true);
  const [recognitionSupported, setRecognitionSupported] = useState<boolean>(true);
  const [playingTurnId, setPlayingTurnId] = useState<string | null>(null);

  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const userSpokeRef = useRef<boolean>(false);
  const turnsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activePresetConfig = useMemo(() => {
    return VOICE_PRESETS.find((v) => v.id === selectedVoicePreset) || VOICE_PRESETS[0];
  }, [selectedVoicePreset]);

  // Initialize Speech Engine & Voice Activity Detection
  useEffect(() => {
    speechEngineRef.current = new SpeechEngine(
      (state) => {
        isSpeakingRef.current = state === 'speaking';
        if (state === 'speaking') {
          setStatus('speaking');
        } else if (state === 'idle') {
          setPlayingTurnId(null);
          if (status === 'speaking') {
            setStatus('idle');
            if (autoListen) {
              startListening();
            }
          }
        }
      },
      (phrase) => {
        setActivePhrase(phrase);
      }
    );

    vadRef.current = new VoiceActivityDetector(
      () => {
        if (isSpeakingRef.current) {
          handleBargeIn();
        }
      },
      (vol) => {
        setMicVolume(vol);
      }
    );

    return () => {
      speechEngineRef.current?.stop();
      vadRef.current?.stop();
      stopListening();
    };
  }, [autoListen]);

  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, activeTab, currentUtterance]);

  const handleBargeIn = useCallback(() => {
    if (speechEngineRef.current) {
      speechEngineRef.current.stop();
    }
    isSpeakingRef.current = false;
    setPlayingTurnId(null);
    setStatus('interrupted');
    toast.info('Medora paused · Listening to your voice...', { duration: 1600 });
    setTimeout(() => {
      startListening();
    }, 150);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setRecognitionSupported(false);
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLang.code;

      recognition.onstart = () => {
        setStatus('listening');
        userSpokeRef.current = false;
      };

      recognition.onresult = (event: any) => {
        userSpokeRef.current = true;
        let interim = '';
        let finalTrans = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTrans += trans;
          } else {
            interim += trans;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }

        if (finalTrans) {
          const updated = (currentUtteranceRef.current ? currentUtteranceRef.current + ' ' : '') + finalTrans.trim();
          currentUtteranceRef.current = updated;
          setCurrentUtterance(updated);
          setInterimTranscript('');

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = setTimeout(() => {
            void submitQuery(currentUtteranceRef.current);
          }, 650);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        console.warn('Speech recognition notice:', event.error);
      };

      recognition.onend = () => {
        if (status === 'listening' && !userSpokeRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      vadRef.current?.start();
    } catch (e) {
      console.warn('Could not launch recognition:', e);
    }
  }, [selectedLang, status, handleBargeIn]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    vadRef.current?.stop();
    if (status === 'listening') {
      setStatus('idle');
    }
  }, [status]);

  const submitQuery = async (queryText: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) return;

    stopListening();
    setStatus('thinking');
    currentUtteranceRef.current = '';
    setCurrentUtterance('');
    setInterimTranscript('');

    const historyPayload = turns.slice(-6).flatMap((t) => [
      { role: 'user' as const, content: t.userQuery },
      { role: 'assistant' as const, content: t.reply }
    ]);

    try {
      let apiMessage = cleanQuery;
      if (selectedLang.langKey !== 'en') {
        apiMessage = `[User preferred language: ${selectedLang.name}] ${cleanQuery}`;
      }

      const res = await api.chat(
        apiMessage,
        historyPayload,
        ctx.ownerId,
        aiProvider
      );

      const reply = res.answer;
      const turnId = Math.random().toString(36).slice(2, 9);
      const newTurn: VoiceTurn = {
        id: turnId,
        queryNumber: turns.length + 1,
        userQuery: cleanQuery,
        reply: reply,
        model: aiProvider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: res.citations || [],
        suggestions: res.suggestions || [],
        sources: res.sources || []
      };

      setTurns((prev) => [...prev, newTurn]);
      setActiveTab(newTurn.queryNumber);
      setPlayingTurnId(turnId);

      const cleanVoiceText = cleanTextForSpeech(reply);

      await speechEngineRef.current?.speakText(
        cleanVoiceText || reply,
        selectedLang.code,
        () => {
          setStatus('idle');
          setPlayingTurnId(null);
          if (autoListen) {
            startListening();
          }
        },
        activePresetConfig.gender,
        voiceSpeedMode,
        'auto',
        activePresetConfig.voiceKeyword
      );
    } catch (err: any) {
      const msg = err?.message || 'Could not process audio voice request.';
      toast.error(msg);
      setStatus('idle');
      setPlayingTurnId(null);
    }
  };

  const replayTurnVoice = (turn: VoiceTurn) => {
    if (playingTurnId === turn.id && status === 'speaking') {
      speechEngineRef.current?.stop();
      setPlayingTurnId(null);
      setStatus('idle');
    } else {
      speechEngineRef.current?.stop();
      setPlayingTurnId(turn.id);
      const cleanVoiceText = cleanTextForSpeech(turn.reply);
      speechEngineRef.current?.speakText(
        cleanVoiceText || turn.reply,
        selectedLang.code,
        () => {
          setStatus('idle');
          setPlayingTurnId(null);
        },
        activePresetConfig.gender,
        voiceSpeedMode,
        'auto',
        activePresetConfig.voiceKeyword
      );
    }
  };

  const testVoiceSample = () => {
    const sampleMsg = "Hello! I am Medora. Your medical records are connected and ready.";
    speechEngineRef.current?.speakText(
      sampleMsg,
      selectedLang.code,
      () => setStatus('idle'),
      activePresetConfig.gender,
      voiceSpeedMode,
      'auto',
      activePresetConfig.voiceKeyword
    );
    toast.success(`Voice set to: ${activePresetConfig.name}`);
  };

  const handleLanguageChange = (lang: VoiceLanguage) => {
    setSelectedLang(lang);
    toast.success(`Language set to ${lang.name}`);
    if (status === 'listening') {
      stopListening();
      setTimeout(() => startListening(), 250);
    }
  };

  useEffect(() => {
    if (open && initialQuery && initialQuery.trim()) {
      void submitQuery(initialQuery.trim());
    } else if (open && turns.length === 0) {
      const timer = setTimeout(() => {
        startListening();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const displayedTurns =
    activeTab === 'all'
      ? turns
      : turns.filter((t) => t.queryNumber === activeTab);

  // Distinct 4 quick prompts with medical icons
  const distinctPrompts = useMemo(() => {
    const list = [
      { text: selectedLang.samplePrompt, icon: Scan, iconColor: '#0d9488', iconBg: '#e5f7f2' },
      { text: 'Explain my cholesterol and glucose test results', icon: FlaskConical, iconColor: '#245be8', iconBg: '#eaf1ff' },
      { text: 'What did Dr. Rajesh Sharma advise in my last visit?', icon: Stethoscope, iconColor: '#7c3aed', iconBg: '#efeaff' },
      { text: 'Are there any interactions with my active prescriptions?', icon: Pill, iconColor: '#c45275', iconBg: '#ffedf2' }
    ];
    const seen = new Set<string>();
    return list.filter((item) => {
      if (seen.has(item.text)) return false;
      seen.add(item.text);
      return true;
    });
  }, [selectedLang]);

  if (!open || !mounted) return null;

  // 1. Minimized Mode (Floating Compact Pill)
  if (viewMode === 'minimized') {
    return createPortal(
      <aside
        aria-label="Medora Voice Companion Minimized"
        onClick={() => setViewMode('docked')}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          height: 44,
          padding: '0 16px',
          borderRadius: 22,
          background: '#ffffff',
          border: '1px solid #245be8',
          boxShadow: '0 8px 24px rgba(36, 91, 232, 0.22)',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          cursor: 'pointer',
          transition: 'all 0.18s ease'
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: status === 'listening' ? '#e8f7f1' : '#eaf1ff',
            color: status === 'listening' ? '#167764' : '#245be8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Mic size={14} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 650, color: '#172a46' }}>
          Medora Voice · {status === 'listening' ? 'Listening…' : status === 'speaking' ? 'Speaking…' : 'Tap to expand'}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#8b9bb1',
            cursor: 'pointer',
            padding: 2,
            marginLeft: 4
          }}
        >
          <X size={14} />
        </button>
      </aside>,
      document.body
    );
  }

  // 2. Docked Corner Studio (Default) or Modal Mode (Expanded Center)
  const isModal = viewMode === 'modal';

  const containerStyle: React.CSSProperties = isModal
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 540,
        maxWidth: '92vw',
        maxHeight: '90vh',
        zIndex: 60,
        background: '#ffffff',
        border: '1px solid #dce3ee',
        borderRadius: 16,
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }
    : {
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 430,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 48px)',
        zIndex: 60,
        background: '#ffffff',
        border: '1px solid #dce3ee',
        borderRadius: 16,
        boxShadow: '0 16px 40px -10px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      };

  return createPortal(
    <>
      {/* Modal Backdrop only when in centered modal mode */}
      {isModal && (
        <div
          onClick={() => setViewMode('docked')}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.35)',
            zIndex: 59,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      <aside aria-label="Medora Voice Companion Studio" style={containerStyle}>
        {/* Top Header Bar */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: '#eaf1ff',
                color: '#245be8',
                border: '1px solid #c7d8fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Mic size={15} />
            </span>
            <div>
              <strong style={{ fontSize: 13, color: '#172a46', display: 'block', lineHeight: 1.2 }}>
                Voice Companion
              </strong>
              <small style={{ fontSize: 10.5, color: '#64748b' }}>
                Grounded in your medical records
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* AI Engine Switcher (Solid) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                background: '#f1f5fa',
                padding: '2px 3px',
                borderRadius: 6,
                border: '1px solid #dce3ee'
              }}
            >
              <button
                type="button"
                onClick={() => setAiProvider('gemini')}
                title="Google Cloud Gemini 3.1 Flash"
                style={{
                  border: 'none',
                  fontSize: 10,
                  fontWeight: 650,
                  padding: '2px 6px',
                  borderRadius: 5,
                  background: aiProvider === 'gemini' ? '#245be8' : 'transparent',
                  color: aiProvider === 'gemini' ? '#ffffff' : '#5b6b83',
                  cursor: 'pointer'
                }}
              >
                Gemini
              </button>
              <button
                type="button"
                onClick={() => setAiProvider('groq')}
                title="Groq 120B Ultra-Fast"
                style={{
                  border: 'none',
                  fontSize: 10,
                  fontWeight: 650,
                  padding: '2px 6px',
                  borderRadius: 5,
                  background: aiProvider === 'groq' ? '#d97706' : 'transparent',
                  color: aiProvider === 'groq' ? '#ffffff' : '#5b6b83',
                  cursor: 'pointer'
                }}
              >
                Groq
              </button>
            </div>

            {/* Window Mode Controls: Minimize, Dock/Expand, Close */}
            <button
              type="button"
              onClick={() => setViewMode('minimized')}
              title="Minimize to floating pill"
              style={{
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#64748b',
                width: 26,
                height: 26,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Minus size={13} />
            </button>

            <button
              type="button"
              onClick={() => setViewMode(isModal ? 'docked' : 'modal')}
              title={isModal ? 'Dock to bottom corner' : 'Expand to center modal'}
              style={{
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#64748b',
                width: 26,
                height: 26,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {isModal ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close voice conversation"
              style={{
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#64748b',
                width: 26,
                height: 26,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Compact Voice & Persona Bar */}
        <div
          style={{
            padding: '7px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap'
          }}
        >
          {/* Voice Persona Selector with Test Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200 }}>
            <Sparkles size={12} color="#245be8" style={{ flexShrink: 0 }} />
            <select
              value={selectedVoicePreset}
              onChange={(e) => {
                setSelectedVoicePreset(e.target.value);
                const preset = VOICE_PRESETS.find((v) => v.id === e.target.value);
                if (preset) {
                  toast.success(`Voice changed to: ${preset.name.split('(')[0].trim()}`);
                }
              }}
              style={{
                fontSize: 11,
                padding: '3px 6px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#172a46',
                fontWeight: 600,
                cursor: 'pointer',
                flex: 1,
                minHeight: 'auto',
                width: 'auto'
              }}
            >
              {VOICE_PRESETS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={testVoiceSample}
              title="Preview selected voice"
              style={{
                border: '1px solid #dce7fc',
                background: '#eaf1ff',
                color: '#245be8',
                borderRadius: 6,
                padding: '3px 7px',
                fontSize: 10.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0
              }}
            >
              <Volume2 size={11} /> Test
            </button>
          </div>

          {/* Language Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Languages size={13} color="#64748b" />
            <select
              value={selectedLang.code}
              onChange={(e) => {
                const l = INDIAN_LANGUAGES.find((x) => x.code === e.target.value);
                if (l) handleLanguageChange(l);
              }}
              style={{
                fontSize: 11,
                padding: '3px 6px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#172a46',
                fontWeight: 500,
                cursor: 'pointer',
                minHeight: 'auto',
                width: 'auto'
              }}
            >
              {INDIAN_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Central Audio Orb & Visualizer */}
        <div
          style={{
            padding: '14px 16px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff'
          }}
        >
          {/* Solid State Voice Orb */}
          <button
            type="button"
            onClick={() => {
              if (status === 'listening') {
                stopListening();
              } else {
                startListening();
              }
            }}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: 'none',
              background:
                status === 'speaking'
                  ? '#245be8'
                  : status === 'listening'
                  ? '#059669'
                  : status === 'thinking'
                  ? '#7c3aed'
                  : '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow:
                status === 'speaking'
                  ? '0 0 0 6px rgba(36, 91, 232, 0.16)'
                  : status === 'listening'
                  ? '0 0 0 6px rgba(5, 150, 105, 0.16)'
                  : status === 'thinking'
                  ? '0 0 0 6px rgba(124, 58, 237, 0.16)'
                  : '0 3px 10px rgba(0, 0, 0, 0.08)',
              cursor: 'pointer',
              transform: `scale(${1 + micVolume * 0.14})`,
              transition: 'transform 0.08s ease, background 0.2s ease'
            }}
            title={status === 'listening' ? 'Click to stop listening' : 'Click to speak'}
          >
            {status === 'speaking' ? (
              <Volume2 size={20} />
            ) : status === 'listening' ? (
              <Mic size={20} />
            ) : status === 'thinking' ? (
              <Sparkles size={20} />
            ) : (
              <Mic size={20} />
            )}
          </button>

          {/* Audio Spectrum Bars */}
          <AudioSpectrumVisualizer status={status} micVolume={micVolume} activePhrase={activePhrase} />

          {/* Status Pill */}
          <div style={{ marginTop: 4, textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 10px',
                borderRadius: 12,
                fontSize: 10.5,
                fontWeight: 600,
                background:
                  status === 'speaking'
                    ? '#eaf1ff'
                    : status === 'listening'
                    ? '#e8f7f1'
                    : status === 'interrupted'
                    ? '#fff5e5'
                    : status === 'thinking'
                    ? '#efeaff'
                    : '#f1f5fa',
                color:
                  status === 'speaking'
                    ? '#245be8'
                    : status === 'listening'
                    ? '#167764'
                    : status === 'interrupted'
                    ? '#956018'
                    : status === 'thinking'
                    ? '#7c3aed'
                    : '#5b6b83',
                border: '1px solid rgba(0,0,0,0.06)'
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background:
                    status === 'speaking'
                      ? '#245be8'
                      : status === 'listening'
                      ? '#167764'
                      : status === 'interrupted'
                      ? '#956018'
                      : status === 'thinking'
                      ? '#7c3aed'
                      : '#8a9cb7'
                }}
              />
              {status === 'speaking' && 'Speaking · Interrupt anytime'}
              {status === 'listening' && <span>Listening for Query {turns.length + 1}…</span>}
              {status === 'thinking' && 'Reasoning clinical answer…'}
              {status === 'interrupted' && 'Paused · Listening to your voice'}
              {status === 'idle' && 'Tap orb or Speak below'}
            </span>
          </div>
        </div>

        {/* Live Conversation Transcript Area */}
        <div style={{ padding: '8px 16px', flex: 1, minHeight: 0, overflowY: 'auto', maxHeight: isModal ? 340 : 200 }}>
          {/* Active Speaking Input (Current Query in real-time) */}
          {(currentUtterance || interimTranscript || (status === 'listening' && turns.length > 0)) && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #c7d8fa',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#245be8', textTransform: 'uppercase' }}>
                  Query {turns.length + 1} (Speaking Now):
                </span>
                {currentUtterance.trim() && (
                  <button
                    type="button"
                    onClick={() => void submitQuery(currentUtterance)}
                    style={{
                      border: 'none',
                      background: '#245be8',
                      color: '#ffffff',
                      borderRadius: 5,
                      padding: '2px 7px',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3
                    }}
                  >
                    <Send size={10} /> Send Now
                  </button>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: '#172a46', fontWeight: 500 }}>
                {currentUtterance || (
                  <span style={{ color: '#8b9bb1', fontStyle: 'italic' }}>
                    Listening for your query…
                  </span>
                )}
                {interimTranscript && (
                  <span style={{ color: '#245be8' }}> {interimTranscript}</span>
                )}
              </p>
            </div>
          )}

          {/* Render Completed Query Turns */}
          {displayedTurns.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayedTurns.map((turn) => (
                <div
                  key={turn.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 9,
                    background: '#ffffff',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      padding: '6px 10px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #eef2f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          background: '#245be8',
                          color: '#ffffff',
                          padding: '1px 5px',
                          borderRadius: 3
                        }}
                      >
                        Q{turn.queryNumber}
                      </span>
                      <strong style={{ fontSize: 11.5, color: '#172a46' }}>{turn.userQuery}</strong>
                    </div>
                    <span style={{ fontSize: 9.5, color: '#8b9bb1' }}>{turn.timestamp}</span>
                  </div>

                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#245be8', textTransform: 'uppercase' }}>
                        Medora Answer:
                      </span>

                      <button
                        type="button"
                        onClick={() => replayTurnVoice(turn)}
                        style={{
                          border: 'none',
                          background: playingTurnId === turn.id ? '#eaf1ff' : '#f1f5fa',
                          color: playingTurnId === turn.id ? '#245be8' : '#475569',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 5,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3
                        }}
                      >
                        {playingTurnId === turn.id ? <Pause size={10} /> : <Play size={10} />}
                        {playingTurnId === turn.id ? 'Pause' : 'Listen'}
                      </button>
                    </div>

                    <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: '#334155', whiteSpace: 'pre-line' }}>
                      {turn.reply}
                    </p>

                    {turn.citations.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 9.5,
                            background: '#e8f7f1',
                            border: '1px solid #b7ebd8',
                            padding: '1px 5px',
                            borderRadius: 4,
                            color: '#167764',
                            fontWeight: 650
                          }}
                        >
                          <Database size={9} /> Grounded in Records
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Initial Empty State with 2x2 Compact Prompt Cards (No Scrollbar Needed!) */
            !currentUtterance && (
              <div style={{ padding: '4px 0' }}>
                <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>
                  Tap a quick clinical question to ask:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                  {distinctPrompts.map((p, i) => {
                    const PromptIcon = p.icon;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => void submitQuery(p.text)}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          fontSize: 11,
                          color: '#172a46',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#245be8';
                          e.currentTarget.style.background = '#f8fbff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 5,
                            background: p.iconBg,
                            color: p.iconColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <PromptIcon size={12} />
                        </span>
                        <span
                          style={{
                            flex: 1,
                            fontWeight: 500,
                            lineHeight: 1.25,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}
                        >
                          {p.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}
          <div ref={turnsEndRef} />
        </div>

        {/* Footer Action Bar */}
        <div
          style={{
            padding: '8px 16px 10px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn"
              style={{
                borderRadius: 7,
                padding: '5px 12px',
                fontSize: 11.5,
                gap: 5,
                minHeight: 32,
                background: status === 'listening' ? '#059669' : '#245be8',
                color: '#ffffff',
                border: `1px solid ${status === 'listening' ? '#047857' : '#1d4ed8'}`
              }}
              onClick={() => {
                if (status === 'listening') {
                  stopListening();
                } else {
                  startListening();
                }
              }}
            >
              {status === 'listening' ? <MicOff size={13} /> : <Mic size={13} />}
              {status === 'listening' ? 'Stop' : 'Speak'}
            </button>

            <button
              type="button"
              className="btn secondary"
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 7,
                minHeight: 32,
                color: '#5b6b83',
                border: '1px solid #dce3ee',
                background: '#ffffff',
                gap: 4
              }}
              onClick={() => {
                speechEngineRef.current?.stop();
                stopListening();
                setTurns([]);
                setActiveTab('all');
                setCurrentUtterance('');
                setInterimTranscript('');
                setStatus('idle');
                toast.success('Conversation reset');
              }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>

          {/* Hands-Free Loop Toggle */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: 11,
              color: '#334155',
              fontWeight: 500
            }}
          >
            <input
              type="checkbox"
              checked={autoListen}
              onChange={(e) => setAutoListen(e.target.checked)}
              style={{
                width: 14,
                height: 14,
                minHeight: 14,
                maxHeight: 14,
                margin: 0,
                cursor: 'pointer',
                accentColor: '#245be8',
                flexShrink: 0
              }}
            />
            <span>Hands-free Loop</span>
          </label>
        </div>
      </aside>
    </>,
    document.body
  );
}
