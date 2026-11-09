'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  FileText,
  Mic,
  Volume2,
  VolumeX,
  Database,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  HelpCircle,
  Cpu,
  Copy,
  Check,
  RotateCcw,
  Stethoscope,
  Pill,
  CalendarDays,
  ShieldCheck,
  User,
  ThumbsUp,
  ThumbsDown,
  FlaskConical,
  Scan,
  HeartPulse,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { api, type ChatCitation } from '@/lib/medora-api';
import { type AppContext, Heading, Panel } from './shared';
import { VoiceChatDialog } from './voice-chat-dialog';
import { SpeechEngine } from '@/lib/voice-speech';
import { niceDate } from '@/lib/medora-demo';

type Turn = {
  role: 'user' | 'assistant';
  content: string;
  sources?: { id: string; name: string }[];
  retrieval?: string;
  citations?: ChatCitation[];
  suggestions?: string[];
  provider?: 'gemini' | 'groq';
  timestamp?: string;
  feedback?: 'like' | 'dislike' | null;
};

type PromptCategory = 'all' | 'labs' | 'imaging' | 'meds' | 'visits';

export function LiveChat({ ctx }: { ctx: AppContext }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [openCitationsIndex, setOpenCitationsIndex] = useState<number | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<'en' | 'hi' | 'hinglish' | 'ta' | 'bn'>('en');
  const [promptCategory, setPromptCategory] = useState<PromptCategory>('all');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'groq'>('gemini');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const patientName = ctx.data.settings.name || 'Alex';
  const documents = ctx.data.documents || [];
  const upcomingAppointment = ctx.data.appointments?.find((a) => a.status === 'Confirmed');

  useEffect(() => {
    speechEngineRef.current = new SpeechEngine((state) => {
      if (state !== 'speaking') {
        setSpeakingIndex(null);
      }
    });
    return () => {
      speechEngineRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  const send = async (overrideText?: string) => {
    const text = (overrideText || message).trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newTurns: Turn[] = [...turns, { role: 'user', content: text, timestamp: timeStr }];
    setTurns(newTurns);
    if (!overrideText) setMessage('');

    try {
      await ctx.flush?.();
      const historyPayload = newTurns.slice(-10).map((t) => ({
        role: t.role,
        content: t.content
      }));

      const result = await api.chat(
        text,
        historyPayload,
        ctx.ownerId,
        aiProvider
      );

      const responseTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.answer,
          sources: result.sources,
          retrieval: result.retrieval,
          citations: result.citations,
          suggestions: result.suggestions,
          provider: result.provider || aiProvider,
          timestamp: responseTime,
          feedback: null
        }
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The answer could not be prepared.');
      toast.error('Could not get response from AI. Please retry.');
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      toast.success('Response copied to clipboard');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const setTurnFeedback = (index: number, feedback: 'like' | 'dislike') => {
    setTurns((prev) =>
      prev.map((t, i) => (i === index ? { ...t, feedback: t.feedback === feedback ? null : feedback } : t))
    );
    toast.success(
      feedback === 'like' ? 'Thank you for your feedback!' : 'Feedback noted. We will refine future responses.'
    );
  };

  const cleanSpeechText = (raw: string) => {
    return raw
      .replace(/\|[^\n]+\|/g, '')
      .replace(/[#*`_~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, '. ')
      .trim();
  };

  const toggleSpeakTurn = (index: number, content: string) => {
    if (speakingIndex === index) {
      speechEngineRef.current?.stop();
      setSpeakingIndex(null);
    } else {
      speechEngineRef.current?.stop();
      setSpeakingIndex(index);
      const isHindi = /[\u0900-\u097F]/.test(content);
      const isTamil = /[\u0B80-\u0BFF]/.test(content);
      const isBengali = /[\u0980-\u09FF]/.test(content);
      const lang = isHindi ? 'hi-IN' : isTamil ? 'ta-IN' : isBengali ? 'bn-IN' : 'en-IN';

      const speechReady = cleanSpeechText(content);
      speechEngineRef.current?.speakText(speechReady, lang, () => {
        setSpeakingIndex(null);
      });
    }
  };

  const categorizedPrompts: Record<
    string,
    { category: PromptCategory; text: string; icon: any; iconColor: string; iconBg: string }[]
  > = {
    en: [
      { category: 'imaging', text: 'What was my last X-Ray report and what does it show?', icon: Scan, iconColor: '#0d9488', iconBg: '#e5f7f2' },
      { category: 'labs', text: 'Summarize my blood test cholesterol & glucose readings', icon: FlaskConical, iconColor: '#245be8', iconBg: '#eaf1ff' },
      { category: 'visits', text: 'What did Dr Sarah Khan advise during my annual review?', icon: Stethoscope, iconColor: '#7c3aed', iconBg: '#efeaff' },
      { category: 'visits', text: 'Who is my cardiology referral for and what is next?', icon: CalendarDays, iconColor: '#7c3aed', iconBg: '#efeaff' },
      { category: 'meds', text: 'Are there any interactions with my current prescriptions?', icon: Pill, iconColor: '#c45275', iconBg: '#ffedf2' },
      { category: 'labs', text: 'Were any of my metabolic panel markers out of range?', icon: FlaskConical, iconColor: '#245be8', iconBg: '#eaf1ff' }
    ],
    hi: [
      { category: 'imaging', text: 'मेरी पिछली एक्स-रे रिपोर्ट में क्या निष्कर्ष आए?', icon: Scan, iconColor: '#0d9488', iconBg: '#e5f7f2' },
      { category: 'labs', text: 'मेरे ब्लड टेस्ट में कोलेस्ट्रॉल और ग्लूकोज के नतीजे क्या हैं?', icon: FlaskConical, iconColor: '#245be8', iconBg: '#eaf1ff' },
      { category: 'visits', text: 'सालाना स्वास्थ्य समीक्षा में डॉक्टर ने क्या सलाह दी?', icon: Stethoscope, iconColor: '#7c3aed', iconBg: '#efeaff' },
      { category: 'meds', text: 'मेरी दवाओं के बारे में पूरी जानकारी दें', icon: Pill, iconColor: '#c45275', iconBg: '#ffedf2' }
    ],
    hinglish: [
      { category: 'imaging', text: 'Mera last chest x-ray report kya show karta hai?', icon: Scan, iconColor: '#0d9488', iconBg: '#e5f7f2' },
      { category: 'labs', text: 'Blood test report me glucose aur lipid levels kaise hain?', icon: FlaskConical, iconColor: '#245be8', iconBg: '#eaf1ff' },
      { category: 'visits', text: 'Dr Sarah Khan ne annual visit me kya advise diya tha?', icon: Stethoscope, iconColor: '#7c3aed', iconBg: '#efeaff' },
      { category: 'visits', text: 'Cardiology consultation ke liye kya referral bana hai?', icon: CalendarDays, iconColor: '#7c3aed', iconBg: '#efeaff' }
    ],
    ta: [
      { category: 'imaging', text: 'எனது சமீபத்திய எக்ஸ்ரே அறிக்கை என்ன சொல்கிறது?', icon: Scan, iconColor: '#0d9488', iconBg: '#e5f7f2' },
      { category: 'labs', text: 'எனது இரத்த பரிசோதனை முடிவுகளை விளக்குங்கள்', icon: FlaskConical, iconColor: '#245be8', iconBg: '#eaf1ff' },
      { category: 'visits', text: 'மருத்துவர் வழங்கிய முக்கிய ஆலோசனைகள் என்ன?', icon: Stethoscope, iconColor: '#7c3aed', iconBg: '#efeaff' }
    ],
    bn: [
      { category: 'imaging', text: 'আমার সর্বশেষ এক্স-রে রিপোর্টে কি পাওয়া গেছে?', icon: Scan, iconColor: '#0d9488', iconBg: '#e5f7f2' },
      { category: 'labs', text: 'আমার রক্তের পরীক্ষার ফলাফল বিস্তারিত বলুন', icon: FlaskConical, iconColor: '#245be8', iconBg: '#eaf1ff' },
      { category: 'visits', text: 'ডাক্তারের বার্ষিক স্বাস্থ্য পরীক্ষার পরামর্শ কি ছিল?', icon: Stethoscope, iconColor: '#7c3aed', iconBg: '#efeaff' }
    ]
  };

  const activePrompts = categorizedPrompts[activeLangTab] || categorizedPrompts.en;
  const filteredPrompts =
    promptCategory === 'all'
      ? activePrompts
      : activePrompts.filter((p) => p.category === promptCategory);

  // Clean structured typography renderer for assistant answers
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} style={{ height: 8 }} />;
      }

      if (trimmed.startsWith('###')) {
        return (
          <h4
            key={idx}
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#172a46',
              marginTop: 10,
              marginBottom: 4,
              letterSpacing: '-0.2px'
            }}
          >
            {trimmed.replace(/^###\s*/, '')}
          </h4>
        );
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
        const textPart = trimmed.replace(/^[-•*]\s*/, '');
        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              margin: '3px 0',
              paddingLeft: 4
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#245be8',
                marginTop: 8,
                flexShrink: 0
              }}
            />
            <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.6, color: '#334155' }}>
              {renderBoldText(textPart)}
            </span>
          </div>
        );
      }

      if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s*(.*)/);
        if (match) {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                margin: '3px 0',
                paddingLeft: 4
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#245be8',
                  background: '#eaf1ff',
                  borderRadius: 4,
                  padding: '1px 6px',
                  marginTop: 2,
                  flexShrink: 0
                }}
              >
                {match[1]}
              </span>
              <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.6, color: '#334155' }}>
                {renderBoldText(match[2])}
              </span>
            </div>
          );
        }
      }

      return (
        <p
          key={idx}
          style={{
            margin: '4px 0',
            fontSize: 13.5,
            lineHeight: 1.65,
            color: '#334155'
          }}
        >
          {renderBoldText(line)}
        </p>
      );
    });
  };

  const renderBoldText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} style={{ color: '#0f172a', fontWeight: 650 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <>
      <Heading
        title="Conversational AI Health Companion"
        sub="Instant, verified answers grounded in your private medical records, lab reports, and care plan."
        eyebrow="ASK MEDORA · CLINICAL AI NAVIGATOR"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Intelligence Engine Switcher Pill (Solid Colors, No Gradients) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: '#f1f5fa',
              padding: '3px 4px',
              borderRadius: 10,
              border: '1px solid #dce3ee'
            }}
          >
            <button
              type="button"
              onClick={() => setAiProvider('gemini')}
              title="Google Cloud Gemini 3.1 Flash with multimodal clinical reasoning"
              style={{
                border: 'none',
                fontSize: 11.5,
                fontWeight: 650,
                padding: '5px 12px',
                borderRadius: 8,
                background: aiProvider === 'gemini' ? '#245be8' : 'transparent',
                color: aiProvider === 'gemini' ? '#ffffff' : '#5b6b83',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles size={13} /> Gemini 3.1 Flash
            </button>
            <button
              type="button"
              onClick={() => setAiProvider('groq')}
              title="Groq 120B Ultra-Fast Clinical Inference"
              style={{
                border: 'none',
                fontSize: 11.5,
                fontWeight: 650,
                padding: '5px 12px',
                borderRadius: 8,
                background: aiProvider === 'groq' ? '#d97706' : 'transparent',
                color: aiProvider === 'groq' ? '#ffffff' : '#5b6b83',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease'
              }}
            >
              <Cpu size={13} /> Groq 120B
            </button>
          </div>

          {/* Interactive Voice Mode Button (Solid Medora Primary) */}
          <button
            className="btn primary"
            onClick={() => setVoiceOpen(true)}
            style={{
              background: '#245be8',
              borderColor: '#1d4ed8',
              fontWeight: 600,
              fontSize: 12.5,
              padding: '8px 16px',
              minHeight: 38,
              gap: 7
            }}
          >
            <Mic size={15} /> Voice Navigator
          </button>

          {/* Clear conversation button */}
          {turns.length > 0 && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                speechEngineRef.current?.stop();
                setSpeakingIndex(null);
                setTurns([]);
                toast.success('Conversation reset');
              }}
              title="Start a new conversation"
              style={{
                fontSize: 12,
                minHeight: 38,
                padding: '8px 12px',
                gap: 5,
                color: '#64748b'
              }}
            >
              <RotateCcw size={13} /> New Chat
            </button>
          )}
        </div>
      </Heading>

      {/* Main 2-Column Responsive Layout */}
      <div className="chat-layout" style={{ alignItems: 'start' }}>
        {/* Left Primary Conversation Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Smart Prompt Navigation Deck */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: '14px 16px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                marginBottom: 12
              }}
            >
              {/* Category Filter Tabs with Proper Lucide Icons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Topics', icon: Sparkles },
                  { id: 'labs', label: 'Lab Reports', icon: FlaskConical },
                  { id: 'imaging', label: 'Imaging & X-Rays', icon: Scan },
                  { id: 'visits', label: 'Doctor Visits', icon: Stethoscope },
                  { id: 'meds', label: 'Prescriptions', icon: Pill }
                ].map((cat) => {
                  const CatIcon = cat.icon;
                  const isActive = promptCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setPromptCategory(cat.id as PromptCategory)}
                      style={{
                        border: '1px solid',
                        borderColor: isActive ? '#245be8' : '#e2e8f0',
                        background: isActive ? '#eef3ff' : '#ffffff',
                        color: isActive ? '#245be8' : '#5b6b83',
                        fontSize: 12,
                        fontWeight: isActive ? 650 : 500,
                        padding: '5px 11px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <CatIcon size={13} color={isActive ? '#245be8' : '#8a9cb7'} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Language Switcher Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  background: '#f1f5fa',
                  padding: '2px 4px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0'
                }}
              >
                {[
                  { key: 'en', label: 'English' },
                  { key: 'hi', label: 'हिन्दी' },
                  { key: 'hinglish', label: 'Hinglish' },
                  { key: 'ta', label: 'தமிழ்' },
                  { key: 'bn', label: 'বাংলা' }
                ].map((lang) => (
                  <button
                    key={lang.key}
                    type="button"
                    onClick={() => setActiveLangTab(lang.key as any)}
                    style={{
                      border: 'none',
                      background: activeLangTab === lang.key ? '#ffffff' : 'transparent',
                      color: activeLangTab === lang.key ? '#172a46' : '#64748b',
                      fontSize: 11,
                      fontWeight: activeLangTab === lang.key ? 700 : 500,
                      padding: '3px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      borderWidth: activeLangTab === lang.key ? 1 : 0,
                      borderStyle: 'solid',
                      borderColor: activeLangTab === lang.key ? '#cbd5e1' : 'transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Cards Pill Grid with Semantic Colored Icon Boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
              {filteredPrompts.slice(0, 4).map((p, idx) => {
                const IconComponent = p.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={busy}
                    onClick={() => void send(p.text)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      textAlign: 'left',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 9,
                      padding: '8px 12px',
                      fontSize: 12,
                      color: '#172a46',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#245be8';
                      e.currentTarget.style.background = '#f8fbff';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: p.iconBg,
                        color: p.iconColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <IconComponent size={14} />
                    </span>
                    <span style={{ flex: 1, lineHeight: 1.35, fontWeight: 500 }}>
                      {p.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversation Workspace Container */}
          <Panel
            className="chat-panel"
            style={{
              padding: 0,
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 520
            }}
          >
            {/* Chat Body Stream */}
            <div
              className="chat-body"
              style={{
                flex: 1,
                padding: '24px 24px 16px',
                overflowY: 'auto',
                maxHeight: 540,
                display: 'flex',
                flexDirection: 'column',
                gap: 20
              }}
              aria-live="polite"
            >
              {/* Empty State with Proper Colors & Icons */}
              {!turns.length && (
                <div
                  style={{
                    padding: '36px 16px 24px',
                    textAlign: 'center',
                    maxWidth: 580,
                    margin: '0 auto'
                  }}
                >
                  {/* Clean Solid Hero Icon Box */}
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: '#eaf1ff',
                      color: '#245be8',
                      border: '1px solid #c7d8fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px'
                    }}
                  >
                    <HeartPulse size={28} />
                  </div>

                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#172a46',
                      marginBottom: 8,
                      letterSpacing: '-0.3px'
                    }}
                  >
                    Hello {patientName.split(' ')[0]}, I&apos;m your Medora Health Companion
                  </h3>

                  <p
                    style={{
                      fontSize: 13.5,
                      color: '#64748b',
                      lineHeight: 1.6,
                      marginBottom: 24
                    }}
                  >
                    Ask questions about your recent clinical visits, lab reports, X-rays, or medications.
                    Every answer is strictly grounded in your verified records.
                  </p>

                  {/* 4 Feature Launch Cards with Clean Solid Icons */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 10,
                      textAlign: 'left'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => void send('What was my last X-Ray report and what does it show?')}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0d9488';
                        e.currentTarget.style.background = '#f0fdfa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.background = '#ffffff';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: '#e5f7f2',
                            color: '#0d9488',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Scan size={14} />
                        </span>
                        <strong style={{ fontSize: 12.5, color: '#172a46' }}>Check Last X-Ray</strong>
                      </div>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                        Summarize findings and radiologist impressions
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => void send('Summarize my blood test cholesterol & glucose readings')}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#245be8';
                        e.currentTarget.style.background = '#f5f8ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.background = '#ffffff';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: '#eaf1ff',
                            color: '#245be8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <FlaskConical size={14} />
                        </span>
                        <strong style={{ fontSize: 12.5, color: '#172a46' }}>Blood Chemistry</strong>
                      </div>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                        Check glucose, cholesterol, and lipid ranges
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => void send('What did Dr Sarah Khan advise during my annual review?')}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#7c3aed';
                        e.currentTarget.style.background = '#faf5ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.background = '#ffffff';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: '#efeaff',
                            color: '#7c3aed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Stethoscope size={14} />
                        </span>
                        <strong style={{ fontSize: 12.5, color: '#172a46' }}>Doctor Advice</strong>
                      </div>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                        Review key actions from your annual consultation
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => void send('Are there any interactions with my current prescriptions?')}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#c45275';
                        e.currentTarget.style.background = '#fff5f7';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.background = '#ffffff';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: '#ffedf2',
                            color: '#c45275',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Pill size={14} />
                        </span>
                        <strong style={{ fontSize: 12.5, color: '#172a46' }}>Medication Review</strong>
                      </div>
                      <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                        Understand dosage schedules and interactions
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Message List */}
              {turns.map((turn, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: turn.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '100%'
                  }}
                >
                  {/* User Bubble (Solid #245be8, No Gradient) */}
                  {turn.role === 'user' ? (
                    <div style={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div
                        style={{
                          background: '#245be8',
                          color: '#ffffff',
                          padding: '12px 18px',
                          borderRadius: '14px 14px 4px 14px',
                          fontSize: 13.5,
                          lineHeight: 1.55,
                          wordBreak: 'break-word'
                        }}
                      >
                        {turn.content}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 10.5,
                          color: '#8b9bb1',
                          marginTop: 4,
                          paddingRight: 2
                        }}
                      >
                        <User size={11} /> You · {turn.timestamp || 'Just now'}
                      </div>
                    </div>
                  ) : (
                    /* Assistant Card (Solid White with Subtle Border) */
                    <article
                      style={{
                        width: '100%',
                        maxWidth: '92%',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 14,
                        padding: '16px 18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}
                    >
                      {/* Assistant Top Meta Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                          paddingBottom: 10,
                          borderBottom: '1px solid #f1f5f9'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* Solid Icon Box */}
                          <span
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 7,
                              background: '#eaf1ff',
                              color: '#245be8',
                              border: '1px solid #dce7fc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <HeartPulse size={14} />
                          </span>

                          <strong style={{ fontSize: 13, color: '#172a46', fontWeight: 650 }}>
                            Medora Clinical Navigator
                          </strong>

                          {/* Grounding Verification Badge (Solid Emerald) */}
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 10.5,
                              fontWeight: 650,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: '#e8f7f1',
                              color: '#167764',
                              border: '1px solid #b7ebd8'
                            }}
                            title="Grounded in your private medical records"
                          >
                            <CheckCircle2 size={11} /> Grounded in Records
                          </span>

                          {/* Engine model pill (Solid) */}
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 6,
                              background: turn.provider === 'groq' ? '#fff5e5' : '#eaf1ff',
                              color: turn.provider === 'groq' ? '#956018' : '#245be8',
                              border: `1px solid ${turn.provider === 'groq' ? '#fed7aa' : '#c7d8fa'}`
                            }}
                          >
                            {turn.provider === 'groq' ? 'Groq 120B' : 'Gemini 3.1 Flash'}
                          </span>
                        </div>

                        {/* Top Citation / Voice Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {turn.citations && turn.citations.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setOpenCitationsIndex(openCitationsIndex === i ? null : i)}
                              style={{
                                border: '1px solid #dce7fc',
                                background: openCitationsIndex === i ? '#eaf1ff' : '#ffffff',
                                color: '#245be8',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '3px 9px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Database size={11} />
                              {turn.citations.length} Citations
                              {openCitationsIndex === i ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleSpeakTurn(i, turn.content)}
                            aria-label={speakingIndex === i ? 'Stop reading' : 'Read aloud with speech'}
                            style={{
                              border: '1px solid #e2e8f0',
                              background: speakingIndex === i ? '#fff0f3' : '#ffffff',
                              color: speakingIndex === i ? '#b63e58' : '#64748b',
                              fontSize: 11,
                              fontWeight: 500,
                              padding: '3px 8px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            {speakingIndex === i ? <VolumeX size={12} /> : <Volume2 size={12} />}
                            {speakingIndex === i ? 'Stop' : 'Read'}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Citations Drawer */}
                      {openCitationsIndex === i && turn.citations && turn.citations.length > 0 && (
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #dce3ee',
                            borderRadius: 10,
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <Database size={13} color="#245be8" />
                            GROUNDED SOURCE CITATIONS:
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {turn.citations.map((c, cIdx) => (
                              <div
                                key={cIdx}
                                style={{
                                  background: '#ffffff',
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0',
                                  fontSize: 11.5
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 4
                                  }}
                                >
                                  <span style={{ fontWeight: 650, color: '#172a46', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <FileText size={12} color="#5b6b83" /> {c.document_name}
                                  </span>
                                  <span
                                    style={{
                                      background: '#e8f7f1',
                                      color: '#167764',
                                      fontSize: 10,
                                      padding: '1px 7px',
                                      borderRadius: 4,
                                      fontWeight: 700
                                    }}
                                  >
                                    {c.match_percentage}% Relevance
                                  </span>
                                </div>
                                <p
                                  style={{
                                    margin: 0,
                                    color: '#475569',
                                    fontStyle: 'italic',
                                    background: '#f1f5fa',
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    lineHeight: 1.45
                                  }}
                                >
                                  &ldquo;{c.excerpt}&rdquo;
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Main Rendered Content */}
                      <div>{renderFormattedContent(turn.content)}</div>

                      {/* Linked Source Documents */}
                      {turn.sources && turn.sources.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            paddingTop: 8,
                            borderTop: '1px solid #f1f5f9'
                          }}
                        >
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                            Referenced Records:
                          </span>
                          {turn.sources.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                const found = ctx.data.documents.find((d) => d.id === s.id);
                                if (found) {
                                  ctx.open('document', found);
                                } else {
                                  ctx.go('documents');
                                }
                              }}
                              style={{
                                fontSize: 11,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: '#e8f7f1',
                                border: '1px solid #b7ebd8',
                                color: '#167764',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                cursor: 'pointer',
                                fontWeight: 550
                              }}
                            >
                              <FileText size={11} color="#167764" />
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Interactive Suggested Follow-Up Questions */}
                      {turn.suggestions && turn.suggestions.length > 0 && (
                        <div
                          style={{
                            paddingTop: 10,
                            borderTop: '1px dashed #e2e8f0'
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#64748b',
                              marginBottom: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            <HelpCircle size={12} color="#245be8" />
                            SUGGESTED NEXT QUESTIONS:
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {turn.suggestions.map((suggestion, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                disabled={busy}
                                onClick={() => void send(suggestion)}
                                style={{
                                  fontSize: 11.5,
                                  padding: '4px 11px',
                                  borderRadius: 8,
                                  background: '#eaf1ff',
                                  color: '#245be8',
                                  border: '1px solid #c7d8fa',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#dce7fc')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#eaf1ff')}
                              >
                                {suggestion} →
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Assistant Bottom Action Bar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: 8,
                          borderTop: '1px solid #f1f5f9',
                          marginTop: 4
                        }}
                      >
                        <span style={{ fontSize: 10.5, color: '#8b9bb1' }}>
                          Answered at {turn.timestamp || 'Just now'} · Always confirm medical decisions with your doctor
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(turn.content, i)}
                            title="Copy answer"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: copiedIndex === i ? '#167764' : '#8b9bb1',
                              cursor: 'pointer',
                              padding: 4,
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            {copiedIndex === i ? <Check size={14} /> : <Copy size={14} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setTurnFeedback(i, 'like')}
                            title="Helpful answer"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: turn.feedback === 'like' ? '#245be8' : '#8b9bb1',
                              cursor: 'pointer',
                              padding: 4,
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <ThumbsUp size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setTurnFeedback(i, 'dislike')}
                            title="Not helpful"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: turn.feedback === 'dislike' ? '#b63e58' : '#8b9bb1',
                              cursor: 'pointer',
                              padding: 4,
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  )}
                </div>
              ))}

              {/* Busy Thinking / Generating State (Clean Solid Loading) */}
              {busy && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: '92%',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: '#eaf1ff',
                        color: '#245be8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Sparkles size={12} />
                    </span>
                    <strong style={{ fontSize: 12.5, color: '#172a46' }}>
                      Medora is reviewing your records…
                    </strong>
                    <span
                      style={{
                        fontSize: 10,
                        background: '#e8f7f1',
                        color: '#167764',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontWeight: 600
                      }}
                    >
                      Vector Grounding Active
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#245be8',
                        display: 'inline-block'
                      }}
                    />
                    <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
                      Searching documents, cross-referencing clinical notes, and composing response…
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error Banner if any */}
            {error && (
              <div
                style={{
                  margin: '0 20px 8px',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#fff0f3',
                  border: '1px solid #facbd1',
                  color: '#b63e58',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError('')}
                  style={{ border: 'none', background: 'transparent', color: '#b63e58', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Sticky Grounded Input Dock */}
            <div
              style={{
                borderTop: '1px solid #eef2f6',
                background: '#ffffff',
                padding: '14px 20px'
              }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#ffffff',
                  border: '1px solid #dce3ee',
                  borderRadius: 10,
                  padding: '4px 6px 4px 10px',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#245be8')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#dce3ee')}
              >
                {/* Voice shortcut button */}
                <button
                  type="button"
                  onClick={() => setVoiceOpen(true)}
                  aria-label="Interactive Voice Chat"
                  title="Open real-time voice chat dialog"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: 'none',
                    background: '#eaf1ff',
                    color: '#245be8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Mic size={16} />
                </button>

                <input
                  ref={inputRef}
                  value={message}
                  maxLength={6000}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask a health question (e.g. 'What were my blood test results?')"
                  aria-label="Your clinical question"
                  disabled={busy}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    fontSize: 13.5,
                    color: '#172a46',
                    outline: 'none',
                    padding: '8px 4px',
                    minHeight: 38
                  }}
                />

                <button
                  type="submit"
                  disabled={busy || !message.trim()}
                  className="btn primary"
                  style={{
                    height: 38,
                    padding: '0 16px',
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 600,
                    gap: 6,
                    flexShrink: 0,
                    background: '#245be8',
                    borderColor: '#1d4ed8'
                  }}
                >
                  <Send size={14} />
                  {busy ? 'Searching…' : 'Send'}
                </button>
              </form>

              {/* Sub-dock Privacy Guarantee */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  fontSize: 11,
                  color: '#8b9bb1'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldCheck size={13} color="#167764" /> Private & End-to-End Grounded in your records
                </span>
                <span>Medical decisions require clinical confirmation</span>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right Health Context & Grounding Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Grounded Records Card */}
          <Panel
            title="Grounded Records"
            sub="Your private files indexed for instant AI answering."
            action={
              <button
                type="button"
                className="btn ghost"
                onClick={() => ctx.go('documents')}
                style={{ fontSize: 11, padding: '2px 6px' }}
              >
                View all ({documents.length})
              </button>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {documents.slice(0, 4).map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => ctx.open('document', doc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 11px',
                    borderRadius: 9,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fbff';
                    e.currentTarget.style.borderColor = '#245be8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: '#eaf1ff',
                      color: '#245be8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <FileText size={14} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#172a46',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {doc.name}
                    </strong>
                    <small style={{ color: '#8b9bb1', fontSize: 10.5 }}>
                      {doc.type} · {niceDate(doc.date).split(' ').slice(0, 2).join(' ')}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Quick Care Shortcuts */}
          <Panel title="Care Shortcuts" sub="Direct actions connected to your care.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="list-item"
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8 }}
                onClick={() => ctx.go('doctors')}
              >
                <span className="icon-box blue" style={{ width: 32, height: 32, borderRadius: 8 }}>
                  <Stethoscope size={15} />
                </span>
                <div>
                  <strong style={{ fontSize: 12 }}>Connected Doctors</strong>
                  <small style={{ fontSize: 10.5 }}>Dr Sarah Khan · General Practice</small>
                </div>
              </button>

              <button
                type="button"
                className="list-item"
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8 }}
                onClick={() => ctx.go('appointments')}
              >
                <span className="icon-box teal" style={{ width: 32, height: 32, borderRadius: 8 }}>
                  <CalendarDays size={15} />
                </span>
                <div>
                  <strong style={{ fontSize: 12 }}>Upcoming Visits</strong>
                  <small style={{ fontSize: 10.5 }}>
                    {upcomingAppointment ? `${upcomingAppointment.specialty} (${niceDate(upcomingAppointment.date)})` : 'No upcoming visits'}
                  </small>
                </div>
              </button>

              <button
                type="button"
                className="list-item"
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8 }}
                onClick={() => ctx.go('medications')}
              >
                <span className="icon-box pink" style={{ width: 32, height: 32, borderRadius: 8 }}>
                  <Pill size={15} />
                </span>
                <div>
                  <strong style={{ fontSize: 12 }}>Medications List</strong>
                  <small style={{ fontSize: 10.5 }}>{ctx.data.medicines?.length || 0} active prescriptions</small>
                </div>
              </button>

              <button
                type="button"
                className="list-item"
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8 }}
                onClick={() => ctx.open('qr-pass')}
              >
                <span className="icon-box violet" style={{ width: 32, height: 32, borderRadius: 8 }}>
                  <ShieldCheck size={15} />
                </span>
                <div>
                  <strong style={{ fontSize: 12 }}>Emergency QR Pass</strong>
                  <small style={{ fontSize: 10.5 }}>One-tap intake for ER & First Responders</small>
                </div>
              </button>
            </div>
          </Panel>

          {/* Privacy & Clinical Assurance */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 10,
              background: '#e8f7f1',
              border: '1px solid #b7ebd8',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start'
            }}
          >
            <ShieldCheck size={20} color="#167764" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 12, color: '#167764', display: 'block', marginBottom: 2 }}>
                Private & HIPAA/GDPR Aligned
              </strong>
              <p style={{ fontSize: 11, color: '#31695c', margin: 0, lineHeight: 1.45 }}>
                Your health questions and records remain protected in your private workspace. Medora AI does not share or train public models on your personal data.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Chat Modal */}
      <VoiceChatDialog
        ctx={ctx}
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
      />
    </>
  );
}
