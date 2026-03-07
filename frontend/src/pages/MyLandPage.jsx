/**
 * MyLandPage — Land information input + AI plan generation + plan display
 * Combines the planner form and plan output into a single "My Land" experience.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  IconArrowLeft, IconCamera,
  IconMapPin, IconRuler, IconDroplets, IconSeeding,
  IconBuildingWarehouse, IconCurrencyRupee, IconPlant2,
  IconCheck, IconLoader2, IconAlertCircle, IconRefresh,
  IconSparkles, IconChecklist, IconTrendingUp, IconShield,
  IconBookmark, IconChevronRight, IconSearch,
} from '@tabler/icons-react';
import { generatePlanStream, analyzeImage, generateVisualization } from '../utils/api';
import { validateImageFile, getValidationSuggestion } from '../utils/imageValidation';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import FieldMic from '../components/FieldMic';
import './MyLandPage.css';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const SOIL_TYPES    = ['Red Soil', 'Black Cotton Soil', 'Alluvial Soil', 'Laterite Soil', 'Sandy Soil', 'Clay Soil'];
const WATER_SOURCES = ['River / Stream', 'Borewell', 'Open Well', 'Canal Irrigation', 'Rainwater Only', 'Lake / Pond'];
const INFRA_OPTIONS = ['Tea Bungalow', 'Old House / Barn', 'Tool Shed', 'Storage Room', 'Electricity', 'Road Access', 'None'];
const BIODIVERSITY  = ['Mango Orchard', 'Sugarcane', 'Paddy / Rice', 'Wheat', 'Grapes / Vineyard', 'Vegetable Farm', 'Coconut Grove', 'Mixed Crops', 'Barren Land'];

const fmt = (n) => {
  if (!n && n !== 0) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

/* ─── Cost Bar ───────────────────────────────────────────────────────────── */
function CostBar({ label, amount, max, color }) {
  const [anim, setAnim] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnim(true), 500); return () => clearTimeout(t); }, []);
  const pct = max ? Math.min((amount / max) * 100, 100) : 0;
  return (
    <div className="myl__cost-bar">
      <div className="myl__cost-bar-head">
        <span className="myl__cost-bar-label">{label}</span>
        <span className="myl__cost-bar-val">{fmt(amount)}</span>
      </div>
      <div className="myl__cost-bar-track">
        <div className="myl__cost-bar-fill" style={{ width: anim ? `${pct}%` : '0%', background: color }} />
      </div>
    </div>
  );
}

