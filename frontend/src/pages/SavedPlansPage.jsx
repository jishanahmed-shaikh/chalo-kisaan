import React, { useState, useEffect, useCallback } from 'react';
import {
  IconArrowLeft, IconLeaf, IconMapPin, IconStar,
  IconTrash, IconCalendar, IconChevronRight,
  IconLoader2, IconCloudOff,
  IconSeedling, IconCurrencyRupee, IconStarFilled,
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePrimaryPlan } from '../context/PrimaryPlanContext';
import { fetchSavedPlans, deleteSavedPlan } from '../utils/api';
import './SavedPlansPage.css';

/* ── helpers ── */
function fmt(n) {
  if (!n && n !== 0) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso.slice(0, 10); }
}

/* ── single plan card ── */
function PlanCard({ plan, onView, onDelete, onSetPrimary, isPrimary, deleting, t }) {
  const score = plan.score ?? plan.planData?.suitabilityScore ?? 0;
  const service = plan.service || plan.planData?.recommendedService || 'Agritourism Plan';
  const income = plan.planData?.monthlyIncome ?? plan.planData?.estimatedMonthlyIncome;
  const location = plan.location || plan.farmData?.location || '—';

  return (
    <div className={`sp__card${isPrimary ? ' sp__card--primary' : ''}`}>
      {isPrimary && (
        <div className="sp__primary-badge">
          <IconStarFilled size={10} strokeWidth={2.5} /> Primary Plan
        </div>
      )}
      <div className="sp__card-head">
        <div className="sp__score-badge" data-score={score >= 70 ? 'high' : score >= 50 ? 'mid' : 'low'}>
          <IconStar size={12} strokeWidth={2.5} />
          {score}
        </div>
        <div className="sp__card-meta">
          <div className="sp__card-service">{service}</div>
          <div className="sp__card-location">
            <IconMapPin size={12} strokeWidth={2} />
            {location}
            {plan.landSize ? ` · ${plan.landSize} acres` : ''}
          </div>
        </div>
      </div>

      <div className="sp__card-stats">
        {income != null && (
          <div className="sp__stat">
            <IconCurrencyRupee size={13} strokeWidth={2} />
            <span>{fmt(income)}{t('sp_per_month')}</span>
          </div>
        )}
        {plan.planData?.activities?.length > 0 && (
          <div className="sp__stat">
            <IconLeaf size={13} strokeWidth={2} />
            <span>{plan.planData.activities.length} {t('sp_activities')}</span>
          </div>
        )}
        <div className="sp__stat sp__stat--date">
          <IconCalendar size={13} strokeWidth={2} />
          <span>{formatDate(plan.createdAt)}</span>
        </div>
      </div>

      <div className="sp__card-actions">
        <button
          className={`sp__btn-primary-toggle${isPrimary ? ' sp__btn-primary-toggle--active' : ''}`}
          onClick={() => onSetPrimary(plan)}
          aria-label={isPrimary ? 'Remove as primary plan' : 'Set as primary plan'}
          title={isPrimary ? 'Remove as primary' : 'Set as primary plan for AI assistant'}
        >
          {isPrimary
            ? <><IconStarFilled size={14} strokeWidth={2.5} /> Primary</>
            : <><IconStar size={14} strokeWidth={2.5} /> Set Primary</>
          }
        </button>
        <button
          className="sp__btn-delete"
          onClick={() => onDelete(plan.planId)}
          disabled={deleting === plan.planId}
          aria-label="Delete plan"
        >
          {deleting === plan.planId
            ? <IconLoader2 size={16} strokeWidth={2} className="sp__spin" />
            : <IconTrash size={16} strokeWidth={2} />
          }
        </button>
        <button className="sp__btn-view" onClick={() => onView(plan)}>
          {t('sp_view')}
          <IconChevronRight size={15} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

/* ── main page ── */
export default function SavedPlansPage({ onBack, onLoadPlan }) {
  const { authHeader, isGuest, logout } = useAuth();
  const { t } = useLanguage();
  const { primaryPlan, setPrimaryPlan } = usePrimaryPlan();
  const [plans, setPlans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [deleting, setDeleting] = useState(null); // planId being deleted

  const load = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }   // guests have no saved plans
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSavedPlans(authHeader());
      setPlans(res.plans || []);
    } catch (err) {
      setError(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [authHeader, isGuest]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (planId) => {
    if (!window.confirm('Delete this plan? This cannot be undone.')) return;
    setDeleting(planId);
    try {
      await deleteSavedPlan(planId, authHeader());
      setPlans(prev => prev.filter(p => p.planId !== planId));
    } catch (err) {
      alert(err.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const handleView = (plan) => {
    onLoadPlan?.(plan.planData, plan.farmData);
  };

  const handleSetPrimary = (plan) => {
    // Toggle: if already primary, unset it
    if (primaryPlan?.planId === plan.planId) {
      setPrimaryPlan(null);
    } else {
      setPrimaryPlan(plan);
    }
  };

  return (
    <div className="sp">
      {/* header */}
      <header className="sp__header">
        <button className="sp__back" onClick={onBack} aria-label="Go back">
          <IconArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <div className="sp__header-title">
          <span>{t('sp_title')}</span>
          <span className="sp__header-sub">{t('profile_saved_plans_sub')}</span>
        </div>
        {!loading && plans.length > 0 && (
          <span className="sp__count">{plans.length}</span>
        )}
      </header>

      {/* guest prompt */}
      {isGuest && (
        <div className="sp__guest-prompt">
          <p>Sign in to save and access your agritourism plans across devices.</p>
          <button className="btn-primary" onClick={logout}>Sign In / Register</button>
        </div>
      )}

      <div className="sp__body">

        {/* loading */}
        {loading && (
          <div className="sp__state">
            <IconLoader2 size={40} strokeWidth={1.5} className="sp__spin sp__state-icon sp__state-icon--loading" />
            <p>{t('sp_loading')}</p>
          </div>
        )}

        {/* error */}
        {!loading && error && (
          <div className="sp__state">
            <IconCloudOff size={44} strokeWidth={1.5} className="sp__state-icon sp__state-icon--error" />
            <p className="sp__state-title">{t('common_error')}</p>
            <p className="sp__state-sub">{error}</p>
            <button className="sp__retry-btn" onClick={load}>{t('common_retry')}</button>
          </div>
        )}

        {/* empty */}
        {!loading && !error && plans.length === 0 && (
          <div className="sp__state">
            <IconSeedling size={52} strokeWidth={1.2} className="sp__state-icon sp__state-icon--empty" />
            <p className="sp__state-title">{t('sp_empty')}</p>
            <p className="sp__state-sub">
              Plans you generate from "{t('nav_my_land')}" will appear here automatically.
            </p>
            <button className="sp__retry-btn" onClick={onBack}>{t('common_back')}</button>
          </div>
        )}

        {/* list */}
        {!loading && !error && plans.length > 0 && (
          <div className="sp__list">
            {plans.map(plan => (
              <PlanCard
                key={plan.planId}
                plan={plan}
                onView={handleView}
                onDelete={handleDelete}
                onSetPrimary={handleSetPrimary}
                isPrimary={primaryPlan?.planId === plan.planId}
                deleting={deleting}
                t={t}
              />
            ))}
          </div>
        )}

        <div className="sp__bottom-pad" />
      </div>
    </div>
  );
}
