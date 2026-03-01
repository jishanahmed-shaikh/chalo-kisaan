import { useState, useCallback, useRef, useEffect } from 'react';

// Maps app language key → BCP-47 for SpeechSynthesis
const LANG_MAP = {
  english: 'en-IN',
  hindi:   'hi-IN',
  marathi: 'mr-IN',
  punjabi: 'pa-IN',
  gujarati:'gu-IN',
};

// Narrator scripts per page × language
export const NARRATOR_SCRIPTS = {
  landing: {
    english: `Welcome to Chalo Kisaan — the AI Agritourism Planner. 
      Transform your farm into a thriving business with a personalised plan in 60 seconds. 
      Tap Begin Planning to get started.`,
    hindi: `चलो किसान में आपका स्वागत है — AI कृषि पर्यटन योजनाकार।
      अपने खेत को एक सफल व्यवसाय में बदलें। 
      योजना शुरू करने के लिए नीचे बटन दबाएं।`,
    marathi: `चलो किसान मध्ये आपले स्वागत आहे — AI कृषी पर्यटन नियोजक.
      तुमच्या शेताचे रूपांतर एका फायदेशीर व्यवसायात करा.
      सुरू करण्यासाठी खाली बटण दाबा.`,
  },
  planner_step1: {
    english: `Step one: Tell us about your land. 
      Enter your farm size in acres, your location, and optionally upload a photo of your farm. 
      You can also tap the microphone button next to each field to speak your answer.`,
    hindi: `पहला कदम: अपनी जमीन के बारे में बताएं।
      अपनी जमीन का आकार, जगह भरें, और चाहें तो खेत की फोटो अपलोड करें।
      हर खाने के पास माइक बटन दबाकर बोलकर भी भर सकते हैं।`,
    marathi: `पहिली पायरी: तुमच्या जमिनीबद्दल सांगा.
      जमिनीचे क्षेत्रफळ, ठिकाण भरा आणि शेताचा फोटो अपलोड करा.
      प्रत्येक फील्डजवळील मायक्रोफोन बटण दाबून बोलूनही भरू शकता.`,
  },
  planner_step2: {
    english: `Step two: Tell us about your resources and budget.
      Select your current crops, water source, existing infrastructure, and your available budget.`,
    hindi: `दूसरा कदम: अपने संसाधन और बजट बताएं।
      मौजूदा फसल, पानी का स्रोत, ढांचा और उपलब्ध बजट चुनें।`,
    marathi: `दुसरी पायरी: तुमचे संसाधने आणि बजट सांगा.
      सध्याची पिके, पाण्याचा स्रोत, पायाभूत सुविधा आणि उपलब्ध बजट निवडा.`,
  },
  planner_step3: {
    english: `Step three: Review your details and generate your personalised agritourism plan. 
      Tap Generate My Plan when you are ready.`,
    hindi: `तीसरा कदम: अपनी जानकारी जांचें और योजना बनाएं।
      तैयार होने पर "योजना बनाएं" बटन दबाएं।`,
    marathi: `तिसरी पायरी: तुमची माहिती तपासा आणि योजना तयार करा.
      तयार असल्यावर "योजना तयार करा" बटण दाबा.`,
  },
  results: {
    english: `Your personalised agritourism plan is ready! 
      Use the tabs below to explore your setup plan, revenue forecast, farm visualisation, and government schemes.`,
    hindi: `आपकी व्यक्तिगत कृषि पर्यटन योजना तैयार है!
      नीचे दिए टैब से अपनी योजना, आमदनी, खेत की तस्वीर और सरकारी योजनाएं देखें।`,
    marathi: `तुमची वैयक्तिक कृषी पर्यटन योजना तयार आहे!
      खाली दिलेल्या टॅबमधून तुमची योजना, उत्पन्न, शेताचे दर्शन आणि सरकारी योजना पाहा.`,
  },
};

export function useNarrator(language = 'english') {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef(null);

  useEffect(() => {
    setIsSupported('speechSynthesis' in window);
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const speak = useCallback((text, langOverride) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const lang = LANG_MAP[langOverride || language] || 'en-IN';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    // Pick best available voice for the language
    const voices = window.speechSynthesis.getVoices();
    const match =
      voices.find(v => v.lang === lang) ||
      voices.find(v => v.lang.startsWith(lang.split('-')[0])) ||
      voices.find(v => v.lang.startsWith('en'));
    if (match) utterance.voice = match;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [language]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const narratePage = useCallback((pageKey) => {
    const scripts = NARRATOR_SCRIPTS[pageKey];
    if (!scripts) return;
    const text = scripts[language] || scripts.english;
    speak(text, language);
  }, [language, speak]);

  return { isSpeaking, isSupported, speak, stop, narratePage };
}
