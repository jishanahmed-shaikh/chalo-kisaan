import React, { useState, useRef } from 'react';
import {
  IconArrowLeft, IconArrowRight, IconPlant2, IconMicrophone,
  IconCamera, IconSearch, IconRuler, IconMapPin, IconDroplets,
  IconBuildingWarehouse, IconCurrencyRupee, IconSeeding,
  IconCheck, IconLoader2, IconRobot, IconAlertCircle,
  IconLanguage,
} from "@tabler/icons-react";
import logoPrimary from '../assets/logo-primary.png';
import VoiceInput from "../components/VoiceInput";
import FieldMic from "../components/FieldMic";
import Narrator from "../components/Narrator";
import { useNarrator } from "../hooks/useNarrator";
import { generatePlanStream, analyzeImage } from "../utils/api";
import "./PlannerPage.css";

const SOIL_TYPES    = ["Red Soil","Black Cotton Soil","Alluvial Soil","Laterite Soil","Sandy Soil","Clay Soil"];
const WATER_SOURCES = ["River / Stream","Borewell","Open Well","Canal Irrigation","Rainwater Only","Lake / Pond"];
const INFRA_OPTIONS = ["Tea Bungalow","Old House / Barn","Tool Shed","Storage Room","Electricity","Road Access","None"];
const BIODIVERSITY  = ["Mango Orchard","Sugarcane","Paddy / Rice","Wheat","Grapes / Vineyard","Vegetable Farm","Coconut Grove","Mixed Crops","Barren Land"];
const LANGUAGES     = [{ key:"english", label:"EN" },{ key:"hindi", label:"हि" },{ key:"marathi", label:"म" }];
const STEPS         = ["Farm Basics", "Resources & Budget", "Review & Generate"];

