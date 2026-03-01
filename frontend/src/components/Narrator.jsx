import React from 'react';
import { IconVolume, IconPlayerStop } from '@tabler/icons-react';
import './Narrator.css';

/**
 * Floating narrator button — placed in any page.
 * Props:
 *   isSpeaking  : bool
 *   isSupported : bool
 *   onSpeak     : () => void  — start narrating current page
 *   onStop      : () => void  — stop narration
 */
export default function Narrator({ isSpeaking, isSupported, onSpeak, onStop }) {
  if (!isSupported) return null;

  return (
    <button
      className={`narrator-btn ${isSpeaking ? 'narrator-btn--speaking' : ''}`}
      onClick={isSpeaking ? onStop : onSpeak}
      title={isSpeaking ? 'Stop narration' : 'Read this page aloud'}
      aria-label={isSpeaking ? 'Stop narration' : 'Read this page aloud'}
    >
      {isSpeaking ? (
        <>
          <IconPlayerStop size={18} stroke={2} />
          <span className="narrator-btn__pulse" />
        </>
      ) : (
        <IconVolume size={18} stroke={2} />
      )}
    </button>
  );
}
