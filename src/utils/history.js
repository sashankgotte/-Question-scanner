const storageKey = 'question-scanner-history-v1';

export function readHistory() {
  try {
    const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveHistoryItem(analysis) {
  const item = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    text: analysis.detectedText,
    subject: analysis.subject || 'Other',
    topic: analysis.topic || 'General',
    answer: analysis.answer || '',
    verified: Boolean(analysis.verification?.verified),
    analysis,
  };
  try {
    const history = readHistory();
    localStorage.setItem(storageKey, JSON.stringify([item, ...history].slice(0, 100)));
    return item;
  } catch {
    return null;
  }
}
