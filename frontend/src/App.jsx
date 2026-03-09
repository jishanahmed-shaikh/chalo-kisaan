import React, { useState, useRef, useCallback } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import OnboardingPage from './pages/OnboardingPage';
import VoiceAssistantPage from './pages/VoiceAssistantPage';
import MyLandPage from './pages/MyLandPage';
import SavedPlansPage from './pages/SavedPlansPage';
import AlertsPage from './pages/AlertsPage';
import BottomNav from './components/BottomNav';
import TopNav from './components/TopNav';
import InstallBanner from './components/InstallBanner';
import PrimaryPlanBanner from './components/PrimaryPlanBanner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { PrimaryPlanProvider } from './context/PrimaryPlanContext';
import { useLocalStorage } from './hooks/useLocalStorage';
import './App.css';

// Pages that show persistent navigation (bottom on mobile, top on desktop)
const NAV_PAGES = ['home', 'my-land', 'assistant', 'requests', 'profile'];

// Tab order for slide direction detection
const TAB_ORDER = ['home', 'my-land', 'assistant', 'requests', 'profile'];

function AppInner() {
  // ⚠️ ALL HOOKS MUST BE CALLED AT THE TOP, BEFORE ANY CONDITIONAL LOGIC
  const { isLoggedIn, profile, isGuest } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [planData,  setPlanData]  = useLocalStorage('ck_planData', null);
  const [farmData,  setFarmData]  = useLocalStorage('ck_farmData', null);
  const [farmImage, setFarmImage] = useLocalStorage('ck_farmImage', null);

  const [page, setPage] = useState('home');
  const [slideDir, setSlideDir] = useState('none'); // 'left' | 'right' | 'none'
  const [showLoginGate, setShowLoginGate] = useState(false);
  // Track whether onboarding has been dismissed this session
  const [onboardingDone, setOnboardingDone] = useLocalStorage('ck_onboarding_done', false);

  // Holds a reference to VoiceAssistantPage's mic-toggle function.
  // Registered by the page itself on mount via the onRegisterMicCallback prop.
  const assistantMicRef = useRef(null);
  // Tracks whether the assistant mic is currently active (for BottomNav hero highlight)
  const [micActive, setMicActive] = useState(false);

  /* ── Navigation helpers ── */
  const goTo = useCallback((p) => {
    const fromIdx = TAB_ORDER.indexOf(page);
    const toIdx   = TAB_ORDER.indexOf(p);
    if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
      setSlideDir(toIdx > fromIdx ? 'left' : 'right');
    } else {
      setSlideDir('none');
    }
    setPage(p);
  }, [page]);

  const handlePlanComplete = useCallback((plan, farm, image) => {
    setPlanData(plan);
    setFarmData(farm);
    if (image && image.startsWith('blob:')) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 800;
        const scale = Math.min(1, maxW / img.width);
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setFarmImage(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = image;
    } else {
      setFarmImage(image);
    }
    if (farm?.language) setLanguage(farm.language);
    setPage('my-land'); // Route to My Land to show the rich plan view
  }, [setPlanData, setFarmData, setFarmImage, setLanguage]);

  // Unauthenticated flow
  if (!isLoggedIn) {
    if (showLoginGate) {
      return <LoginPage onBack={() => setShowLoginGate(false)} />;
    }
    return <LandingPage onStart={() => setShowLoginGate(true)} language={language} />;
  }

  // Show onboarding if profile has no name yet (first-time user) — guests skip this
  const needsOnboarding = !onboardingDone && !isGuest && (!profile?.given_name);
  if (needsOnboarding) {
    return <OnboardingPage onComplete={() => setOnboardingDone(true)} />;
  }

  const showNav = NAV_PAGES.includes(page);

  // Resolve which nav tab is "active"
  const activeNav =
    page === 'home'      ? 'home'      :
    page === 'my-land'   ? 'my-land'   :
    page === 'assistant' ? 'assistant' :
    page === 'requests'  ? 'requests'  :
    page === 'profile'   ? 'profile'   : '';

  const handleNavTab = (tab) => {
    if (tab === 'assistant' && page === 'assistant') {
      // Already on assistant page — trigger the mic directly
      assistantMicRef.current?.();
    } else {
      goTo(tab);
    }
  };

  return (
    <div className={`app${showNav ? ' app--with-nav' : ''}`}>

      {/* ── Desktop TopNav (hidden on mobile via CSS) ── */}
      {showNav && (
        <TopNav active={activeNav} onNav={handleNavTab} />
      )}

      {/* ── Primary Plan Banner — shown on all main nav pages ── */}
      {showNav && (
        <PrimaryPlanBanner onViewPlan={() => goTo('my-land')} />
      )}

      {/* ── Pages with persistent nav, wrapped in slide-transition container ── */}
      <div
        key={page}
        className={`app__page-slide${slideDir !== 'none' ? ` app__page-slide--${slideDir}` : ''}`}
        onAnimationEnd={() => setSlideDir('none')}
      >

      {page === 'home' && (
        <HomePage
          planData={planData}
          farmImage={farmImage}
          onGoToMyLand={() => goTo('my-land')}
          onSpeakToAI={() => goTo('assistant')}
          onViewDetails={() => goTo('my-land')}
        />
      )}

      {page === 'profile' && (
        <ProfilePage
          onGoToSavedPlans={() => setPage('saved-plans')}
          onGoToMyLand={() => goTo('my-land')}
          onGoToOnboarding={() => { setOnboardingDone(false); goTo('home'); }}
        />
      )}

      {page === 'assistant' && (
        <VoiceAssistantPage
          language={language}
          onBack={() => goTo('home')}
          onRegisterMicCallback={(fn) => { assistantMicRef.current = fn; }}
          onListeningChange={setMicActive}
        />
      )}

      {page === 'my-land' && (
        <MyLandPage
          initialPlanData={planData}
          initialFarmData={farmData}
          initialFarmImage={farmImage}
          onPlanReady={(plan, farm, image) => {
            handlePlanComplete(plan, farm, image);
          }}
          onBack={() => goTo('home')}
        />
      )}

      {page === 'requests' && (
        <AlertsPage onBack={() => goTo('home')} />
      )}

      {page === 'saved-plans' && (
        <SavedPlansPage
          onBack={() => setPage('profile')}
          onLoadPlan={(plan, farm) => {
            setPlanData(plan);
            setFarmData(farm);
            goTo('my-land');
          }}
        />
      )}

      </div>{/* end app__page-slide */}

      {/* ── Mobile Bottom Nav (hidden on desktop via CSS) ── */}
      {showNav && (
        <BottomNav
          active={activeNav}
          onNav={handleNavTab}
          heroActive={micActive}
        />
      )}

      <InstallBanner />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <PrimaryPlanProvider>
          <AppInner />
        </PrimaryPlanProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
