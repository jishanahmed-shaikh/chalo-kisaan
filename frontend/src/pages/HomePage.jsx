import React, { useState, useEffect } from 'react';
import {
  IconCamera, IconMicrophone, IconChevronRight,
  IconCurrencyRupee, IconTool, IconBulb, IconArrowRight,
  IconSparkles, IconTrendingUp, IconAward, IconLeaf,
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import logoPrimary from '../assets/logo-primary.png';
import './HomePage.css';

/* ── Circular Score Gauge ─────────────────────────────────────────────────── */
function ScoreGauge({ score = 78, label = 'VERY GOOD' }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const R = 54;
  const circ = 2 * Math.PI * R;
  const fill = animated ? (score / 100) * circ : 0;
  const color = score >= 70 ? 'var(--g-500)' : score >= 45 ? 'var(--saffron)' : 'var(--terracotta)';
  const bgGradient = score >= 70 ? 'linear-gradient(135deg, var(--g-50) 0%, var(--g-100) 100%)' : 'linear-gradient(135deg, var(--saffron-bg) 0%, var(--g-50) 100%)';

  return (
    <div className="home__gauge-container">
      <div className="home__gauge-wrap" style={{ background: bgGradient }}>
        <svg viewBox="0 0 130 130" className="home__gauge-svg" aria-label={`Score: ${score}`}>
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10" />
          <circle
            cx="65" cy="65" r={R}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`}
            transform="rotate(-90 65 65)"
            style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(0.34,1.56,0.64,1)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
          />
          <text x="65" y="60" textAnchor="middle" fill={color}
            fontSize="22" fontWeight="700" fontFamily="Inter,sans-serif">{score}%</text>
          <text x="65" y="76" textAnchor="middle" fill="var(--ink-3)"
            fontSize="9" fontWeight="600" fontFamily="Inter,sans-serif"
            letterSpacing="0.08em">{label}</text>
        </svg>
      </div>
    </div>
  );
}

/* ── Insight Card ─────────────────────────────────────────────────────────── */
function InsightCard({ icon: IconComp, iconBg, title, value, unit }) {
  return (
    <div className="home__insight-card">
      <div className="home__insight-icon" style={{ background: iconBg }}>
        <IconComp size={20} color="#fff" strokeWidth={2} />
      </div>
      <div className="home__insight-content">
        <div className="home__insight-title">{title}</div>
        <div className="home__insight-value">
          {value}<span className="home__insight-unit">{unit}</span>
        </div>
      </div>
      <div className="home__insight-arrow">
        <IconChevronRight size={18} strokeWidth={2.2} />
      </div>
    </div>
  );
}

/* ── Expert Tip Card ──────────────────────────────────────────────────────── */
function ExpertTip({ image, text, label }) {
  return (
    <div className="home__tip-card">
      <div className="home__tip-badge-wrap">
        <div className="home__tip-badge">
          <IconBulb size={12} strokeWidth={2.2} />
          {label}
        </div>
      </div>
      {image && (
        <div className="home__tip-img">
          <img src={image} alt="farm tip" />
        </div>
      )}
      <div className="home__tip-body">
        <p className="home__tip-text">{text}</p>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function HomePage({ planData, onUploadPhoto, onSpeakToAI, onViewDetails, onGoToMyLand }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const displayName = t('common_kisan');
  const hasPlan = Boolean(planData);

  const score = planData?.suitabilityScore ?? planData?.suitability_score ?? null;
  const scoreLabel =
    !score       ? '—' :
    score >= 80  ? t('home_score_excellent') :
    score >= 65  ? t('home_score_very_good') :
    score >= 50  ? t('home_score_good') : t('home_score_fair');

  const monthlyIncome = planData?.monthlyRevenueEstimate || planData?.revenue_projections?.monthly_potential || null;
  const annualIncome  = monthlyIncome ? monthlyIncome * 12 : null;
  const setupCost     = planData?.totalSetupCost ?? planData?.estimated_setup_cost ?? null;

  const recommendedActivities = (
    planData?.uniqueExperiences ||
    planData?.business_concept?.recommended_activities ||
    []
  ).slice(0, 2);

  const tipText = planData?.quick_wins?.[0] || null;

  return (
    <div className="home">
      {/* ── Top Bar ── */}
      <header className="home__header">
        <div className="home__header-left">
          <div className="home__date">{today}</div>
          <h1 className="home__greeting">
            {t('home_greeting')}, {displayName} 🙏
          </h1>
        </div>
        <button className="home__avatar" aria-label="Profile">
          <img src={logoPrimary} alt="profile" />
          <span className="home__avatar-dot" />
        </button>
      </header>

      <div className="home__scroll">

        {/* ── Score Card ── */}
        <section className="home__score-card">
          <h2 className="home__score-title">{t('home_farm_score')}</h2>
          {hasPlan && score !== null ? (
            <>
              <ScoreGauge score={score} label={scoreLabel} />
              <p className="home__score-desc">
                {t('home_plan_subtitle')} —{' '}
                {recommendedActivities.length > 0
                  ? recommendedActivities.map((a, i) => (
                      <span key={a}>
                        <strong className="home__score-highlight">{a}</strong>
                        {i < recommendedActivities.length - 1 ? ' & ' : '.'}
                      </span>
                    ))
                  : <strong className="home__score-highlight">Agritourism</strong>
                }
              </p>
            </>
          ) : (
            <div className="home__score-empty">
              <div className="home__score-empty-visual">
                <div className="home__score-empty-icon">🌾</div>
              </div>
              <h3 className="home__score-empty-title">{t('home_no_plan_title')}</h3>
              <p className="home__score-empty-text">{t('home_no_plan_sub')}</p>
              <button className="home__score-empty-btn" onClick={onGoToMyLand}>
                {t('home_create_plan')} <IconArrowRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </section>

        {/* ── Action Buttons ── */}
        <section className="home__actions">
          <button className="home__action-btn home__action-btn--light" onClick={onGoToMyLand}>
            <div className="home__action-icon">
              <IconCamera size={24} strokeWidth={2} />
            </div>
            <div>
              <div className="home__action-title">{t('home_action_land')}</div>
              <div className="home__action-sub">{t('home_action_land_sub')}</div>
            </div>
          </button>
          <button className="home__action-btn home__action-btn--green" onClick={onSpeakToAI}>
            <div className="home__action-icon">
              <IconMicrophone size={24} strokeWidth={2} />
            </div>
            <div>
              <div className="home__action-title">{t('home_action_ai')}</div>
              <div className="home__action-sub">{t('home_action_ai_sub')}</div>
            </div>
          </button>
        </section>

        {/* ── Insights — only shown when real data exists ── */}
        {hasPlan && (annualIncome !== null || setupCost !== null) && (
          <section className="home__insights-section">
            <div className="home__section-header">
              <h2 className="home__section-title">{t('home_monthly_income')}</h2>
              <button className="home__view-all" onClick={onViewDetails}>
                {t('home_view_plan')} <IconChevronRight size={14} strokeWidth={2.5} />
              </button>
            </div>

            {annualIncome !== null && (
              <InsightCard
                icon={IconCurrencyRupee}
                iconBg="var(--saffron)"
                title={t('home_annual_income')}
                value={`₹${(annualIncome / 100000).toFixed(1)} Lakhs`}
                unit={`/${t('common_year')}`}
              />
            )}
            {setupCost !== null && (
              <InsightCard
                icon={IconTool}
                iconBg="var(--ink-3)"
                title={t('home_setup_cost')}
                value={`₹${Number(setupCost).toLocaleString('en-IN')}`}
                unit=""
              />
            )}
          </section>
        )}

        {/* ── Expert Tip — only shown when real data exists ── */}
        {tipText && (
          <section className="home__tip-section">
            <ExpertTip text={tipText} label={t('home_expert_tip')} />
          </section>
        )}

        {/* ── CTA Banner — always shown when no plan ── */}
        {!hasPlan && (
          <section className="home__cta-banner">
            <div className="home__cta-content">
              <IconSparkles size={20} strokeWidth={2} color="var(--g-400)" />
              <div>
                <div className="home__cta-title">{t('home_no_plan_sub')}</div>
                <div className="home__cta-sub">2 min · Free</div>
              </div>
            </div>
            <button className="home__cta-btn" onClick={onGoToMyLand}>
              {t('home_create_plan')} <IconArrowRight size={16} strokeWidth={2.5} />
            </button>
          </section>
        )}

        {/* ── View Plan CTA — shown when plan exists ── */}
        {hasPlan && (
          <section className="home__view-plan-banner">
            <div className="home__view-plan-left">
              <IconSparkles size={18} strokeWidth={2} color="var(--g-400)" />
              <div>
                <div className="home__view-plan-title">
                  {planData?.recommendedService || planData?.business_concept?.name || t('home_plan_subtitle')}
                </div>
                <div className="home__view-plan-sub">{t('home_view_plan')}</div>
              </div>
            </div>
            <button className="home__view-plan-btn" onClick={onViewDetails}>
              {t('home_view_plan')} <IconChevronRight size={14} strokeWidth={2.5} />
            </button>
          </section>
        )}

        <div className="home__bottom-pad" />
      </div>
    </div>
  );
}
