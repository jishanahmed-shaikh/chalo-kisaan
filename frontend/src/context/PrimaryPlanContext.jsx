/**
 * PrimaryPlanContext
 * ------------------
 * Holds the user's "primary" farm plan — the one they want the AI assistant
 * to use as context for all conversations.
 *
 * Persisted to localStorage so it survives page refreshes.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const PrimaryPlanContext = createContext(null);

export function PrimaryPlanProvider({ children }) {
  const [primaryPlan, setPrimaryPlanState] = useState(() => {
    try {
      const raw = localStorage.getItem('ck_primary_plan');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const setPrimaryPlan = useCallback((plan) => {
    setPrimaryPlanState(plan);
    if (plan) {
      localStorage.setItem('ck_primary_plan', JSON.stringify(plan));
    } else {
      localStorage.removeItem('ck_primary_plan');
    }
  }, []);

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
