import React, { useState } from 'react';
import {
  IconMicrophone, IconMicrophoneOff, IconPlayerStop,
  IconCheck, IconAlertCircle, IconLoader2, IconX,
} from '@tabler/icons-react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { parseVoiceTranscript } from '../utils/api';
import './VoiceInput.css';

const LANGUAGES = [
  { key: 'hindi', label: 'हिंदी', english: 'Hindi' },
  { key: 'marathi', label: 'मराठी', english: 'Marathi' },
  { key: 'english', label: 'English', english: 'English' },
  { key: 'punjabi', label: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  { key: 'gujarati', label: 'ગુજરાતી', english: 'Gujarati' },
];

const EXAMPLE_PHRASES = {
  hindi: 'मेरे पास 5 एकड़ जमीन है, पुणे के पास, बजट 2 लाख है',
  marathi: 'माझ्याकडे 3 एकर जमीन आहे, नाशिकजवळ, द्राक्षे आहेत',
  english: 'I have 10 acres near Kolhapur with mango orchards, budget 3 lakhs',
};

export default function VoiceInput({ onFormDataParsed, onClose }) {
  const [selectedLang, setSelectedLang] = useState('hindi');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState(null);

  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput(selectedLang);

  const handleSubmitTranscript = async () => {
    const text = transcript.trim();
    if (!text) return;

    setIsParsing(true);
    setParseError(null);
    try {
      const result = await parseVoiceTranscript(text);
      if (result.success && result.formData) {
        onFormDataParsed(result.formData);
      }
    } catch (err) {
      setParseError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  if (!isSupported) {
    return (
      <div className="voice__unsupported">
        <IconMicrophoneOff size={28} stroke={1.5} />
        <p>Voice input is not supported in your browser.</p>
        <p>Please use Chrome or Edge for voice features.</p>
        <button className="voice__close-btn" onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div className="voice">
      <div className="voice__header">
        <h3 className="voice__title">
          <IconMicrophone size={18} stroke={1.8} /> Voice Input
          <span className="voice__title-devanagari">आवाज़ से भरें</span>
        </h3>
        <button className="voice__close-btn" onClick={onClose}>
          <IconX size={16} stroke={2} />
        </button>
      </div>

      {/* Language selector */}
      <div className="voice__lang-selector">
        <p className="voice__lang-label">Choose your language / अपनी भाषा चुनें</p>
        <div className="voice__lang-pills">
          {LANGUAGES.map(lang => (
            <button
              key={lang.key}
              className={`voice__lang-pill ${selectedLang === lang.key ? 'voice__lang-pill--active' : ''}`}
              onClick={() => setSelectedLang(lang.key)}
              disabled={isListening}
            >
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Example phrase */}
      {EXAMPLE_PHRASES[selectedLang] && (
        <div className="voice__example">
          <span className="voice__example-label">Example / उदाहरण:</span>
          <span className="voice__example-text">"{EXAMPLE_PHRASES[selectedLang]}"</span>
        </div>
      )}

      {/* Mic button */}
      <div className="voice__mic-area">
        <button
          className={`voice__mic-btn ${isListening ? 'voice__mic-btn--recording' : ''}`}
          onClick={toggleListening}
        >
          <span className="voice__mic-icon">
            {isListening
              ? <IconPlayerStop size={26} stroke={2} />
              : <IconMicrophone size={26} stroke={1.8} />}
          </span>
          <span className="voice__mic-label">
            {isListening ? 'Stop Recording' : 'Start Recording'}
          </span>
          {isListening && <span className="voice__mic-sub">बोलते रहें...</span>}
        </button>

        {isListening && (
          <div className="voice__waves">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="voice__wave-bar"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transcript display */}
      {(transcript || interimTranscript) && (
        <div className="voice__transcript">
          <div className="voice__transcript-label">Transcript / आपकी बात:</div>
          <div className="voice__transcript-text">
            <span>{transcript}</span>
            {interimTranscript && (
              <span className="voice__interim">{interimTranscript}</span>
            )}
          </div>
          <button className="voice__clear-btn" onClick={resetTranscript}>
            Clear
          </button>
        </div>
      )}

      {/* Error */}
      {(error || parseError) && (
        <div className="voice__error">
          <IconAlertCircle size={14} stroke={2} />
          {error === 'not-allowed'
            ? 'Microphone permission denied. Please allow microphone access.'
            : error === 'network'
            ? 'Speech service unreachable. Retrying… (check internet connection)'
            : error || parseError}
        </div>
      )}

      {/* Submit */}
      {transcript && !isListening && (
        <button className="voice__submit-btn" onClick={handleSubmitTranscript} disabled={isParsing}>
          {isParsing ? (
            <><IconLoader2 size={15} stroke={2} className="spin" /> Parsing your details...</>
          ) : (
            <><IconCheck size={15} stroke={2} /> Fill Form with This
              <span className="voice__submit-devanagari">फॉर्म भरें</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
