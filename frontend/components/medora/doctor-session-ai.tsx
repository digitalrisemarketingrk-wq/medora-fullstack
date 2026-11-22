'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AudioLines,
  Mic,
  MicOff,
  Pause,
  Play,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Pill,
  Stethoscope,
  FileText,
  Clock,
  Save,
  Download,
  Copy,
  RotateCcw,
  Zap,
  ShieldAlert,
  Tag,
  HeartPulse,
  BrainCircuit,
  Plus,
  Trash2,
  Filter,
  Square,
  Activity,
  X,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { AppContext, Heading, Panel, Pick, SearchInput, EmptyState } from './shared';
import { audit, dateOffset, download, niceDate, uid, type Patient } from '@/lib/medora-demo';
import { api, API_MODE, type ConsultationSessionInsights, type DrugRecommendation } from '@/lib/medora-api';

export const PATIENT_ALLERGIES_REGISTRY: Record<string, string[]> = {
  p1: ['Penicillin (Moderate - Urticaria / Hives)', 'Sulfa Drugs (Mild)'],
  p2: ['Sulfa Drugs / Sulfonamides (Severe - Angioedema)', 'Levocetirizine (Documented hypersensitivity)'],
  p3: ['Aspirin & NSAIDs (Moderate - Bronchospasm)', 'Penicillin (Mild)'],
  p4: ['Ciprofloxacin / Fluoroquinolones (Mild - Tendinitis)', 'Sulfa Drugs (Hives)'],
  p5: ['Penicillin (Severe - Anaphylaxis risk)', 'Amoxicillin'],
  p6: ['Amoxicillin / Beta-Lactams (Skin rash)', 'Levocetirizine (Mild rash / hives)']
};

/**
 * Real-Time Clinical Pharmacology Phonetic Normalizer.
 * Corrects ambient speech recognition mishearings of medical drugs, dosages, and frequencies.
 */
