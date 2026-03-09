import React, { useState, useEffect, useRef } from 'react';
import {
  IconCamera, IconMicrophone, IconChevronRight,
  IconCurrencyRupee, IconTool, IconBulb, IconArrowRight,
  IconSparkles, IconLeaf, IconX, IconSun, IconDroplet,
  IconTrendingUp, IconMapPin, IconBell, IconMoon,
} from '@tabler/icons-react';
import { useLanguage } from '../context/LanguageContext';
import logoPrimary from '../assets/logo-primary.png';
import './HomePage.css';

/* ── Animated Farm SVG Landscape ─────────────────────────────────────────── */
function FarmLandscape() {
  return (
    <svg className="farm-landscape" viewBox="0 0 390 220" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f4c2a" />
          <stop offset="100%" stopColor="#1a7a42" />
        </linearGradient>
        <linearGradient id="groundGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2d6a1f" />
          <stop offset="100%" stopColor="#1a4a10" />
        </linearGradient>
        <linearGradient id="hillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3d8b2a" />
          <stop offset="100%" stopColor="#2a6018" />
        </linearGradient>
        <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd700" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ff8c00" stopOpacity="0.4" />
        </radialGradient>
        <filter id="blur2">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <clipPath id="landscapeClip">
          <rect width="390" height="220" />
        </clipPath>
      </defs>

      <g clipPath="url(#landscapeClip)">
        {/* Sky */}
        <rect width="390" height="220" fill="url(#skyGrad)" />

        {/* Sun glow */}
        <circle cx="320" cy="45" r="35" fill="url(#sunGrad)" filter="url(#blur2)" className="farm-sun" />
        <circle cx="320" cy="45" r="18" fill="#ffd700" opacity="0.85" className="farm-sun" />

        {/* Stars / sparkles */}
        {[[40,30],[80,20],[150,15],[200,25],[260,18],[90,50]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="1.2" fill="#a8f0c0" opacity="0.6"
            className="farm-star" style={{ animationDelay: `${i * 0.4}s` }} />
        ))}

        {/* Far hills */}
        <path d="M0 140 Q50 90 100 115 Q150 80 200 110 Q250 75 300 100 Q350 80 390 105 L390 220 L0 220Z"
          fill="#1d5c14" opacity="0.7" />

        {/* Mid hills */}
        <path d="M0 160 Q60 120 120 145 Q180 110 240 140 Q300 115 360 135 L390 140 L390 220 L0 220Z"
          fill="url(#hillGrad)" />

        {/* Ground */}
        <rect x="0" y="168" width="390" height="52" fill="url(#groundGrad)" />

        {/* Crop rows — animated */}
        {[0,1,2,3,4,5].map(i => (
          <g key={i} className="crop-row" style={{ animationDelay: `${i * 0.1}s` }}>
            <rect x={20 + i * 58} y="158" width="40" height="60" rx="2"
              fill="#4caf50" opacity={0.25 + i * 0.05} />
            {/* Crop stalks */}
            {[0,1,2,3,4].map(j => (
              <line key={j}
                x1={26 + i * 58 + j * 7} y1="218"
                x2={26 + i * 58 + j * 7} y2={185 - (j % 2) * 8}
                stroke="#81c784" strokeWidth="1.5" opacity="0.7"
                className="crop-stalk" style={{ animationDelay: `${(i + j) * 0.08}s` }} />
            ))}
          </g>
        ))}

        {/* Trees */}
        {[[30,130],[75,120],[340,118],[375,128]].map(([x,y],i) => (
          <g key={i} className="farm-tree" style={{ animationDelay: `${i * 0.2}s` }}>
            <rect x={x-3} y={y+18} width="6" height="20" fill="#5d4037" rx="2" />
            <circle cx={x} cy={y} r="16" fill="#2e7d32" opacity="0.9" />
            <circle cx={x-5} cy={y+5} r="10" fill="#388e3c" opacity="0.7" />
            <circle cx={x+5} cy={y+4} r="10" fill="#43a047" opacity="0.6" />
          </g>
        ))}

        {/* Farmhouse */}
        <g className="farmhouse">
          <rect x="168" y="148" width="54" height="34" rx="2" fill="#8d6e63" />
          <polygon points="158,148 222,148 190,122" fill="#6d4c41" />
          <rect x="182" y="162" width="16" height="20" rx="2" fill="#4e342e" />
          <rect x="170" y="155" width="10" height="10" rx="1" fill="#fff8e1" opacity="0.8" />
          <rect x="200" y="155" width="10" height="10" rx="1" fill="#fff8e1" opacity="0.8" />
          {/* Chimney smoke */}
          <path d="M200 122 Q202 112 198 104 Q196 96 200 88"
            stroke="#e0e0e0" strokeWidth="2" fill="none" opacity="0.5"
            strokeLinecap="round" className="smoke" />
        </g>

        {/* Path */}
        <path d="M178 220 Q185 195 190 182 Q195 195 202 220Z"
          fill="#a1887f" opacity="0.6" />

        {/* Birds */}
        {[[120,65],[130,58],[260,48],[272,54]].map(([x,y],i) => (
          <path key={i}
            d={`M${x} ${y} Q${x+5} ${y-4} ${x+10} ${y}`}
            stroke="#a8f0c0" strokeWidth="1.2" fill="none" opacity="0.7"
            className="bird" style={{ animationDelay: `${i * 0.3}s` }} />
        ))}

        {/* Overlay gradient for text readability */}
        <rect width="390" height="220"
          fill="url(#overlayGrad)" />
        <defs>
          <linearGradient id="overlayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.0)" />
            <stop offset="60%" stopColor="rgba(0,0,0,0.1)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </linearGradient>
        </defs>
      </g>
    </svg>
  );
}

