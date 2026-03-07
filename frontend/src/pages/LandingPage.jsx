import React from 'react';
import {
  IconUsers, IconTrendingUp, IconLeaf,
  IconMicrophone, IconRobot, IconPhoto,
  IconCurrencyRupee, IconBuilding, IconFileText,
} from '@tabler/icons-react';
import logoPrimary from '../assets/logo-primary.png';
import Narrator from '../components/Narrator';
import { useNarrator } from '../hooks/useNarrator';
import { useLanguage } from '../context/LanguageContext';
import './LandingPage.css';

const STATS = [
  { value: '8.6 Cr',  label: 'Marginal farmers in India',          Icon: IconUsers },
  { value: '₹2 Lakh', label: 'Avg. annual side income potential',  Icon: IconTrendingUp },
  { value: '73%',     label: 'Farms with agritourism potential',    Icon: IconLeaf },
];

const FEATURES = [
  { Icon: IconMicrophone,    title: 'Voice Input',        desc: 'Speak in Hindi, Marathi or English. No typing required.' },
  { Icon: IconRobot,         title: 'AI Business Plan',   desc: 'Step-by-step agritourism plan tailored to your land.' },
  { Icon: IconPhoto,         title: 'Farm Visualisation', desc: 'See how your farm looks after transformation.' },
  { Icon: IconCurrencyRupee, title: 'Revenue Forecast',   desc: 'Realistic income projections and break-even analysis.' },
  { Icon: IconBuilding,      title: 'Govt. Schemes',      desc: 'Schemes and subsidies you are eligible for.' },
  { Icon: IconFileText,      title: 'Bank-Ready Report',  desc: 'Download a detailed PDF plan for loan applications.' },
];

export default function LandingPage({ onStart, language = 'hindi' }) {
  const { isSpeaking, isSupported, narratePage, stop } = useNarrator(language);
  const { t } = useLanguage();

  return (
    <div className="landing">

      <Narrator
        isSpeaking={isSpeaking}
        isSupported={isSupported}
        onSpeak={() => narratePage('landing')}
        onStop={stop}
      />

      <header className="landing__header">
        <div className="landing__logo">
          <img
            src={logoPrimary}
            alt="Chalo Kisaan Logo"
            className="landing__logo-emblem"
          />
          <div>
            <div className="landing__logo-name">Chalo Kisaan</div>
            <div className="landing__logo-tagline">{t('landing_tagline')}</div>
          </div>
        </div>
        <div className="landing__header-rule" />
      </header>

      <section className="landing__hero anim-fade-up">
        <div className="landing__hero-inner">
          <div className="landing__hero-kicker stamp" style={{ color: 'var(--g-500)', borderColor: 'var(--g-500)' }}>
            AI-Powered · Free to Use · Voice First
          </div>
          <h1 className="landing__headline">
            {t('landing_tagline')}<br />
            <em>{t('landing_sub')}</em>
          </h1>
          <p className="landing__subheadline">
            {t('landing_sub')}
          </p>
          <button className="landing__cta btn-primary" onClick={onStart}>
            {t('landing_start')}
            <span className="landing__cta-arrow">→</span>
          </button>
          <p className="landing__cta-note text-muted">
            Works on mobile &nbsp;·&nbsp; Free to use &nbsp;·&nbsp; Results in 60 seconds
          </p>
        </div>

        <div className="landing__hero-panel">
          <div className="landing__panel-header">
            <span className="landing__panel-dot landing__panel-dot--saffron" />
            <span className="landing__panel-dot landing__panel-dot--forest" />
            <span className="landing__panel-dot landing__panel-dot--terracotta" />
            <span className="landing__panel-label">Sample Output</span>
          </div>
          <div className="landing__panel-body">
            <div className="landing__panel-service">Vineyard Farm Stay</div>
            <div className="landing__panel-location">Near Nashik, Maharashtra · 5 acres</div>
            <div className="landing__panel-rule rule-gold" />
            <div className="landing__panel-rows">
              {[
                ['Suitability Score', '87 / 100'],
                ['Setup Investment', '₹2.4 Lakh'],
                ['Monthly Revenue', '₹38,000'],
                ['Break-Even', '8 months'],
              ].map(([k, v]) => (
                <div key={k} className="landing__panel-row">
                  <span className="landing__panel-key">{k}</span>
                  <span className="landing__panel-val">{v}</span>
                </div>
              ))}
            </div>
            <div className="landing__panel-rule rule-gold" />
            <div className="landing__panel-phases">
              <div className="landing__panel-phase-label">Setup Plan</div>
              {['Land Preparation · 2 weeks', 'Build Tent Cottages · 4 weeks', 'Tourist Booking Setup · 1 week'].map(p => (
                <div key={p} className="landing__panel-phase">
                  <span className="landing__panel-tick">✓</span> {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing__stats">
        <div className="landing__stats-rule rule-double" />
        <div className="landing__stats-grid">
          {STATS.map(({ value, label, Icon }, i) => (
            <div key={i} className="landing__stat" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="landing__stat-icon">
                <Icon size={26} stroke={1.5} color="var(--forest)" />
              </div>
              <div className="landing__stat-value">{value}</div>
              <div className="landing__stat-label">{label}</div>
            </div>
          ))}
        </div>
        <div className="landing__stats-rule rule-double" />
      </section>

      <section className="landing__features">
        <h2 className="landing__features-title">What Chalo Kisaan Does For You</h2>
        <div className="landing__features-grid">
          {FEATURES.map(({ Icon, title, desc }, i) => (
            <div key={i} className="landing__feature" style={{ animationDelay: `${i * 0.07}s` }}>
              <div className="landing__feature-icon">
                <Icon size={24} stroke={1.5} color="var(--forest)" />
              </div>
              <div className="landing__feature-title">{title}</div>
              <div className="landing__feature-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing__cta-strip">
        <div className="landing__cta-strip-inner">
          <div className="landing__cta-strip-text">
            <span className="landing__cta-strip-en">Built for India's 8.6 crore marginal farmers</span>
          </div>
          <button className="btn-primary" onClick={onStart}>{t('landing_start')} &nbsp;→</button>
        </div>
      </section>

      <footer className="landing__footer">
        <div className="rule-gold" />
        <p>Transforming Indian agriculture through technology &nbsp;·&nbsp; v1.0</p>
      </footer>
    </div>
  );
}
