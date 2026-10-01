const apiOrigin = import.meta.env.VITE_API_ORIGIN || '';

async function readResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request failed. Please try again.');
  return result;
}

export async function analyzeQuestion({ file, question }) {
  const body = new FormData();
  if (file) body.append('file', file);
  if (question) body.append('question', question);
  return readResponse(await fetch(`${apiOrigin}/api/analyze`, { method: 'POST', body }));
}

export async function askAI({ question, context, mode, answerLanguage }) {
  return readResponse(await fetch(`${apiOrigin}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context, mode, answerLanguage }),
  }));
}

export async function checkHealth() {
  try {
    const response = await fetch(`${apiOrigin}/api/health`);
    return response.ok ? await response.json() : { ready: false };
  } catch {
    return { ready: false };
  }
}
