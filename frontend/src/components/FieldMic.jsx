import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IconMicrophone, IconMicrophoneOff } from '@tabler/icons-react';
import './FieldMic.css';

const LANG_MAP = {
  english: 'en-IN', hindi: 'hi-IN', marathi: 'mr-IN',
  punjabi: 'pa-IN', gujarati: 'gu-IN',
};

const RETRYABLE = new Set(['network', 'service-not-allowed', 'aborted']);
const MAX_RETRIES = 4;

/**
 * Inline mic button for a single form field.
 * Props:
 *   language   : 'hindi' | 'marathi' | 'english' | ...
 *   onResult   : (transcript: string) => void
 *   disabled   : bool
 */
export default function FieldMic({ language = 'english', onResult, disabled }) {
  const [state, setState] = useState('idle'); // idle | listening | error
  const recRef      = useRef(null);
  const retryRef    = useRef(0);
  const timerRef    = useRef(null);
  const activeRef   = useRef(false);  // true while user wants recording ON

  const isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => {
    activeRef.current = false;
    clearTimeout(timerRef.current);
    recRef.current?.abort();
  }, []);

  const buildAndStart = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang             = LANG_MAP[language] || 'en-IN';
    rec.interimResults   = false;
    rec.maxAlternatives  = 1;
    rec.continuous       = false;

    rec.onstart = () => { setState('listening'); retryRef.current = 0; };

    rec.onerror = (e) => {
      if (activeRef.current && RETRYABLE.has(e.error) && retryRef.current < MAX_RETRIES) {
        retryRef.current += 1;
        timerRef.current = setTimeout(() => {
          if (activeRef.current) buildAndStart();
        }, 600 * retryRef.current);
      } else {
        activeRef.current = false;
        setState('idle');
      }
    };

    rec.onend = () => {
      if (!activeRef.current) setState('idle');
    };

    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript || '';
      activeRef.current = false;
      setState('idle');
      if (t) onResult(t);
    };

    recRef.current = rec;
    try { rec.start(); } catch { setState('idle'); activeRef.current = false; }
  }, [language, onResult]);

  const toggle = () => {
    if (state === 'listening') {
      activeRef.current = false;
      clearTimeout(timerRef.current);
      recRef.current?.stop();
      setState('idle');
      return;
    }
    retryRef.current  = 0;
    activeRef.current = true;
    buildAndStart();
  };

  if (!isSupported) return null;

  return (
    <button
      type="button"
      className={`field-mic ${state === 'listening' ? 'field-mic--active' : ''}`}
      onClick={toggle}
      disabled={disabled}
      title={state === 'listening' ? 'Stop listening' : 'Speak to fill this field'}
      aria-label="Voice input for this field"
    >
      {state === 'listening'
        ? <><IconMicrophoneOff size={15} stroke={2} /><span className="field-mic__ring" /></>
        : <IconMicrophone size={15} stroke={2} />
      }
    </button>
  );
}
