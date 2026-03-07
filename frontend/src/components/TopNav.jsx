/**
 * TopNav — Desktop/web horizontal navigation bar.
 * Shown ONLY on screens ≥ 768px (hidden on mobile via CSS).
 * On mobile the BottomNav handles navigation instead.
 */
import React, { useState } from 'react';
import {
  IconHome2, IconMapPin, IconBell, IconUser,
  IconMicrophone, IconMenu2, IconX,
} from '@tabler/icons-react';
import { useLanguage } from '../context/LanguageContext';
import logoPrimary from '../assets/logo-primary.png';
import './TopNav.css';

export default function TopNav({ active, onNav }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLanguage();

  const TABS = [
    { key: 'home',      label: t('nav_home'),         Icon: IconHome2 },
    { key: 'my-land',   label: t('nav_my_land'),       Icon: IconMapPin },
    { key: 'assistant', label: t('assistant_title'),   Icon: IconMicrophone },
    { key: 'requests',  label: t('nav_requests'),      Icon: IconBell },
    { key: 'profile',   label: t('nav_profile'),       Icon: IconUser },
  ];

  const handleNav = (key) => {
    onNav(key);
    setMenuOpen(false);
  };

  return (
    <nav className="top-nav" aria-label="Main navigation">
      {/* Brand */}
      <div className="top-nav__brand" onClick={() => handleNav('home')} role="button" tabIndex={0}>
        <img src={logoPrimary} alt="Chalo Kisaan" className="top-nav__logo" />
        <span className="top-nav__brand-name">Chalo Kisaan</span>
      </div>

      {/* Desktop links */}
      <ul className="top-nav__links">
        {TABS.map(({ key, label, Icon }) => (
          <li key={key}>
            <button
              className={`top-nav__link${active === key ? ' top-nav__link--active' : ''}`}
              onClick={() => handleNav(key)}
            >
              <Icon size={18} strokeWidth={active === key ? 2.2 : 1.8} />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Mobile hamburger (only renders on small screens via CSS) */}
      <button
        className="top-nav__hamburger"
        onClick={() => setMenuOpen(p => !p)}
        aria-label={menuOpen ? t('common_close') : 'Open menu'}
      >
        {menuOpen ? <IconX size={22} strokeWidth={2} /> : <IconMenu2 size={22} strokeWidth={1.8} />}
      </button>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="top-nav__mobile-menu">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`top-nav__mobile-link${active === key ? ' top-nav__mobile-link--active' : ''}`}
              onClick={() => handleNav(key)}
            >
              <Icon size={20} strokeWidth={active === key ? 2.2 : 1.8} />
              {label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
