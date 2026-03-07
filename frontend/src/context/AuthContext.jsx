/**
 * AuthContext — global auth state for Chalo Kisaan.
 *
 * Stores Cognito tokens in localStorage.
 * Exposes:  user, isLoggedIn, login(tokens), logout(), authHeader()
 *
 * authHeader() returns { Authorization: "Bearer <id_token>" }
 * Pass this to every authenticated API call.
 *
 * Token auto-refresh: when id_token is within 5 minutes of expiry,
 * the context silently calls /api/auth/refresh using the stored refresh_token.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi } from '../utils/api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'ck_auth';
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadStoredAuth);
  const refreshTimerRef = useRef(null);

  // Persist to localStorage whenever auth changes
  useEffect(() => {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [auth]);

  const logout = useCallback(() => {
    clearTimeout(refreshTimerRef.current);
    setAuth(null);
  }, []);

  const login = useCallback((tokens) => {
    // tokens = { id_token, access_token, refresh_token, expires_in, phone }
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    setAuth({ ...tokens, expiresAt, profile: null }); // profile fetched after login
  }, []);

  // Silent token refresh
  const silentRefresh = useCallback(async (currentAuth) => {
    if (!currentAuth?.refresh_token || !currentAuth?.phone) return;
    try {
      const res = await authApi.refresh(currentAuth.phone, currentAuth.refresh_token);
      if (res.success) {
        const expiresAt = Date.now() + res.expires_in * 1000;
        setAuth(prev => ({
          ...prev,
          id_token:     res.id_token,
          access_token: res.access_token,
          expiresAt,
        }));
      }
    } catch {
      // Refresh failed — user must log in again
      logout();
    }
  }, [logout]);

  // Schedule auto-refresh whenever auth.expiresAt changes
  useEffect(() => {
    clearTimeout(refreshTimerRef.current);
    if (!auth?.expiresAt) return;

    const msUntilRefresh = auth.expiresAt - Date.now() - REFRESH_BUFFER_MS;
    if (msUntilRefresh <= 0) {
      // Already expired or near expiry — refresh immediately
      silentRefresh(auth);
    } else {
      refreshTimerRef.current = setTimeout(() => silentRefresh(auth), msUntilRefresh);
    }

    return () => clearTimeout(refreshTimerRef.current);
  }, [auth?.expiresAt, silentRefresh]); // eslint-disable-line

  // Check dev bypass flag first
  const devBypass = process.env.REACT_APP_DEV_BYPASS_AUTH === 'true';
  const isLoggedIn = devBypass || Boolean(auth?.id_token && auth?.expiresAt > Date.now());

  // Fetch full profile from Cognito whenever we have a valid token but no profile yet
  useEffect(() => {
    if (!auth?.id_token || auth?.profile) return;
    const headers = { Authorization: `Bearer ${auth.id_token}` };
    authApi.getProfile(headers)
      .then(profile => {
        setAuth(prev => prev ? { ...prev, profile } : prev);
      })
      .catch(() => { /* silently ignore — profile stays null */ });
  }, [auth?.id_token, auth?.profile]); // eslint-disable-line

  const setProfile = useCallback((profile) => {
    setAuth(prev => prev ? { ...prev, profile } : prev);
  }, []);

  const authHeader = useCallback(() => {
    if (!auth?.id_token) return {};
    return { Authorization: `Bearer ${auth.id_token}` };
  }, [auth?.id_token]);

  return (
    <AuthContext.Provider value={{ auth, isLoggedIn, login, logout, authHeader, setProfile, user: auth, profile: auth?.profile || null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
