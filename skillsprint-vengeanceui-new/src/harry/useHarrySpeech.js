import { useCallback, useEffect, useRef, useState } from "react";

// useHarrySpeech.js
//
// Wraps the browser-native Web Speech API (SpeechRecognition for input,
// speechSynthesis for output) so HarryWidget doesn't need to touch either
// API directly. No external API key is required, and everything degrades
// gracefully when a browser doesn't support one or both pieces.

function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Harry needs exactly ONE consistent voice every time he speaks - not
// whatever default the browser happens to pick (which varies by OS/browser
// and is often female). We pick once, from a preference list of known-male
// English voices, cache it, and reuse it for every utterance. This is the
// ONLY place SpeechSynthesisUtterance is created anywhere in the app (see
// grep note below) - there is exactly one TTS source, so there is no
// double-voice/echo path to begin with.
const MALE_VOICE_NAME_PREFERENCE = [
  "Google UK English Male",
  "Google US English Male",
  "Microsoft Guy Online (Natural) - English (United States)",
  "Microsoft David - English (United States)",
  "Microsoft David",
  "Microsoft Ryan Online (Natural) - English (United Kingdom)",
  "Daniel",
  "Alex",
  "Fred",
  "Oliver"
];

function pickMaleVoice(voices) {
  if (!voices || !voices.length) return null;
  const english = voices.filter(v => (v.lang || "").toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;

  for (const name of MALE_VOICE_NAME_PREFERENCE) {
    const hit = pool.find(v => v.name === name || v.name.includes(name));
    if (hit) return hit;
  }
  const labeledMale = pool.find(v => /\bmale\b/i.test(v.name) && !/female/i.test(v.name));
  if (labeledMale) return labeledMale;
  return pool[0] || voices[0] || null;
}

export function useHarrySpeech({ onResult, onError, onSpeechStart, onSpeechEnd } = {}) {
  const RecognitionCtor = getRecognitionCtor();
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const recognitionSupported = Boolean(RecognitionCtor);

  const recognitionRef = useRef(null);
  const voiceRef = useRef(null);
  const [listening, setListening] = useState(false);

  // Load the browser's available voices (async on some browsers) and pick
  // ONE male voice, once, cached in voiceRef for every future utterance.
  useEffect(() => {
    if (!speechSupported) return;
    function loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length) voiceRef.current = pickMaleVoice(voices);
    }
    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechSupported]);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(() => {
    try {
      const saved = window.localStorage.getItem("harry:voiceOutputEnabled");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem("harry:voiceOutputEnabled", String(voiceOutputEnabled)); } catch { /* ignore */ }
  }, [voiceOutputEnabled]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
      if (speechSupported) {
        try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionSupported) {
      onError?.("unsupported");
      return;
    }
    if (listening) return;

    const recognition = new RecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) {
        onError?.("empty");
        return;
      }
      onResult?.(transcript);
    };

    recognition.onerror = (event) => {
      // Common codes: "not-allowed" (mic permission denied), "no-speech",
      // "audio-capture" (no mic found), "network", "aborted".
      onError?.(event?.error || "unknown");
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setListening(false);
      onError?.("start-failed");
    }
  }, [RecognitionCtor, recognitionSupported, listening, onResult, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    setListening(false);
  }, []);

  const speak = useCallback((text) => {
    if (!speechSupported || !voiceOutputEnabled || !text) {
      onSpeechEnd?.();
      return;
    }
    try {
      window.speechSynthesis.cancel(); // never overlap utterances - single TTS source, one at a time
      const utterance = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) utterance.voice = voiceRef.current;
      // Warm, confident, slightly deeper, moderate pace - not robotic, not a nav system.
      utterance.rate = 0.97;
      utterance.pitch = 0.9;
      utterance.onstart = () => onSpeechStart?.();
      utterance.onend = () => onSpeechEnd?.();
      utterance.onerror = () => onSpeechEnd?.();
      window.speechSynthesis.speak(utterance);
    } catch {
      onSpeechEnd?.();
    }
  }, [speechSupported, voiceOutputEnabled, onSpeechStart, onSpeechEnd]);

  const cancelSpeaking = useCallback(() => {
    if (speechSupported) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }, [speechSupported]);

  return {
    recognitionSupported,
    speechSupported,
    listening,
    startListening,
    stopListening,
    speak,
    cancelSpeaking,
    voiceOutputEnabled,
    setVoiceOutputEnabled
  };
}
