/**
 * PrimaryPlanContext
 * ------------------
 * Holds the user's "primary" farm plan — the one they want the AI assistant
 * to use as context for all conversations.
 *
 * Persistence strategy:
 * 1. localStorage for fast client-side access
 * 2. Backend DynamoDB for persistence across devices & auth refreshes
 * 3. Only authenticated users can access their saved plan
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const PrimaryPlanContext = createContext(null);

const API_BASE = process.env.REACT_APP_API_URL || '/api';

export function PrimaryPlanProvider({ children }) {
  const { isLoggedIn, profile } = useAuth();
  const [primaryPlan, setPrimaryPlanState] = useState(() => {
    try {
      const raw = localStorage.getItem('ck_primary_plan');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [lastUserId, setLastUserId] = useState(null);

  // Fetch primary plan from backend when user logs in OR user ID changes
  useEffect(() => {
    if (!isLoggedIn) {
      // Clear plan when logging out
      setPrimaryPlanState(null);
      localStorage.removeItem('ck_primary_plan');
      setLastUserId(null);
      return;
    }

    // Check if user ID changed (different user logged in)
    const currentUserId = profile?.sub;
    if (currentUserId && lastUserId && lastUserId !== currentUserId) {
      // User changed — clear the old plan immediately
      setPrimaryPlanState(null);
      localStorage.removeItem('ck_primary_plan');
    }
    
    setLastUserId(currentUserId);

    // Fetch from backend
    const fetchPrimaryPlan = async () => {
      try {
        const token = localStorage.getItem('idToken') || localStorage.getItem('cognito_token') || '';
        if (!token) return;

        const res = await fetch(`${API_BASE}/assistant/primary-plan`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) return;
        const data = await res.json();

        if (data.plan) {
          setPrimaryPlanState(data.plan);
          localStorage.setItem('ck_primary_plan', JSON.stringify(data.plan));
        }
      } catch (err) {
        console.error('[PrimaryPlanContext] Failed to fetch primary plan:', err);
      }
    };

    fetchPrimaryPlan();
  }, [isLoggedIn, profile?.sub]);

  const setPrimaryPlan = useCallback((plan) => {
    setPrimaryPlanState(plan);
    if (plan) {
      localStorage.setItem('ck_primary_plan', JSON.stringify(plan));
      
      // Save to backend if logged in
      if (isLoggedIn && plan.planId) {
        const saveToDynamo = async () => {
          try {
            const token = localStorage.getItem('idToken') || localStorage.getItem('cognito_token') || '';
            if (!token) return;

            await fetch(`${API_BASE}/assistant/primary-plan/set`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ plan_id: plan.planId }),
            });
          } catch (err) {
            console.error('[PrimaryPlanContext] Failed to save primary plan:', err);
          }
        };
        saveToDynamo();
      }
    } else {
      localStorage.removeItem('ck_primary_plan');
      
      // Clear from backend if logged in
      if (isLoggedIn) {
        const clearFromDynamo = async () => {
          try {
            const token = localStorage.getItem('idToken') || localStorage.getItem('cognito_token') || '';
            if (!token) return;

            await fetch(`${API_BASE}/assistant/primary-plan/clear`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
            });
          } catch (err) {
            console.error('[PrimaryPlanContext] Failed to clear primary plan:', err);
          }
        };
        clearFromDynamo();
      }
    }
  }, [isLoggedIn]);

  const clearPrimaryPlan = useCallback(() => {
    setPrimaryPlan(null);
  }, [setPrimaryPlan]);

  /**
   * Build a compact context string to inject into AI prompts.
   * Only includes the fields that are useful for the assistant.
   */
  const buildAssistantContext = useCallback(() => {
    if (!primaryPlan) return null;
    const p = primaryPlan.planData || {};
    const f = primaryPlan.farmData || {};

    const parts = [];

    // Farm basics
    if (f.location)  parts.push(`Farm location: ${f.location}`);
    if (f.landSize)  parts.push(`Land size: ${f.landSize} acres`);
    if (f.soilType)  parts.push(`Soil type: ${f.soilType}`);
    if (f.waterSource) parts.push(`Water source: ${f.waterSource}`);
    if (f.currentCrops) parts.push(`Current crops: ${f.currentCrops}`);

    // Plan summary
    if (p.recommendedService) parts.push(`Recommended service: ${p.recommendedService}`);
    if (p.suitabilityScore)   parts.push(`Suitability score: ${p.suitabilityScore}/100`);
    if (p.estimatedMonthlyIncome ?? p.monthlyIncome) {
      const income = p.estimatedMonthlyIncome ?? p.monthlyIncome;
      parts.push(`Estimated monthly income: ₹${income?.toLocaleString?.() ?? income}`);
    }
    if (p.activities?.length) {
      parts.push(`Planned activities: ${p.activities.join(', ')}`);
    }
    if (p.setupCost) parts.push(`Setup cost: ₹${p.setupCost?.toLocaleString?.() ?? p.setupCost}`);
    if (p.timeline)  parts.push(`Timeline: ${p.timeline}`);

    if (!parts.length) return null;

    return `[User's Primary Farm Plan]\n${parts.join('\n')}`;
  }, [primaryPlan]);

  return (
    <PrimaryPlanContext.Provider value={{ primaryPlan, setPrimaryPlan, clearPrimaryPlan, buildAssistantContext }}>
      {children}
    </PrimaryPlanContext.Provider>
  );
}

export function usePrimaryPlan() {
  const ctx = useContext(PrimaryPlanContext);
  if (!ctx) throw new Error('usePrimaryPlan must be used within PrimaryPlanProvider');
  return ctx;
}
