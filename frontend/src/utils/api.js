const API_BASE = process.env.REACT_APP_API_URL || '/api';

/**
 * Parse error body from FastAPI responses.
 */
function parseErrorMessage(errBody, fallback) {
  return errBody?.detail || errBody?.error || errBody?.message || fallback;
}

export async function generatePlanStream(formData, onDelta, onComplete, onError, onRaw, extraHeaders = {}) {
  try {
    // Backend /api/generate-plan accepts a flat FarmDataIn body
    const response = await fetch(`${API_BASE}/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(parseErrorMessage(err, 'Server error'));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    // Buffer incomplete SSE lines across TCP chunk boundaries
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines — only process complete events
      const events = buffer.split('\n\n');
      // Last element is either empty or an incomplete event — keep it in the buffer
      buffer = events.pop() ?? '';

      for (const event of events) {
        // An SSE event can span multiple "data:" lines — join them
        const dataLine = event
          .split('\n')
          .filter(l => l.startsWith('data: '))
          .map(l => l.slice(6))
          .join('');   // multi-line data fields are concatenated per SSE spec

        if (!dataLine) continue;

        try {
          const payload = JSON.parse(dataLine);
          if (payload.type === 'delta')    onDelta?.(payload.text);
          if (payload.type === 'complete') onComplete?.(payload.data);
          if (payload.type === 'raw')      onRaw?.(payload.text);
          if (payload.type === 'error')    onError?.(new Error(payload.message));
        } catch {
          // Ignore unparseable frames
        }
      }
    }
  } catch (err) {
    onError?.(err);
  }
}

export async function analyzeImage(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch(`${API_BASE}/analyze-image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Image analysis failed'));
  }

  return response.json();
}

export async function generateVisualization(farmData, planData) {
  const response = await fetch(`${API_BASE}/generate-visualization`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farmData, planData }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Visualization failed'));
  }

  return response.json();
}

export async function parseVoiceTranscript(transcript, language = 'hindi') {
  const response = await fetch(`${API_BASE}/parse-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, language }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Voice parse failed'));
  }

  return response.json();
}

export async function visualizeLand(imageBase64, services, farmData, mode = 'transform', planSummary = '') {
  const response = await fetch(`${API_BASE}/visualize-land`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, services, farmData, mode, planSummary }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Land visualization failed'));
  }

  return response.json();
}

// ── Report API (new) ──────────────────────────────────────────

export async function createReport(farmData, planData, language, farmImageBase64 = null) {
  const response = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farmData, planData, language, farmImageBase64 }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Failed to save report'));
  }

  return response.json();
}

export async function getReport(reportId) {
  const response = await fetch(`${API_BASE}/reports/${reportId}`);

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Report not found'));
  }

  return response.json();
}

export async function saveVisualization(reportId, imageBase64, services = [], mode = 'transform') {
  const response = await fetch(`${API_BASE}/reports/${reportId}/visualizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, services, mode }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Failed to save visualization'));
  }

  return response.json();
}

// ── Legacy (kept for backwards compat) ────────────────────────

export async function savePlan(farmData, planData, language = 'hindi') {
  const response = await fetch(`${API_BASE}/save-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farmData, planData, language }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Save failed'));
  }

  return response.json();
}

export async function loadPlan(planId) {
  const response = await fetch(`${API_BASE}/plans/${planId}`);

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Plan not found'));
  }

  return response.json();
}

export async function fetchSavedPlans(extraHeaders = {}) {
  const response = await fetch(`${API_BASE}/plans`, {
    headers: { ...extraHeaders },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Failed to fetch plans'));
  }

  return response.json(); // { success, plans: [...] }
}

export async function deleteSavedPlan(planId, extraHeaders = {}) {
  const response = await fetch(`${API_BASE}/plans/${planId}`, {
    method: 'DELETE',
    headers: { ...extraHeaders },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(parseErrorMessage(err, 'Failed to delete plan'));
  }

  return response.json();
}

// ── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  /** Sign up — create account with phone + password + profile. Returns { success, message } */
  async register(phone, password, profile = {}) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        password,
        given_name:  profile.given_name  || '',
        family_name: profile.family_name || '',
        birthdate:   profile.birthdate   || '',
        address:     profile.address     || '',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(parseErrorMessage(data, 'Could not create account'));
    return data;
  },

  /** Log in with phone + password. Returns { id_token, access_token, refresh_token, expires_in, phone } */
  async login(phone, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(parseErrorMessage(data, 'Login failed'));
    return data;
  },

  /** Silent refresh — returns { id_token, access_token, expires_in } */
  async refresh(phone, refreshToken) {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, refresh_token: refreshToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(parseErrorMessage(data, 'Session expired'));
    return data;
  },

  /** Fetch the authenticated user's full profile from Cognito */
  async getProfile(authHeaders) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(parseErrorMessage(data, 'Could not fetch profile'));
    return data;
  },

  /** Update profile attributes */
  async updateProfile(profileData, authHeaders) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(profileData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(parseErrorMessage(data, 'Could not update profile'));
    return data;
  },
};

// Helper to inject auth header into generatePlanStream
export async function generatePlanStreamAuth(formData, authHeader, onDelta, onComplete, onError, onRaw) {
  return generatePlanStream(formData, onDelta, onComplete, onError, onRaw, authHeader);
}

/**
 * Context-aware AI Assistant chat — streams response as SSE.
 * POST /api/assistant/chat
 */
export async function assistantChat(message, language, history, onDelta, onComplete, onError, extraHeaders = {}, location = null) {
  try {
    const body = { message, language, history };
    if (location) body.location = location;

    // Use AbortController for a 30-second timeout on the initial connection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(`${API_BASE}/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errMsg = `Server error (${response.status})`;
      try {
        const err = await response.json();
        errMsg = parseErrorMessage(err, errMsg);
      } catch { /* ignore parse errors */ }
      throw new Error(errMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const dataLine = event
          .split('\n')
          .filter(l => l.startsWith('data: '))
          .map(l => l.slice(6))
          .join('');

        if (!dataLine) continue;

        try {
          const payload = JSON.parse(dataLine);
          if (payload.type === 'delta')    onDelta?.(payload.text);
          if (payload.type === 'complete') onComplete?.(payload.text);
          if (payload.type === 'error')    onError?.(new Error(payload.message));
        } catch {
          // Ignore unparseable frames
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      onError?.(new Error('Request timed out. Please check your connection and try again.'));
    } else {
      onError?.(err);
    }
  }
}
