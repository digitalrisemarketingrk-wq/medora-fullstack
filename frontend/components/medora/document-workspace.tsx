'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Bookmark,
  Check,
  ClipboardList,
  Download,
  FileText,
  Files,
  GitCompareArrows,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  X,
  Languages,
  Volume2,
  VolumeX,
  Mic,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Info
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { audit, dateOffset, type Doc, download, niceDate, uid } from '@/lib/medora-demo';
import { api, API_MODE, type WorkspaceSnapshot, type TranslatedDocumentData } from '@/lib/medora-api';
import { type AppContext, Heading, Panel, Pick, SearchInput, EmptyState, TabView } from './shared';
import { DemoBoundary, FeatureBanner, FeatureDialog } from './feature-kit';
import { INDIAN_LANGUAGES, type VoiceLanguage, SpeechEngine } from '@/lib/voice-speech';
import { VoiceChatDialog } from './voice-chat-dialog';

const initialQuestions = [
  'What does this document mean for my care?',
  'What should we review or record next?',
  'When should we discuss this together?'
];

const sampleGlossary = [
  { term: 'Referral', meaning: 'A document asking another care team to review a patient.' },
  { term: 'Consultation letter', meaning: 'A written record of a conversation with a clinician.' },
  { term: 'Follow-up', meaning: 'A later appointment or conversation to review the next step.' }
];

async function recordMutation<T extends { workspace: WorkspaceSnapshot }>(
  ctx: AppContext,
  operation: () => Promise<T>
): Promise<T> {
  if (ctx.mutate) return ctx.mutate(operation);
  await ctx.flush?.();
  const result = await operation();
  ctx.accept?.(result.workspace);
  return result;
}

