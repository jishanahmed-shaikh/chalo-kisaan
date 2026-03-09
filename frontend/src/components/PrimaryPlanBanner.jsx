/**
 * PrimaryPlanBanner
 * -----------------
 * A slim, persistent banner that appears at the top of every main screen
 * when the user has a primary plan selected. Shows key plan stats and lets
 * the user clear it.
 */
import React, { useState } from 'react';
import {
  IconStar, IconX, IconMapPin, IconCurrencyRupee,
  IconChevronUp, IconChevronDown,
} from '@tabler/icons-react';
import { usePrimaryPlan } from '../context/PrimaryPlanContext';
import './PrimaryPlanBanner.css';

function fmt(n) {
  if (!n && n !== 0) return null;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L/mo`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K/mo`;
  return `₹${n}/mo`;
}

export default function PrimaryPlanBanner({ onViewPlan }) {
  const { primaryPlan, clearPrimaryPlan } = usePrimaryPlan();
  const [expanded, setExpanded] = useState(false);

  if (!primaryPlan) return null;

  const p = primaryPlan.planData  || {};
  const f = primaryPlan.farmData  || {};

  const service  = p.recommendedService || primaryPlan.service || 'Farm Plan';
  const location = f.location || primaryPlan.location || '';
  const income   = p.estimatedMonthlyIncome ?? p.monthlyIncome;
  const score    = p.suitabilityScore ?? primaryPlan.score ?? 0;
  const activities = p.activities || [];

  return (
    <div className={`ppb${expanded ? ' ppb--expanded' : ''}`} role="complementary" aria-label="Primary farm plan">

      {/* ── Collapsed row ── */}
      <div className="ppb__row" onClick={() => setExpanded(v => !v)}>
        <span className="ppb__star-icon" aria-hidden>
          <IconStar size={13} strokeWidth={2.5} />
        </span>

        <div className="ppb__main">
          <span className="ppb__service">{service}</span>
          {location && (
            <span className="ppb__location">
              <IconMapPin size={11} strokeWidth={2} />
              {location}
            </span>
          )}
        </div>

        <div className="ppb__meta">
          {income != null && (
            <span className="ppb__income">
              <IconCurrencyRupee size={12} strokeWidth={2} />
              {fmt(income)}
            </span>
          )}
          {score > 0 && (
            <span className="ppb__score" data-level={score >= 70 ? 'high' : score >= 50 ? 'mid' : 'low'}>
              {score}
            </span>
          )}
        </div>

        <button
          className="ppb__toggle"
          aria-label={expanded ? 'Collapse plan details' : 'Expand plan details'}
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
        >
          {expanded ? <IconChevronUp size={14} strokeWidth={2.5} /> : <IconChevronDown size={14} strokeWidth={2.5} />}
        </button>

        <button
          className="ppb__clear"
          aria-label="Remove primary plan"
          onClick={e => { e.stopPropagation(); clearPrimaryPlan(); }}
        >
          <IconX size={13} strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="ppb__details">
          {f.landSize && (
            <div className="ppb__detail-item">
              <span className="ppb__detail-label">Land</span>
              <span className="ppb__detail-val">{f.landSize} acres</span>
            </div>
          )}
          {f.soilType && (
            <div className="ppb__detail-item">
              <span className="ppb__detail-label">Soil</span>
              <span className="ppb__detail-val">{f.soilType}</span>
            </div>
          )}
          {p.setupCost && (
            <div className="ppb__detail-item">
              <span className="ppb__detail-label">Setup</span>
              <span className="ppb__detail-val">₹{Number(p.setupCost).toLocaleString()}</span>
            </div>
          )}
          {p.timeline && (
            <div className="ppb__detail-item">
              <span className="ppb__detail-label">Timeline</span>
              <span className="ppb__detail-val">{p.timeline}</span>
            </div>
          )}
          {activities.length > 0 && (
            <div className="ppb__detail-item ppb__detail-item--full">
              <span className="ppb__detail-label">Activities</span>
              <span className="ppb__detail-val">{activities.slice(0, 4).join(' · ')}{activities.length > 4 ? ` +${activities.length - 4}` : ''}</span>
            </div>
          )}
          {onViewPlan && (
            <button className="ppb__view-btn" onClick={onViewPlan}>
              View Full Plan →
            </button>
          )}
          <p className="ppb__hint">
            <IconStar size={10} strokeWidth={2.5} /> AI assistant uses this plan as context for all answers
          </p>
        </div>
      )}
    </div>
  );
}
