import React, { useState, useEffect, useCallback } from "react";
import {
  IconArrowLeft, IconHome, IconMap, IconChecklist, IconCurrencyRupee,
  IconEye, IconBuildingBank, IconTarget, IconSparkles, IconUsers,
  IconCalendar, IconAlertTriangle, IconClock, IconBuildingWarehouse,
  IconTrendingUp, IconTrophy, IconSunrise, IconRefresh, IconWind,
  IconBrush, IconClipboard, IconPrinter, IconBuilding, IconCloudUpload, IconCheck, IconLoader2,
} from "@tabler/icons-react";
import Narrator from "../components/Narrator";
import { useNarrator } from "../hooks/useNarrator";
import { generateVisualization, visualizeLand, savePlan } from "../utils/api";
import { exportToPDF } from "../utils/pdfExport";
import "./ResultsPage.css";

const fmt = (n) => {
  if (!n) return "—";
  if (n >= 100000) return `\u20b9${(n/100000).toFixed(1)} L`;
  if (n >= 1000)   return `\u20b9${(n/1000).toFixed(0)}K`;
  return `\u20b9${n}`;
};

function Gauge({ score }) {
  const [anim, setAnim] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnim(true), 400); return () => clearTimeout(t); }, []);
  const color = score >= 70 ? "var(--forest)" : score >= 45 ? "var(--saffron)" : "var(--terracotta)";
  const arc = 251;
  const fill = anim ? (score / 100) * arc : 0;
  return (
    <div className="results__score-gauge">
      <svg viewBox="0 0 200 120" className="results__gauge-svg">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--paper-fold)" strokeWidth="16" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${fill} ${arc}`}
          style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.34,1.56,0.64,1)" }} />
        <text x="100" y="97" textAnchor="middle" fill={color} fontSize="28" fontWeight="700" fontFamily="Literata,serif">{score}</text>
        <text x="100" y="115" textAnchor="middle" fill="var(--ink-faint)" fontSize="11">out of 100</text>
      </svg>
      <span className="results__score-label">Suitability</span>
    </div>
  );
}

function RevBar({ label, value, max }) {
  const [anim, setAnim] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnim(true), 500); return () => clearTimeout(t); }, []);
  const pct = max ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="results__rev-item">
      <div className="results__rev-header">
        <span className="results__rev-name">{label}</span>
        <span className="results__rev-val">{fmt(value)}<span style={{fontSize:12,fontWeight:400,color:"var(--ink-faint)"}}>/mo</span></span>
      </div>
      <div className="results__rev-track">
        <div className="results__rev-fill" style={{ width: anim ? `${pct}%` : "0%" }} />
      </div>
    </div>
  );
}

const TABS = [
  { key:"overview",      label:"Overview",   Icon: IconMap },
  { key:"plan",          label:"Setup Plan", Icon: IconChecklist },
  { key:"revenue",       label:"Revenue",    Icon: IconCurrencyRupee },
  { key:"visualization", label:"Vision",     Icon: IconEye },
  { key:"schemes",       label:"Schemes",    Icon: IconBuildingBank },
];

