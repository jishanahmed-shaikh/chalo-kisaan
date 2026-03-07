/**
 * VoiceAssistantPage — Full-screen AI Voice Assistant
 *
 * Context-aware chat:
 *  - Uses POST /api/assistant/chat (streams SSE)
 *  - Automatically has the user's farm context from saved plans
 *  - FAQ knowledge, agrotourism expert, marketplace info
 *  - Strict language consistency
 *
 * Flow:
 *  1. Tap mic → browser Web Speech API captures voice
 *  2. Transcript shown live
 *  3. Send → POST /api/assistant/chat (stream) → live text response
 *  4. AI answer optionally played via POST /api/tts (Polly TTS)
 */
import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  IconArrowLeft, IconMicrophone,
  IconSend, IconX, IconVolume, IconVolumeOff,
  IconLoader2, IconSparkles, IconRefresh,
  IconLeaf, IconInfoCircle, IconCheck, IconMapPin,
} from '@tabler/icons-react';
import { useVoiceInput }   from '../hooks/useVoiceInput';
import { useAuth }         from '../context/AuthContext';
import { useLanguage }     from '../context/LanguageContext';
import { assistantChat }   from '../utils/api';
import { renderMarkdown }  from '../utils/markdown';
import logoPrimary from '../assets/logo-primary.png';
import './VoiceAssistantPage.css';

/* ─── Language helpers ─────────────────────────────────────────────────────── */
const LANG_OPTIONS = [
  { key: 'hindi',    label: 'हिंदी',    bcp: 'hi-IN', native: 'Hindi'    },
  { key: 'english',  label: 'English',  bcp: 'en-IN', native: 'English'  },
  { key: 'marathi',  label: 'मराठी',    bcp: 'mr-IN',  native: 'Marathi'  },
  { key: 'punjabi',  label: 'ਪੰਜਾਬੀ',  bcp: 'pa-IN', native: 'Punjabi'  },
  { key: 'gujarati', label: 'ગુજરાતી',  bcp: 'gu-IN',  native: 'Gujarati' },
];