export function correctMedicalPhonetics(text: string): string {
  if (!text) return text;
  return text
    // Levocetirizine / Cetirizine (All acoustic sound-alikes: level, lever citizen, levocritizine, level to, leave a citizen)
    .replace(/\b(?:leave\s*a\s*citizen|leave\s*citizen|lever\s*citizen|lever\s*city|levo\s*city\s*seen|levo\s*critizine|levocritizine|levo\s*citrizine|levocitrizine|levo\s*cetirizine|levocetirizine|live\s*citizen|live\s*a\s*citizen|clever\s*citizen|liver\s*citizen|label\s*citizen|level\s*(?:citizen|citizens|critizine|citrizine|setters?|tea\s*seen|resin|triazine|set|satin|certain|seen|sit|to|two|2))\b/gi, 'Levocetirizine')
    .replace(/\b(?:setters\s*seen|city\s*scene|citi\s*rizine|cetri\s*zine)\b/gi, 'Cetirizine')
    // Contextual Levocetirizine recovery when speech engine outputs "level" alongside medication keywords
    .replace(/\b(?:prescribe|prescribing|take|giving|start\s*on|tablet|tab|pill|medicine|for\s*allergy|for\s*allergies)\s+level\b/gi, '$1 Levocetirizine')
    .replace(/\blevel\s+(?:5\s*mg|10\s*mg|5mg|10mg|tablet|tab|pill|for\s*allerg(?:y|ies)|at\s*bedtime|once\s*daily)\b/gi, 'Levocetirizine $1')
    // Standalone "level" when talking about prescriptions (preserving blood pressure/glucose level)
    .replace(/(?<!(?:blood\s*pressure|sugar|glucose|pain|oxygen|creatinine|platelet)\s+)\blevel\b(?!\s+(?:high|low|normal|elevated|borderline|checked|reading))/gi, 'Levocetirizine')
    // Telmisartan
    .replace(/\b(?:tell\s*me\s*(?:certain|start\s*in|satan|sir\s*tan|star\s*tan)|telmi\s*sartan|tell\s*miss\s*sartan)\b/gi, 'Telmisartan')
    // Amoxicillin / Augmentin
    .replace(/\b(?:a\s*mock\s*(?:ceiling|seller|silin|silly|sealing)|marks\s*a\s*ceiling|amoxy\s*cillin|amox\s*cillin)\b/gi, 'Amoxicillin')
    .replace(/\b(?:augmented|argument\s*in|ox\s*mentin|og\s*mentin)\b/gi, 'Augmentin')
    .replace(/\b(?:amox\s*clav|amoxicillin\s*clavulanate|amoxicillin\s*plus\s*clavulanate)\b/gi, 'Amoxicillin-Clavulanate')
    // Paracetamol
    .replace(/\b(?:para\s*set\s*a\s*mall|paris\s*at\s*all|parasite\s*mall|para\s*sit\s*a\s*mall|paracit\s*a\s*mol)\b/gi, 'Paracetamol')
    // Metformin
    .replace(/\b(?:met\s*forming|meant\s*for\s*men|net\s*formin|met\s*former)\b/gi, 'Metformin')
    // Atorvastatin
    .replace(/\b(?:a\s*tour\s*of\s*a\s*stat\s*in|a\s*tour\s*stat\s*in|a\s*torva\s*statin|tour\s*of\s*a\s*statin)\b/gi, 'Atorvastatin')
    // Pantoprazole / Omeprazole
    .replace(/\b(?:pento\s*pro\s*zole|pan\s*top\s*raz\s*ole|painter\s*prozzle|panta\s*prazole|panto\s*d)\b/gi, 'Pantoprazole')
    .replace(/\b(?:oh\s*meh\s*prazole|o\s*map\s*resolve)\b/gi, 'Omeprazole')
    // Montelukast
    .replace(/\b(?:mountain\s*lou\s*cast|monte\s*lu\s*cast|monty\s*lou\s*cast)\b/gi, 'Montelukast')
    // Azithromycin
    .replace(/\b(?:as\s*it\s*through\s*my\s*sin|a\s*zithro\s*my\s*sin|azithro\s*mycin)\b/gi, 'Azithromycin')
    // Ciprofloxacin
    .replace(/\b(?:sip\s*row\s*flocks\s*a\s*sin|cipro\s*flocks\s*a\s*seen|sepro\s*flocks\s*a\s*sin)\b/gi, 'Ciprofloxacin')
    // Lisinopril
    .replace(/\b(?:listen\s*o\s*pril|listen\s*april|lisino\s*pril)\b/gi, 'Lisinopril')
    // Amlodipine
    .replace(/\b(?:am\s*low\s*da\s*peen|am\s*load\s*a\s*peen|amlo\s*deep\s*in)\b/gi, 'Amlodipine')
    // Ibuprofen
    .replace(/\b(?:i\s*be\s*pro\s*fen|eye\s*view\s*pro\s*fen|ibu\s*pro\s*fin)\b/gi, 'Ibuprofen')
    // Doxycycline
    .replace(/\b(?:doc\s*see\s*cycle\s*in|doxy\s*cycle\s*in)\b/gi, 'Doxycycline')
    // Cefixime
    .replace(/\b(?:see\s*fix\s*eem|safe\s*fix\s*eem)\b/gi, 'Cefixime')
    // Losartan
    .replace(/\b(?:low\s*sir\s*tan|low\s*sartan)\b/gi, 'Losartan')
    // Dosages & Frequencies
    .replace(/\b(\d+)\s*(?:m\s*g|milligrams?|milli\s*grams?)\b/gi, '$1mg')
    .replace(/\b(\d+)\s*(?:m\s*l|milliliters?|milli\s*liters?)\b/gi, '$1ml')
    .replace(/\b(?:once|one\s*time)\s*(?:a\s*day|daily)\b/gi, 'once daily (1-0-0)')
    .replace(/\b(?:twice|two\s*times)\s*(?:a\s*day|daily)\b/gi, 'twice daily (1-0-1)')
    .replace(/\b(?:thrice|three\s*times)\s*(?:a\s*day|daily)\b/gi, 'three times daily (1-1-1)')
    .replace(/\b(?:at\s*bedtime|at\s*night|before\s*sleep)\b/gi, 'at bedtime (0-0-1)')
    .replace(/\b(?:empty\s*stomach|before\s*food|before\s*breakfast)\b/gi, 'on an empty stomach')
    .replace(/\b(?:after\s*food|after\s*meals|after\s*eating)\b/gi, 'after meals');
}

const SAMPLE_RAW_CONSULTATION = `Doctor: Good morning Priya, um, how have you been feeling since we started you on the Lisinopril for your blood pressure?
Patient: Good morning Dr. Sharma. Uh, my energy is slightly better, but, um, you know, I've developed this annoying dry cough in the evenings. And, like, yesterday when I climbed the stairs, I felt a little bit of breathlessness, and hmm, my ankles felt slightly swollen.
Doctor: I see. Let's check your vitals right away. Your blood pressure today in clinic is 134 over 84 mmHg, pulse is 74 bpm, regular rhythm. Oxygen saturation is 98% on room air.
Patient: Is that, like, normal or high?
Doctor: Your blood pressure is fairly well controlled, but the dry cough is a classic bradykinin effect from the Lisinopril. And you have trace pedal edema bilaterally. I recommend we switch you from Lisinopril to an ARB like Telmisartan 40mg once daily in the morning. ARBs give the same heart and kidney protection without triggering the dry cough.
Patient: That would be, um, wonderful. Should I stop the old tablet immediately?
Doctor: Yes, stop Lisinopril today and start Telmisartan tomorrow morning after breakfast. For the allergic cough and throat irritation, we can also add Levocetirizine 5mg at bedtime for 10 days. Also, let's order a routine serum creatinine and electrolyte blood test.
Patient: Okay doctor. Any dietary restrictions?
Doctor: Keep dietary sodium low, under 2 grams a day, drink plenty of water, and keep a log of your morning blood pressure readings. If you experience sudden chest discomfort or severe shortness of breath at rest, contact emergency services immediately. Let's review your progress in two weeks.`;

