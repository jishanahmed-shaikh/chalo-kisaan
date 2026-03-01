const API_BASE = process.env.REACT_APP_API_URL || '/api';

export async function generatePlanStream(formData, onDelta, onComplete, onError) {
  try {
    const response = await fetch(`${API_BASE}/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Server error');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.type === 'delta') onDelta?.(payload.text);
          if (payload.type === 'complete') onComplete?.(payload.data);
          if (payload.type === 'error') onError?.(new Error(payload.message));
        } catch {}
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
    throw new Error(err.error || 'Image analysis failed');
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
    throw new Error(err.error || 'Visualization failed');
  }

  return response.json();
}

export async function parseVoiceTranscript(transcript) {
  const response = await fetch(`${API_BASE}/parse-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Voice parse failed');
  }

  return response.json();
}
