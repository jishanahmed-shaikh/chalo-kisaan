import React, { useState, useRef } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import OnboardingPage from './pages/OnboardingPage';
import VoiceAssistantPage from './pages/VoiceAssistantPage';
import MyLandPage from './pages/MyLandPage';
import SavedPlansPage from './pages/SavedPlansPage';
import BottomNav from './components/BottomNav';
import TopNav from './components/TopNav';
import InstallBanner from './components/InstallBanner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { useLocalStorage } from './hooks/useLocalStorage';
import './App.css';

// Pages that show persistent navigation (bottom on mobile, top on desktop)
const NAV_PAGES = ['home', 'my-land', 'assistant', 'requests', 'profile'];

function AppInner() {
  // ⚠️ ALL HOOKS MUST BE CALLED AT THE TOP, BEFORE ANY CONDITIONAL LOGIC
  const { isLoggedIn, profile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [planData,  setPlanData]  = useLocalStorage('ck_planData', null);
  const [farmData,  setFarmData]  = useLocalStorage('ck_farmData', null);
  const [farmImage, setFarmImage] = useLocalStorage('ck_farmImage', null);

  const [page, setPage] = useState('home');
  const [showLoginGate, setShowLoginGate] = useState(false);
  // Track whether onboarding has been dismissed this session
  const [onboardingDone, setOnboardingDone] = useLocalStorage('ck_onboarding_done', false);

  // Holds a reference to VoiceAssistantPage's mic-toggle function.
  // Registered by the page itself on mount via the onRegisterMicCallback prop.
  const assistantMicRef = useRef(null);
  // Tracks whether the assistant mic is currently active (for BottomNav hero highlight)
  const [micActive, setMicActive] = useState(false);

  // Unauthenticated flow
  if (!isLoggedIn) {
    if (showLoginGate) {
      return <LoginPage onBack={() => setShowLoginGate(false)} />;
    }
    return <LandingPage onStart={() => setShowLoginGate(true)} language={language} />;
  }

  // Show onboarding if profile has no name yet (first-time user)
  const needsOnboarding = !onboardingDone && (!profile?.given_name);
  if (needsOnboarding) {
    return <OnboardingPage onComplete={() => setOnboardingDone(true)} />;
  }

  /* ── Navigation helpers ── */
  const goTo = (p) => setPage(p);

  const handlePlanComplete = (plan, farm, image) => {
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
  };

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

      {/* ── Pages with persistent nav ── */}
      {page === 'home' && (
        <HomePage
          planData={planData}
          onGoToMyLand={() => setPage('my-land')}
          onSpeakToAI={() => setPage('assistant')}
          onViewDetails={() => setPage('my-land')}
        />
      )}

      {page === 'profile' && (
        <ProfilePage
          onGoToSavedPlans={() => setPage('saved-plans')}
          onGoToMyLand={() => setPage('my-land')}
          onGoToOnboarding={() => { setOnboardingDone(false); setPage('home'); }}
        />
      )}

      {page === 'assistant' && (
        <VoiceAssistantPage
          language={language}
          onBack={() => setPage('home')}
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
          onBack={() => setPage('home')}
        />
      )}

      {page === 'requests' && (
        <div className="app__placeholder">
          <div className="app__placeholder-inner">
            <span>🔔</span>
            <h2>Alerts</h2>
            <p>Booking requests and alerts coming soon.</p>
          </div>
        </div>
      )}

      {page === 'saved-plans' && (
        <SavedPlansPage
          onBack={() => setPage('profile')}
          onLoadPlan={(plan, farm) => {
            setPlanData(plan);
            setFarmData(farm);
            setPage('my-land');
          }}
        />
      )}

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
        <AppInner />
      </LanguageProvider>
    </AuthProvider>
  );
}
