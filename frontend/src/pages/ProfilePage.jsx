import React, { useState } from 'react';
import {
  IconTractor, IconBuildingBank, IconLanguage,
  IconHeadset, IconChevronRight, IconMapPin,
  IconCheck, IconBookmark, IconEdit, IconLoader2,
  IconX, IconUser,
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authApi } from '../utils/api';
import logoPrimary from '../assets/logo-primary.png';
import './ProfilePage.css';

const LANGUAGES = [
  { key: 'hindi',   label: 'हिंदी',   sub: 'Hindi'    },
  { key: 'english', label: 'English',  sub: 'English'  },
  { key: 'marathi', label: 'मराठी',    sub: 'Marathi'  },
  { key: 'punjabi', label: 'ਪੰਜਾਬੀ',  sub: 'Punjabi'  },
  { key: 'gujarati',label: 'ગુજરાતી',  sub: 'Gujarati' },
];

function SettingsRow({ icon: IconComp, iconBg, title, subtitle, onClick }) {
  return (
    <button className="profile__row" onClick={onClick} type="button">
      <div className="profile__row-icon" style={{ background: iconBg }}>
        <IconComp size={20} strokeWidth={2} color="#fff" />
      </div>
      <div className="profile__row-body">
        <div className="profile__row-title">{title}</div>
        {subtitle && <div className="profile__row-sub">{subtitle}</div>}
      </div>
      <IconChevronRight size={18} strokeWidth={2} color="var(--ink-4)" />
    </button>
  );
}