export default function ResultsPage({ planData, farmData, farmImage, onBack, onReset, language = "hindi" }) {
  const [tab, setTab] = useState("overview");
  const [viz, setViz] = useState(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // AI Land Visualization state
  const [selectedServices, setSelectedServices] = useState([]);
  const [vizMode, setVizMode] = useState("transform");
  const [aiImage, setAiImage] = useState(null);
  const [aiImageLoading, setAiImageLoading] = useState(false);
  const [aiImageError, setAiImageError] = useState(null);

  const { isSpeaking, isSupported, narratePage, stop } = useNarrator(language);

  const loadViz = useCallback(async () => {
    setVizLoading(true);
    try {
      const res = await generateVisualization(farmData, planData);
      if (res.success) setViz(res.visualization);
    } catch {}
    setVizLoading(false);
  }, [farmData, planData]);

  useEffect(() => { if (planData && farmData) loadViz(); }, [planData, farmData, loadViz]);

  const handleGenerateAiImage = useCallback(async () => {
    if (!farmImage || selectedServices.length === 0) return;
    setAiImageLoading(true);
    setAiImageError(null);
    setAiImage(null);
    try {
      // farmImage is a base64 data URL — strip prefix for API
      const base64 = farmImage.includes(",") ? farmImage.split(",")[1] : farmImage;
      const res = await visualizeLand(
        base64,
        selectedServices,
        farmData,
        vizMode,
        planData.recommendedService || "",
      );
      if (res.success) {
        setAiImage(`data:image/png;base64,${res.generatedImage}`);
      } else {
        setAiImageError("Generation failed. Please try again.");
      }
    } catch (err) {
      setAiImageError(err.message || "Something went wrong.");
    }
    setAiImageLoading(false);
  }, [farmImage, selectedServices, farmData, vizMode, planData]);

  // Build service options from plan data
  const serviceOptions = React.useMemo(() => {
    const services = new Set();
    planData.revenueStreams?.forEach(s => { if (s.stream) services.add(s.stream); });
    planData.uniqueExperiences?.forEach(e => { if (e) services.add(e); });
    return [...services];
  }, [planData]);

  if (!planData) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",gap:16 }}>
        <p>No plan data found.</p>
        <button className="btn-primary" onClick={onReset}>Start Over</button>
      </div>
    );
  }

  const maxRev = planData.revenueStreams
    ? Math.max(...planData.revenueStreams.map(r => r.monthlyRevenue || 0))
    : 0;

  return (
    <div className="results">
      <Narrator
        isSpeaking={isSpeaking}
        isSupported={isSupported}
        onSpeak={() => narratePage("results")}
        onStop={stop}
      />

      {/* Header */}
      <header className="results__header">
        <button className="results__nav-btn" onClick={onBack}>
          <IconArrowLeft size={15} stroke={2} /> Redo
        </button>
        <div className="results__header-center">
          <div className="results__service-name">{planData.recommendedService}</div>
          <div className="results__tagline">"{planData.tagline}"</div>
        </div>
        <button className="results__nav-btn" onClick={onReset}>
          <IconHome size={15} stroke={2} /> Home
        </button>
      </header>

      {/* Score + KPIs */}
      <div className="results__score-strip">
        <Gauge score={planData.suitabilityScore || 72} />
        <div className="results__kpi-row">
          {[
            { Icon: IconCurrencyRupee, val: fmt(planData.monthlyRevenueEstimate), label: "Monthly Revenue" },
            { Icon: IconTrendingUp,    val: fmt(planData.yearlyRevenueEstimate),  label: "Annual Potential" },
            { Icon: IconClock,         val: `${planData.breakEvenMonths || "—"} mo`, label: "Break Even" },
            { Icon: IconBuildingWarehouse, val: fmt(planData.totalSetupCost),     label: "Setup Cost" },
          ].map(k => (
            <div key={k.label} className="results__kpi">
              <span className="results__kpi-icon"><k.Icon size={18} stroke={1.5} /></span>
              <span className="results__kpi-val">{k.val}</span>
              <span className="results__kpi-label">{k.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="results__tabs">
        {TABS.map(t => (
          <button key={t.key} className={`results__tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            <t.Icon size={15} stroke={1.8} /> {t.label}
          </button>
        ))}
      </div>

      <div className="results__body">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="results__tab-content anim-fade-up">
            <div className="rc">
              <div className="rc__head"><IconTarget size={16} stroke={2} /><span className="rc__title">Why This is Right for Your Farm</span></div>
              <div className="rc__body"><p className="results__suitability-text">{planData.suitabilityReason}</p></div>
            </div>
            <div className="rc">
              <div className="rc__head"><IconSparkles size={16} stroke={2} /><span className="rc__title">Unique Experiences You Can Offer</span></div>
              <div className="rc__body">
                <div className="results__experiences">
                  {planData.uniqueExperiences?.map((e, i) => (
                    <div key={i} className="results__exp-item">
                      <span className="results__exp-num">{String(i+1).padStart(2,"0")}</span>
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rc">
              <div className="rc__head"><IconUsers size={16} stroke={2} /><span className="rc__title">Your Target Tourists</span></div>
              <div className="rc__body"><p className="results__target">{planData.targetTourists}</p></div>
            </div>
            {planData.seasonalCalendar && (
              <div className="rc">
                <div className="rc__head"><IconCalendar size={16} stroke={2} /><span className="rc__title">Seasonal Calendar</span></div>
                <div className="rc__body">
                  <div className="results__seasons">
                    <div className="results__season results__season--peak">
                      <div className="results__season-label">Peak Season</div>
                      <div className="results__season-value">{planData.seasonalCalendar.peak}</div>
                    </div>
                    <div className="results__season results__season--off">
                      <div className="results__season-label">Off-Peak</div>
                      <div className="results__season-value">{planData.seasonalCalendar.offPeak}</div>
                    </div>
                  </div>
                  <p className="results__season-activities">{planData.seasonalCalendar.activities}</p>
                </div>
              </div>
            )}
            {planData.riskFactors?.length > 0 && (
              <div className="rc">
                <div className="rc__head"><IconAlertTriangle size={16} stroke={2} /><span className="rc__title">Things to Watch Out For</span></div>
                <div className="rc__body">
                  <div className="results__risks">
                    {planData.riskFactors.map((r, i) => (
                      <div key={i} className="results__risk-item"><span>•</span>{r}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SETUP PLAN ── */}
        {tab === "plan" && (
          <div className="results__tab-content anim-fade-up">
            <div className="rc">
              <div className="rc__head"><IconChecklist size={16} stroke={2} /><span className="rc__title">Step-by-Step Setup Plan</span></div>
              <div className="rc__body">
                <div className="results__timeline">
                  {planData.setupPhases?.map((phase, i) => (
                    <div key={i} className="results__phase">
                      <div className="results__phase-marker">
                        <div className="results__phase-dot">{phase.phase}</div>
                        {i < planData.setupPhases.length - 1 && <div className="results__phase-line" />}
                      </div>
                      <div className="results__phase-content">
                        <div className="results__phase-header">
                          <h3 className="results__phase-title">{phase.title}</h3>
                          <div className="results__phase-meta">
                            <span className="results__badge results__badge--time">
                              <IconClock size={11} stroke={2} /> {phase.duration}
                            </span>
                            <span className="results__badge results__badge--cost">{fmt(phase.cost)}</span>
                          </div>
                        </div>
                        <div className="results__tasks">
                          {phase.tasks?.map((t, j) => (
                            <div key={j} className="results__task">
                              <span className="results__task-check">✓</span>{t}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUE ── */}
        {tab === "revenue" && (
          <div className="results__tab-content anim-fade-up">
            <div className="rc">
              <div className="rc__head"><IconTrendingUp size={16} stroke={2} /><span className="rc__title">Revenue Streams</span></div>
              <div className="rc__body">
                <div className="results__rev-list">
                  {planData.revenueStreams?.map((s, i) => (
                    <div key={i}>
                      <RevBar label={s.stream} value={s.monthlyRevenue} max={maxRev} />
                      {s.description && <p className="results__rev-desc" style={{marginTop:5}}>{s.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rc">
              <div className="rc__head"><IconTrophy size={16} stroke={2} /><span className="rc__title">Financial Summary</span></div>
              <div className="rc__body">
                <table className="results__fin-table">
                  <tbody>
                    <tr><td className="results__fin-key">Total Setup Investment</td><td className="results__fin-val results__fin-val--cost">{fmt(planData.totalSetupCost)}</td></tr>
                    <tr><td className="results__fin-key">Monthly Revenue (Est.)</td><td className="results__fin-val results__fin-val--rev">{fmt(planData.monthlyRevenueEstimate)}</td></tr>
                    <tr><td className="results__fin-key">Annual Revenue (Est.)</td><td className="results__fin-val results__fin-val--rev">{fmt(planData.yearlyRevenueEstimate)}</td></tr>
                    <tr className="results__fin-total"><td className="results__fin-key">Break-Even Period</td><td className="results__fin-val">{planData.breakEvenMonths} months</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── VISUALISATION ── */}
        {tab === "visualization" && (
          <div className="results__tab-content anim-fade-up">

            {/* Service Selector */}
            <div className="rc">
              <div className="rc__head"><IconSparkles size={16} stroke={2} /><span className="rc__title">Select Services to Visualize</span></div>
              <div className="rc__body">
                {!farmImage && (
                  <div className="results__viz-notice">
                    <IconAlertTriangle size={16} stroke={2} />
                    Upload a farm photo in the planner to enable AI visualization.
                  </div>
                )}
                <div className="results__service-chips">
                  {serviceOptions.map(s => (
                    <button
                      key={s}
                      className={`results__service-chip ${selectedServices.includes(s) ? "results__service-chip--active" : ""}`}
                      onClick={() => setSelectedServices(prev =>
                        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {farmImage && (
                  <div className="results__viz-controls">
                    <div className="results__mode-toggle">
                      <button
                        className={`results__mode-btn ${vizMode === "transform" ? "results__mode-btn--active" : ""}`}
                        onClick={() => setVizMode("transform")}
                      >
                        <IconBrush size={14} stroke={2} /> Full Transform
                      </button>
                      <button
                        className={`results__mode-btn ${vizMode === "inpaint" ? "results__mode-btn--active" : ""}`}
                        onClick={() => setVizMode("inpaint")}
                      >
                        <IconSparkles size={14} stroke={2} /> Add to Photo
                      </button>
                    </div>
                    <button
                      className="btn-primary results__generate-btn"
                      onClick={handleGenerateAiImage}
                      disabled={aiImageLoading || selectedServices.length === 0}
                    >
                      {aiImageLoading
                        ? <><IconLoader2 size={15} stroke={2} className="spin" /> AI is reimagining your farm...</>
                        : <><IconEye size={15} stroke={2} /> Visualize My Farm</>}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Before & After Display */}
            <div className="rc">
              <div className="rc__head"><IconEye size={16} stroke={2} /><span className="rc__title">Before &amp; After — Your Farm Transformation</span></div>
              <div className="rc__body" style={{padding:0}}>
                <div className="results__viz-panels">
                  {farmImage && (
                    <div className="results__viz-panel">
                      <span className="results__viz-badge results__viz-badge--before">Before</span>
                      <img src={farmImage} alt="Current farm" className="results__viz-img" />
                      <div className="results__viz-cap">Your farm today</div>
                    </div>
                  )}
                  <div className="results__viz-panel" style={{ gridColumn: farmImage ? "auto" : "1/-1" }}>
                    <span className="results__viz-badge results__viz-badge--after">After</span>
                    {aiImageLoading ? (
                      <div className="results__viz-loading">
                        <span className="spinner spinner--dark" />
                        <span>AI is transforming your farm...</span>
                        <span style={{fontSize:11, color:"var(--ink-faint)"}}>This may take 10-15 seconds</span>
                      </div>
                    ) : aiImage ? (
                      <img src={aiImage} alt="AI-generated farm transformation" className="results__viz-img" />
                    ) : (
                      <div className="results__farm-illustration">
                        <div className="results__farm-sky" />
                        <div className="results__farm-hills" />
                        <div className="results__farm-land" />
                        <div className="results__farm-path" />
                        {[10,22,38,60,78].map((l,i) => (
                          <div key={i} className="results__farm-tree" style={{ left:`${l}%`, height:`${44+i%3*14}px`, bottom:`${48+(i%2)*3}%` }} />
                        ))}
                        <div className="results__farm-hut results__farm-hut--main" />
                        <div className="results__farm-hut results__farm-hut--small" />
                        <div className="results__farm-tent" />
                      </div>
                    )}
                    <div className="results__viz-cap">
                      {aiImage
                        ? `${planData.recommendedService} — AI Generated`
                        : `${planData.recommendedService} — Select services above & generate`}
                    </div>
                  </div>
                </div>
                {aiImageError && (
                  <div className="results__viz-error">
                    <IconAlertTriangle size={14} stroke={2} /> {aiImageError}
                  </div>
                )}
                {aiImage && (
                  <div style={{padding:"12px 16px", display:"flex", gap:10}}>
                    <button className="results__copy-btn" onClick={handleGenerateAiImage} disabled={aiImageLoading}>
                      <IconRefresh size={14} stroke={2} /> Regenerate
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Text description cards */}
            {viz && (
              <>
                <div className="rc">
                  <div className="rc__head"><IconSunrise size={16} stroke={2} /><span className="rc__title">How Your Farm Will Look</span></div>
                  <div className="rc__body"><p className="results__viz-desc">{viz.afterDescription}</p></div>
                </div>
                <div className="rc">
                  <div className="rc__head"><IconRefresh size={16} stroke={2} /><span className="rc__title">Key Changes</span></div>
                  <div className="rc__body">
                    <div className="results__changes-list">
                      {viz.keyChanges?.map((c, i) => (
                        <div key={i} className="results__change-item"><span className="results__change-arrow">→</span>{c}</div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rc">
                  <div className="rc__head"><IconWind size={16} stroke={2} /><span className="rc__title">The Atmosphere</span></div>
                  <div className="rc__body"><p className="results__atmosphere">{viz.atmosphereDescription}</p></div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SCHEMES ── */}
        {tab === "schemes" && (
          <div className="results__tab-content anim-fade-up">
            <div className="results__schemes-list">
              {planData.govtSchemes?.map((s, i) => (
                <div key={i} className="results__scheme">
                  <div className="results__scheme-name-bar">
                    <IconBuilding size={15} stroke={1.8} />
                    <span className="results__scheme-name">{s.name}</span>
                  </div>
                  <div className="results__scheme-body">
                    <div className="results__scheme-row"><span className="results__scheme-key">Benefit:</span>{s.benefit}</div>
                    <div className="results__scheme-row"><span className="results__scheme-key">Eligibility:</span>{s.eligibility}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="results__schemes-cta">
              Contact your local <strong>Krishi Vigyan Kendra (KVK)</strong> or District Agriculture Officer
              to apply for these schemes and subsidies.
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="results__action-bar safe-bottom">
        <button className="btn-secondary" onClick={onBack}>
          <IconRefresh size={15} stroke={2} /> New Plan
        </button>
        <button className="btn-secondary" onClick={async () => {
          if (saveStatus === 'saving') return;
          setSaveStatus('saving');
          try {
            await savePlan(farmData, planData, language);
            setSaveStatus('saved');
          } catch { setSaveStatus('error'); }
        }} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? <><IconLoader2 size={15} stroke={2} className="spin" /> Saving...</>
           : saveStatus === 'saved' ? <><IconCheck size={15} stroke={2} /> Saved to Cloud</>
           : <><IconCloudUpload size={15} stroke={2} /> Save to Cloud</>}
        </button>
        <button className="btn-primary" disabled={pdfGenerating} onClick={async () => {
          setPdfGenerating(true);
          try { await exportToPDF(planData, farmData, farmImage); } catch {}
          setPdfGenerating(false);
        }}>
          {pdfGenerating
            ? <><IconLoader2 size={15} stroke={2} className="spin" /> Preparing PDF...</>
            : <><IconPrinter size={15} stroke={2} /> Download Report</>}
        </button>
      </div>
    </div>
  );
}