/* ─── Income Chart ───────────────────────────────────────────────────────── */
function IncomeChart({ monthly }) {
  const [anim, setAnim] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnim(true), 600); return () => clearTimeout(t); }, []);
  const vals = [0.25, 0.45, 0.72, 0.88, 0.96, 1].map(f => monthly * f);
  const max = monthly * 1.1;
  return (
    <div className="myl__chart">
      {['M1','M2','M3','M4','M5','M6'].map((m, i) => {
        const h = anim ? Math.max(6, (vals[i] / max) * 100) : 6;
        return (
          <div key={m} className="myl__chart-col">
            <div className={`myl__chart-bar${i === 5 ? ' myl__chart-bar--hi' : ''}`}
              style={{ height: `${h}%`, transition: `height 0.7s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.06}s` }} />
            <span className={`myl__chart-lbl${i === 5 ? ' myl__chart-lbl--hi' : ''}`}>{m}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Step Card ──────────────────────────────────────────────────────────── */
function SetupStep({ number, title, desc, duration, active }) {
  return (
    <div className={`myl__step${active ? ' myl__step--active' : ''}`}>
      <div className={`myl__step-num${active ? ' myl__step-num--active' : ''}`}>{number}</div>
      <div className="myl__step-body">
        <div className="myl__step-title">{title}</div>
        {desc && <div className="myl__step-desc">{desc}</div>}
        {duration && <div className="myl__step-duration">⏱ {duration}</div>}
      </div>
    </div>
  );
}

/* ─── Pill selector ──────────────────────────────────────────────────────── */
function Pill({ label, active, onClick }) {
  return (
    <button className={`myl__pill${active ? ' myl__pill--active' : ''}`} onClick={onClick}>
      {active && <IconCheck size={11} strokeWidth={3} />}
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function MyLandPage({ initialPlanData, initialFarmData, initialFarmImage, onPlanReady, onBack }) {
  const { authHeader } = useAuth();
  const { t, language } = useLanguage();

  /* ── Form state ── */
  const EMPTY_FORM = {
    landSize: '', location: '', soilType: '', waterSource: '',
    existingInfrastructure: [], budget: '', biodiversity: '', language: 'hindi',
  };
  const [form, setForm] = useState(() => initialFarmData ? { ...EMPTY_FORM, ...initialFarmData } : EMPTY_FORM);
  const [imagePreview, setImagePreview]   = useState(initialFarmImage || null);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [isAnalyzingImg, setIsAnalyzingImg] = useState(false);

  /* ── View state: 'form' | 'generating' | 'plan' ── */
  const [view, setView]         = useState(initialPlanData ? 'plan' : 'form');
  const [planData, setPlanData] = useState(initialPlanData || null);
  const [streamText, setStreamText] = useState('');
  const [error, setError]           = useState(null);
  const [showAiVision, setShowAiVision] = useState(false);
  const [vizUrl, setVizUrl]             = useState(null);
  const [vizLoading, setVizLoading]     = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [saveStatus, setSaveStatus]     = useState(null); // null | 'saved' | 'error'
  const rawRef      = useRef('');
  const streamBoxRef = useRef(null);
  const fileRef      = useRef(null);

  const loadViz = useCallback(async () => {
    if (vizUrl || vizLoading || !form) return;
    setVizLoading(true);
    try {
      const res = await generateVisualization(form, planData, authHeader());
      if (res?.image_url) setVizUrl(res.image_url);
    } catch {
      // ignore
    } finally {
      setVizLoading(false);
    }
  }, [vizUrl, vizLoading, form, planData, authHeader]);

  useEffect(() => {
    if (showAiVision) loadViz();
  }, [showAiVision, loadViz]);

  useEffect(() => {
    if (streamBoxRef.current) streamBoxRef.current.scrollTop = streamBoxRef.current.scrollHeight;
  }, [streamText]);

  /* ── Form helpers ── */
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const togglePill = (key, val) => set(key, form[key] === val ? '' : val);
  const toggleInfra = (val) => {
    if (val === 'None') {
      setForm(p => ({ ...p, existingInfrastructure: p.existingInfrastructure.includes('None') ? [] : ['None'] }));
    } else {
      setForm(p => ({
        ...p,
        existingInfrastructure: p.existingInfrastructure.includes(val)
          ? p.existingInfrastructure.filter(v => v !== val)
          : [...p.existingInfrastructure.filter(v => v !== 'None'), val],
      }));
    }
  };

  /* ── Image upload with validation ── */
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const validation = await validateImageFile(file);
    if (!validation.valid) {
      const suggestion = getValidationSuggestion(validation.error);
      setError(`${validation.error}\n${suggestion}`);
      return;
    }

    // Validation passed - proceed with preview and analysis
    setImagePreview(URL.createObjectURL(file));
    setImageAnalysis(null);
    setIsAnalyzingImg(true);
    setError(null);

    try {
      const res = await analyzeImage(file);
      if (res.success) {
        setImageAnalysis(res.analysis);
      } else {
        setError(
          `❌ AI analysis could not identify this as a farm photo.\n` +
          `💡 Try uploading a clearer photo of your land, taken from ground level.`
        );
      }
    } catch (err) {
      setError(
        `❌ Analysis error: ${err.message}\n` +
        `💡 Try uploading a different farm photo or checking your internet connection.`
      );
    }
    setIsAnalyzingImg(false);
  };

  /* ── Generate plan ── */
  const handleGenerate = async () => {
    if (!form.landSize || !form.location || !form.budget) {
      setError(t('myl_fill_required'));
      return;
    }
    setError(null);
    setView('generating');
    setStreamText('');
    rawRef.current = '';
    let result = null;

    await generatePlanStream(
      form,
      (d) => { rawRef.current += d; setStreamText(rawRef.current); },
      (d) => { result = d; },
      (e) => { setError(e.message); setView('form'); },
      (_raw) => {
        try {
          const stripped = _raw.replace(/^```[a-z]*\s*\n?/m, '').replace(/\s*```\s*$/m, '').trim();
          const first = stripped.indexOf('{');
          const last  = stripped.lastIndexOf('}');
          if (first !== -1 && last > first) result = JSON.parse(stripped.slice(first, last + 1));
        } catch { /* fall through */ }
      },
      authHeader(),
    );

    // Final client-side parse on accumulated stream text
    if (!result && rawRef.current) {
      try {
        const stripped = rawRef.current.replace(/^```[a-z]*\s*\n?/m, '').replace(/\s*```\s*$/m, '').trim();
        const first = stripped.indexOf('{');
        const last  = stripped.lastIndexOf('}');
        if (first !== -1 && last > first) {
          const parsed = JSON.parse(stripped.slice(first, last + 1));
          if (parsed && typeof parsed === 'object') result = parsed;
        }
      } catch { /* fall through */ }
    }

    if (result) {
      setPlanData(result);
      setView('plan');
      onPlanReady?.(result, form, imagePreview);
    } else {
      setError("Could not generate plan. Please try again.");
      setView('form');
    }
  };

  const handleRegenerate = () => {
    setPlanData(null);
    setSaveStatus(null);
    setView('form');
  };

  const handleSavePlan = async () => {
    if (isSaving || saveStatus === 'saved') return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const API = process.env.REACT_APP_API_URL || '/api';
      const res = await fetch(`${API}/save-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ farmData: form, planData, language: form.language || 'hindi' }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  /* ─────────────────────────────────────────────── VIEW: FORM ── */
  if (view === 'form') {
    const canSubmit = form.landSize && form.location && form.budget;

    return (
      <div className="myl">
        {/* Header */}
        <header className="myl__header">
          <button className="myl__back-btn" onClick={onBack} aria-label="Back">
            <IconArrowLeft size={20} strokeWidth={2.2} />
          </button>
          <div className="myl__header-title">
            <IconMapPin size={18} strokeWidth={2} color="var(--g-400)" />
            {t('myl_title')}
          </div>
          <div className="myl__header-spacer" />
        </header>

        <div className="myl__body">

          {/* Farm Photo */}
          <div className="myl__section">
            <div className="myl__section-label">
              <IconCamera size={15} strokeWidth={2} /> {t('myl_photo_label')}
              <span className="myl__optional">{t('myl_photo_optional')}</span>
            </div>
            <div className="myl__photo-upload" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              {imagePreview ? (
                <div className="myl__photo-preview">
                  <img src={imagePreview} alt="Your farm" />
                  <div className="myl__photo-overlay">
                    <IconCamera size={14} strokeWidth={2} /> {t('myl_change_photo')}
                  </div>
                  {isAnalyzingImg && (
                    <div className="myl__photo-analyzing">
                      <IconLoader2 size={13} strokeWidth={2} className="spin" />
                      {t('myl_analysing_ai')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="myl__photo-placeholder">
                  <div className="myl__photo-ph-icon"><IconCamera size={28} strokeWidth={1.5} /></div>
                  <div className="myl__photo-ph-label">{t('myl_photo_ph')}</div>
                  <div className="myl__photo-ph-sub">{t('myl_photo_ai_sub')}</div>
                </div>
              )}
            </div>
            {imageAnalysis && (
              <div className={`myl__analysis${imageAnalysis.agritourismPotential === 'not_farm' ? ' myl__analysis--warn' : ''}`}>
                <div className="myl__analysis-head">
                  <IconSearch size={13} strokeWidth={2} /> {t('myl_ai_analysis')}
                  <span className={`myl__potential myl__potential--${imageAnalysis.agritourismPotential}`}>
                    {imageAnalysis.agritourismPotential === 'not_farm' ? t('myl_not_farm') : `${imageAnalysis.agritourismPotential} ${t('myl_potential_sfx')}`}
                  </span>
                </div>
                <p className="myl__analysis-text">{imageAnalysis.visualObservations}</p>
                {imageAnalysis.potentialServices?.length > 0 && imageAnalysis.agritourismPotential !== 'not_farm' && (
                  <div className="myl__analysis-tags">
                    {imageAnalysis.potentialServices.map((s, i) => (
                      <span key={i} className="myl__analysis-tag"><IconCheck size={10} strokeWidth={3} /> {s}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Land Size */}
          <div className="myl__section">
            <label className="myl__section-label">
              <IconRuler size={15} strokeWidth={2} /> {t('myl_land_size')}
              <span className="myl__required">*</span>
            </label>
            <div className="myl__input-row">
              <input
                className="myl__input"
                type="number"
                placeholder={t('myl_land_size_ph')}
                value={form.landSize}
                onChange={e => set('landSize', e.target.value)}
                min="0.5"
                step="0.5"
              />
              <FieldMic language={form.language} onResult={t => set('landSize', t.replace(/[^\d.]/g, ''))} />
            </div>
          </div>

          {/* Location */}
          <div className="myl__section">
            <label className="myl__section-label">
              <IconMapPin size={15} strokeWidth={2} /> {t('myl_location')}
              <span className="myl__required">*</span>
            </label>
            <div className="myl__input-row">
              <input
                className="myl__input"
                type="text"
                placeholder={t('myl_location_ph')}
                value={form.location}
                onChange={e => set('location', e.target.value)}
              />
              <FieldMic language={form.language} onResult={t => set('location', t.trim())} />
            </div>
          </div>

          {/* Soil Type */}
          <div className="myl__section">
            <div className="myl__section-label">
              <IconSeeding size={15} strokeWidth={2} /> {t('myl_soil')}
            </div>
            <div className="myl__pills">
              {SOIL_TYPES.map(s => (
                <Pill key={s} label={s} active={form.soilType === s} onClick={() => togglePill('soilType', s)} />
              ))}
            </div>
          </div>

          {/* Current Crops */}
          <div className="myl__section">
            <div className="myl__section-label">
              <IconPlant2 size={15} strokeWidth={2} /> {t('myl_current_crops')}
            </div>
            <div className="myl__pills">
              {BIODIVERSITY.map(b => (
                <Pill key={b} label={b} active={form.biodiversity === b} onClick={() => togglePill('biodiversity', b)} />
              ))}
            </div>
          </div>

          {/* Water Source */}
          <div className="myl__section">
            <div className="myl__section-label">
              <IconDroplets size={15} strokeWidth={2} /> {t('myl_water')}
            </div>
            <div className="myl__pills">
              {WATER_SOURCES.map(w => (
                <Pill key={w} label={w} active={form.waterSource === w} onClick={() => togglePill('waterSource', w)} />
              ))}
            </div>
          </div>

          {/* Infrastructure */}
          <div className="myl__section">
            <div className="myl__section-label">
              <IconBuildingWarehouse size={15} strokeWidth={2} /> {t('myl_infra')}
            </div>
            <div className="myl__pills">
              {INFRA_OPTIONS.map(inf => (
                <Pill key={inf} label={inf}
                  active={form.existingInfrastructure.includes(inf)}
                  onClick={() => toggleInfra(inf)} />
              ))}
            </div>
          </div>

          {/* Budget */}
          <div className="myl__section">
            <label className="myl__section-label">
              <IconCurrencyRupee size={15} strokeWidth={2} /> {t('myl_avail_budget')}
              <span className="myl__required">*</span>
            </label>
            <div className="myl__input-row">
              <input
                className="myl__input"
                type="number"
                placeholder={t('myl_budget_ph')}
                value={form.budget}
                onChange={e => set('budget', e.target.value)}
                min="10000"
              />
              <FieldMic language={form.language} onResult={t => set('budget', t.replace(/[^\d]/g, ''))} />
            </div>
            {form.budget && (
              <div className="myl__budget-hint">₹{Number(form.budget).toLocaleString('en-IN')}</div>
            )}
          </div>

          {error && (
            <div className="myl__error">
              <IconAlertCircle size={15} strokeWidth={2} /> {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            className="myl__generate-btn"
            onClick={handleGenerate}
            disabled={!canSubmit}
          >
            <IconSparkles size={18} strokeWidth={2} />
            {t('myl_generate')}
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────── VIEW: GENERATING ── */
  if (view === 'generating') {
    return (
      <div className="myl myl--generating">
        <header className="myl__header">
          <div className="myl__header-spacer" />
          <div className="myl__header-title">
            <IconSparkles size={18} strokeWidth={2} color="var(--g-400)" />
            {t('myl_gen_plan_title')}
          </div>
          <div className="myl__header-spacer" />
        </header>

        <div className="myl__gen-wrap">
          <div className="myl__gen-animation">
            <div className="myl__gen-icon">🌾</div>
            <div className="myl__gen-bars">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="myl__gen-bar" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
            <div className="myl__gen-label">{t('myl_gen_label')}</div>
            <div className="myl__gen-sublabel">{t('myl_gen_sub')}</div>
          </div>

          {streamText && (
            <div className="myl__stream-box" ref={streamBoxRef}>
              {streamText.replace(/^```[a-z]*\s*\n?/, '')}
              <span className="myl__stream-cursor">▌</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────── VIEW: PLAN ── */
  // Normalise field names — backend uses camelCase; support both old snake_case and new camelCase
  const bizName      = planData?.recommendedService   || planData?.business_concept?.name || 'Your Agritourism Plan';
  const tagline      = planData?.tagline              || '';
  const score        = planData?.suitabilityScore     ?? planData?.suitability_score ?? 0;
  const totalCost    = planData?.totalSetupCost        || planData?.estimated_setup_cost || 0;
  const monthly      = planData?.monthlyRevenueEstimate || planData?.revenue_projections?.monthly_potential || 0;
  const vsAvg        = planData?.revenue_projections?.vs_average_pct || 0;
  const breakEven    = planData?.breakEvenMonths       || null;
  const materials    = planData?.cost_breakdown?.materials || Math.round(totalCost * 0.68);
  const labor        = planData?.cost_breakdown?.labor    || Math.round(totalCost * 0.32);

  // Implementation phases — new schema uses setupPhases[], old uses implementation_plan.phases[]
  const phases = (
    planData?.setupPhases ||
    planData?.implementation_plan?.phases ||
    planData?.implementation_steps ||
    []
  ).slice(0, 3);

  // Activities — new schema has uniqueExperiences[], old has business_concept.recommended_activities[]
  const activities = (
    planData?.uniqueExperiences ||
    planData?.business_concept?.recommended_activities ||
    []
  ).slice(0, 4);

  // Quick wins — new schema has riskFactors[] & revenueStreams[], old has quick_wins[]
  const quickWins = (planData?.quick_wins || []).slice(0, 3);

  // Revenue streams for display
  const revenueStreams = (planData?.revenueStreams || []).slice(0, 4);

  return (
    <div className="myl">
      {/* Header */}
      <header className="myl__header">
        <button className="myl__back-btn" onClick={onBack} aria-label="Back">
          <IconArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <div className="myl__header-title">
          <IconMapPin size={18} strokeWidth={2} color="var(--g-400)" />
          {t('myl_plan_title')}
        </div>
        <button className="myl__regen-btn" onClick={handleRegenerate} title="Edit & regenerate">
          <IconRefresh size={18} strokeWidth={2} />
        </button>
      </header>

      <div className="myl__body myl__body--plan">

        {/* Hero summary */}
        <div className="myl__plan-hero">
          {imagePreview && (
            <div className="myl__plan-hero-img-wrap">
              <img src={showAiVision && vizUrl ? vizUrl : imagePreview} alt="Your farm" className="myl__plan-hero-img" />
              <button
                className={`myl__viz-badge${showAiVision ? ' myl__viz-badge--active' : ''}`}
                onClick={() => setShowAiVision(v => !v)}
              >
                <IconSparkles size={13} strokeWidth={2.5} />
              <span className="myl__viz-badge-text">{vizLoading ? t('myl_generating') : t('myl_ai_vision')}</span>
              </button>
            </div>
          )}
          <div className="myl__plan-hero-body">
            <div className="myl__plan-name">{bizName}</div>
            {tagline && <div className="myl__plan-tagline">{tagline}</div>}
            <div className="myl__plan-meta">
              {form.location && <span><IconMapPin size={12} strokeWidth={2} />{form.location}</span>}
              {form.landSize && <span><IconRuler size={12} strokeWidth={2} />{form.landSize} acres</span>}
            </div>
            {score > 0 && (
              <div className="myl__plan-score">
                <div className="myl__plan-score-num">{score}%</div>
                <div className="myl__plan-score-label">
                  {score >= 80 ? t('home_score_excellent') : score >= 65 ? t('home_score_very_good') : score >= 50 ? t('home_score_good') : t('home_score_fair')} {t('myl_score_label')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Key metrics row */}
        <div className="myl__metrics">
          <div className="myl__metric">
            <div className="myl__metric-val">{fmt(monthly)}<span className="myl__metric-unit">/mo</span></div>
            <div className="myl__metric-label">{t('myl_monthly_income')}</div>
          </div>
          <div className="myl__metric-sep" />
          <div className="myl__metric">
            <div className="myl__metric-val">{fmt(totalCost)}</div>
            <div className="myl__metric-label">{t('myl_setup_cost')}</div>
          </div>
          {breakEven && (
            <>
              <div className="myl__metric-sep" />
              <div className="myl__metric">
                <div className="myl__metric-val">{breakEven}<span className="myl__metric-unit">mo</span></div>
                <div className="myl__metric-label">{t('myl_break_even')}</div>
              </div>
            </>
          )}
          {!breakEven && vsAvg > 0 && (
            <>
              <div className="myl__metric-sep" />
              <div className="myl__metric">
                <div className="myl__metric-val myl__metric-val--green">+{vsAvg}%</div>
                <div className="myl__metric-label">{t('myl_vs_avg')}</div>
              </div>
            </>
          )}
        </div>

        {/* Recommended activities */}
        {activities.length > 0 && (
          <div className="myl__plan-section">
            <div className="myl__plan-section-head">
              <IconSparkles size={16} strokeWidth={2} color="var(--g-600)" />
              {t('myl_unique_exp')}
            </div>
            <div className="myl__activity-grid">
              {activities.map((a, i) => (
                <div key={i} className="myl__activity-chip">
                  <IconCheck size={12} strokeWidth={3} color="var(--g-600)" />
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue streams */}
        {revenueStreams.length > 0 && (
          <div className="myl__plan-section">
            <div className="myl__plan-section-head">
              <IconTrendingUp size={16} strokeWidth={2} color="var(--g-600)" />
              {t('myl_rev_streams')}
            </div>
            <div className="myl__income-card">
              <div className="myl__income-head">
                <span className="myl__income-label">{t('myl_proj_monthly')}</span>
                <span className="myl__income-val">{fmt(monthly)}</span>
              </div>
              {revenueStreams.map((rs, i) => (
                <div key={i} className="myl__rev-row">
                  <span className="myl__rev-label">{rs.stream || rs.name}</span>
                  <span className="myl__rev-val">{fmt(rs.monthlyRevenue || rs.monthly || 0)}/mo</span>
                </div>
              ))}
              <IncomeChart monthly={monthly} />
            </div>
          </div>
        )}

        {/* Implementation roadmap */}
        {phases.length > 0 && (
          <div className="myl__plan-section">
            <div className="myl__plan-section-head">
              <IconChecklist size={16} strokeWidth={2} color="var(--g-600)" />
              {t('myl_setup_roadmap')}
            </div>
            {phases.map((p, i) => (
              <SetupStep
                key={i}
                number={i + 1}
                title={p.title || `Phase ${p.phase || i + 1}`}
                desc={p.description || (p.tasks || p.activities || []).join(', ')}
                duration={p.duration || p.timeline}
                active={i === 1}
              />
            ))}
          </div>
        )}

        {/* Cost breakdown */}
        {totalCost > 0 && (
          <div className="myl__plan-section">
            <div className="myl__plan-section-head">
              <IconCurrencyRupee size={16} strokeWidth={2} color="var(--g-600)" />
              {t('myl_cost_breakdown')}
            </div>
            <div className="myl__cost-card">
              <div className="myl__cost-total-row">
                <span className="myl__cost-total-label">{t('myl_total_cost')}</span>
                <span className="myl__cost-total-val">{fmt(totalCost)}</span>
              </div>
              <CostBar label={t('myl_materials')} amount={materials} max={totalCost} color="var(--saffron)" />
              <CostBar label={t('myl_labor')} amount={labor} max={totalCost} color="var(--g-600)" />
            </div>
          </div>
        )}

        {/* Quick wins */}
        {quickWins.length > 0 && (
          <div className="myl__plan-section">
            <div className="myl__plan-section-head">
              <IconChevronRight size={16} strokeWidth={2} color="var(--g-600)" />
              {t('myl_quick_wins')}
            </div>
            <div className="myl__quick-wins">
              {quickWins.map((w, i) => (
                <div key={i} className="myl__quick-win">
                  <div className="myl__quick-win-num">{i + 1}</div>
                  <div className="myl__quick-win-text">{w}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="myl__plan-footer">
          <div className="myl__plan-verified">
            <IconShield size={14} strokeWidth={2} color="var(--g-600)" />
            {t('myl_ai_verified')}
          </div>
          <div className="myl__plan-actions">
            <button className="myl__action-btn myl__action-btn--outline" onClick={handleRegenerate}>
              <IconRefresh size={16} strokeWidth={2} /> {t('myl_edit_regen')}
            </button>
            <button
              className={`myl__action-btn${saveStatus === 'saved' ? ' myl__action-btn--saved' : ' myl__action-btn--solid'}`}
              onClick={handleSavePlan}
              disabled={isSaving || saveStatus === 'saved'}
            >
              {isSaving
                ? <><IconLoader2 size={16} strokeWidth={2} className="spin" /> {t('myl_generating').split('…')[0]}…</>
                : saveStatus === 'saved'
                ? <><IconCheck size={16} strokeWidth={2.5} /> {t('myl_saved_ok')}</>
                : saveStatus === 'error'
                ? <><IconBookmark size={16} strokeWidth={2} /> {t('myl_retry_save')}</>
                : <><IconBookmark size={16} strokeWidth={2} /> {t('myl_save_plan')}</>}
            </button>
          </div>
        </div>

        <div className="myl__bottom-pad" />
      </div>
    </div>
  );
}
