'use client';

import { API_BASE, getApiBase } from './medora-api';

// High-fidelity multi-lingual Speech & Voice Activity Detection for Medora

export interface VoiceLanguage {
  code: string;           // e.g. 'hi-IN', 'en-IN'
  langKey: string;        // 'hi', 'en', 'ta', 'bn', etc.
  name: string;           // 'Hindi (हिन्दी)'
  flag: string;           // '🇮🇳'
  nativeGreeting: string; // 'नमस्ते! मैं आपकी क्या सहायता कर सकता हूँ?'
  samplePrompt: string;   // 'मेरा पिछला एक्स-रे क्या था?'
}

export const INDIAN_LANGUAGES: VoiceLanguage[] = [
  { code: 'en-US', langKey: 'en', name: 'English (Natural HD)', flag: '🌐', nativeGreeting: 'Hello! I am Medora. How can I help with your health records today?', samplePrompt: 'What was my last X-Ray report and what does it show?' },
  { code: 'en-IN', langKey: 'en', name: 'English (India)', flag: '🇮🇳', nativeGreeting: 'Hello! I am Medora. How can I help with your health records?', samplePrompt: 'What was my last X-Ray report and what does it say?' },
  { code: 'hi-IN', langKey: 'hi', name: 'Hindi (हिन्दी)', flag: '🇮🇳', nativeGreeting: 'नमस्ते! मैं मेदोरा हूँ। आपकी सेहत और रिपोर्ट्स के बारे में कैसे मदद करूँ?', samplePrompt: 'मेरा पिछला एक्स-रे क्या था और रिपोर्ट में क्या लिखा है?' },
  { code: 'bn-IN', langKey: 'bn', name: 'Bengali (বাংলা)', flag: '🇮🇳', nativeGreeting: 'নমস্কার! আমি মেদোরা। আপনার স্বাস্থ্য রিপোর্টে কীভাবে সাহায্য করতে পারি?', samplePrompt: 'আমার শেষ এক্স-রে কী ছিল এবং রিপোর্টে কী বলা আছে?' },
  { code: 'ta-IN', langKey: 'ta', name: 'Tamil (தமிழ்)', flag: '🇮🇳', nativeGreeting: 'வணக்கம்! நான் மெடோரா. உங்கள் மருத்துவ அறிக்கைகளில் எப்படி உதவலாம்?', samplePrompt: 'என் கடைசி எக்ஸ்ரே என்ன சொல்கிறது?' },
  { code: 'te-IN', langKey: 'te', name: 'Telugu (తెలుగు)', flag: '🇮🇳', nativeGreeting: 'నమస్కారం! నేను మెడోరా. మీ ఆరోగ్య రికార్డులలో నేను ఎలా సహాయపడగలను?', samplePrompt: 'నా చివరి ఎక్స్-రే ఏమిటి మరియు అది ఏమి చెబుతోంది?' },
  { code: 'mr-IN', langKey: 'mr', name: 'Marathi (मराठी)', flag: '🇮🇳', nativeGreeting: 'नमस्कार! मी मेदोरा. तुमच्या आरोग्याच्या अहवालांबद्दल मी काय मदत करू?', samplePrompt: 'माझा शेवटचा एक्स-रे काय होता आणि रिपोर्टमध्ये काय म्हटले आहे?' },
  { code: 'gu-IN', langKey: 'gu', name: 'Gujarati (ગુજરાતી)', flag: '🇮🇳', nativeGreeting: 'નમસ્તે! હું મેદોરા છું. તમારા સ્વાસ્થ્ય દસ્તાવેજોમાં હું કેવી રીતે મદદ કરું?', samplePrompt: 'મારો છેલ્લો એક્સ-રે શું હતો અને તેમાં શું લખ્યું છે?' },
  { code: 'kn-IN', langKey: 'kn', name: 'Kannada (ಕನ್ನಡ)', flag: '🇮🇳', nativeGreeting: 'ನಮಸ್ಕಾರ! ನಾನು ಮೆಡೋರಾ. ನಿಮ್ಮ ಆರೋಗ್ಯ ದಾಖಲೆಗಳಲ್ಲಿ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?', samplePrompt: 'ನನ್ನ ಕೊನೆಯ ಎಕ್ಸ್-ರೇ ಏನು ಮತ್ತು ಅದು ಏನು ಹೇಳುತ್ತದೆ?' },
  { code: 'ml-IN', langKey: 'ml', name: 'Malayalam (മലയാളം)', flag: '🇮🇳', nativeGreeting: 'നമസ്കാരം! ഞാൻ മെഡോറ. നിങ്ങളുടെ ആരോഗ്യ രേഖകളിൽ ഞാൻ എങ്ങനെ സഹായിക്കണം?', samplePrompt: 'എന്റെ അവസാന എക്സ്-റേ എന്തായിരുന്നു, അതിൽ എന്താണ് പറയുന്നത്?' },
  { code: 'pa-IN', langKey: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)', flag: '🇮🇳', nativeGreeting: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਮੇਦੋਰਾ ਹਾਂ। ਤੁਹਾਡੇ ਸਿਹਤ ਰਿਕਾਰਡਾਂ ਵਿੱਚ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?', samplePrompt: 'ਮੇਰਾ ਪਿਛਲਾ ਐਕਸ-ਰੇ ਕੀ ਸੀ ਅਤੇ ਰਿਪੋਰਟ ਵਿੱਚ ਕੀ ਕਿਹਾ ਗਿਆ ਹੈ?' },
  { code: 'ur-IN', langKey: 'ur', name: 'Urdu (اردو)', flag: '🇮🇳', nativeGreeting: 'السلام علیکم! میں میڈورا ہوں۔ آپ کی صحت کے ریکارڈز میں کیسے مدد کر سکتا ہوں؟', samplePrompt: 'میرا آخری ایکسرے کیا تھا اور رپورٹ میں کیا لکھا ہے؟' },
];

