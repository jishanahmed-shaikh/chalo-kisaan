import React, { useState } from 'react';
import {
  IconLock, IconLoader2, IconArrowRight,
  IconShieldCheck, IconEye, IconEyeOff, IconUserPlus, IconLogin,
  IconArrowLeft,
} from '@tabler/icons-react';
import logoPrimary from '../assets/logo-primary.png';
import { authApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './LoginPage.css';

export default function LoginPage({ onBack }) {
  const { login } = useAuth();
  const { t } = useLanguage();

  // mode: 'login' | 'register'
  const [mode,     setMode]     = useState('login');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  const reset = (nextMode) => {
    setMode(nextMode);
    setPhone('');
    setPassword('');
    setConfirm('');
    setError('');
    setSuccess('');
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (phone.replace(/\D/g, '').length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.register(phone, password);
      setSuccess('Account created! Please log in.');
      setMode('login');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message || 'Could not create account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone || !password) {
      setError('Enter your phone number and password');
      return;
    }
    setLoading(true);
    try {
      const tokens = await authApi.login(phone, password);
      login(tokens);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      {onBack && (
        <button className="login__back-btn" onClick={onBack} aria-label="Go Back">
          <IconArrowLeft size={20} strokeWidth={2.5} />
          {t('common_back')}
        </button>
      )}
      <div className="login__card">

        {/* Logo */}
        <div className="login__logo">
          <img src={logoPrimary} alt="Chalo Kisaan" />
          <div>
            <div className="login__brand">Chalo Kisaan</div>
            <div className="login__brand-sub">Agritourism Platform for Farmers</div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="login__tabs">
          <button
            className={`login__tab${mode === 'login' ? ' login__tab--active' : ''}`}
            onClick={() => reset('login')}
            type="button"
          >
            <IconLogin size={15} strokeWidth={2.5} /> {t('login_submit')}
          </button>
          <button
            className={`login__tab${mode === 'register' ? ' login__tab--active' : ''}`}
            onClick={() => reset('register')}
            type="button"
          >
            <IconUserPlus size={15} strokeWidth={2.5} /> {t('login_register')}
          </button>
        </div>

        {success && <div className="login__success">{success}</div>}

        {/* ── Login form ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="login__form anim-fade-up">
            <h1 className="login__title">{t('home_greeting')}!</h1>
            <p className="login__sub">
              {t('login_submit')}.
            </p>

            {/* Phone */}
            <div className="login__field">
              <div className="login__phone-row">
                <span className="login__country-code">
                  <span className="login__flag">🇮🇳</span> +91
                </span>
                <input
                  className="login__phone-input"
                  type="tel"
                  inputMode="numeric"
                  placeholder="9876543210"
                  maxLength={10}
                  value={phone}
                  onChange={e => { setError(''); setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); }}
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="login__field">
              <div className="login__pwd-row">
                <IconLock size={17} strokeWidth={2} className="login__pwd-icon" />
                <input
                  className="login__pwd-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder={t('login_password')}
                  value={password}
                  onChange={e => { setError(''); setPassword(e.target.value); }}
                />
                <button type="button" className="login__pwd-toggle" onClick={() => setShowPwd(p => !p)}>
                  {showPwd ? <IconEyeOff size={17} strokeWidth={2} /> : <IconEye size={17} strokeWidth={2} />}
                </button>
              </div>
            </div>

            {error && <div className="login__error">{error}</div>}

            <button type="submit" className="login__btn" disabled={loading}>
              {loading
                ? <><IconLoader2 size={18} strokeWidth={2} className="spin" /> {t('login_signing_in')}</>
                : <>{t('login_submit')} <IconArrowRight size={18} strokeWidth={2} /></>
              }
            </button>

            <p className="login__disclaimer">
              <IconShieldCheck size={13} strokeWidth={2} />
              Your data is secure and private.
            </p>
          </form>
        )}

        {/* ── Register form ── */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="login__form anim-fade-up">
            <h1 className="login__title">{t('login_register')}</h1>
            <p className="login__sub">
              {t('login_no_account')}
            </p>

            {/* Phone */}
            <div className="login__field">
              <div className="login__phone-row">
                <span className="login__country-code">
                  <span className="login__flag">🇮🇳</span> +91
                </span>
                <input
                  className="login__phone-input"
                  type="tel"
                  inputMode="numeric"
                  placeholder="9876543210"
                  maxLength={10}
                  value={phone}
                  onChange={e => { setError(''); setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); }}
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="login__field">
              <div className="login__pwd-row">
                <IconLock size={17} strokeWidth={2} className="login__pwd-icon" />
                <input
                  className="login__pwd-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Create password (min 8 chars)"
                  value={password}
                  onChange={e => { setError(''); setPassword(e.target.value); }}
                />
                <button type="button" className="login__pwd-toggle" onClick={() => setShowPwd(p => !p)}>
                  {showPwd ? <IconEyeOff size={17} strokeWidth={2} /> : <IconEye size={17} strokeWidth={2} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="login__field">
              <div className="login__pwd-row">
                <IconLock size={17} strokeWidth={2} className="login__pwd-icon" />
                <input
                  className="login__pwd-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={e => { setError(''); setConfirm(e.target.value); }}
                />
              </div>
            </div>

            {error && <div className="login__error">{error}</div>}

            <button type="submit" className="login__btn" disabled={loading}>
              {loading
                ? <><IconLoader2 size={18} strokeWidth={2} className="spin" /> {t('login_signing_in')}</>
                : <>{t('login_register')} <IconArrowRight size={18} strokeWidth={2} /></>
              }
            </button>

            <p className="login__disclaimer">
              <IconShieldCheck size={13} strokeWidth={2} />
              We only use your number for login. No spam, ever.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
