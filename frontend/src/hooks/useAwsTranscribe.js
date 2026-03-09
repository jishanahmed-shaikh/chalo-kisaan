/**
 * useAwsTranscribe — real-time speech-to-text via AWS Transcribe Streaming.
 *
 * Strategy:
 *  1. Record audio from the mic using MediaRecorder (webm/ogg chunks).
 *  2. POST each chunk to the backend /api/transcribe endpoint which calls
 *     AWS Transcribe Streaming and returns the partial transcript.
 *  3. Accumulate final + interim results exactly like the old Web Speech hook
 *     so VoiceAssistantPage needs zero logic changes.
 *
 * The hook exposes the same interface as useVoiceInput:
 *   { isListening, transcript, interimTranscript, isSupported,
 *     startListening, stopListening, resetTranscript, error, networkUnavailable }
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const LANG_MAP = {
  english:  'en-IN',
  hindi:    'hi-IN',
  marathi:  'mr-IN',
  punjabi:  'pa-IN',
  gujarati: 'gu-IN',
};

const CHUNK_INTERVAL_MS  = 2500;   // send audio every 2.5 seconds
const API_BASE = process.env.REACT_APP_API_URL || '/api';

export function useAwsTranscribe(language = 'english') {
  const [isListening,        setIsListening]        = useState(false);
  const [transcript,         setTranscript]         = useState('');
  const [interimTranscript,  setInterimTranscript]  = useState('');
  const [error,              setError]              = useState(null);
  const [networkUnavailable, setNetworkUnavailable] = useState(false);
  const [isSupported,        setIsSupported]        = useState(false);
  const [isTranscribing,     setIsTranscribing]     = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef        = useRef(null);
  const chunkTimerRef    = useRef(null);
  const chunksRef        = useRef([]);
  const shouldRunRef     = useRef(false);
  const langRef          = useRef(LANG_MAP[language] || 'en-IN');
  const abortCtrlRef     = useRef(null);

  // Keep langRef in sync
  useEffect(() => {
    langRef.current = LANG_MAP[language] || 'en-IN';
  }, [language]);

  // Check MediaRecorder support on mount
  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
      typeof navigator?.mediaDevices?.getUserMedia === 'function' &&
      typeof window.MediaRecorder !== 'undefined',
    );
  }, []);

  /** Show interim result from accumulated audio (simple speech-to-text preview) */
  const updateInterimFromChunks = useCallback(async () => {
    if (!chunksRef.current.length) return;

    // For interim: do a quick client-side check or simple estimation
    // This just shows that we're collecting audio
    const totalBytes = chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
    const durationSec = Math.round(totalBytes / (16000 * 2 / 8)); // rough estimate at 16kHz 16-bit
    
    // Show a placeholder interim result (optional — mostly for UX feedback)
    if (durationSec >= 2) {
      setInterimTranscript(`[recording... ${durationSec}s]`);
    }
  }, []);

  /** Send ALL accumulated audio chunks to /api/transcribe once, then process result */
  const flushChunks = useCallback(async () => {
    if (!chunksRef.current.length) return;

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];

    try {
      setIsTranscribing(true);
      setInterimTranscript('Transcribing...');

      const formData = new FormData();
      formData.append('audio', blob, 'chunk.webm');
      formData.append('language', langRef.current);

      // Get auth token from localStorage (set by Cognito)
      const token = localStorage.getItem('idToken') || localStorage.getItem('cognito_token') || '';
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;

      const res = await fetch(`${API_BASE}/transcribe`, {
        method: 'POST',
        body: formData,
        headers,
        signal: ctrl.signal,
      });

      if (!res.ok) {
        if (res.status === 503) {
          setNetworkUnavailable(true);
          setIsTranscribing(false);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.transcript) {
        // AWS Transcribe result is always final when using batch
        setTranscript(prev => (prev ? prev + ' ' + data.transcript : data.transcript));
        setInterimTranscript('');
      }
      setIsTranscribing(false);
    } catch (err) {
      if (err.name === 'AbortError') return;   // cleanly stopped
      console.error('[useAwsTranscribe] flush error:', err);
      setError('network');
      setNetworkUnavailable(true);
      setIsTranscribing(false);
    }
  }, []);

  const stopListening = useCallback(async () => {
    shouldRunRef.current = false;
    clearInterval(chunkTimerRef.current);
    abortCtrlRef.current?.abort();

    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }

    mediaRecorderRef.current = null;
    streamRef.current = null;

    // Before clearing, flush any accumulated chunks
    await new Promise(resolve => setTimeout(resolve, 100)); // give ondataavailable time to fire
    if (chunksRef.current.length) {
      await flushChunks();
    }
    chunksRef.current = [];

    setIsListening(false);
    setInterimTranscript('');
  }, [flushChunks]);

  const startListening = useCallback(async () => {
    if (isListening) return;
    setError(null);
    setNetworkUnavailable(false);
    chunksRef.current = [];
    setTranscript('');
    setInterimTranscript('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      shouldRunRef.current = true;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        setError('recorder-error');
        stopListening();
      };

      recorder.start(CHUNK_INTERVAL_MS);  // fires ondataavailable every 2.5s
      setIsListening(true);

      // Show interim progress (how long recording)
      chunkTimerRef.current = setInterval(() => {
        if (!shouldRunRef.current) return;
        updateInterimFromChunks();
      }, 1000);

    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('not-allowed');
      } else {
        setError('mic-error');
        setNetworkUnavailable(true);
      }
      setIsListening(false);
    }
  }, [isListening, stopListening, updateInterimFromChunks]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRunRef.current = false;
      clearInterval(chunkTimerRef.current);
      abortCtrlRef.current?.abort();
      try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    error,
    networkUnavailable,
    isTranscribing,
  };
}
