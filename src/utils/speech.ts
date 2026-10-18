/**
 * Robust Web Speech API wrapper (TTS & Audio chime) for 급똥내비
 * Fixes Chrome utterance garbage collection, voice preload timing, and resume bugs.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];
let voiceLoadingPromise: Promise<SpeechSynthesisVoice[]> | null = null;

// Initialize and preload voices
export function initVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  if (cachedVoices.length > 0) {
    return Promise.resolve(cachedVoices);
  }

  if (voiceLoadingPromise) {
    return voiceLoadingPromise;
  }

  voiceLoadingPromise = new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      cachedVoices = voices;
      resolve(voices);
      return;
    }

    const onVoicesChanged = () => {
      const updated = window.speechSynthesis.getVoices();
      if (updated && updated.length > 0) {
        cachedVoices = updated;
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(updated);
      }
    };

    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

    // Timeout fallback after 1.5s
    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, 1500);
  });

  return voiceLoadingPromise;
}

// Find best Korean voice
function findKoreanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // 1. Exact ko-KR or ko_KR match
  const exact = voices.find(
    (v) => v.lang === 'ko-KR' || v.lang === 'ko_KR' || v.lang.startsWith('ko')
  );
  if (exact) return exact;

  // 2. Name match (e.g., Korean, Yuna, Heami)
  const byName = voices.find((v) => /korean|korea|한국/i.test(v.name));
  if (byName) return byName;

  // 3. Fallback to default or first voice
  return voices.find((v) => v.default) || voices[0] || null;
}

/**
 * Speaks Korean text with robust error handling and garbage collection prevention
 */
export function speakKoreanTTS(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis is not supported in this environment.');
    onError?.('Speech synthesis not supported');
    return;
  }

  if (!text || text.trim() === '') {
    onEnd?.();
    return;
  }

  // Pre-chime for instant audible confirmation
  playHapticChime('nav_start');

  try {
    // Chrome bugfix: resume if paused
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();
  } catch (e) {
    console.warn('Speech cancel error:', e);
  }

  // Slight 40ms delay after cancel to prevent Chromium utterance drop
  setTimeout(async () => {
    try {
      const voices = await initVoices();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.05; // Emergency prompt pace
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const koVoice = findKoreanVoice(voices);
      if (koVoice) {
        utterance.voice = koVoice;
      }

      // Keep utterance in window global scope to avoid V8 GC cutoff bug
      (window as any).__flushpulse_utterance = utterance;

      let hasFinished = false;
      const safeFinish = (callback?: () => void) => {
        if (!hasFinished) {
          hasFinished = true;
          (window as any).__flushpulse_utterance = null;
          callback?.();
        }
      };

      utterance.onstart = () => {
        onStart?.();
      };

      utterance.onend = () => {
        safeFinish(onEnd);
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        safeFinish(() => onError?.(e));
      };

      // Safeguard timer: ensure onEnd fires even if browser swallows onend event
      const expectedDurationMs = Math.max(3000, text.length * 280);
      setTimeout(() => {
        if (!hasFinished && (window as any).__flushpulse_utterance === utterance) {
          safeFinish(onEnd);
        }
      }, expectedDurationMs);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Failed to speak Korean TTS:', err);
      onError?.(err);
      onEnd?.();
    }
  }, 40);
}

export function stopSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      (window as any).__flushpulse_utterance = null;
    } catch (e) {
      console.warn('Speech stop error:', e);
    }
  }
}

export function isSpeaking(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking;
}

// AudioContext-based sound generator
export function playHapticChime(type: 'emergency' | 'nav_start' | 'click' | 'success' | 'alert') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (type === 'emergency' || type === 'alert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(920, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(460, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.23);
    } else if (type === 'nav_start' || type === 'success') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.08);
      osc2.start(ctx.currentTime + 0.08);
      osc2.stop(ctx.currentTime + 0.25);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    }
  } catch {
    // Ignore audio context autoplay restriction errors
  }
}