export default function PlannerPage({ onBack, onComplete, onLanguageChange }) {
  const [form, setForm] = useState({
    landSize:"", location:"", soilType:"", waterSource:"",
    existingInfrastructure:"", budget:"", biodiversity:"", language:"hindi",
  });
  const [showVoice,      setShowVoice]      = useState(false);
  const [imagePreview,   setImagePreview]   = useState(null);
  const [imageAnalysis,  setImageAnalysis]  = useState(null);
  const [isAnalyzingImg, setIsAnalyzingImg] = useState(false);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [streamText,     setStreamText]     = useState("");
  const [error,          setError]          = useState(null);
  const [step,           setStep]           = useState(1);
  const fileRef = useRef(null);

  const narratorKey = `planner_step${step}`;
  const { isSpeaking, isSupported, narratePage, stop } = useNarrator(form.language);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const togglePill = (key, val) => set(key, form[key] === val ? "" : val);

  const handleVoiceData = (data) => {
    if (!data) return;
    setForm(p => ({
      ...p,
      landSize:              data.landSize?.toString()   || p.landSize,
      location:              data.location               || p.location,
      soilType:              data.soilType               || p.soilType,
      waterSource:           data.waterSource            || p.waterSource,
      existingInfrastructure:data.existingInfrastructure || p.existingInfrastructure,
      budget:                data.budget?.toString()     || p.budget,
      biodiversity:          data.biodiversity           || p.biodiversity,
      language:              data.detectedLanguage       || p.language,
    }));
    setShowVoice(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setIsAnalyzingImg(true);
    try {
      const res = await analyzeImage(file);
      if (res.success) setImageAnalysis(res.analysis);
    } catch {}
    setIsAnalyzingImg(false);
  };

  const handleGenerate = async () => {
    if (!form.landSize || !form.location || !form.budget) {
      setError("Please fill in Land Size, Location, and Budget to continue.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    setStreamText("");
    let result = null;
    await generatePlanStream(
      form,
      (d) => setStreamText(p => p + d),
      (d) => { result = d; },
      (e) => { setError(e.message); setIsGenerating(false); }
    );
    setIsGenerating(false);
    if (result) {
      onComplete(result, form, imagePreview);
    } else if (streamText) {
      try {
        const m = streamText.match(/\{[\s\S]*\}/);
        if (m) onComplete(JSON.parse(m[0]), form, imagePreview);
      } catch {}
    }
  };

  const REVIEW_ROWS = [
    { Icon: IconRuler,            k: "Land Size",      v: form.landSize ? `${form.landSize} acres` : "—" },
    { Icon: IconMapPin,           k: "Location",       v: form.location || "—" },
    { Icon: IconSeeding,          k: "Soil Type",      v: form.soilType || "Not specified" },
    { Icon: IconPlant2,           k: "Crops",          v: form.biodiversity || "Not specified" },
    { Icon: IconDroplets,         k: "Water Source",   v: form.waterSource || "Not specified" },
    { Icon: IconBuildingWarehouse,k: "Infrastructure", v: form.existingInfrastructure || "None" },
    { Icon: IconCurrencyRupee,    k: "Budget",         v: form.budget ? `\u20b9${Number(form.budget).toLocaleString("en-IN")}` : "—" },
    { Icon: IconLanguage,         k: "Language",       v: form.language.charAt(0).toUpperCase() + form.language.slice(1) },
  ];

  return (
    <div className="planner">
      <Narrator
        isSpeaking={isSpeaking}
        isSupported={isSupported}
        onSpeak={() => narratePage(narratorKey)}
        onStop={stop}
      />

      {/* Header */}
      <header className="planner__header">
        <button className="planner__back-btn" onClick={onBack}>
          <IconArrowLeft size={16} stroke={2} /> Back
        </button>
        <div className="planner__header-title">
          <img src={logoPrimary} alt="Chalo Kisaan" className="planner__header-logo" />
          Plan Your Farm
          <span className="text-devanagari">अपना खेत बताएं</span>
        </div>
        <div className="planner__lang-switch">
          {LANGUAGES.map(l => (
            <button key={l.key}
              className={`planner__lang-btn ${form.language === l.key ? "active" : ""}`}
              onClick={() => { set("language", l.key); onLanguageChange?.(l.key); }}>{l.label}</button>
          ))}
        </div>
      </header>

      {/* Progress */}
      <div className="planner__progress">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const cls = step === n ? "active" : step > n ? "done" : "";
          return (
            <React.Fragment key={n}>
              {i > 0 && <span className="planner__step-sep">›</span>}
              <div className={`planner__step ${cls}`}>
                <div className="planner__step-num">
                  {step > n ? <IconCheck size={12} stroke={3} /> : n}
                </div>
                <span className="planner__step-label">{label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="planner__body">

        {/* Voice trigger */}
        <button className="planner__voice-trigger" onClick={() => setShowVoice(true)}>
          <span className="planner__voice-icon"><IconMicrophone size={20} stroke={1.8} /></span>
          <div className="planner__voice-texts">
            <span className="planner__voice-label">Fill with Voice Input</span>
            <span className="planner__voice-sub">
              Speak in Hindi, Marathi or English — we will extract all details automatically
            </span>
          </div>
        </button>

        {/* Voice modal */}
        {showVoice && (
          <div className="planner__voice-modal">
            <div className="planner__voice-overlay" onClick={() => setShowVoice(false)} />
            <div className="planner__voice-container">
              <VoiceInput onFormDataParsed={handleVoiceData} onClose={() => setShowVoice(false)} />
            </div>
          </div>
        )}

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="anim-fade-up">
            <h2 className="planner__section-title">About Your Land</h2>
            <p className="planner__section-sub">Upload a photo of your farm and tell us the basics.</p>

            {/* Image upload */}
            <div className="planner__field">
              <label className="planner__label">Farm Photo (optional)</label>
              <div className="planner__image-upload" onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display:"none" }} />
                {imagePreview ? (
                  <div className="planner__image-preview">
                    <img src={imagePreview} alt="Farm" />
                    <div className="planner__image-overlay">
                      <IconCamera size={14} stroke={2} /> Change Photo
                    </div>
                    {isAnalyzingImg && (
                      <div className="planner__analyzing-bar">
                        <IconLoader2 size={14} stroke={2} className="spin" />
                        Analysing with AI...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="planner__image-placeholder">
                    <span className="planner__image-icon"><IconCamera size={28} stroke={1.5} /></span>
                    <span className="planner__image-label">Tap to Upload Farm Photo</span>
                    <span className="planner__image-sublabel">AI will analyse your land agritourism potential</span>
                  </div>
                )}
              </div>

              {imageAnalysis && (
                <div className="planner__analysis">
                  <div className="planner__analysis-header">
                    <IconSearch size={14} stroke={2} /> AI Land Analysis
                    <span className={`planner__potential planner__potential--${imageAnalysis.agritourismPotential}`}>
                      {imageAnalysis.agritourismPotential} potential
                    </span>
                  </div>
                  <p className="planner__analysis-text">{imageAnalysis.visualObservations}</p>
                  <div className="planner__analysis-tags">
                    {imageAnalysis.potentialServices?.map((s, i) => (
                      <span key={i} className="planner__analysis-tag">
                        <IconCheck size={11} stroke={3} /> {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Land size */}
            <div className="planner__field">
              <label className="planner__label">
                Land Size (acres)
                <span className="planner__label-devanagari">· जमीन का आकार</span>
                <span className="planner__required"> *</span>
              </label>
              <div className="planner__input-row">
                <input className="planner__input" type="number" placeholder="e.g. 5"
                  value={form.landSize} onChange={e => set("landSize", e.target.value)} min="0.5" step="0.5" />
                <FieldMic language={form.language} onResult={t => set("landSize", t.replace(/[^\d.]/g, ""))} />
              </div>
            </div>

            {/* Location */}
            <div className="planner__field">
              <label className="planner__label">
                Location
                <span className="planner__label-devanagari">· जगह</span>
                <span className="planner__required"> *</span>
              </label>
              <div className="planner__input-row">
                <input className="planner__input" type="text" placeholder="e.g. Near Nashik, Maharashtra"
                  value={form.location} onChange={e => set("location", e.target.value)} />
                <FieldMic language={form.language} onResult={t => set("location", t.trim())} />
              </div>
            </div>

            {/* Soil type */}
            <div className="planner__field">
              <label className="planner__label">Soil Type <span className="planner__label-devanagari">· मिट्टी का प्रकार</span></label>
              <div className="planner__pill-group">
                {SOIL_TYPES.map(s => (
                  <button key={s} className={`pill ${form.soilType === s ? "active" : ""}`}
                    onClick={() => togglePill("soilType", s)}>{s}</button>
                ))}
              </div>
            </div>

            <div className="planner__btn-row">
              <button className="btn-secondary planner__back-step-btn" onClick={onBack}>
                <IconArrowLeft size={15} stroke={2} /> Cancel
              </button>
              <button className="btn-primary planner__next-btn"
                onClick={() => setStep(2)} disabled={!form.landSize || !form.location}>
                Continue <IconArrowRight size={15} stroke={2} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="anim-fade-up">
            <h2 className="planner__section-title">Resources &amp; Budget</h2>
            <p className="planner__section-sub">Help us understand what you already have on your land.</p>

            <div className="planner__field">
              <label className="planner__label">Current Crops / Land Type <span className="planner__label-devanagari">· फसल का प्रकार</span></label>
              <div className="planner__pill-group">
                {BIODIVERSITY.map(b => (
                  <button key={b} className={`pill ${form.biodiversity === b ? "active" : ""}`}
                    onClick={() => togglePill("biodiversity", b)}>{b}</button>
                ))}
              </div>
            </div>

            <div className="planner__field">
              <label className="planner__label">Water Source <span className="planner__label-devanagari">· पानी का स्रोत</span></label>
              <div className="planner__pill-group">
                {WATER_SOURCES.map(w => (
                  <button key={w} className={`pill ${form.waterSource === w ? "active" : ""}`}
                    onClick={() => togglePill("waterSource", w)}>{w}</button>
                ))}
              </div>
            </div>

            <div className="planner__field">
              <label className="planner__label">Existing Infrastructure <span className="planner__label-devanagari">· मौजूदा ढांचा</span></label>
              <div className="planner__pill-group">
                {INFRA_OPTIONS.map(inf => (
                  <button key={inf} className={`pill ${form.existingInfrastructure === inf ? "active" : ""}`}
                    onClick={() => togglePill("existingInfrastructure", inf)}>{inf}</button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div className="planner__field">
              <label className="planner__label">
                Available Budget (₹)
                <span className="planner__label-devanagari">· बजट</span>
                <span className="planner__required"> *</span>
              </label>
              <div className="planner__input-row">
                <input className="planner__input" type="number"
                  placeholder="e.g. 200000  (₹2 Lakh)"
                  value={form.budget} onChange={e => set("budget", e.target.value)} min="10000" />
                <FieldMic language={form.language} onResult={t => set("budget", t.replace(/[^\d]/g, ""))} />
              </div>
              {form.budget && (
                <span className="planner__budget-hint">
                  ₹{Number(form.budget).toLocaleString("en-IN")}
                </span>
              )}
            </div>

            <div className="planner__btn-row">
              <button className="btn-secondary planner__back-step-btn" onClick={() => setStep(1)}>
                <IconArrowLeft size={15} stroke={2} /> Back
              </button>
              <button className="btn-primary planner__next-btn"
                onClick={() => setStep(3)} disabled={!form.budget}>
                Review <IconArrowRight size={15} stroke={2} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div className="anim-fade-up">
            <h2 className="planner__section-title">Review &amp; Generate</h2>
            <p className="planner__section-sub">Confirm your details before we generate your personalised plan.</p>

            <div className="planner__review-grid">
              {REVIEW_ROWS.map(({ Icon, k, v }) => (
                <div key={k} className="planner__review-item">
                  <span className="planner__review-icon"><Icon size={16} stroke={1.8} /></span>
                  <div>
                    <div className="planner__review-key">{k}</div>
                    <div className="planner__review-val">{v}</div>
                  </div>
                </div>
              ))}
            </div>

            {imagePreview && (
              <div className="planner__review-image">
                <img src={imagePreview} alt="Your farm" />
              </div>
            )}

            {error && (
              <div className="planner__error">
                <IconAlertCircle size={15} stroke={2} /> {error}
              </div>
            )}

            {isGenerating && (
              <div className="planner__generating">
                <div className="planner__gen-header">
                  <div className="planner__gen-dots">
                    {[0,1,2].map(i => (
                      <div key={i} className="planner__gen-dot" style={{ animationDelay:`${i*0.15}s` }} />
                    ))}
                  </div>
                  AI is crafting your personalised agritourism plan…
                </div>
                {streamText && (
                  <div className="planner__stream-box">
                    {streamText.slice(-280)}
                    <span className="planner__stream-cursor">▌</span>
                  </div>
                )}
              </div>
            )}

            <div className="planner__btn-row">
              <button className="btn-secondary planner__back-step-btn" onClick={() => setStep(2)}>
                <IconArrowLeft size={15} stroke={2} /> Back
              </button>
              <button className="planner__generate-btn" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <><IconLoader2 size={16} stroke={2} className="spin" /> Generating…</>
                ) : (
                  <>
                    <IconRobot size={16} stroke={1.8} /> Generate My Plan
                    <span className="planner__generate-sub text-devanagari">योजना बनाएं</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
