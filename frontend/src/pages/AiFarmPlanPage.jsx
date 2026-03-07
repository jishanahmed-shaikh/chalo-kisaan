import React, { useState, useEffect, useCallback } from 'react';
import {
  IconArrowLeft, IconShare, IconSparkles,
  IconChecklist, IconCurrencyRupee, IconTrendingUp,
  IconClock, IconDownload, IconBuildingStore,
  IconToggleLeft, IconToggleRight, IconShield,
  IconLoader2, IconRefresh,
} from '@tabler/icons-react';
import { generateVisualization } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './AiFarmPlanPage.css';

const fmt = (n) => {
  if (!n && n !== 0) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

/* ── Step Card ── */
function SetupStep({ number, title, desc, duration, isActive }) {
  return (
    <div className={`plan__step-card${isActive ? ' plan__step-card--active' : ''}`}>
      <div className={`plan__step-num${isActive ? ' plan__step-num--active' : ''}`}>
        {number}
      </div>
      <div className="plan__step-body">
        <div className="plan__step-title">{title}</div>
        <div className="plan__step-desc">{desc}</div>
        {duration && (
          <div className="plan__step-duration">
            <IconClock size={12} strokeWidth={2.5} />
            {duration}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Cost Bar ── */
function CostBar({ label, amount, max, color }) {
  const [anim, setAnim] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnim(true), 600); return () => clearTimeout(t); }, []);
  const pct = max ? Math.min((amount / max) * 100, 100) : 0;
  return (
    <div className="plan__cost-bar">
      <div className="plan__cost-bar-header">
        <span className="plan__cost-bar-label">{label}</span>
        <span className="plan__cost-bar-value">{fmt(amount)}</span>
      </div>
      <div className="plan__cost-bar-track">
        <div
          className="plan__cost-bar-fill"
          style={{
            width: anim ? `${pct}%` : '0%',
            background: color,
          }}
        />
      </div>
    </div>
  );
}

/* ── Income Chart ── */
function IncomeChart({ monthly }) {
  const [anim, setAnim] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnim(true), 700); return () => clearTimeout(t); }, []);

  const months = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];
  const values = [
    monthly * 0.25, monthly * 0.45, monthly * 0.72,
    monthly * 0.88, monthly * 0.96, monthly,
  ];
  const max = monthly * 1.1;

  return (
    <div className="plan__chart">
      <div className="plan__chart-bars">
        {months.map((m, i) => {
          const h = anim ? Math.max(8, (values[i] / max) * 100) : 8;
          const isLast = i === months.length - 1;
          return (
            <div key={m} className="plan__chart-col">
              <div
                className={`plan__chart-bar${isLast ? ' plan__chart-bar--active' : ''}`}
                style={{ height: `${h}%`, transition: `height 0.8s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s` }}
              />
              <span className={`plan__chart-label${isLast ? ' plan__chart-label--active' : ''}`}>{m}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main ── */
export default function AiFarmPlanPage({ planData, farmData, farmImage, onBack }) {
  const [showAiVision, setShowAiVision] = useState(false);
  const [vizUrl, setVizUrl] = useState(null);
  const [vizLoading, setVizLoading] = useState(false);
  const { authHeader } = useAuth();

  const loadViz = useCallback(async () => {
    if (vizUrl || vizLoading || !farmData) return;
    setVizLoading(true);
    try {
      const res = await generateVisualization(farmData, planData, authHeader());
      if (res?.image_url) setVizUrl(res.image_url);
    } catch {
      // silently fail
    } finally {
      setVizLoading(false);
    }
  }, [vizUrl, vizLoading, farmData, planData, authHeader]);

  useEffect(() => {
    if (showAiVision) loadViz();
  }, [showAiVision, loadViz]);

  if (!planData) {
    return (
      <div className="plan__empty">
        <IconSparkles size={40} strokeWidth={1.5} color="var(--g-400)" />
        <h2>No Plan Yet</h2>
        <p>Generate your AI farm plan from the planner.</p>
        <button className="plan__back-btn" onClick={onBack}>
          <IconArrowLeft size={18} /> Go Back
        </button>
      </div>
    );
  }

  const biz   = planData.business_concept   || {};
  const steps = planData.implementation_plan?.phases?.slice(0, 3)
    || planData.implementation_steps?.slice(0, 3)
    || [];
  const totalCost    = planData.estimated_setup_cost || 0;
  const materials    = planData.cost_breakdown?.materials || Math.round(totalCost * 0.68) || 0;
  const labor        = planData.cost_breakdown?.labor    || Math.round(totalCost * 0.32) || 0;
  const monthlyIncome = planData.revenue_projections?.monthly_potential || 0;
  const vsAvg        = planData.revenue_projections?.vs_average_pct || 0;

  return (
    <div className="plan">

      {/* ── Hero Image ── */}
      <div className="plan__hero">
        <div className="plan__hero-img-wrap">
          {showAiVision && vizUrl ? (
            <img src={vizUrl} alt="AI Vision of your farm" className="plan__hero-img" />
          ) : farmImage ? (
            <img src={farmImage} alt="Your farm" className="plan__hero-img" />
          ) : (
            <div className="plan__hero-placeholder" />
          )}

          {/* Vision toggle */}
          <button
            className={`plan__viz-badge${showAiVision ? ' plan__viz-badge--active' : ''}`}
            onClick={() => setShowAiVision(v => !v)}
          >
            <IconSparkles size={13} strokeWidth={2.5} />
            AI Generated Vision
          </button>

          {/* Nav */}
          <button className="plan__nav-btn plan__nav-btn--back" onClick={onBack} aria-label="Back">
            <IconArrowLeft size={20} strokeWidth={2.2} />
          </button>
          <button className="plan__nav-btn plan__nav-btn--share" aria-label="Share">
            <IconShare size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Title + Toggle */}
        <div className="plan__hero-footer">
          <h1 className="plan__title">{biz.name || 'Your AI Farm Plan'}</h1>
          <div className="plan__vision-toggle">
            <span className="plan__toggle-label">Original Land</span>
            <button
              className="plan__toggle-btn"
              onClick={() => setShowAiVision(v => !v)}
              aria-label="Toggle AI Vision"
            >
              <div className={`plan__toggle-track${showAiVision ? ' plan__toggle-track--on' : ''}`}>
                <div className="plan__toggle-thumb" />
              </div>
            </button>
            <span className={`plan__toggle-label${showAiVision ? ' plan__toggle-label--active' : ''}`}>
              AI Vision
              {vizLoading && <IconLoader2 size={12} className="spin" style={{ marginLeft: 4 }} />}
            </span>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="plan__content">

        {/* ── Setup Roadmap ── */}
        <section className="plan__section">
          <div className="plan__section-header">
            <h2 className="plan__section-title">
              <IconChecklist size={18} strokeWidth={2} color="var(--g-600)" />
              Setup Roadmap
            </h2>
            <span className="plan__section-badge">{steps.length || 3} Steps</span>
          </div>

          {steps.length > 0 ? steps.map((step, i) => (
            <SetupStep
              key={i}
              number={i + 1}
              title={step.title || step.phase || `Step ${i + 1}`}
              desc={step.description || step.activities?.join(', ') || ''}
              duration={step.duration || step.timeline}
              isActive={i === 1}
            />
          )) : (
            <>
              <SetupStep number={1} title="Land Preparation"
                desc="Level ground and clear weeds for visitor access." duration="1 Week" />
              <SetupStep number={2} title="Setup Infrastructure"
                desc="Install basic facilities for agritourism visitors." duration="2 Weeks" isActive />
              <SetupStep number={3} title="Welcome Guests"
                desc="List on platforms and start hosting farm tours." duration="Ongoing" />
            </>
          )}
        </section>

        {/* ── Cost Breakdown ── */}
        <section className="plan__section">
          <div className="plan__cost-card">
            <div className="plan__cost-header">
              <div>
                <div className="plan__cost-label">Estimated Setup Cost</div>
                <div className="plan__cost-total">{fmt(totalCost)}</div>
              </div>
              <div className="plan__cost-icon">
                <IconCurrencyRupee size={20} strokeWidth={2} color="var(--saffron)" />
              </div>
            </div>
            <CostBar
              label="Materials (Bamboo/Canvas)"
              amount={materials}
              max={totalCost}
              color="var(--saffron)"
            />
            <CostBar
              label="Labor &amp; Permits"
              amount={labor}
              max={totalCost}
              color="var(--g-700)"
            />
          </div>
        </section>

        {/* ── Monthly Income ── */}
        <section className="plan__section">
          <div className="plan__income-card">
            <div className="plan__income-header">
              <div>
                <div className="plan__income-label">Projected Monthly Income</div>
                <div className="plan__income-value">
                  {fmt(monthlyIncome)}
                  <span className="plan__income-badge">
                    +{vsAvg}% vs avg
                  </span>
                </div>
              </div>
              <div className="plan__income-icon">
                <IconTrendingUp size={20} strokeWidth={2} color="var(--g-600)" />
              </div>
            </div>
            <IncomeChart monthly={monthlyIncome} />
          </div>
        </section>

        {/* ── Verified Footer ── */}
        <div className="plan__verified">
          <IconShield size={14} strokeWidth={2} color="var(--g-600)" />
          AI Plan Verified by Agri-Experts
        </div>

        {/* ── Action Buttons ── */}
        <div className="plan__actions">
          <button className="plan__action-btn plan__action-btn--outline">
            <IconDownload size={18} strokeWidth={2} />
            Download Plan
          </button>
          <button className="plan__action-btn plan__action-btn--solid">
            <IconBuildingStore size={18} strokeWidth={2} />
            Connect to Vendors
          </button>
        </div>

        <div className="plan__bottom-pad" />
      </div>
    </div>
  );
}