/**
 * Finds the highest-quality natural / neural voice for the given language code and gender.
 */
export function getBestVoiceForLanguage(
  langCode: string,
  gender: 'female' | 'male' = 'female',
  preferredVoice?: string
): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // 0. Explicit Preferred Voice Name Match (e.g. 'aria', 'jenny', 'guy', 'serena', 'neerja')
  if (preferredVoice && preferredVoice !== 'auto') {
    const pref = preferredVoice.toLowerCase();
    const prefMatch = voices.find(v => v.name.toLowerCase().includes(pref));
    if (prefMatch) return prefMatch;
  }

  const target = langCode.toLowerCase().replace('_', '-');
  const targetPrefix = target.split('-')[0];

  const naturalKeywords = ['natural', 'online', 'neural', 'aria', 'jenny', 'serena', 'guy', 'christopher', 'google'];
  const femaleKeywords = ['aria', 'jenny', 'serena', 'samantha', 'zira', 'female', 'natural', 'online', 'neerja', 'swara'];
  const maleKeywords = ['guy', 'christopher', 'george', 'david', 'male', 'natural', 'online', 'prabhat', 'madhur'];
  const keywords = gender === 'female' ? femaleKeywords : maleKeywords;

  // 1. First priority: High-quality English Natural Neural Voice (Aria, Jenny, Serena, Guy)
  if (targetPrefix === 'en') {
    const naturalEn = voices.find(v => {
      const vLang = v.lang.toLowerCase();
      const name = v.name.toLowerCase();
      const isEn = vLang.startsWith('en');
      const isGender = keywords.some(k => name.includes(k));
      const isNatural = naturalKeywords.some(k => name.includes(k));
      return isEn && isGender && isNatural;
    });
    if (naturalEn) return naturalEn;

    const anyNaturalEn = voices.find(v => v.lang.toLowerCase().startsWith('en') && naturalKeywords.some(k => v.name.toLowerCase().includes(k)));
    if (anyNaturalEn) return anyNaturalEn;
  }

  // 2. Second priority: Exact match with target locale + gender match + natural/online in name
  const exactGenderNeural = voices.find(v => {
    const vLang = v.lang.toLowerCase().replace('_', '-');
    const name = v.name.toLowerCase();
    const isLangMatch = vLang === target;
    const isGenderMatch = keywords.some(k => name.includes(k));
    const isNeural = naturalKeywords.some(k => name.includes(k));
    return isLangMatch && isGenderMatch && isNeural;
  });
  if (exactGenderNeural) return exactGenderNeural;

  // 3. Exact target locale + gender match
  const exactGender = voices.find(v => {
    const vLang = v.lang.toLowerCase().replace('_', '-');
    const name = v.name.toLowerCase();
    return vLang === target && keywords.some(k => name.includes(k));
  });
  if (exactGender) return exactGender;

  // 4. Exact target locale + natural/online
  const exactNeural = voices.find(v => {
    const vLang = v.lang.toLowerCase().replace('_', '-');
    const name = v.name.toLowerCase();
    return vLang === target && naturalKeywords.some(k => name.includes(k));
  });
  if (exactNeural) return exactNeural;

  // 5. Any voice matching exact locale (e.g. en-IN or hi-IN)
  const exactLocale = voices.find(v => v.lang.toLowerCase().replace('_', '-') === target);
  if (exactLocale) return exactLocale;

  // 6. Language prefix match with gender preference
  const prefixGenderMatch = voices.find(v => v.lang.toLowerCase().startsWith(targetPrefix) && keywords.some(k => v.name.toLowerCase().includes(k)));
  if (prefixGenderMatch) return prefixGenderMatch;

  const prefixMatch = voices.find(v => v.lang.toLowerCase().startsWith(targetPrefix));
  if (prefixMatch) return prefixMatch;

  // 7. Fallback for English: Natural voice
  if (targetPrefix === 'en') {
    const enGender = voices.find(v => v.lang.startsWith('en') && keywords.some(k => v.name.toLowerCase().includes(k)));
    if (enGender) return enGender;
    return voices.find(v => v.lang.startsWith('en')) || null;
  }

  return voices[0] || null;
}

