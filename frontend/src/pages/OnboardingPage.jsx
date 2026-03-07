/**
 * OnboardingPage — Collects farmer profile details after first sign-up.
 * Fields: given_name, family_name, birthdate, add            <button
            className="onb__btn"
            onClick={goNext}
            disabled={!canProceedStep0}
          >
            {t('onb_next')} <IconArrowRight size={18} strokeWidth={2} />
          </button>hone already known from auth).
 * Saves to Cognito via PUT /api/auth/me.
 */
import React, { useState } from 'react';
import {
  IconUser, IconMapPin, IconCalendar, IconArrowRight,
  IconLoader2, IconShieldCheck, IconCheck,
} from '@tabler/icons-react';
import logoPrimary from '../assets/logo-primary.png';
import { authApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './OnboardingPage.css';

const STEPS = [
  { id: 'name',      labelKey: 'onb_your_name',  icon: IconUser },
  { id: 'details',   labelKey: 'onb_details',     icon: IconCalendar },
  { id: 'address',   labelKey: 'onb_address',     icon: IconMapPin },
];

export default function OnboardingPage({ onComplete }) {
  const { authHeader, setProfile, profile, auth } = useAuth();
  const { t } = useLanguage();

  const [step, setStep]           = useState(0);
  const [given_name, setGivenName]   = useState(profile?.given_name  || '');
  const [family_name, setFamilyName] = useState(profile?.family_name || '');
  const [birthdate, setBirthdate]    = useState(profile?.birthdate   || '');
  const [address, setAddress]        = useState(profile?.address     || '');
  const [loading, setLoading]        = useState(false);
  const [error, setError]            = useState('');

  const phone = auth?.phone || profile?.phone || '';

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      await authApi.updateProfile(
        { given_name, family_name, birthdate, address },
        authHeader(),
      );
      // Update local context so ProfilePage shows the new data immediately
      setProfile({ ...profile, given_name, family_name, birthdate, address, phone });
      onComplete?.();
    } catch (err) {
      setError(err.message || 'Could not save profile. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep0 = given_name.trim().length >= 2;
  const canProceedStep1 = birthdate.length >= 8;
  const canSubmit       = given_name.trim().length >= 2;

  const goNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div className="onb">
      {/* ── Header ── */}
      <div className="onb__header">
        <img src={logoPrimary} alt="Chalo Kisaan" className="onb__logo" />
        <div className="onb__brand">Chalo Kisaan</div>
        <div className="onb__sub text-devanagari">{t('onb_welcome')}</div>
      </div>

      {/* ── Progress bar ── */}
      <div className="onb__progress">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`onb__step-dot ${i <= step ? 'onb__step-dot--active' : ''} ${i < step ? 'onb__step-dot--done' : ''}`}>
              {i < step ? <IconCheck size={13} strokeWidth={3} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`onb__step-line ${i < step ? 'onb__step-line--done' : ''}`} />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="onb__step-label">{t(STEPS[step].labelKey)}</div>

      {/* ── Step 0: Name ── */}
      {step === 0 && (
        <div className="onb__card anim-fade-up">
          <div className="onb__card-icon">
            <IconUser size={28} strokeWidth={1.5} color="var(--forest)" />
          </div>
          <h2 className="onb__card-title">{t('onb_your_name')}?</h2>
          <p className="onb__card-desc">
            {t('profile_edit_title')}.
          </p>

          <div className="onb__field">
            <label className="onb__label">{t('profile_first_name')} <span className="onb__req">*</span></label>
            <input
              className="onb__input"
              type="text"
              placeholder="e.g. Ramesh"
              value={given_name}
              onChange={e => { setError(''); setGivenName(e.target.value); }}
              autoFocus
            />
          </div>
          <div className="onb__field">
            <label className="onb__label">{t('profile_last_name')}</label>
            <input
              className="onb__input"
              type="text"
              placeholder="e.g. Kumar"
              value={family_name}
              onChange={e => setFamilyName(e.target.value)}
            />
          </div>

          {/* Phone preview (read-only) */}
          <div className="onb__readonly-row">
            <span className="onb__readonly-icon">📱</span>
            <div>
              <div className="onb__readonly-label">Registered Mobile</div>
              <div className="onb__readonly-val">{phone || '—'}</div>
            </div>
          </div>

          <button
            className="onb__btn"
            onClick={goNext}
            disabled={!canProceedStep0}
          >
            Continue <IconArrowRight size={18} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ── Step 1: Birthdate ── */}
      {step === 1 && (
        <div className="onb__card anim-fade-up">
          <div className="onb__card-icon">
            <IconCalendar size={28} strokeWidth={1.5} color="var(--forest)" />
          </div>
          <h2 className="onb__card-title">{t('profile_dob')}</h2>
          <p className="onb__card-desc">
            {t('profile_address_hint')}.
          </p>

          <div className="onb__field">
            <label className="onb__label">{t('profile_dob')} <span className="onb__req">*</span></label>
            <input
              className="onb__input"
              type="date"
              value={birthdate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => { setError(''); setBirthdate(e.target.value); }}
              autoFocus
            />
          </div>

          <div className="onb__nav-row">
            <button className="onb__btn-outline" onClick={goBack}>← {t('onb_back')}</button>
            <button
              className="onb__btn"
              onClick={goNext}
              disabled={!canProceedStep1}
            >
              {t('onb_next')} <IconArrowRight size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Address ── */}
      {step === 2 && (
        <div className="onb__card anim-fade-up">
          <div className="onb__card-icon">
            <IconMapPin size={28} strokeWidth={1.5} color="var(--forest)" />
          </div>
          <h2 className="onb__card-title">{t('profile_address')}</h2>
          <p className="onb__card-desc">
            {t('profile_address_hint')}.
          </p>

          <div className="onb__field">
            <label className="onb__label">{t('profile_address')}</label>
            <input
              className="onb__input"
              type="text"
              placeholder="e.g. Nagpur, Maharashtra"
              value={address}
              onChange={e => setAddress(e.target.value)}
              autoFocus
            />
          </div>

          {error && <div className="onb__error">{error}</div>}

          <div className="onb__nav-row">
            <button className="onb__btn-outline" onClick={goBack}>← {t('onb_back')}</button>
            <button
              className="onb__btn"
              onClick={handleSave}
              disabled={loading || !canSubmit}
            >
              {loading
                ? <><IconLoader2 size={18} strokeWidth={2} className="spin" /> {t('onb_saving')}</>
                : <>{t('onb_submit')} <IconArrowRight size={18} strokeWidth={2} /></>
              }
            </button>
          </div>

          <button
            className="onb__skip"
            onClick={() => onComplete?.()}
            type="button"
          >
            Skip for now →
          </button>

          <p className="onb__disclaimer">
            <IconShieldCheck size={13} strokeWidth={2} />
            Data stored securely in AWS. Only you can see it.
          </p>
        </div>
      )}
    </div>
  );
}
