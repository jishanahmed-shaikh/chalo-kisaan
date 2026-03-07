import React from 'react';
import {
  IconHome2, IconMapPin, IconBell, IconUser, IconMicrophone,
} from '@tabler/icons-react';
import { useLanguage } from '../context/LanguageContext';
import './BottomNav.css';

export default function BottomNav({ active, onNav, heroActive = false }) {
  const { t } = useLanguage();

  const TABS = [
    { key: 'home',      label: t('nav_home'),      Icon: IconHome2 },
    { key: 'my-land',   label: t('nav_my_land'),   Icon: IconMapPin },
    { key: 'assistant', label: t('nav_assistant'), Icon: IconMicrophone, hero: true },
    { key: 'requests',  label: t('nav_requests'),  Icon: IconBell },
    { key: 'profile',   label: t('nav_profile'),   Icon: IconUser },
  ];

  return (
    <nav className="bottom-nav safe-bottom" aria-label="Main navigation">
      {TABS.map(({ key, label, Icon, hero }) => (
        <button
          key={key}
          className={[
            'bottom-nav__item',
            hero              ? 'bottom-nav__item--hero'   : '',
            active === key    ? 'bottom-nav__item--active' : '',
            hero && heroActive ? 'bottom-nav__item--hero-listening' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => onNav(key)}
          aria-label={label}
        >
          <span className="bottom-nav__icon">
            <Icon size={hero ? 24 : 22} strokeWidth={active === key ? 2.2 : 1.8} />
          </span>
          {!hero && <span className="bottom-nav__label">{label}</span>}
        </button>
      ))}
    </nav>
  );
}