/* ── Score Ring ───────────────────────────────────────────────────────────── */
function ScoreRing({ score = 78 }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 500);
    return () => clearTimeout(t);
  }, []);

  const R = 42;
  const circ = 2 * Math.PI * R;
  const fill = animated ? (score / 100) * circ : 0;
  const color = score >= 70 ? '#4caf50' : score >= 45 ? '#ff9800' : '#f44336';

  return (
    <div className="score-ring">
      <svg viewBox="0 0 100 100" className="score-ring__svg">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 6px ${color})` }} />
        <text x="50" y="46" textAnchor="middle" fill="#fff"
          fontSize="18" fontWeight="800" fontFamily="var(--font-display,'Outfit',sans-serif)">{score}</text>
        <text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,0.6)"
          fontSize="8" fontWeight="600" letterSpacing="1">SCORE</text>
      </svg>
    </div>
  );
}

/* ── Stat Pill ────────────────────────────────────────────────────────────── */
function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div className="stat-pill">
      <div className="stat-pill__icon" style={{ background: color }}>
        <Icon size={14} strokeWidth={2.5} color="#fff" />
      </div>
      <div className="stat-pill__text">
        <span className="stat-pill__label">{label}</span>
        <span className="stat-pill__value">{value}</span>
      </div>
    </div>
  );
}

/* ── Income Card ──────────────────────────────────────────────────────────── */
function IncomeCard({ monthly, annual, onClick }) {
  const [barAnim, setBarAnim] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBarAnim(true), 700);
    return () => clearTimeout(t);
  }, []);

  const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];

  // Real data: model seasonal income variation from monthly average
  // Agritourism peaks in Oct-Feb (festival/harvest season) and dips in summer
  const seasonalFactors = [0.80, 0.75, 0.70, 0.60, 0.50, 0.55, 0.60, 0.70, 0.80, 1.00, 1.10, 1.00];
  const monthlyValues = seasonalFactors.map(f => Math.round((monthly || 0) * f));
  const maxVal = Math.max(...monthlyValues, 1);
  // Heights as % of chart height (min 8% so bars are always visible)
  const heights = monthlyValues.map(v => Math.max(8, Math.round((v / maxVal) * 100)));

  return (
    <div className="income-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="income-card__header">
        <div>
          <div className="income-card__label">Monthly Income</div>
          <div className="income-card__value">
            ₹{monthly ? (monthly / 1000).toFixed(0) : '0'}
            <span className="income-card__unit">K/mo</span>
          </div>
        </div>
        <div className="income-card__annual">
          <IconTrendingUp size={14} strokeWidth={2.5} />
          <span>₹{annual ? (annual / 100000).toFixed(1) : '0'}L/yr</span>
        </div>
      </div>
      <div className="income-card__chart">
        {heights.map((h, i) => (
          <div key={i} className="income-card__bar-wrap">
            <div className="income-card__bar"
              style={{ height: barAnim ? `${h}%` : '0%', transitionDelay: `${i * 0.04}s` }} />
            <span className="income-card__month">{months[i]}</span>
          </div>
        ))}
      </div>
      <div className="income-card__footer">
        <IconChevronRight size={16} strokeWidth={2.5} />
        <span>View full revenue breakdown</span>
      </div>
    </div>
  );
}

/* ── Action Tile ──────────────────────────────────────────────────────────── */
function ActionTile({ icon: Icon, label, sublabel, onClick, variant = 'default' }) {
  return (
    <button className={`action-tile action-tile--${variant}`} onClick={onClick}>
      <div className="action-tile__icon-wrap">
        <Icon size={26} strokeWidth={1.8} />
      </div>
      <div className="action-tile__text">
        <span className="action-tile__label">{label}</span>
        <span className="action-tile__sub">{sublabel}</span>
      </div>
      <div className="action-tile__arrow">
        <IconArrowRight size={16} strokeWidth={2.5} />
      </div>
    </button>
  );
}

/* ── Expert Tip ───────────────────────────────────────────────────────────── */
function TipCard({ text }) {
  return (
    <div className="tip-card">
      <div className="tip-card__badge">
        <IconBulb size={13} strokeWidth={2.5} />
        Expert Tip
      </div>
      <p className="tip-card__text">{text}</p>
      <div className="tip-card__accent" aria-hidden="true" />
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────────────────────────── */
function EmptyState({ t, onGoToMyLand }) {
  return (
    <div className="empty-state">
      <div className="empty-state__orb" aria-hidden="true">
        <div className="empty-state__orb-inner">
          <IconLeaf size={36} strokeWidth={1.5} color="#4caf50" />
        </div>
      </div>
      <h3 className="empty-state__title">{t('home_no_plan_title')}</h3>
      <p className="empty-state__text">{t('home_no_plan_sub')}</p>
      <button className="empty-state__btn" onClick={onGoToMyLand}>
        <IconSparkles size={16} strokeWidth={2} />
        {t('home_create_plan')}
      </button>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function HomePage({ planData, onUploadPhoto, onSpeakToAI, onViewDetails, onGoToMyLand }) {
  const { t } = useLanguage();
  const [showBanner, setShowBanner] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 20);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const hour = new Date().getHours();
  const timeOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 20 ? 'evening' : 'night';
  const TimeIcon = timeOfDay === 'morning' ? IconSun : timeOfDay === 'night' ? IconMoon : IconSun;

  const hasPlan = Boolean(planData);
  const score = planData?.suitabilityScore ?? planData?.suitability_score ?? null;
  const monthly = planData?.monthlyRevenueEstimate || planData?.revenue_projections?.monthly_potential || null;
  const annual  = monthly ? monthly * 12 : null;
  const setupCost = planData?.totalSetupCost ?? planData?.estimated_setup_cost ?? null;
  const serviceName = planData?.recommendedService || planData?.business_concept?.name || null;
  const location = planData?.location || null;
  const tipText = planData?.quick_wins?.[0] || null;
  const activities = (planData?.uniqueExperiences || planData?.business_concept?.recommended_activities || []).slice(0, 2);

  const scoreLabel =
    !score      ? '' :
    score >= 80 ? t('home_score_excellent') :
    score >= 65 ? t('home_score_very_good') :
    score >= 50 ? t('home_score_good') : t('home_score_fair');

  return (
    <div className="home">

      {/* ── Floating Header ── */}
      <header className={`home__header ${scrolled ? 'home__header--scrolled' : ''}`}>
        <div className="home__header-left">
          <div className="home__date">
            <TimeIcon size={10} strokeWidth={2.5} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {today}
          </div>
          <h1 className="home__greeting">
            {t('home_greeting')}, <span className="home__greeting-name">{t('common_kisan')}</span>
          </h1>
          {hasPlan && serviceName && (
            <div className="home__plan-chip">
              <IconLeaf size={10} strokeWidth={2.5} />
              {serviceName}
            </div>
          )}
        </div>
        <div className="home__header-right">
          <button className="home__notif-btn" aria-label="Notifications">
            <IconBell size={18} strokeWidth={1.8} />
            {hasPlan && <span className="home__notif-dot" />}
          </button>
          <button className="home__avatar" aria-label="Profile">
            <img src={logoPrimary} alt="profile" />
            <span className="home__avatar-dot" />
          </button>
        </div>
      </header>

      <div className="home__scroll" ref={scrollRef}>

        {/* ── Hero Section ── */}
        <section className="home__hero">
          <FarmLandscape />

          {/* Floating updates pill */}
          {showBanner && (
            <div className="hero-pill">
              <IconSparkles size={14} strokeWidth={2} color="#4caf50" />
              <span>New agritourism schemes available</span>
              <button className="hero-pill__close" onClick={() => setShowBanner(false)} aria-label="Close">
                <IconX size={13} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* Hero content overlay */}
          <div className="hero-content">
            {hasPlan && score !== null ? (
              <div className="hero-plan-summary">
                <ScoreRing score={score} />
                <div className="hero-plan-info">
                  <div className="hero-plan-label">{scoreLabel}</div>
                  <div className="hero-plan-name">{serviceName}</div>
                  {location && (
                    <div className="hero-plan-location">
                      <IconMapPin size={12} strokeWidth={2} />
                      {location}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hero-cta-text">
                <div className="hero-cta-eyebrow">
                  <IconLeaf size={14} strokeWidth={2} />
                  AI-Powered Analysis
                </div>
                <div className="hero-cta-heading">Turn your farm<br />into income</div>
              </div>
            )}

            {/* Action buttons */}
            <div className="hero-actions">
              <button className="hero-action-btn hero-action-btn--ai" onClick={onSpeakToAI}>
                <div className="hero-action-btn__icon">
                  <IconMicrophone size={22} strokeWidth={1.8} />
                </div>
                <span>Ask AI</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Content Area ── */}
        <div className="home__content">

          {hasPlan ? (
            <>
              {/* Stats Row */}
              {(monthly || setupCost) && (
                <div className="stats-row">
                  {monthly && (
                    <StatPill icon={IconCurrencyRupee} label="Monthly" value={`₹${(monthly/1000).toFixed(0)}K`} color="#4caf50" />
                  )}
                  {setupCost && (
                    <StatPill icon={IconTool} label="Setup" value={`₹${(setupCost/1000).toFixed(0)}K`} color="#ff9800" />
                  )}
                  {score && (
                    <StatPill icon={IconTrendingUp} label="Score" value={`${score}%`} color="#2196f3" />
                  )}
                </div>
              )}

              {/* Income Card */}
              {monthly && (
                <IncomeCard monthly={monthly} annual={annual} onClick={onViewDetails} />
              )}

              {/* Action Tiles */}
              <div className="tiles-grid">
                <ActionTile
                  icon={IconSparkles}
                  label="View Full Plan"
                  sublabel={activities[0] || 'See your agritourism plan'}
                  onClick={onViewDetails}
                  variant="green"
                />
                <ActionTile
                  icon={IconCamera}
                  label="Update Farm Photo"
                  sublabel="Improve AI analysis"
                  onClick={onGoToMyLand}
                  variant="amber"
                />
              </div>

              {/* Expert Tip */}
              {tipText && <TipCard text={tipText} />}

              {/* Activities */}
              {activities.length > 0 && (
                <div className="activities-section">
                  <div className="activities-section__header">
                    <h3 className="activities-section__title">Recommended Activities</h3>
                    <button className="activities-section__all" onClick={onViewDetails}>
                      See all <IconChevronRight size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="activities-list">
                    {activities.map((a, i) => (
                      <div key={i} className="activity-item" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="activity-item__dot" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <EmptyState t={t} onGoToMyLand={onGoToMyLand} />

              {/* Action tiles for no-plan state */}
              <div className="tiles-grid">
                <ActionTile
                  icon={IconCamera}
                  label="Analyse My Land"
                  sublabel="Upload a photo to start"
                  onClick={onGoToMyLand}
                  variant="green"
                />
                <ActionTile
                  icon={IconMicrophone}
                  label="Talk to AI"
                  sublabel="Get instant guidance"
                  onClick={onSpeakToAI}
                  variant="amber"
                />
              </div>

              {/* Weather-style info strip */}
              <div className="info-strip">
                <div className="info-strip__item">
                  <IconSun size={18} strokeWidth={1.8} color="#ff9800" />
                  <div>
                    <div className="info-strip__label">Best Season</div>
                    <div className="info-strip__val">Oct – Feb</div>
                  </div>
                </div>
                <div className="info-strip__divider" />
                <div className="info-strip__item">
                  <IconDroplet size={18} strokeWidth={1.8} color="#2196f3" />
                  <div>
                    <div className="info-strip__label">Water Needed</div>
                    <div className="info-strip__val">Low–Medium</div>
                  </div>
                </div>
                <div className="info-strip__divider" />
                <div className="info-strip__item">
                  <IconTrendingUp size={18} strokeWidth={1.8} color="#4caf50" />
                  <div>
                    <div className="info-strip__label">Avg. ROI</div>
                    <div className="info-strip__val">8–14 mo</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="home__bottom-pad" />
      </div>
    </div>
  );
}