export function DoctorSessionAI({ ctx }: { ctx: AppContext }) {
  const normalizeTranscript = (text:string) => API_MODE ? text : correctMedicalPhonetics(text);
  const [selectedPatientId, setSelectedPatientId] = useState(ctx.selected || ctx.data.patients[0]?.id || 'p1');
  const p = ctx.data.patients.find(x => x.id === selectedPatientId) || ctx.data.patients[0];
  const [q, setQ] = useState('');

  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [transcriptTab, setTranscriptTab] = useState<'clean' | 'raw'>('clean');
  const [rawTranscript, setRawTranscript] = useState('');
  const [cleanTranscript, setCleanTranscript] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState<ConsultationSessionInsights | null>(null);
  const [isSampleLoaded, setIsSampleLoaded] = useState(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(24).fill(4));

  // Dynamic Patient Allergy State (Synced with Clinical Registry)
  const [patientAllergies, setPatientAllergies] = useState<string[]>(
    API_MODE ? [] : PATIENT_ALLERGIES_REGISTRY[p?.id || 'p1'] || []
  );
  const [newAllergyText, setNewAllergyText] = useState('');
  const [isAddingAllergy, setIsAddingAllergy] = useState(false);

  // Audio recording & Speech recognition refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const isRecordingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const analysisGeneration = useRef(0);

  // Active meds
  const activeMeds = API_MODE ? [] : p?.id === 'p1' ? ctx.data.medicines.map(m => m.name) : [];

  // Sync allergies when patient selection changes
  useEffect(() => {
    setPatientAllergies(API_MODE ? [] : PATIENT_ALLERGIES_REGISTRY[p?.id || 'p1'] || []);
    ++analysisGeneration.current;
    setInsights(null);
    setAnalyzing(false);
    setRawTranscript('');
    setCleanTranscript('');
    accumulatedTranscriptRef.current='';
  }, [p?.id]);

  const addAllergy = (allergy: string) => {
    const trimmed = allergy.trim();
    if (!trimmed) return;
    if (patientAllergies.some(a => a.toLowerCase().includes(trimmed.toLowerCase()))) {
      toast.info(`${trimmed} is already in this session context.`);
      return;
    }
    setPatientAllergies(prev => [...prev, trimmed]);
    setNewAllergyText('');
    setIsAddingAllergy(false);
    toast.success(`Added ${trimmed} to ${p.name}'s session context.`);
  };

  const removeAllergy = (index: number) => {
    const removed = patientAllergies[index];
    setPatientAllergies(prev => prev.filter((_, i) => i !== index));
    toast.info(`Removed ${removed} from this session.`);
  };

  const matchingPatients = ctx.data.patients.filter(pt =>
    `${pt.name} ${pt.id} ${pt.condition}`.toLowerCase().includes(q.toLowerCase())
  );

  // Clean filler words function (Whisper disfluency purge)
  const stripFillerWords = (text: string) => {
    return text
      .replace(/\b(um+|uh+|er+|ah+|hmm+|mm+|like,?\s*(?=you\s*know)|you\s*know)\b[\s,]*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  // Timer loop for active session: starts from 00:00 and increments dynamically
  useEffect(() => {
    if (sessionActive && !sessionPaused) {
      timerRef.current = setInterval(() => {
        setSessionSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionActive, sessionPaused]);

  // Clean up on unmount or patient change
  useEffect(() => {
    stopRecording();
    setSessionActive(false);
    setSessionPaused(false);
    setSessionSeconds(0);
    setRawTranscript('');
    setCleanTranscript('');
    accumulatedTranscriptRef.current = '';
    setIsSampleLoaded(false);
    setInsights(null);
  }, [p?.id]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start real-time microphone recording and speech recognition
  const startRecording = async (isResume: boolean = false) => {
    // If starting a fresh session, reset timer to 00:00 and clear text
    if (!isResume) {
      setSessionSeconds(0);
      setRawTranscript('');
      setCleanTranscript('');
      accumulatedTranscriptRef.current = '';
      setIsSampleLoaded(false);
      setInsights(null);
    }

    isRecordingRef.current = true;
    isPausedRef.current = false;
    setSessionActive(true);
    setSessionPaused(false);

    // 1. Explicitly prompt and capture live microphone audio stream
    if (typeof window !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioStreamRef.current = stream;
        setMicPermission('granted');

        // Connect real Web Audio Analyser for live frequency waveform
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.35;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        // Real-time animation frame loop reading live mic frequencies
        const updateWaveform = () => {
          if (!analyserRef.current || isPausedRef.current || !isRecordingRef.current) {
            return;
          }
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const bars: number[] = [];
          const count = 24;
          const step = Math.max(1, Math.floor(dataArray.length / count));
          for (let i = 0; i < count; i++) {
            const val = dataArray[i * step] || 0;
            // Scale byte frequency to 4..28px
            const height = Math.max(4, Math.min(28, Math.round((val / 255) * 26) + 4));
            bars.push(height);
          }
          setAudioLevels(bars);
          animFrameRef.current = requestAnimationFrame(updateWaveform);
        };
        animFrameRef.current = requestAnimationFrame(updateWaveform);
      } catch (err) {
        console.warn('Microphone permission denied or unavailable:', err);
        setMicPermission('denied');
        toast.error('Microphone access denied. Please click the permissions icon in your browser address bar to allow microphone.');
      }
    }

    // 2. Start continuous speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {}
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let interim = '';
          let newFinal = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              newFinal += text + ' ';
            } else {
              interim += text;
            }
          }

          if (newFinal) {
            const correctedChunk = normalizeTranscript(newFinal.trim());
            accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + correctedChunk;
          }

          const fullLive = (accumulatedTranscriptRef.current + (interim ? ' ' + normalizeTranscript(interim) : '')).trim();
          const corrected = normalizeTranscript(fullLive);
          setRawTranscript(corrected);
          setCleanTranscript(stripFillerWords(corrected));
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed') {
            setMicPermission('denied');
            toast.error('Microphone permission blocked. Please allow microphone in browser permissions.');
          } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
            console.warn('Speech recognition notice:', event.error);
          }
        };

        recognition.onend = () => {
          // Keep listening continuously during active consultation
          if (isRecordingRef.current && !isPausedRef.current) {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        toast.success(isResume ? 'Consultation resumed. Mic active.' : 'Live consultation started. Recording from 00:00.');
      } catch (e) {
        console.warn('Recognition start exception:', e);
      }
    } else {
      toast.info('Speech recognition API not supported in this browser. Live mic waveform active; you can type notes or load sample case.');
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    isPausedRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setAudioLevels(new Array(24).fill(4));
  };

  const pauseSession = () => {
    isPausedRef.current = true;
    setSessionPaused(true);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    setAudioLevels(new Array(24).fill(4));
    toast.info('Session paused.');
  };

  const resumeSession = () => {
    void startRecording(true);
  };

  const resetSession = () => {
    stopRecording();
    setSessionActive(false);
    setSessionPaused(false);
    setSessionSeconds(0);
    setRawTranscript('');
    setCleanTranscript('');
    accumulatedTranscriptRef.current = '';
    setIsSampleLoaded(false);
    setInsights(null);
    toast.info('Consultation reset. Ready to start from 00:00.');
  };

  // Load realistic 3-min consultation dialogue for demonstration testing
  const loadSampleSession = () => {
    stopRecording();
    setIsSampleLoaded(true);
    setSessionActive(true);
    setSessionPaused(true);
    setSessionSeconds(184); // 03:04
    setRawTranscript(SAMPLE_RAW_CONSULTATION);
    setCleanTranscript(stripFillerWords(SAMPLE_RAW_CONSULTATION));
    accumulatedTranscriptRef.current = SAMPLE_RAW_CONSULTATION;
    toast.success('Clinical sample case loaded (03:04). Click "End Session & Generate Insights" to test.');
  };

  // 1-Click End Session & Generate Insights
  const handleEndSessionAndAnalyze = async () => {
    stopRecording();
    setSessionActive(false);
    setSessionPaused(false);

    const rawActive = cleanTranscript || rawTranscript;
    const activeText = normalizeTranscript(rawActive.trim());
    if (!activeText) {
      toast.error('No consultation audio or transcript captured yet.');
      return;
    }

    const requestGeneration=++analysisGeneration.current;
    setAnalyzing(true);
    try {
      const res = await api.consultationSessionInsights(
        activeText,
        p.name,
        p.condition,
        p.age,
        patientAllergies,
        activeMeds,
        ctx.ownerId
      );
      if(requestGeneration!==analysisGeneration.current)return;
      setInsights(res);
      setCleanTranscript(res.clean_transcript || stripFillerWords(activeText));
      toast.success('Session insights & suggested prescriptions generated!');
    } catch {
      if(requestGeneration!==analysisGeneration.current)return;
      toast.error('Analysis is unavailable. Your transcript is still here; no clinical result was generated.');
    } finally {
      if(requestGeneration===analysisGeneration.current)setAnalyzing(false);
    }
  };

  // Transfer suggested medicines to Rx Studio
  const handleTransferToRxStudio = () => {
    if (API_MODE) {window.location.assign('/practice#prescriptions');return;}
    if (!insights || !insights.suggested_medications.length) {
      toast.error('No medications available to transfer.');
      return;
    }

    // Add suggested medicines to active medicines in care record
    ctx.update(d => {
      const newMeds = insights.suggested_medications
        .filter(m => !m.contraindicated)
        .map(item => ({
          id: uid(),
          name: item.drug_name,
          detail: `${item.dosage} · ${item.frequency} (${item.timing}) for ${item.duration}. ${item.clinical_rationale}`,
          time: item.frequency.includes('1-0-1') ? '08:00, 20:00' : item.frequency.includes('0-0-1') ? '21:00' : '08:00',
          taken: false,
          reminder: true
        }));

      return audit({
        ...d,
        medicines: p.id === 'p1' ? [...d.medicines, ...newMeds] : d.medicines
      }, `Transferred ${newMeds.length} prescribed medications from Live Session AI for ${p.name}`);
    });

    toast.success(`Transferred medications to Rx Studio!`);
    ctx.go('prescriptions');
  };

  // Save consultation summary directly into patient clinical notes
  const handleSaveToCareRecord = async () => {
    if (!insights) return;

    const noteBody = `CONSULTATION SESSION AI SUMMARY\nPatient: ${p.name} · ${p.age}y · ${p.id.toUpperCase()}\nDate: ${niceDate(dateOffset(0))}\n\nSUMMARY\n${insights.summary}\n\nIDENTIFIED ISSUES:\n${insights.identified_issues.map(i => `• ${i.issue} ${i.icd10 ? `[${i.icd10}]` : ''} (${i.severity || 'mild'})`).join('\n')}\n\nSUGGESTED MEDICATIONS:\n${insights.suggested_medications.map(m => `• ${m.drug_name} (${m.frequency}, ${m.timing}) - ${m.clinical_rationale}`).join('\n')}\n\nINVESTIGATIONS & ADVICE:\n• Labs: ${insights.investigations.join(', ')}\n• Lifestyle: ${insights.lifestyle_advice.join(', ')}\n\nClean Transcript:\n${insights.clean_transcript}`;

    ctx.update(d => {
      const newNote = {
        id: uid(),
        patientId: p.id,
        title: `Consultation draft · ${p.condition}`,
        body: noteBody,
        date: dateOffset(0)
      };

      const doc = {
        id: 'doc-' + uid(),
        name: `Consultation-Summary-${p.name.replace(/\s+/g, '-')}-${dateOffset(0)}.txt`,
        type: 'Consultation',
        date: dateOffset(0),
        size: `${Math.max(1, Math.ceil(noteBody.length / 1024))} KB`,
        summary: insights.summary
      };

      return audit({
        ...d,
        notes: [...d.notes, newNote],
        documents: !API_MODE && p.id === 'p1' ? [doc, ...d.documents] : d.documents
      }, `Consultation session summary saved for ${p.name}`);
    });

    try {
      await ctx.flush?.();
      toast.success(`Consultation summary saved to ${p.name}'s care records!`);
    } catch {
      toast.error('The cloud save failed. Keep this session open and retry saving your draft.');
    }
  };

  return (
    <>
      <Heading
        title="Doctor Live Session AI · Ambient Consultation Copilot"
        sub="Record natural doctor-patient dialogue, automatically strip vocal fillers (no 'hmm', 'ah'), and generate 1-click clinical summaries and medication suggestions."
        eyebrow="AMBIENT CLINICAL INTELLIGENCE"
      >
        <button className="btn secondary" onClick={() => ctx.go('prescriptions')}>
          <Pill size={16} /> Open Rx Studio
        </button>
        <button className="btn secondary" onClick={() => ctx.go('consultation')}>
          <FileText size={16} /> Doctor Copilot
        </button>
      </Heading>

      {/* Patient Bar */}
      <div className="copilot-patient-bar">
        <SearchInput value={q} onChange={setQ} placeholder="Select patient for this consultation session…" />
        <label>
          Active Patient
          <Pick
            label="Active Patient"
            value={p.name+' · '+p.id.slice(0,8)}
            onChange={v => {
              const found = ctx.data.patients.find(x => x.name+' · '+x.id.slice(0,8) === v);
              if (found) {
                stopRecording();
                setSelectedPatientId(found.id);
                ctx.setSelected(found.id);
              }
            }}
            options={matchingPatients.length ? matchingPatients.map(x => x.name+' · '+x.id.slice(0,8)) : [p.name+' · '+p.id.slice(0,8)]}
          />
        </label>
        <span className="badge">
          {p.age}y · {p.id.toUpperCase()}
        </span>
      </div>

      {/* Patient Dossier Bar with Interactive Clinical Allergy Manager */}
      <div className="rx-patient-banner" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span className="avatar large">{p.initials}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>{p.name}</h3>
                <span className="badge">{p.condition}</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Blood Group: <strong>{ctx.data.settings?.blood || 'O+'}</strong> · Active Meds:{' '}
                {activeMeds.length ? activeMeds.join(', ') : 'None recorded'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn secondary small"
              onClick={() => setIsAddingAllergy(prev => !prev)}
              style={{ fontSize: '11.5px', padding: '4px 10px' }}
            >
              <Plus size={13} /> {isAddingAllergy ? 'Close' : 'Add Allergy'}
            </button>
          </div>
        </div>

        {/* Allergy List Display */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
          <strong style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} style={{ color: patientAllergies.length ? '#b91c1c' : '#059669' }} />
            Documented Allergies ({patientAllergies.length}):
          </strong>

          {patientAllergies.length > 0 ? (
            patientAllergies.map((alg, idx) => (
              <span
                key={idx}
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fca5a5',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{alg}</span>
                <button
                  type="button"
                  title="Remove this allergy"
                  onClick={() => removeAllergy(idx)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))
          ) : (
            <span style={{ fontSize: '12px', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
              <ShieldCheck size={13} /> Allergy history not recorded — confirm with the patient
            </span>
          )}
        </div>

        {/* Interactive Quick Add Allergy Drawer */}
        {isAddingAllergy && (
          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Quick Add:</span>
            {['Penicillin (Skin rash)', 'Sulfa Drugs (Severe)', 'Levocetirizine / Antihistamines', 'Aspirin / NSAIDs', 'Amoxicillin', 'Cephalosporins'].map(cand => (
              <button
                key={cand}
                type="button"
                className="btn secondary small"
                onClick={() => addAllergy(cand)}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                + {cand}
              </button>
            ))}
            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
              <input
                type="text"
                placeholder="Custom allergy name..."
                value={newAllergyText}
                onChange={e => setNewAllergyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAllergy(newAllergyText);
                  }
                }}
                style={{ padding: '3px 8px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '160px' }}
              />
              <button
                type="button"
                className="btn primary small"
                onClick={() => addAllergy(newAllergyText)}
                disabled={!newAllergyText.trim()}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Session Recording & Scribe Control Center */}
      <Panel
        title={
          sessionActive
            ? isSampleLoaded
              ? 'Clinical Case Simulation · 03:04'
              : `Live Consultation Session in Progress · ${formatTimer(sessionSeconds)}`
            : 'Consultation Session Controls'
        }
        sub={
          sessionActive
            ? isSampleLoaded
              ? 'Sample consultation dialogue loaded with natural conversational disfluencies. Inspect or generate 1-click clinical insights.'
              : 'Capturing ambient microphone speech in real time. Whisper filler filter automatically discards "hmm", "uh", "ah", and vocal hesitations.'
            : 'Click "Start Live Session" to enable microphone and record dialogue live in real-time from 00:00.'
        }
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!sessionActive ? (
              <>
                <button
                  className="btn primary"
                  onClick={() => void startRecording(false)}
                  style={{ background: '#059669', color: '#fff', border: 'none' }}
                >
                  <Mic size={15} /> Start Live Session
                </button>
                <button className="btn secondary" onClick={loadSampleSession}>
                  <FileText size={15} /> Load Clinical Sample Case
                </button>
              </>
            ) : (
              <>
                {sessionPaused ? (
                  <button className="btn secondary" onClick={resumeSession}>
                    <Play size={15} /> Resume
                  </button>
                ) : (
                  <button className="btn secondary" onClick={pauseSession}>
                    <Pause size={15} /> Pause
                  </button>
                )}
                <button className="btn ghost" onClick={resetSession} title="Reset session and timer to 00:00">
                  <RotateCcw size={14} /> Reset
                </button>
                <button
                  className="btn primary"
                  disabled={analyzing}
                  onClick={handleEndSessionAndAnalyze}
                  style={{ background: '#4338ca', color: '#fff', border: 'none' }}
                >
                  <Square size={13} fill="currentColor" /> {analyzing ? 'Analyzing Session...' : 'End Session & Generate Insights'}
                </button>
              </>
            )}
          </div>
        }
      >
        {/* Animated Sound Wave Bar when active */}
        {sessionActive && (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: '#f8faff',
              border: '1px solid #c7d2fe',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isSampleLoaded
                    ? '#e0e7ff'
                    : sessionPaused
                    ? '#fef3c7'
                    : '#dcfce7',
                  color: isSampleLoaded
                    ? '#3730a3'
                    : sessionPaused
                    ? '#b45309'
                    : '#15803d',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isSampleLoaded
                      ? '#4f46e5'
                      : sessionPaused
                      ? '#f59e0b'
                      : '#22c55e',
                    boxShadow: sessionPaused || isSampleLoaded ? 'none' : '0 0 8px #22c55e'
                  }}
                />
                {isSampleLoaded
                  ? 'Sample Simulation Case'
                  : sessionPaused
                  ? 'Session Paused'
                  : 'Live Ambient Mic Active'}
              </span>
              <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', color: '#1e293b' }}>
                {formatTimer(sessionSeconds)}
              </span>
            </div>

            {/* Dynamic Real-Time Sound Waves from Microphone */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '28px' }}>
              {audioLevels.map((lvl, i) => (
                <span
                  key={i}
                  style={{
                    width: '3.5px',
                    height: `${sessionPaused ? 4 : lvl}px`,
                    borderRadius: '2px',
                    background: sessionPaused
                      ? '#cbd5e1'
                      : lvl > 8
                      ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(180deg, #6366f1 0%, #38bdf8 100%)',
                    transition: 'height 0.08s ease'
                  }}
                />
              ))}
            </div>

            <div style={{ fontSize: '11.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={13} style={{ color: '#059669', flexShrink: 0 }} />
              <span><strong>Whisper Disfluency Filter Active:</strong> Discarding &quot;hmm&quot;, &quot;uh&quot;, &quot;ah&quot;, and vocal hesitations</span>
            </div>
          </div>
        )}

        {/* Microphone permission alert if denied */}
        {micPermission === 'denied' && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '14px'
            }}
          >
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>
              Microphone access is currently blocked in your browser. To record consultations live, please allow microphone access in your browser settings (look for the microphone icon in your address bar).
            </span>
          </div>
        )}

        {/* Live Transcript View with Clean / Raw toggle */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn small ${transcriptTab === 'clean' ? 'primary' : 'ghost'}`}
                onClick={() => setTranscriptTab('clean')}
                style={{ fontSize: '12px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Filter size={12} /> Clean Clinical Dialogue
              </button>
              <button
                className={`btn small ${transcriptTab === 'raw' ? 'primary' : 'ghost'}`}
                onClick={() => setTranscriptTab('raw')}
                style={{ fontSize: '12px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Mic size={12} /> Verbatim Ambient Feed
              </button>
            </div>
            {rawTranscript && (
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {transcriptTab === 'clean' ? 'Conversational fillers removed' : 'Unfiltered acoustic feed'}
              </span>
            )}
          </div>

          <textarea
            rows={5}
            value={transcriptTab === 'clean' ? cleanTranscript : rawTranscript}
            onChange={e => {
              if (transcriptTab === 'clean') {
                setCleanTranscript(e.target.value);
              } else {
                setRawTranscript(e.target.value);
                setCleanTranscript(stripFillerWords(e.target.value));
              }
            }}
            placeholder={
              sessionActive
                ? 'Listening to consultation conversation in real-time...'
                : 'Click "Start Live Session" to record consultation, or click "Load Clinical Sample Case" to preview...'
            }
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              lineHeight: 1.6,
              background: '#fff',
              color: '#1e293b'
            }}
          />
        </div>

        {/* Pharmacological Quick-Insert Chips & Clinical Audio Injection */}
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Pill size={13} style={{ color: '#4f46e5' }} /> Pharmacological Quick-Insert (1-Click Clinical Drug Injection):
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Click to append medication to dialogue or speak naturally into microphone
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              { name: 'Levocetirizine 5mg', timing: 'at bedtime for 10 days for allergic rhinitis' },
              { name: 'Telmisartan 40mg', timing: 'once daily in morning for blood pressure control' },
              { name: 'Amoxicillin-Clav 625mg', timing: 'twice daily with food for 7 days' },
              { name: 'Paracetamol 650mg', timing: 'thrice daily as needed for pain and fever' },
              { name: 'Pantoprazole 40mg', timing: 'once daily before breakfast for 14 days' },
              { name: 'Montelukast 10mg', timing: 'once daily at night for airway hyperreactivity' },
              { name: 'Azithromycin 500mg', timing: 'once daily 1 hour before meals for 5 days' },
              { name: 'Amlodipine 5mg', timing: 'once daily in morning for hypertension' }
            ].map(item => (
              <button
                key={item.name}
                type="button"
                className="btn secondary small"
                onClick={() => {
                  const phrase = `\nDoctor: Prescribing ${item.name} ${item.timing}.`;
                  setCleanTranscript(prev => (prev ? prev + phrase : phrase.trim()));
                  setRawTranscript(prev => (prev ? prev + phrase : phrase.trim()));
                  accumulatedTranscriptRef.current += phrase;
                  toast.success(`Appended ${item.name} into consultation dialogue.`);
                }}
                style={{ fontSize: '11.5px', padding: '4px 9px', background: '#f8fafc' }}
              >
                + {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* Real-time Phonetic Normalizer Status Note */}
        <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={13} style={{ color: '#4f46e5', flexShrink: 0 }} />
          <span>
            <strong>Phonetic Recovery Engine Active:</strong> Automatically maps acoustic mishearings (e.g. &quot;level&quot;, &quot;lever citizen&quot;, &quot;levocritizine&quot; &rarr; <strong>Levocetirizine 5mg</strong>).
          </span>
        </div>

        {/* Quick Action below transcript: Accessible whenever text is present */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button
            className="btn primary"
            disabled={analyzing || (!cleanTranscript.trim() && !rawTranscript.trim())}
            onClick={handleEndSessionAndAnalyze}
            style={{ background: '#4338ca', color: '#fff', fontSize: '13px', padding: '8px 18px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Zap size={14} /> {analyzing ? 'Extracting Insights...' : 'Generate 1-Click Summary & Prescriptions'}
          </button>
        </div>
      </Panel>

      {/* Loading state */}
      {analyzing && (
        <div className="soap-loading-state">
          <BrainCircuit size={32} className="spin-slow" style={{ color: '#4f46e5' }} />
          <div>
            <strong style={{ fontSize: '15px', color: '#1e293b' }}>
              Ambient Session AI is synthesizing consultation...
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Purging conversational fillers, summarizing clinical trajectory, extracting health issues, and cross-checking medications against {p.name}&apos;s allergy profile.
            </p>
          </div>
        </div>
      )}

      {/* Results & Accelerated Clinical Insights Hub */}
      {insights && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '20px' }}>
          {/* Top Hand-Off Action Banner */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)',
              border: '1px solid #c7d2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px'
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} style={{ color: '#4f46e5' }} /> Accelerated Clinical Output Ready
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#475569' }}>
                Summary generated, {insights.identified_issues.length} health issues identified, and {insights.suggested_medications.length} medications ready for prescription.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn primary"
                onClick={handleTransferToRxStudio}
                style={{ background: '#059669', color: '#ffffff', fontWeight: 600 }}
              >
                <ArrowRight size={15} /> Send to Rx Studio & Print Receipt
              </button>
              <button className="btn secondary" onClick={handleSaveToCareRecord}>
                <Save size={15} /> Save to Care Record
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `CLINICAL SUMMARY:\n${insights.summary}\n\nISSUES:\n${insights.identified_issues.map(i => i.issue).join(', ')}\n\nMEDICATIONS:\n${insights.suggested_medications.map(m => `${m.drug_name} (${m.frequency})`).join('\n')}`
                  );
                  toast.success('Consultation briefing copied');
                }}
              >
                <Copy size={15} /> Copy All
              </button>
            </div>
          </div>

          {/* 2-Column Clinical Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
            {/* Left Column: Summary & Issues */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Executive Summary */}
              <Panel title="Executive Clinical Summary" sub="Concise 30-second overview of consultation">
                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', lineHeight: 1.65, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                  {insights.summary}
                </div>
              </Panel>

              {/* Identified Health Issues */}
              <Panel title="Identified Clinical Issues" sub="Working impressions extracted from dialogue">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {insights.identified_issues.map((issue, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#e0e7ff',
                            color: '#4338ca',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                        >
                          {idx + 1}
                        </span>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{issue.issue}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {issue.icd10 && (
                          <span className="soap-icd-tag">
                            <strong>{issue.icd10}</strong>
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: issue.severity === 'high' ? '#fee2e2' : '#fef3c7',
                            color: issue.severity === 'high' ? '#991b1b' : '#92400e'
                          }}
                        >
                          {issue.severity || 'mild'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Right Column: Suggested Prescriptions & Safety Checks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Panel
                title="AI Suggested Prescriptions"
                sub="Reported medication drafts — clinician review required"
                action={
                  <button
                    className="btn secondary small"
                    onClick={handleTransferToRxStudio}
                    style={{ fontSize: '12px' }}
                  >
                    Open in Rx Studio <ArrowRight size={13} />
                  </button>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {insights.suggested_medications.map((med, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: med.contraindicated ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
                        background: med.contraindicated ? '#fffafa' : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>{med.drug_name}</strong>
                          <span style={{ fontSize: '11.5px', color: '#64748b', marginLeft: '6px' }}>
                            ({med.generic_name})
                          </span>
                        </div>
                        <span className="badge">{med.dosage_form}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                        <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                          {med.frequency}
                        </span>
                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 7px', borderRadius: '4px' }}>
                          {med.timing}
                        </span>
                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 7px', borderRadius: '4px' }}>
                          {med.duration}
                        </span>
                      </div>

                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                        {med.clinical_rationale}
                      </p>

                      {med.contraindicated ? (
                        <div className="rx-contra-banner" style={{ marginTop: '4px' }}>
                          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{med.safety_alert || 'Contraindicated with patient allergy'}</span>
                        </div>
                      ) : med.safety_alert ? (
                        <div className="rx-caution-banner" style={{ marginTop: '4px' }}>
                          {med.safety_alert}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Investigations & Lifestyle Advice */}
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e2e8f0', fontSize: '12.5px' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <strong style={{ color: '#475569' }}>Diagnostic Investigations:</strong>{' '}
                    <span>{insights.investigations.join(', ')}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#475569' }}>Lifestyle & Follow-up:</strong>{' '}
                    <span>{insights.lifestyle_advice.join(', ')}</span>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