/* Strip emojis and reduce text to clean readable content before TTS */
function stripForTTS(text) {
  return text
    // Remove emoji ranges
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    // Remove markdown symbols
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
    .replace(/`+/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    // Normalise whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* Suggested quick-ask chips per language */
const QUICK_ASKS = {
  hindi: [
    { text: 'मेरी आय कितनी हो सकती है?', icon: '💰' },
    { text: 'पास में मंडी कहाँ है?', icon: '🏪' },
    { text: 'कौन सी सरकारी योजना मिलेगी?', icon: '🏛️' },
    { text: 'शुरुआत कैसे करूँ?', icon: '🚀' },
  ],
  english: [
    { text: 'How much can I earn from my farm?', icon: '💰' },
    { text: 'Where is the nearest mandi?', icon: '🏪' },
    { text: 'What govt schemes can I apply for?', icon: '🏛️' },
    { text: 'How do I start agritourism?', icon: '🚀' },
  ],
  marathi: [
    { text: 'माझ्या शेतातून किती उत्पन्न मिळेल?', icon: '💰' },
    { text: 'जवळची बाजारपेठ कुठे आहे?', icon: '🏪' },
    { text: 'कोणत्या सरकारी योजना आहेत?', icon: '🏛️' },
    { text: 'कृषी पर्यटन कसे सुरू करावे?', icon: '🚀' },
  ],
  punjabi: [
    { text: 'ਮੇਰੀ ਕਮਾਈ ਕਿੰਨੀ ਹੋ ਸਕਦੀ ਹੈ?', icon: '💰' },
    { text: 'ਨੇੜੇ ਮੰਡੀ ਕਿੱਥੇ ਹੈ?', icon: '🏪' },
    { text: 'ਕਿਹੜੀਆਂ ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ ਹਨ?', icon: '🏛️' },
    { text: 'ਖੇਤੀ ਸੈਰ-ਸਪਾਟਾ ਕਿਵੇਂ ਸ਼ੁਰੂ ਕਰਾਂ?', icon: '🚀' },
  ],
  gujarati: [
    { text: 'મારી આવક કેટલી થઈ શકે?', icon: '💰' },
    { text: 'નજીકની બજાર ક્યાં છે?', icon: '🏪' },
    { text: 'કઈ સરકારી યોજનાઓ છે?', icon: '🏛️' },
    { text: 'કૃષિ પ્રવાસન કેવી રીતે શરૂ કરું?', icon: '🚀' },
  ],
};

/* Prompt hints per language */
const HINTS = {
  hindi:    'अपना सवाल बोलें या टाइप करें…',
  english:  'Ask me anything about your farm…',
  marathi:  'तुमचा प्रश्न बोला किंवा टाइप करा…',
  punjabi:  'ਆਪਣਾ ਸਵਾਲ ਬੋਲੋ ਜਾਂ ਟਾਈਪ ਕਰੋ…',
  gujarati: 'તમારો પ્રશ્ન બોલો અથવા ટાઈપ કરો…',
};

/* ─── Message helpers ──────────────────────────────────────────────────────── */
let _msgId = 0;
const mkMsg = (role, text, extra = {}) => ({
  id: ++_msgId, role, text, ts: Date.now(), ...extra,
});

/* ─── Waveform bars (pure CSS animation, no canvas) ──────────────────────── */
function WaveformBars({ active, bars = 9 }) {
  return (
    <div className={`va__waveform${active ? ' va__waveform--active' : ''}`} aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className="va__waveform-bar"
          style={{ animationDelay: `${(i * 0.09).toFixed(2)}s` }}
        />
      ))}
    </div>
  );
}

/* ─── Pulsing mic ring ─────────────────────────────────────────────────────── */
function PulseMic({ listening, onClick }) {
  return (
    <button
      className={`va__mic${listening ? ' va__mic--listening' : ''}`}
      onClick={onClick}
      aria-label={listening ? 'Stop listening' : 'Start listening'}
    >
      <span className="va__mic-ring va__mic-ring--1" />
      <span className="va__mic-ring va__mic-ring--2" />
      <span className="va__mic-inner">
        <IconMicrophone size={28} strokeWidth={1.8} />
      </span>
    </button>
  );
}

/* ─── Single chat bubble ───────────────────────────────────────────────────── */
function ChatBubble({ msg, onRetry }) {
  const isAi = msg.role === 'ai';
  return (
    <div className={`va__bubble va__bubble--${msg.role}${msg.streaming ? ' va__bubble--streaming' : ''}`}>
      {isAi && (
        <div className="va__bubble-avatar">
          <IconSparkles size={14} strokeWidth={2} />
        </div>
      )}
      <div className="va__bubble-body">
        <div className={`va__bubble-text${msg.streaming ? ' va__bubble-text--streaming' : ''}`}>
          {renderMarkdown(msg.text || '')}
        </div>
        {msg.streaming && (
          <span className="va__bubble-cursor" aria-hidden>▌</span>
        )}
        {msg.error && (
          <button className="va__bubble-retry" onClick={onRetry}>
            <IconRefresh size={12} strokeWidth={2} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────────── */
export default function VoiceAssistantPage({ onBack, language: initLang, onRegisterMicCallback, onListeningChange }) {
  const { authHeader, profile } = useAuth();
  const { language: globalLang, setLanguage: setGlobalLang, t } = useLanguage();

  /* language toggle — sync with global context */
  const [lang, setLang] = useState(initLang || globalLang);

  /* chat history */
  const [msgs, setMsgs] = useState([]);

  /* current transcribed query */
  const [query,  setQuery]    = useState('');
  const [typing, setTyping]   = useState('');

  /* UI state */
  const [phase, setPhase]     = useState('idle');  // idle | listening | thinking | speaking
  const [ttsOn, setTtsOn]     = useState(true);
  const [showLangMenu, setShowLangMenu] = useState(false);

  /* geolocation — obtained once on mount for location-aware answers */
  const [geoLocation, setGeoLocation] = useState(null);

  /* refs */
  const messagesEndRef  = useRef(null);
  const audioRef        = useRef(null);
  const containerRef    = useRef(null);
  const prevListeningRef = useRef(false);
  const sendQueryRef     = useRef(null);  // always holds latest sendQuery

  /* Voice hook (browser Web Speech API) */
  const {
    isListening, transcript, interimTranscript,
    isSupported, startListening, stopListening, resetTranscript,
  } = useVoiceInput(lang);

  /* ── Auto-scroll ───────────────────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, transcript, interimTranscript]);

  /* ── Sync voice → query display ─────────────────────────────────────────── */
  useEffect(() => {
    if (transcript) setQuery(transcript);
  }, [transcript]);

  /* ── Welcome message on mount ────────────────────────────────────────────── */
  useEffect(() => {
    const name = profile?.given_name || '';
    const welcome = {
      hindi:    `नमस्ते${name ? ` ${name} जी` : ''}! मैं आपका AI कृषि-सहायक हूँ। आपके खेत के बारे में कुछ भी पूछें — आय, योजनाएँ, मंडी, सरकारी सहायता — मैं आपकी मदद के लिए हूँ।`,
      english:  `Namaste${name ? ` ${name}` : ''}! I'm your AI farming assistant. Ask me anything — income potential, govt schemes, nearby markets, or how to start agritourism.`,
      marathi:  `नमस्कार${name ? ` ${name}` : ''}! मी तुमचा AI शेती-सहायक आहे. तुमच्या शेताबद्दल काहीही विचारा — उत्पन्न, योजना, बाजारपेठ, सरकारी मदत.`,
      punjabi:  `ਸਤ ਸ੍ਰੀ ਅਕਾਲ${name ? ` ${name} ਜੀ` : ''}! ਮੈਂ ਤੁਹਾਡਾ AI ਖੇਤੀ-ਸਹਾਇਕ ਹਾਂ। ਆਪਣੇ ਖੇਤ ਬਾਰੇ ਕੁਝ ਵੀ ਪੁੱਛੋ।`,
      gujarati: `નમસ્તે${name ? ` ${name}` : ''}! હું તમારો AI ખેતી-સહાયક છું. તમારા ખેતર વિશે કંઈ પણ પૂછો.`,
    };
    setMsgs([mkMsg('ai', welcome[lang] || welcome.hindi)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Auto-send when voice recognition stops with pending text ───────────── */
  useEffect(() => {
    const wasListening = prevListeningRef.current;
    prevListeningRef.current = isListening;
    // Fired when listening transitions false→true→false (user stopped speaking)
    if (wasListening && !isListening) {
      const pendingText = (transcript || '').trim();
      if (pendingText) {
        // Small delay to let final transcript settle
        const t = setTimeout(() => sendQueryRef.current?.(pendingText), 300);
        return () => clearTimeout(t);
      }
    }
  }, [isListening, transcript]);

  /* ── Silently request geolocation once on mount ─────────────────────────── */
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocation({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          address:   profile?.address || '',
        });
      },
      () => {
        // Permission denied or error — fall back to profile address only
        if (profile?.address) {
          setGeoLocation({ address: profile.address });
        }
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Speak AI reply via Polly TTS ──────────────────────────────────────── */
  const playTTS = useCallback(async (text) => {
    if (!ttsOn || !text) return;
    try {
      const API = process.env.REACT_APP_API_URL || '/api';
      const cleanText = stripForTTS(text);
      if (!cleanText) return;
      const res = await fetch(`${API}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ text: cleanText.slice(0, 600), language: lang }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.audio_url) {
        audioRef.current?.pause();
        audioRef.current = new Audio(data.audio_url);
        audioRef.current.onended = () => setPhase('idle');
        audioRef.current.play().catch(() => {});
        setPhase('speaking');
      }
    } catch { /* TTS optional — silently skip */ }
  }, [ttsOn, lang, authHeader]);

  /* ── Core: send a query to the AI assistant ─────────────────────────────── */
  const sendQuery = useCallback(async (rawText) => {
    const text = rawText.trim();
    if (!text || phase === 'thinking') return;

    // Add user bubble
    setMsgs(prev => [...prev, mkMsg('user', text)]);
    setQuery('');
    setTyping('');
    resetTranscript();

    setPhase('thinking');

    // Create streaming AI bubble
    const aiMsgId = ++_msgId;
    const aiMsg = { id: aiMsgId, role: 'ai', text: '', streaming: true };
    setMsgs(prev => [...prev, aiMsg]);

    let fullText = '';

    // Build conversation history from previous messages (for context continuity)
    const history = msgs
      .filter(m => m.role === 'user' || m.role === 'ai')
      .map(m => ({ role: m.role, text: m.text }));

    await assistantChat(
      text,
      lang,
      history,
      /* onDelta */ (delta) => {
        fullText += delta;
        setMsgs(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, text: fullText, streaming: true } : m
        ));
      },
      /* onComplete */ () => {},
      /* onError */ (err) => {
        setMsgs(prev => prev.map(m =>
          m.id === aiMsgId
            ? { ...m, text: err?.message || 'कुछ गड़बड़ हो गई। कृपया दोबारा पूछें।', streaming: false, error: true }
            : m
        ));
        setPhase('idle');
      },
      authHeader(),
      geoLocation,
    );

    /* Finalise bubble */
    setMsgs(prev => prev.map(m =>
      m.id === aiMsgId ? { ...m, text: fullText || 'No response.', streaming: false } : m
    ));

    setPhase('idle');

    /* Speak the reply */
    playTTS(fullText);
  }, [phase, lang, msgs, authHeader, playTTS, resetTranscript, geoLocation]);

  /* Keep ref always pointing at latest sendQuery */
  useEffect(() => {
    sendQueryRef.current = sendQuery;
  }, [sendQuery]);

  /* ── Mic toggle ────────────────────────────────────────────────────────── */
  const handleMicToggle = useCallback(() => {
    if (!isSupported) {
      alert('Voice input not supported in this browser. Please use Chrome.');
      return;
    }
    if (isListening) {
      stopListening();
      setPhase('idle');
    } else {
      resetTranscript();
      setQuery('');
      startListening();
      setPhase('listening');
    }
  }, [isListening, isSupported, startListening, stopListening, resetTranscript]);

  /* ── Register mic-toggle with parent (BottomNav hero bridge) ────────────── */
  useEffect(() => {
    onRegisterMicCallback?.(handleMicToggle);
  }, [handleMicToggle, onRegisterMicCallback]);

  /* ── Sync listening → phase ────────────────────────────────────────────── */
  useEffect(() => {
    if (!isListening && phase === 'listening') setPhase('idle');
  }, [isListening, phase]);

  /* ── Notify parent of listening state (for BottomNav hero highlight) ─────── */
  useEffect(() => {
    onListeningChange?.(isListening);
  }, [isListening, onListeningChange]);

  /* ── Handle send ────────────────────────────────────────────────────────── */
  const handleSend = useCallback(() => {
    const text = (query || typing).trim();
    if (!text) return;
    if (isListening) stopListening();
    sendQuery(text);
  }, [query, typing, isListening, stopListening, sendQuery]);

  /* ── Cancel ─────────────────────────────────────────────────────────────── */
  const handleCancel = () => {
    if (isListening) stopListening();
    setQuery('');
    setTyping('');
    resetTranscript();
    setPhase('idle');
    audioRef.current?.pause();
  };

  /* ── Quick-ask chip tap ────────────────────────────────────────────────── */
  const handleQuickAsk = (text) => {
    sendQuery(text);
  };

  /* ── Language change ────────────────────────────────────────────────────── */
  const handleLangChange = (l) => {
    setLang(l);
    setGlobalLang(l);
    setShowLangMenu(false);
    if (isListening) stopListening();
  };

  /* ── Active display text ────────────────────────────────────────────────── */
  const displayText = query || (interimTranscript ? interimTranscript : '');
  const hasInput    = displayText.trim().length > 0 || typing.trim().length > 0;
  const showQuickAsks = msgs.length <= 1 && phase === 'idle';

  /* ─── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="va" ref={containerRef}>
      {/* hidden audio element */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* ── Compact Header ── */}
      <header className="va__header">
        <button className="va__header-btn" onClick={onBack} aria-label="Back">
          <IconArrowLeft size={18} strokeWidth={2} />
        </button>

        <div className="va__header-center">
          <img src={logoPrimary} alt="Chalo Kisaan" className="va__header-logo" />
          <div>
            <div className="va__header-title">{t('assistant_title')}</div>
            <div className="va__header-sub">
              <IconLeaf size={10} strokeWidth={2} /> {t('home_action_ai_sub')}
            </div>
          </div>
        </div>

        <div className="va__header-actions">
          <button
            className="va__header-btn"
            onClick={() => setTtsOn(p => !p)}
            aria-label={ttsOn ? 'Mute voice' : 'Unmute voice'}
            title={ttsOn ? 'Mute AI voice' : 'Unmute AI voice'}
          >
            {ttsOn
              ? <IconVolume size={18} strokeWidth={1.8} />
              : <IconVolumeOff size={18} strokeWidth={1.8} />}
          </button>
          <div className="va__lang-wrap">
            <button
              className="va__lang-trigger"
              onClick={() => setShowLangMenu(p => !p)}
              aria-label="Change language"
            >
              <span className="va__lang-flag">{LANG_OPTIONS.find(l => l.key === lang)?.flag ?? '🇮🇳'}</span>
              {LANG_OPTIONS.find(l => l.key === lang)?.label ?? 'हिंदी'}
            </button>
            {showLangMenu && (
              <>
                <div className="va__lang-backdrop" onClick={() => setShowLangMenu(false)} />
                <ul className="va__lang-menu">
                  {LANG_OPTIONS.map(l => (
                    <li key={l.key}>
                      <button
                        className={`va__lang-opt${l.key === lang ? ' va__lang-opt--active' : ''}`}
                        onClick={() => handleLangChange(l.key)}
                      >
                        <span className="va__lang-flag">{l.flag}</span>
                        <span className="va__lang-opt-labels">
                          <span className="va__lang-opt-native">{l.label}</span>
                          <span className="va__lang-opt-eng">{l.native}</span>
                        </span>
                        {l.key === lang && <IconCheck size={13} strokeWidth={3} />}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Context banner (shows when user has farm data) ── */}
      {profile?.given_name && (
        <div className="va__context-banner">
          <IconInfoCircle size={12} strokeWidth={2} />
          <span>
            {lang === 'english'
              ? `I have your farm details${geoLocation ? ' & location' : ''}. Ask me anything specific!`
              : lang === 'marathi'
              ? `तुमच्या शेताची माहिती माझ्याकडे आहे${geoLocation ? ' व स्थान' : ''}. काहीही विचारा!`
              : lang === 'punjabi'
              ? `ਤੁਹਾਡੇ ਖੇਤ ਦੀ ਜਾਣਕਾਰੀ ਮੇਰੇ ਕੋਲ ਹੈ${geoLocation ? ' ਅਤੇ ਸਥਾਨ' : ''}। ਕੁਝ ਵੀ ਪੁੱਛੋ!`
              : lang === 'gujarati'
              ? `તમારા ખેતની વિગત${geoLocation ? ' અને સ્થાન' : ''} મારી પાસે છે. કંઈ પણ પૂછો!`
              : `आपके खेत की जानकारी${geoLocation ? ' व स्थान' : ''} मेरे पास है। कुछ भी पूछें!`}
          </span>
          {geoLocation && (
            <span className="va__context-loc">
              <IconMapPin size={10} strokeWidth={2} />
              {geoLocation.address || 'Located'}
            </span>
          )}
        </div>
      )}

      {/* ── Status pill ── */}
      {phase !== 'idle' && (
        <div className="va__status-row">
          <div className={`va__status-pill va__status-pill--${phase}`}>
            {phase === 'listening' && <><span className="va__status-dot va__status-dot--blink" /> {t('assistant_listening').toUpperCase()}</>}
            {phase === 'thinking'  && <><IconLoader2 size={12} strokeWidth={2} className="spin" /> {t('assistant_thinking')}</>}
            {phase === 'speaking'  && <><span className="va__status-dot va__status-dot--speaking" /> {lang === 'english' ? 'Speaking…' : lang === 'marathi' ? 'बोलत आहे…' : lang === 'punjabi' ? 'ਬੋਲ ਰਿਹਾ ਹਾਂ…' : lang === 'gujarati' ? 'બોલી રહ્યો છું…' : 'बोल रहा हूँ…'}</>}
          </div>
        </div>
      )}

      {/* ── Quick-ask chips (show only at start) ── */}
      {showQuickAsks && (
        <div className="va__quick-asks">
          {(QUICK_ASKS[lang] || QUICK_ASKS.hindi).map((q, i) => (
            <button
              key={i}
              className="va__quick-chip"
              onClick={() => handleQuickAsk(q.text)}
            >
              <span className="va__quick-chip-icon">{q.icon}</span>
              <span className="va__quick-chip-text">{q.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Chat history (takes all remaining space) ── */}
      <div className="va__messages">
        {msgs.map((msg) => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            onRetry={() => {
              const prevUser = [...msgs].reverse().find(m => m.role === 'user');
              if (prevUser) sendQuery(prevUser.text);
            }}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Bottom controls ── */}
      <div className="va__controls">
        {/* Waveform — shown when listening */}
        {isListening && <WaveformBars active={isListening} />}

        {/* Text input with inline buttons */}
        <div className="va__text-row">
          <div className="va__text-container">
            <input
              className="va__text-input"
              placeholder={HINTS[lang] || HINTS.hindi}
              value={typing || displayText}
              onChange={e => { setTyping(e.target.value); setQuery(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
              aria-label="Message input"
            />
            <div className="va__text-actions">
              <button
                className="va__text-btn va__cancel-inline"
                onClick={handleCancel}
                aria-label="Cancel"
                title="Cancel"
              >
                <IconX size={18} strokeWidth={2} />
              </button>
              <button
                className={`va__text-btn va__send-inline${hasInput ? ' va__send-inline--active' : ''}`}
                onClick={handleSend}
                disabled={!hasInput || phase === 'thinking'}
                aria-label="Send"
                title="Send"
              >
                {phase === 'thinking'
                  ? <IconLoader2 size={18} strokeWidth={2} className="spin" />
                  : <IconSend size={18} strokeWidth={2} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mic button row */}
        <div className="va__mic-row">
          {/* Hero mic — same style as BottomNav hero tab */}
          <PulseMic listening={isListening} onClick={handleMicToggle} />
        </div>
      </div>
    </div>
  );
}