/**
 * Cleans text for oral speech (removes raw markdown symbols, tables, hashes).
 */
export function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\|[^\n]+\|/g, '')     // Remove markdown tables
    .replace(/#{1,6}\s+/g, '')       // Remove header hashes
    .replace(/[*_~`]/g, '')          // Remove formatting symbols
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to plain text
    .replace(/[-•*]\s+/g, '. ')     // Convert bullet points to full pauses
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits text into conversational breath phrases with realistic human pauses.
 */
export function splitIntoSpeechPhrases(cleanText: string): string[] {
  // Split on sentence boundaries and natural punctuation pauses
  const rawPhrases = cleanText.split(/(?<=[.!?।])\s+|(?<=[,;])\s+/);
  const phrases: string[] = [];

  for (const p of rawPhrases) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    // If a sentence is very long (>140 chars), split at natural conjunctions
    if (trimmed.length > 140) {
      const subParts = trimmed.split(/\s+(?:and|or|but|aur|ya|tatha|lekin|ennal|matrum)\s+/i);
      for (const sp of subParts) {
        if (sp.trim()) phrases.push(sp.trim());
      }
    } else {
      phrases.push(trimmed);
    }
  }

  return phrases.length ? phrases : [cleanText];
}

export class SpeechEngine {
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isCancelled = false;
  private currentPhraseIndex = 0;
  private phrases: string[] = [];
  private onStateChange?: (state: 'idle' | 'speaking' | 'paused') => void;
  private onPhraseProgress?: (currentPhrase: string, index: number, total: number) => void;
  private timeoutId: any = null;

  constructor(
    onStateChange?: (state: 'idle' | 'speaking' | 'paused') => void,
    onPhraseProgress?: (currentPhrase: string, index: number, total: number) => void
  ) {
    this.onStateChange = onStateChange;
    this.onPhraseProgress = onPhraseProgress;
  }

  public stop(): void {
    this.isCancelled = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.activeUtterance = null;
    this.onStateChange?.('idle');
  }

  public async speakText(
    rawText: string,
    langCode = 'en-US',
    onComplete?: () => void,
    gender: 'female' | 'male' = 'female',
    voiceMode: 'instant' | 'cloud' = 'instant',
    cloudEngine: 'auto' | 'gemini' | 'edge' = 'auto',
    preferredVoice?: string
  ): Promise<void> {
    this.stop();
    const clean = cleanTextForSpeech(rawText);
    if (!clean) {
      onComplete?.();
      return;
    }

    this.isCancelled = false;
    this.onStateChange?.('speaking');

    // 1. Instant Mode: zero network latency (<30ms), crystal-clear local neural playback
    if (voiceMode === 'instant') {
      this.fallbackBrowserSpeech(clean, langCode, onComplete, gender, preferredVoice);
      return;
    }

    const langKey = langCode.toLowerCase().split('-')[0];

    // 2. Cloud Mode: Stream high-definition backend audio (Gemini 3.8 Flash TTS or Edge-TTS)
    try {
      const base = getApiBase();
      const speakUrl = base.startsWith('http')
        ? new URL('ai/speak', base.endsWith('/') ? base : `${base}/`).toString()
        : base + '/ai/speak';
      const response = await fetch(speakUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, language: langKey, gender, engine: cloudEngine })
      });

      if (response.ok && !this.isCancelled) {
        const blob = await response.blob();
        if (blob.size > 100 && !this.isCancelled) {
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          this.currentAudio = audio;

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            this.currentAudio = null;
            this.onStateChange?.('idle');
            onComplete?.();
          };

          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            this.currentAudio = null;
            // Fallback to instant browser synthesis
            this.fallbackBrowserSpeech(clean, langCode, onComplete, gender, preferredVoice);
          };

          this.onPhraseProgress?.(clean.slice(0, 100), 0, 1);
          await audio.play();
          return;
        }
      }
    } catch (e) {
      // Backend neural voice unavailable, seamlessly fall through to browser speech synthesis
    }

    if (this.isCancelled) return;
    this.fallbackBrowserSpeech(clean, langCode, onComplete, gender, preferredVoice);
  }

  private fallbackBrowserSpeech(
    clean: string,
    langCode: string,
    onComplete?: () => void,
    gender: 'female' | 'male' = 'female',
    preferredVoice?: string
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.onStateChange?.('idle');
      onComplete?.();
      return;
    }

    this.phrases = splitIntoSpeechPhrases(clean);
    this.currentPhraseIndex = 0;
    const voice = getBestVoiceForLanguage(langCode, gender, preferredVoice);

    const playNextPhrase = () => {
      if (this.isCancelled || this.currentPhraseIndex >= this.phrases.length) {
        this.onStateChange?.('idle');
        onComplete?.();
        return;
      }

      const phrase = this.phrases[this.currentPhraseIndex];
      this.onPhraseProgress?.(phrase, this.currentPhraseIndex, this.phrases.length);

      const utterance = new SpeechSynthesisUtterance(phrase);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = langCode;
      }

      utterance.rate = 1.0;
      utterance.pitch = gender === 'female' ? 1.0 : 0.95;

      utterance.onend = () => {
        if (this.isCancelled) return;
        this.currentPhraseIndex++;
        const isSentenceEnd = /[.!?।]/.test(phrase.slice(-1));
        const pauseTime = isSentenceEnd ? 100 : 40;

        this.timeoutId = setTimeout(() => {
          playNextPhrase();
        }, pauseTime);
      };

      utterance.onerror = () => {
        if (this.isCancelled) return;
        this.currentPhraseIndex++;
        playNextPhrase();
      };

      this.activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    };

    playNextPhrase();
  }
}

/**
 * Real-time Voice Activity Detector (VAD) listening via Web Audio API.
 * Detects if the user starts talking so Medora can instantly interrupt/pause!
 */
export class VoiceActivityDetector {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private speakingFramesCount = 0;
  private isListening = false;

  constructor(
    private onSpeechDetected: () => void,
    private onVolumeLevel?: (volume: number) => void
  ) {}

  public async start(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.3;

      this.microphone = this.audioCtx.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.isListening = true;
      this.monitorAudio();
      return true;
    } catch (err) {
      console.warn('Microphone access for VAD denied or not supported:', err);
      return false;
    }
  }

  private monitorAudio(): void {
    if (!this.isListening || !this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const normalizedVolume = Math.min(1, average / 128);

    this.onVolumeLevel?.(normalizedVolume);

    // If volume exceeds conversational threshold for > 3 consecutive frames (~120ms)
    if (normalizedVolume > 0.18) {
      this.speakingFramesCount++;
      if (this.speakingFramesCount >= 3) {
        this.onSpeechDetected();
        this.speakingFramesCount = 0;
      }
    } else {
      this.speakingFramesCount = Math.max(0, this.speakingFramesCount - 1);
    }

    this.animFrameId = requestAnimationFrame(() => this.monitorAudio());
  }

  public stop(): void {
    this.isListening = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