export default function ProfilePage({ onGoToSavedPlans, onGoToMyLand, onGoToOnboarding }) {
  const { user, profile, setProfile, authHeader, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  /* ── Edit Profile state ── */
  const [showEdit, setShowEdit]       = useState(false);
  const [editForm, setEditForm]       = useState({});
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const phone = profile?.phone || user?.phone || '';
  const formattedPhone = phone.startsWith('+91')
    ? `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`
    : phone;

  const displayName = [profile?.given_name, profile?.family_name].filter(Boolean).join(' ') || 'Kisan';
  const displayAddress = profile?.address || '';
  const displayBirthdate = profile?.birthdate
    ? new Date(profile.birthdate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const handleLangChange = (lang) => {
    setLanguage(lang);
  };

  const openEdit = () => {
    setEditForm({
      given_name:  profile?.given_name  || '',
      family_name: profile?.family_name || '',
      address:     profile?.address     || '',
      birthdate:   profile?.birthdate   || '',
    });
    setSaveError('');
    setSaveSuccess(false);
    setShowEdit(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const updated = await authApi.updateProfile(editForm, authHeader());
      // Merge updated fields into the existing profile
      if (setProfile) {
        setProfile({ ...profile, ...editForm, ...updated });
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setShowEdit(false);
        setSaveSuccess(false);
      }, 1200);
    } catch (err) {
      setSaveError(err.message || 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile">

      {/* ── Edit Profile Modal ── */}
      {showEdit && (
        <div className="profile__modal-overlay" onClick={() => !saving && setShowEdit(false)}>
          <div className="profile__modal" onClick={e => e.stopPropagation()}>
            <div className="profile__modal-header">
              <div className="profile__modal-title">
                <IconUser size={16} strokeWidth={2} /> {t('profile_edit_title')}
              </div>
              <button className="profile__modal-close" onClick={() => !saving && setShowEdit(false)} disabled={saving}>
                <IconX size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="profile__modal-body">
              <div className="profile__edit-field">
                <label className="profile__edit-label">{t('profile_first_name')}</label>
                <input
                  className="profile__edit-input"
                  type="text"
                  placeholder="e.g. Ramesh"
                  value={editForm.given_name}
                  onChange={e => setEditForm(p => ({ ...p, given_name: e.target.value }))}
                />
              </div>
              <div className="profile__edit-field">
                <label className="profile__edit-label">{t('profile_last_name')}</label>
                <input
                  className="profile__edit-input"
                  type="text"
                  placeholder="e.g. Patel"
                  value={editForm.family_name}
                  onChange={e => setEditForm(p => ({ ...p, family_name: e.target.value }))}
                />
              </div>
              <div className="profile__edit-field">
                <label className="profile__edit-label">
                  <IconMapPin size={13} strokeWidth={2} /> {t('profile_address')}
                </label>
                <input
                  className="profile__edit-input"
                  type="text"
                  placeholder="e.g. Near Nashik, Maharashtra"
                  value={editForm.address}
                  onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                />
                <div className="profile__edit-hint">{t('profile_address_hint')}</div>
              </div>
              <div className="profile__edit-field">
                <label className="profile__edit-label">{t('profile_dob')}</label>
                <input
                  className="profile__edit-input"
                  type="date"
                  value={editForm.birthdate}
                  onChange={e => setEditForm(p => ({ ...p, birthdate: e.target.value }))}
                />
              </div>

              {saveError && (
                <div className="profile__edit-error">{saveError}</div>
              )}
              {saveSuccess && (
                <div className="profile__edit-success">
                  <IconCheck size={14} strokeWidth={3} /> {t('profile_saved_ok')}
                </div>
              )}
            </div>

            <div className="profile__modal-footer">
              <button className="profile__modal-cancel" onClick={() => setShowEdit(false)} disabled={saving}>
                {t('profile_cancel')}
              </button>
              <button className="profile__modal-save" onClick={handleSaveProfile} disabled={saving}>
                {saving
                  ? <><IconLoader2 size={15} strokeWidth={2} className="spin" /> {t('profile_saving')}</>
                  : <><IconCheck size={15} strokeWidth={2.5} /> {t('profile_save')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="profile__hero">
        <div className="profile__avatar-wrap">
          <img src={logoPrimary} alt="avatar" className="profile__avatar" />
          <span className="profile__avatar-badge">
            <IconCheck size={12} strokeWidth={3} color="#fff" />
          </span>
        </div>
        <h1 className="profile__name">{displayName}</h1>
        {formattedPhone && (
          <div className="profile__phone">{formattedPhone}</div>
        )}
        {displayAddress && (
          <div className="profile__location">
            <IconMapPin size={14} strokeWidth={2} color="var(--g-600)" />
            <span>{displayAddress}</span>
          </div>
        )}
        {displayBirthdate && (
          <div className="profile__birthdate">🎂 {displayBirthdate}</div>
        )}
        <div className="profile__status-badge">
          <span className="profile__status-dot" />
          {t('profile_active')}
        </div>
        <button className="profile__edit-btn" onClick={openEdit} type="button">
          <IconEdit size={14} strokeWidth={2} /> {t('profile_edit')}
        </button>
      </div>

      <div className="profile__scroll">

        {/* ── Settings Block ── */}
        <section className="profile__section">
          <div className="profile__section-header">
            <span className="profile__section-title">{t('profile_settings')}</span>
            <span className="profile__section-count">{t('profile_5_actions')}</span>
          </div>

          <div className="profile__card">
            <SettingsRow
              icon={IconBookmark}
              iconBg="var(--g-600)"
              title={t('profile_saved_plans')}
              subtitle={t('profile_saved_plans_sub')}
              onClick={() => onGoToSavedPlans?.()}
            />
            <div className="profile__divider" />
            <SettingsRow
              icon={IconTractor}
              iconBg="var(--g-700)"
              title={t('profile_my_land')}
              subtitle={t('profile_my_land_sub')}
              onClick={() => onGoToMyLand?.()}
            />
            <div className="profile__divider" />
            <SettingsRow
              icon={IconBuildingBank}
              iconBg="var(--saffron)"
              title={t('profile_bank')}
              subtitle={t('profile_bank_sub')}
              onClick={() => {}}
            />
          </div>
        </section>

        {/* ── Language ── */}
        <section className="profile__section">
          <div className="profile__card profile__card--lang">
            <div className="profile__lang-header">
              <div className="profile__row-icon" style={{ background: 'var(--g-100)' }}>
                <IconLanguage size={20} strokeWidth={2} color="var(--g-700)" />
              </div>
              <span className="profile__lang-title">{t('profile_language')} / भाषा</span>
            </div>
            <div className="profile__lang-pills">
              {LANGUAGES.map(({ key, label, flag, sub }) => (
                <button
                  key={key}
                  className={`profile__lang-pill${language === key ? ' profile__lang-pill--active' : ''}`}
                  onClick={() => handleLangChange(key)}
                >
                  <span className="profile__lang-flag">{flag}</span>
                  <span className="profile__lang-pill-labels">
                    <span className="profile__lang-pill-main">{label}</span>
                    <span className="profile__lang-pill-sub">{sub}</span>
                  </span>
                  {language === key && <IconCheck size={11} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Help ── */}
        <section className="profile__section">
          <button className="profile__help-card" type="button">
            <div className="profile__help-icon">
              <IconHeadset size={22} strokeWidth={2} color="#fff" />
            </div>
            <div>
              <div className="profile__help-title">{t('profile_help')}</div>
              <div className="profile__help-sub">{t('profile_help_sub')}</div>
            </div>
          </button>
        </section>

        {/* ── Logout ── */}
        <button className="profile__logout" onClick={logout} type="button">
          {t('profile_logout')}
        </button>

        <div className="profile__version">Chalo Kisaan v1.0.4</div>

        <div className="profile__bottom-pad" />
      </div>
    </div>
  );
}