export function DocumentReview({ ctx, document: doc }: { ctx: AppContext; document: Doc }) {
  const [tab, setTab] = useState('Summary');
  const [question, setQuestion] = useState('');
  const [compareId, setCompareId] = useState(ctx.data.documents.find((d) => d.id !== doc.id)?.id || '');
  const [comparison, setComparison] = useState('');
  const [share, setShare] = useState(false);
  const [recipient, setRecipient] = useState('Dr. Rajesh Sharma');
  const [permission, setPermission] = useState('Summary only');
  const [expires, setExpires] = useState(dateOffset(7));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // Translation State
  const [targetLang, setTargetLang] = useState<VoiceLanguage>(INDIAN_LANGUAGES[1]); // default Hindi (हिन्दी)
  const [translationData, setTranslationData] = useState<TranslatedDocumentData | null>(null);
  const [translating, setTranslating] = useState(false);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'dual' | 'tabs'>('dual');
  const [hoveredFindingIdx, setHoveredFindingIdx] = useState<number | null>(null);

  const speechEngineRef = useRef<SpeechEngine | null>(null);

  useEffect(() => {
    speechEngineRef.current = new SpeechEngine((state) => {
      setIsReadingAloud(state === 'speaking');
    });
    return () => {
      speechEngineRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!translationData && doc.summary) {
      void handleTranslate(targetLang);
    }
  }, [doc.id]);

  const questions = ctx.data.features.documentQuestions[doc.id] || initialQuestions;
  const saved = ctx.data.features.savedSummaries.includes(doc.id);
  const compared = ctx.data.documents.find((d) => d.id === compareId);
  const isStored = API_MODE && !!doc.storagePath;
  const analysed = doc.analysisStatus === 'analysed' || !!doc.summary;

  const setQuestions = (next: string[]) =>
    ctx.update((d) => ({
      ...d,
      features: {
        ...d.features,
        documentQuestions: { ...d.features.documentQuestions, [doc.id]: next }
      }
    }));

  const run = async (label: string, operation: () => Promise<void>) => {
    setBusy(label);
    setError('');
    try {
      await operation();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy('');
    }
  };

  // Perform Multi-Lingual AI Translation
  const handleTranslate = async (lang: VoiceLanguage = targetLang) => {
    setTranslating(true);
    setError('');
    try {
      if (API_MODE) {
        const result = await api.translateDocument(doc.id, lang.langKey, lang.name, ctx.ownerId);
        setTranslationData(result.translation);
        toast.success(`Translated into ${lang.name}`);
      } else {
        // High quality local scripted fallback for demo
        const isHindi = lang.langKey === 'hi';
        const fallback: TranslatedDocumentData = {
          translated_name: isHindi ? `अनुवाद: ${doc.name}` : `Translation (${lang.name}): ${doc.name}`,
          translated_summary: isHindi
            ? `सरल भाषा में सारांश: यह दस्तावेज़ (${doc.type}) आपकी सामान्य देखभाल और रिपोर्ट का हिस्सा है। ${doc.summary}`
            : `Plain Language Summary in ${lang.name}: This clinical document records your medical findings and care plan. ${doc.summary}`,
          translated_findings: doc.findings?.length
            ? doc.findings.map((f) => (isHindi ? `मुख्य निष्कर्ष: ${f}` : `Finding: ${f}`))
            : [isHindi ? 'सभी मुख्य माप सामान्य सीमा में हैं' : 'All key measurements are within reference limits'],
          translated_questions: questions.map((q) =>
            isHindi ? `डॉक्टर से पूछें: ${q}` : `Question for Doctor: ${q}`
          ),
          translated_glossary: [
            {
              term: isHindi ? 'रेडियोलॉजी (Radiology)' : 'Radiology',
              meaning: isHindi
                ? 'एक्स-रे या स्कैन के जरिए शरीर के अंदरूनी हिस्सों की जांच।'
                : 'Medical imaging exams such as X-rays or CT scans.'
            }
          ],
          cultural_guidance: isHindi
            ? 'अपनी रिपोर्ट को अपनी मातृभाषा में समझकर डॉक्टर से बातचीत करने में आसानी होती है।'
            : 'Reviewing documents in your primary language helps make clinical conversations clearer.',
          disclaimer: isHindi
            ? 'यह एआई अनुवाद आपकी समझ के लिए है। किसी भी चिकित्सीय निर्णय से पहले अपने डॉक्टर से सलाह अवश्य लें।'
            : 'AI translation is for information and patient clarity. Always consult your licensed clinician.'
        };
        setTranslationData(fallback);
        toast.success(`Translated into ${lang.name}`);
      }
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Translation failed. Try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setTranslating(false);
    }
  };

  // Read Aloud Translated or Original Summary
  const toggleReadAloud = (textToSpeak: string, langCode: string) => {
    if (isReadingAloud) {
      speechEngineRef.current?.stop();
      setIsReadingAloud(false);
    } else {
      speechEngineRef.current?.speakText(textToSpeak, langCode, () => {
        setIsReadingAloud(false);
      });
    }
  };

  const summaryText = `MEDORA · ${API_MODE ? 'DOCUMENT SUMMARY — REVIEW WITH YOUR CLINICIAN' : 'SCRIPTED DOCUMENT PREVIEW'}\n${doc.name}\n${niceDate(doc.date)}\n\n${doc.summary}\n\nQuestions for my clinician\n${questions.map((q) => '• ' + q).join('\n')}\n\n${API_MODE ? 'AI explanations can contain errors. Verify findings with your clinician.' : 'This demo has not analysed uploaded file contents.'}`;

  return (
    <div className="document-review" aria-busy={!!busy}>
      <div className="document-review-heading">
        <span className="icon-box coral">
          <FileText />
        </span>
        <div>
          <h2>{doc.name}</h2>
          <p>
            {doc.type} · {niceDate(doc.date)} · {doc.size}
          </p>
        </div>
        <span className="badge">
          {API_MODE
            ? doc.deleting
              ? 'Deletion needs retry'
              : analysed
                ? 'AI summary · Review required'
                : isStored
                  ? 'Stored privately'
                  : 'Care record'
            : 'Scripted preview'}
        </span>
      </div>

      {isStored && (
        <div className="service-consent">
          <div className="checkbox-line">
            <Checkbox
              id={'ai-consent-' + doc.id}
              checked={consent}
              onCheckedChange={(v) => setConsent(!!v)}
            />
            <label htmlFor={'ai-consent-' + doc.id}>
              I agree to send this document to the configured AI provider for an explanation.
            </label>
          </div>
          <div className="service-actions">
            <button
              className="btn primary"
              disabled={!consent || !!busy || doc.deleting}
              onClick={() =>
                void run('Analysing document…', async () => {
                  const result = await recordMutation(ctx, () => api.analyse(doc.id, ctx.ownerId));
                  if (result.indexing_warning) toast.info(result.indexing_warning);
                  else toast.success('Summary and questions are ready for review');
                })
              }
            >
              <Sparkles size={16} />
              {busy || (analysed ? 'Analyse again' : 'Analyse document')}
            </button>
            {analysed && (
              <button
                className="btn secondary"
                disabled={!!busy || doc.deleting}
                onClick={() =>
                  void run('Updating search index…', async () => {
                    await recordMutation(ctx, () => api.index(doc.id, ctx.ownerId));
                    toast.success('Document is available in secure search');
                  })
                }
              >
                {doc.indexed ? 'Update search index' : 'Enable document search'}
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">{busy}</p>}

      {/* View Mode Toggle Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: '3px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '5px 14px',
              borderRadius: 8,
              background: viewMode === 'dual' ? '#ffffff' : 'transparent',
              color: viewMode === 'dual' ? '#4f46e5' : '#64748b',
              boxShadow: viewMode === 'dual' ? '0 1px 3px rgba(79,70,229,0.15)' : 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
            onClick={() => setViewMode('dual')}
          >
            <GitCompareArrows size={14} /> Dual-Pane View (Original + Translation)
          </button>
          <button
            type="button"
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '5px 14px',
              borderRadius: 8,
              background: viewMode === 'tabs' ? '#ffffff' : 'transparent',
              color: viewMode === 'tabs' ? '#0f172a' : '#64748b',
              boxShadow: viewMode === 'tabs' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
            onClick={() => setViewMode('tabs')}
          >
            <Files size={14} /> Classic Tabs
          </button>
        </div>

        {viewMode === 'dual' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: '#475569', fontWeight: 600 }}>Language:</span>
            <select
              value={targetLang.code}
              onChange={(e) => {
                const l = INDIAN_LANGUAGES.find((x) => x.code === e.target.value);
                if (l) {
                  setTargetLang(l);
                  void handleTranslate(l);
                }
              }}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontWeight: 600,
                color: '#1e293b',
                cursor: 'pointer'
              }}
            >
              {INDIAN_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>

            <button
              className="btn secondary"
              style={{ fontSize: 11, padding: '4px 10px', height: 28 }}
              onClick={() => setVoiceModalOpen(true)}
            >
              <Mic size={13} /> Voice Q&amp;A
            </button>
          </div>
        )}
      </div>

      {viewMode === 'dual' && (
        <div
          className="dual-pane-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
            marginBottom: 20
          }}
        >
          {/* LEFT PANE: ORIGINAL CLINICAL RECORD */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="icon-box small blue" style={{ width: 24, height: 24 }}>
                  <FileText size={13} />
                </span>
                <strong style={{ fontSize: 13, color: '#1e3a8a' }}>ORIGINAL REPORT (ENGLISH)</strong>
              </div>
              <span className="badge" style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8' }}>
                {doc.type}
              </span>
            </div>

            <div className="summary-surface" style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span className="feature-kicker" style={{ fontSize: 10 }}>CLINICAL SUMMARY</span>
                <button
                  className="btn ghost"
                  style={{ fontSize: 10.5, padding: '2px 6px', minHeight: 20, gap: 4 }}
                  onClick={() => toggleReadAloud(doc.summary, 'en-IN')}
                >
                  <Volume2 size={12} color="#4f46e5" />
                  Read (EN)
                </button>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.55, margin: 0, color: '#334155' }}>{doc.summary}</p>
            </div>

            {!!doc.findings?.length && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Recorded Clinical Findings
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {doc.findings.map((f, i) => {
                    const isHovered = hoveredFindingIdx === i;
                    return (
                      <div
                        key={i}
                        style={{
                          fontSize: 12.5,
                          lineHeight: 1.45,
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: isHovered ? '#e0f2fe' : '#f8fafc',
                          border: isHovered ? '1px solid #38bdf8' : '1px solid #f1f5f9',
                          color: isHovered ? '#0369a1' : '#334155',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <strong>• Finding {i + 1}:</strong> {f}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {questions.length > 0 && (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Doctor Questions on File:
                </span>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: '#475569' }}>
                  {questions.slice(0, 3).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* RIGHT PANE: REGIONAL INDIAN TRANSLATION WITH LISTEN TO REPORT */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #c7d2fe',
              borderRadius: 16,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.05)'
            }}
          >
            {/* Right Pane Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="icon-box small coral" style={{ width: 24, height: 24, background: '#eff6ff', color: '#4f46e5' }}>
                  <Languages size={13} />
                </span>
                <strong style={{ fontSize: 13, color: '#4338ca' }}>
                  {targetLang.name} Translation
                </strong>
              </div>

              {/* LISTEN TO REPORT AUDIO BUTTON */}
              <button
                className={`btn ${isReadingAloud ? 'secondary' : 'primary'}`}
                style={{
                  fontSize: 11.5,
                  padding: '4px 12px',
                  borderRadius: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onClick={() =>
                  toggleReadAloud(
                    translationData?.translated_summary || doc.summary,
                    targetLang.code
                  )
                }
              >
                {isReadingAloud ? <VolumeX size={14} color="#e11d48" /> : <Volume2 size={14} />}
                {isReadingAloud ? 'Stop Audio' : `Listen (${targetLang.name.split(' ')[0]})`}
              </button>
            </div>

            {/* Translated Summary */}
            <div
              style={{
                background: '#f5f3ff',
                border: '1px solid #ddd6fe',
                borderRadius: 10,
                padding: '12px 14px'
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#6d28d9',
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: 4
                }}
              >
                सरल भाषा में सारांश (Plain Language Vernacular)
              </span>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: '#1e1b4b' }}>
                {translating
                  ? `Translating report into ${targetLang.name}…`
                  : translationData?.translated_summary || `Report ready for translation into ${targetLang.name}.`}
              </p>
            </div>

            {/* Translated Findings with Interactive Hover Highlighting */}
            {translationData?.translated_findings && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    मुख्य निष्कर्ष (Findings in {targetLang.name.split(' ')[0]})
                  </h4>
                  <span style={{ fontSize: 10.5, color: '#6366f1' }}>Hover to highlight original</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {translationData.translated_findings.map((tf, i) => {
                    const isHovered = hoveredFindingIdx === i;
                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setHoveredFindingIdx(i)}
                        onMouseLeave={() => setHoveredFindingIdx(null)}
                        style={{
                          fontSize: 13,
                          lineHeight: 1.5,
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: isHovered ? '#ede9fe' : '#faf5ff',
                          border: isHovered ? '1px solid #8b5cf6' : '1px solid #f3e8ff',
                          color: isHovered ? '#5b21b6' : '#2e1065',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <strong>• </strong>{tf}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Translated Medical Glossary */}
            {translationData?.translated_glossary?.length ? (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  शब्दावली (Vernacular Medical Glossary):
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  {translationData.translated_glossary.map((g, idx) => (
                    <div key={idx} style={{ fontSize: 12, color: '#334155' }}>
                      <strong style={{ color: '#4338ca' }}>{g.term}:</strong> {g.meaning}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {translationData?.cultural_guidance && (
              <div style={{ fontSize: 11, color: '#047857', background: '#ecfdf5', padding: '6px 10px', borderRadius: 8, border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={13} style={{ flexShrink: 0 }} />
                <span>{translationData.cultural_guidance}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'tabs' && (
        <TabView items={['Summary', 'Translate', 'Doctor questions', 'Compare']} value={tab} onChange={setTab}>
          {/* SUMMARY TAB */}
          {tab === 'Summary' && (
            <>
              <div className="document-extraction">
                <span>
                  <Check size={14} /> Record details ready
                </span>
                {(!API_MODE || analysed) && (
                  <span>
                    <Check size={14} /> Summary ready to review
                  </span>
                )}
                {doc.indexed && (
                  <span>
                    <Check size={14} /> Search indexed
                  </span>
                )}
              </div>

              <div className="summary-surface">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="feature-kicker">IN PLAIN LANGUAGE</span>
                  <button
                    className="btn ghost"
                    style={{ fontSize: 11, padding: '2px 8px', minHeight: 24, gap: 5 }}
                    onClick={() => toggleReadAloud(doc.summary, 'en-IN')}
                  >
                    {isReadingAloud ? <VolumeX size={13} color="#e11d48" /> : <Volume2 size={13} color="#4f46e5" />}
                    {isReadingAloud ? 'Stop reading' : 'Read aloud'}
                  </button>
                </div>
                <p>{doc.summary}</p>
              </div>

              {!!doc.findings?.length && (
                <section className="analysis-findings">
                  <h3>Recorded findings</h3>
                  <ul>
                    {doc.findings.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="document-fact-grid">
                <div>
                  <span>Document type</span>
                  <strong>{doc.type}</strong>
                </div>
                <div>
                  <span>Added to your timeline</span>
                  <strong>{niceDate(doc.date)}</strong>
                </div>
                <div>
                  <span>Analysis status</span>
                  <strong>
                    {API_MODE
                      ? analysed
                        ? 'Needs clinician review'
                        : isStored
                          ? 'Awaiting analysis'
                          : 'Care record'
                      : 'Demo only'}
                  </strong>
                </div>
              </div>

              {/* Quick Multi-Lingual & Voice Action Card */}
              <div
                style={{
                  marginTop: 18,
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#059669',
                      boxShadow: '0 2px 8px rgba(5, 150, 105, 0.15)'
                    }}
                  >
                    <Languages size={18} />
                  </span>
                  <div>
                    <strong style={{ fontSize: 13, color: '#0f172a', display: 'block' }}>
                      Need this in Hindi or a regional language?
                    </strong>
                    <span style={{ fontSize: 11, color: '#475569' }}>
                      Instant AI translation & voice reading in 10+ Indian languages
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setTab('Translate')}>
                    <Languages size={14} /> Translate
                  </button>
                  <button
                    className="btn secondary"
                    style={{ fontSize: 12, padding: '4px 12px', background: '#ffffff' }}
                    onClick={() => setVoiceModalOpen(true)}
                  >
                    <Mic size={14} /> Voice Chat
                  </button>
                </div>
              </div>

              <div className="review-next-step" style={{ marginTop: 14 }}>
                <ClipboardList size={20} />
                <div>
                  <h3>A conversation to prepare</h3>
                  <p>Keep your questions ready and review the document with your clinician.</p>
                </div>
                <button className="btn secondary" onClick={() => setTab('Doctor questions')}>
                  Prepare questions
                </button>
              </div>

              {(API_MODE ? doc.glossary : sampleGlossary)?.length ? (
                <details className="term-glossary">
                  <summary>Terminology explained</summary>
                  {(API_MODE ? doc.glossary : sampleGlossary)?.map((g) => (
                    <div key={g.term}>
                      <strong>{g.term}</strong>
                      <p>{g.meaning}</p>
                    </div>
                  ))}
                </details>
              ) : null}
            </>
          )}

          {/* TRANSLATE TAB */}
          {tab === 'Translate' && (
            <div className="document-translate-tab" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header & Language Selection Card */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 14,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                      Instant Multi-Lingual Medical Translation
                    </h3>
                    <p style={{ fontSize: 12, margin: 0, color: '#64748b' }}>
                      Select your preferred Indian regional language for clinical translation with glossary & voice.
                    </p>
                  </div>
                  <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                    Multi-Lingual AI
                  </span>
                </div>

                {/* Language Selector Grid / Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {INDIAN_LANGUAGES.map((lang) => {
                    const isSelected = targetLang.code === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setTargetLang(lang);
                          void handleTranslate(lang);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 20,
                          border: isSelected ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                          background: isSelected ? '#eff6ff' : '#f8fafc',
                          color: isSelected ? '#1e40af' : '#334155',
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Action Button */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn primary"
                    disabled={translating}
                    onClick={() => void handleTranslate(targetLang)}
                    style={{ gap: 6 }}
                  >
                    <Languages size={15} />
                    {translating ? `Translating into ${targetLang.name}…` : `Translate to ${targetLang.name}`}
                  </button>

                  <button
                    className="btn secondary"
                    onClick={() => setVoiceModalOpen(true)}
                    style={{ gap: 6 }}
                  >
                    <Mic size={15} /> Voice Discussion in {targetLang.name.split(' ')[0]}
                  </button>
                </div>
              </div>

              {/* Translation Output Display */}
              {translationData ? (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 16,
                    padding: '20px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Title & Read Aloud Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: 14,
                      borderBottom: '1px solid #f1f5f9',
                      marginBottom: 16
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#4f46e5',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      >
                        {targetLang.name} Translation
                      </span>
                      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0', color: '#0f172a' }}>
                        {translationData.translated_name}
                      </h2>
                    </div>

                    <button
                      className={`btn ${isReadingAloud ? 'secondary' : 'primary'}`}
                      style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, gap: 6 }}
                      onClick={() => toggleReadAloud(translationData.translated_summary, targetLang.code)}
                    >
                      {isReadingAloud ? <VolumeX size={15} color="#e11d48" /> : <Volume2 size={15} />}
                      {isReadingAloud ? 'Stop audio' : `Read aloud (${targetLang.name.split(' ')[0]})`}
                    </button>
                  </div>

                  {/* Translated Summary */}
                  <div
                    style={{
                      background: '#f8faff',
                      border: '1px solid #dbeafe',
                      borderRadius: 12,
                      padding: '16px',
                      marginBottom: 18
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#1e40af',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: 6
                      }}
                    >
                      सरल भाषा में सारांश (Plain Language Summary)
                    </span>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: '#1e293b', margin: 0 }}>
                      {translationData.translated_summary}
                    </p>
                  </div>

                  {/* Translated Findings */}
                  {!!translationData.translated_findings?.length && (
                    <div style={{ marginBottom: 18 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                        मुख्य निष्कर्ष (Key Findings)
                      </h3>
                      <ul
                        style={{
                          paddingLeft: 20,
                          margin: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          fontSize: 13,
                          color: '#334155'
                        }}
                      >
                        {translationData.translated_findings.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Translated Doctor Questions */}
                  {!!translationData.translated_questions?.length && (
                    <div
                      style={{
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        borderRadius: 12,
                        padding: '14px 16px',
                        marginBottom: 18
                      }}
                    >
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#065f46', margin: '0 0 8px' }}>
                        डॉक्टर से पूछने योग्य प्रश्न (Questions to Ask Doctor)
                      </h3>
                      <ul
                        style={{
                          paddingLeft: 20,
                          margin: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          fontSize: 12,
                          color: '#047857'
                        }}
                      >
                        {translationData.translated_questions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Translated Glossary */}
                  {!!translationData.translated_glossary?.length && (
                    <div style={{ marginBottom: 18 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                        चिकित्सीय शब्दावली (Medical Terminology Explained)
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {translationData.translated_glossary.map((g, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '10px 14px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 10
                            }}
                          >
                            <strong style={{ fontSize: 13, color: '#0f172a', display: 'block' }}>{g.term}</strong>
                            <p style={{ fontSize: 12, color: '#475569', margin: '2px 0 0' }}>{g.meaning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cultural Guidance & Disclaimer */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      fontSize: 12,
                      color: '#92400e',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      {translationData.cultural_guidance && (
                        <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{translationData.cultural_guidance}</p>
                      )}
                      <span style={{ fontSize: 11 }}>
                        {translationData.disclaimer ||
                          'यह अनुवाद आपकी समझ के लिए है। किसी भी चिकित्सीय निर्णय के लिए अपने डॉक्टर से सलाह लें।'}
                      </span>
                    </div>
                  </div>

                  {/* Footer Translation Actions */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        const textToSave = `MEDORA MEDICAL TRANSLATION · ${targetLang.name}\n${translationData.translated_name}\nDate: ${doc.date}\n\nSummary:\n${translationData.translated_summary}\n\nFindings:\n${translationData.translated_findings?.join('\n')}\n\nQuestions:\n${translationData.translated_questions?.join('\n')}\n\nDisclaimer:\n${translationData.disclaimer || ''}`;
                        download(`medora-translated-${doc.name}-${targetLang.langKey}.txt`, textToSave, 'text/plain');
                        toast.success('Translated summary downloaded');
                      }}
                    >
                      <Download size={15} /> Download Translation
                    </button>

                    <button
                      className="btn primary"
                      onClick={() => setVoiceModalOpen(true)}
                    >
                      <Mic size={15} /> Discuss in Voice Chat
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: 16
                  }}
                >
                  <Languages size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>
                    Ready to translate {doc.name}
                  </h4>
                  <p style={{ fontSize: 12, color: '#64748b', maxWidth: 440, margin: '0 auto 16px' }}>
                    Click below to generate a clinically accurate, plain-language translation in {targetLang.name} with audio
                    pronunciation and glossaries.
                  </p>
                  <button
                    className="btn primary"
                    disabled={translating}
                    onClick={() => void handleTranslate(targetLang)}
                  >
                    <Languages size={15} /> {translating ? 'Generating Translation…' : `Translate to ${targetLang.name}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DOCTOR QUESTIONS TAB */}
          {tab === 'Doctor questions' && (
            <>
              <p className="section-intro">Make the conversation yours. These questions are saved with your document.</p>
              <div className="question-list">
                {questions.map((q, i) => (
                  <div className="question-card" key={i}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <p>{q}</p>
                    <button
                      className="icon-button"
                      aria-label={`Remove question ${i + 1}`}
                      onClick={() => setQuestions(questions.filter((_, n) => n !== i))}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <form
                className="inline-entry"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!question.trim()) return;
                  setQuestions([...questions, question.trim()]);
                  setQuestion('');
                }}
              >
                <input
                  aria-label="Add a doctor question"
                  placeholder="Add a question for your clinician…"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={300}
                />
                <button className="btn primary" disabled={!question.trim()}>
                  <Plus size={16} />
                  Add
                </button>
              </form>
              <button
                className="btn secondary"
                onClick={() => {
                  const title = 'Review ' + doc.name + ' with my clinician';
                  if (ctx.data.tasks.some((t) => t.title === title)) {
                    toast.info('This review is already in your care journey');
                    return;
                  }
                  ctx.update((d) => ({
                    ...d,
                    tasks: [
                      ...d.tasks,
                      { id: uid(), title, detail: questions.join(' '), date: dateOffset(3), done: false }
                    ]
                  }));
                  toast.success('Review added to your care journey');
                }}
              >
                <ClipboardList size={16} />
                Add review to care journey
              </button>
            </>
          )}

          {/* COMPARE TAB */}
          {tab === 'Compare' && (
            <>
              {ctx.data.documents.length > 1 ? (
                <>
                  <label>
                    Compare with
                    <Pick
                      label="Comparison document"
                      value={compared?.name || ''}
                      onChange={(v) => {
                        setCompareId(ctx.data.documents.find((d) => d.name === v)?.id || '');
                        setComparison('');
                      }}
                      options={ctx.data.documents.filter((d) => d.id !== doc.id).map((d) => d.name)}
                    />
                  </label>
                  {compared && (
                    <>
                      <div className="document-compare-grid">
                        {[doc, compared].map((d, i) => (
                          <section className="comparison-card" key={d.id}>
                            <span className="feature-kicker">{i === 0 ? 'CURRENT DOCUMENT' : 'COMPARISON DOCUMENT'}</span>
                            <FileText size={23} />
                            <h3>{d.name}</h3>
                            <p>
                              {niceDate(d.date)} · {d.type}
                            </p>
                            <div>{d.summary}</div>
                          </section>
                        ))}
                      </div>
                      {API_MODE && (
                        <>
                          <button
                            className="btn primary"
                            disabled={!!busy || !consent || !analysed || compared.analysisStatus !== 'analysed'}
                            onClick={() =>
                              void run('Comparing documents…', async () => {
                                await ctx.flush?.();
                                const result = await api.compare(doc.id, compared.id, ctx.ownerId);
                                setComparison(result.comparison);
                              })
                            }
                          >
                            <GitCompareArrows size={16} />
                            Compare with AI
                          </button>
                          <p className="section-intro">
                            Analyse both uploaded documents first and enable AI processing above.
                          </p>
                          {comparison && (
                            <div className="summary-surface" style={{ whiteSpace: 'pre-wrap' }}>
                              {comparison}
                            </div>
                          )}
                        </>
                      )}
                      <div className="comparison-note">
                        <GitCompareArrows size={19} />
                        <p>
                          {API_MODE
                            ? 'Review differences, dates and units with your clinician.'
                            : 'Compare the recorded next steps with your clinician. This demo does not infer clinical changes.'}
                        </p>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <EmptyState
                  title="Add another document to compare"
                  text="A second record lets you review documents side by side."
                />
              )}
            </>
          )}
        </TabView>
      )}

      <div className="document-review-actions">
        <button
          className={`btn ${saved ? 'secondary' : 'primary'}`}
          onClick={() => {
            ctx.update((d) =>
              audit(
                {
                  ...d,
                  features: {
                    ...d.features,
                    savedSummaries: saved
                      ? d.features.savedSummaries.filter((id) => id !== doc.id)
                      : [...d.features.savedSummaries, doc.id]
                  }
                },
                'Saved document summary updated'
              )
            );
          }}
        >
          <Bookmark size={16} />
          {saved ? 'Summary saved' : 'Save summary'}
        </button>
        <button
          className="btn secondary"
          onClick={() => download('medora-document-summary.txt', summaryText, 'text/plain')}
        >
          <Download size={16} />
          Download summary
        </button>
        <button className="btn secondary" onClick={() => (API_MODE ? ctx.go('privacy') : setShare(true))}>
          <Share2 size={16} />
          {API_MODE ? 'Manage care access' : 'Share preview'}
        </button>
        {isStored && (
          <>
            <button
              className="btn secondary"
              disabled={!!busy}
              onClick={() => void run('Downloading original…', () => api.downloadOriginal(doc.id, doc.name, ctx.ownerId))}
            >
              <Download size={16} />
              Original file
            </button>
            <button
              className="btn ghost"
              disabled={!!busy}
              onClick={() => {
                if (window.confirm('Permanently delete this document and its search index?'))
                  void run('Deleting document…', async () => {
                    await recordMutation(ctx, () => api.deleteDocument(doc.id, ctx.ownerId));
                    toast.success('Document deleted');
                  });
              }}
            >
              <Trash2 size={16} />
              Delete
            </button>
          </>
        )}
      </div>

      <DemoBoundary>
        {API_MODE
          ? 'AI explanations require clinician review. Care access grants cover the whole workspace, including documents.'
          : 'Scripted explanation. Uploaded file contents are not read or clinically interpreted.'}
      </DemoBoundary>

      {/* Voice Chat Modal Integration */}
      <VoiceChatDialog
        ctx={ctx}
        open={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        initialQuery={`What does my ${doc.name} (${doc.type}) say?`}
      />

      {!API_MODE && (
        <FeatureDialog
          open={share}
          onClose={() => setShare(false)}
          title="Share a document summary"
          description="Choose a recipient and preview permissions. No message is sent."
        >
          <form
            className="dialog-form"
            onSubmit={(e) => {
              e.preventDefault();
              ctx.update((d) =>
                audit(
                  {
                    ...d,
                    features: {
                      ...d.features,
                      documentShares: [
                        ...d.features.documentShares,
                        { id: uid(), documentId: doc.id, recipient, permission, expires }
                      ]
                    }
                  },
                  'Sharing preview saved'
                )
              );
              setShare(false);
              toast.success('Sharing preview saved. Nothing was sent.');
            }}
          >
            <label>
              Recipient
              <Pick
                label="Document recipient"
                value={recipient}
                onChange={setRecipient}
                options={['Dr. Rajesh Sharma', 'Apollo City Clinic', ...ctx.data.family.map((f) => f.name)]}
              />
            </label>
            <label>
              Permission
              <Pick
                label="Document sharing permission"
                value={permission}
                onChange={setPermission}
                options={['Summary only', 'Summary and doctor questions', 'Document metadata and summary']}
              />
            </label>
            <label>
              Preview expires
              <input type="date" value={expires} min={dateOffset(0)} required onChange={(e) => setExpires(e.target.value)} />
            </label>
            <button className="btn primary">Save sharing preview</button>
          </form>
        </FeatureDialog>
      )}
    </div>
  );
}

export function DocumentWorkspace({ ctx }: { ctx: AppContext }) {
  const [limit, setLimit] = useState(10 * 1024 * 1024);
  const [voiceOpen, setVoiceOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (API_MODE)
      void api
        .capabilities()
        .then((c) => {
          if (active) setLimit(c.max_upload_bytes);
        })
        .catch(() => { });
    return () => {
      active = false;
    };
  }, []);

  const [q, setQ] = useState('');
  const [type, setType] = useState('All documents');
  const [selected, setSelected] = useState(ctx.data.documents[0]?.id || '');
  const [savedOnly, setSavedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const files = ctx.data.documents.filter(
    (d) =>
      (type === 'All documents' || d.type === type) &&
      d.name.toLowerCase().includes(q.toLowerCase()) &&
      (!savedOnly || ctx.data.features.savedSummaries.includes(d.id))
  );
  const current = ctx.data.documents.find((d) => d.id === selected) || ctx.data.documents[0];

  const addFile = async (file?: File) => {
    if (!file || busy) return;
    if (!/\.(pdf|png|jpe?g|txt)$/i.test(file.name)) {
      setError('Choose a PDF, image, or text file.');
      return;
    }
    if (file.size > limit) {
      setError(`Choose a file smaller than ${limit / (1024 * 1024)} MB.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (API_MODE) {
        const result = await recordMutation(ctx, () => api.upload(file, ctx.ownerId));
        setSelected(result.document.id);
        toast.success('Document stored privately');
      } else {
        const id = uid();
        ctx.update((d) =>
          audit(
            {
              ...d,
              documents: [
                {
                  id,
                  name: file.name,
                  type: 'Uploaded file',
                  date: dateOffset(0),
                  size: Math.max(1, Math.ceil(file.size / 1024)) + ' KB',
                  summary:
                    'This upload is a metadata-only preview. File contents have not been read or interpreted.'
                },
                ...d.documents
              ]
            },
            'Document information added'
          )
        );
        setSelected(id);
        toast.success('Document information added');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Heading
        title="From paperwork to perspective."
        sub="Organise your records, compare documents, and prepare for a clearer conversation."
        eyebrow="MEDICAL DOCUMENT AI"
      >
        <button className="btn secondary" onClick={() => setVoiceOpen(true)} style={{ gap: 6 }}>
          <Mic size={16} /> Interactive Voice Chat
        </button>
        <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload size={16} />
          {busy ? 'Uploading…' : 'Add a document'}
        </button>
      </Heading>

      <FeatureBanner
        icon={Files}
        label="YOUR DOCUMENT SPACE"
        title="A clearer story, all together."
        tone="coral"
        action={
          <div className="banner-stat">
            <strong>{ctx.data.documents.length}</strong>
            <span>health documents</span>
          </div>
        }
      >
        {API_MODE
          ? 'Keep documents private, prepare an AI explanation when you choose, and review findings with your clinician in any Indian language.'
          : 'Review a sample explanation, save questions, and keep each next step close.'}
      </FeatureBanner>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.txt"
        className="sr-only"
        aria-label="Upload document"
        disabled={busy}
        onChange={(e) => {
          void addFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div
        className={`document-dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFile(e.dataTransfer.files[0]);
        }}
      >
        <span className="icon-box coral">
          <Upload size={21} />
        </span>
        <div>
          <h3>{busy ? 'Storing your document…' : 'Drop a document here'}</h3>
          <p>
            PDF, image or text · Up to {limit / (1024 * 1024)} MB · {API_MODE ? 'Private storage' : 'File information only'}
          </p>
        </div>
        <button className="btn secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          Browse files
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="document-workspace">
        <Panel className="document-library">
          <div className="row">
            <h2>Your library</h2>
            <span className="badge">{files.length}</span>
          </div>
          <SearchInput value={q} onChange={setQ} placeholder="Search documents…" />
          <Pick
            label="Document type"
            value={type}
            onChange={setType}
            options={['All documents', 'Consultation', 'Lab report', 'Radiology', 'Referral', 'Vaccination', 'Uploaded file']}
          />
          <div className="checkbox-line">
            <Checkbox id="saved-document-filter" checked={savedOnly} onCheckedChange={(v) => setSavedOnly(!!v)} />
            <label htmlFor="saved-document-filter">Saved summaries</label>
          </div>
          <div className="document-library-list">
            {files.map((d) => (
              <button
                key={d.id}
                className={`document-library-item ${current?.id === d.id ? 'selected' : ''}`}
                aria-pressed={current?.id === d.id}
                onClick={() => setSelected(d.id)}
              >
                <span className="icon-box">
                  <FileText size={18} />
                </span>
                <span>
                  <strong>{d.name}</strong>
                  <small>
                    {d.type} · {niceDate(d.date)}
                  </small>
                </span>
                {ctx.data.features.savedSummaries.includes(d.id) && <Bookmark size={15} />}
              </button>
            ))}
            {!files.length && <EmptyState title="No matching documents" text="Try another search or filter." />}
          </div>
        </Panel>

        <Panel className="document-review-panel">
          {current ? (
            <DocumentReview key={current.id} ctx={ctx} document={current} />
          ) : (
            <EmptyState title="Your care story starts here" text="Add a document to organise your care records." />
          )}
        </Panel>
      </div>

      <VoiceChatDialog
        ctx={ctx}
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
      />

      {!API_MODE && ctx.data.features.documentShares.length > 0 && (
        <Panel title="Your sharing previews" sub="Saved permissions only. No documents have been sent." className="mt-6">
          {ctx.data.features.documentShares.map((s) => (
            <div className="sharing-preview-row" key={s.id}>
              <Share2 size={18} />
              <div>
                <strong>{s.recipient}</strong>
                <p>
                  {ctx.data.documents.find((d) => d.id === s.documentId)?.name} · {s.permission}
                </p>
              </div>
              <span className="badge">Until {niceDate(s.expires)}</span>
              <button
                className="btn ghost"
                onClick={() =>
                  ctx.update((d) => ({
                    ...d,
                    features: {
                      ...d.features,
                      documentShares: d.features.documentShares.filter((x) => x.id !== s.id)
                    }
                  }))
                }
              >
                Remove preview
              </button>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}
