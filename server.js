require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = Number(process.env.PORT) || 3001;
const maxFileSize = 12 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 1 },
  fileFilter: (_request, file, done) => {
    const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (!supported.includes(file.mimetype)) {
      const error = new Error('Choose a JPG, PNG, WEBP, HEIC, or PDF file.');
      error.status = 415;
      return done(error);
    }
    done(null, true);
  },
});

const requestCounts = new Map();
app.use(cors({
  origin(origin, done) {
    const allowed = (process.env.APP_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((item) => item.trim());
    done(null, !origin || allowed.includes(origin));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use((request, response, next) => {
  const key = request.ip;
  const now = Date.now();
  const entry = requestCounts.get(key) || { startedAt: now, count: 0 };
  if (now - entry.startedAt >= 10 * 60 * 1000) { entry.startedAt = now; entry.count = 0; }
  entry.count += 1;
  requestCounts.set(key, entry);
  if (entry.count > 30) return response.status(429).json({ error: 'Too many requests. Please wait a few minutes before trying again.' });
  next();
});

async function getAI() {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('AI is not connected yet. Add GEMINI_API_KEY to your .env file and restart the server.');
    error.status = 503;
    throw error;
  }
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

async function generateJSON(ai, prompt, parts = []) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [...parts, prompt],
    config: { responseMimeType: 'application/json' },
  });
  const text = response.text;
  if (!text) throw new Error('The AI returned an empty response. Please try again.');
  try { return JSON.parse(text); }
  catch { throw new Error('The AI returned an unreadable response. Please try again.'); }
}

app.get('/api/health', (_request, response) => response.json({ ready: Boolean(process.env.GEMINI_API_KEY) }));

app.post('/api/analyze', upload.single('file'), async (request, response, next) => {
  try {
    const questionText = typeof request.body.question === 'string' ? request.body.question.trim() : '';
    const supportedLanguages = ['English', 'Hindi', 'Telugu'];
    const answerLanguage = supportedLanguages.includes(request.body.answerLanguage) ? request.body.answerLanguage : 'English';
    if (!questionText && !request.file) return response.status(400).json({ error: 'Add a question or choose an image or PDF first.' });
    if (questionText.length > 6000) return response.status(400).json({ error: 'Questions must be 6,000 characters or fewer.' });

    const ai = await getAI();
    const parts = request.file ? [{ inlineData: { mimeType: request.file.mimetype, data: request.file.buffer.toString('base64') } }] : [];
    const source = questionText ? `Typed question:\n${questionText}` : 'Read the uploaded image or PDF carefully. Extract its questions in reading order.';
    const analysis = await generateJSON(ai, `You are a careful question-reading and tutoring assistant. Preserve detected question text verbatim. Write the answer and explanation in ${answerLanguage}. ${source}
Return one JSON object only, using this shape:
{"readable":true,"detectedText":"verbatim question text including options","subject":"short subject","topic":"short topic","questionType":"MCQ, mathematics, coding, science, theory, or other","ocrConfidence":"high, medium, or low","answer":"the direct answer","explanation":"clear explanation","steps":["step 1"],"options":[{"label":"A","text":"...","correct":false}],"questions":[{"text":"question text","subject":"subject","topic":"topic"}]}
If the source is unreadable or has no question, set readable=false and leave answer/explanation blank. For a single question, include it in questions too. Never guess text obscured by the source. Use empty arrays when not applicable.`, parts);

    if (analysis.readable && analysis.answer) {
      const verification = await generateJSON(ai, `Independently check whether this proposed solution is correct and whether the explanation supports it. Do not solve by copying the stated answer. Return JSON only: {"verified":true,"confidence":"high|medium|low","note":"brief reason"}. If the question or solution is ambiguous, set verified=false and confidence="low".\nQuestion: ${analysis.detectedText}\nProposed answer: ${analysis.answer}\nExplanation: ${analysis.explanation}`);
      analysis.verification = verification;
    }
    response.json(analysis);
  } catch (error) { next(error); }
});

app.post('/api/chat', async (request, response, next) => {
  try {
    const { question, context, mode, answerLanguage = 'English' } = request.body || {};
    if (typeof question !== 'string' || !question.trim()) return response.status(400).json({ error: 'Type a question first.' });
    if (question.length > 2000) return response.status(400).json({ error: 'Please keep follow-up questions under 2,000 characters.' });
    const ai = await getAI();
    const result = await generateJSON(ai, `You are a patient study tutor. Reply in ${String(answerLanguage).slice(0, 30)}. Mode: ${String(mode || 'follow-up').slice(0, 30)}. Use the question context and do not invent facts. Return JSON only: {"answer":"helpful response"}.\nContext: ${JSON.stringify(context || {}).slice(0, 10000)}\nStudent asks: ${question.trim()}`);
    response.json(result);
  } catch (error) { next(error); }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ error: 'That file is larger than 12 MB. Choose a smaller file.' });
  }
  const status = error.status || 500;
  response.status(status).json({ error: status === 500 ? 'Something went wrong while analyzing the question. Please try again.' : error.message });
});

app.listen(port, () => console.log(`Question Scanner API listening on http://localhost:${port}`));
