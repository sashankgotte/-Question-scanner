import { useEffect, useRef, useState } from 'react';
import {
  Aperture, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown,
  ChevronRight, CircleHelp, Clock3, CloudUpload, FileText, Focus, GraduationCap,
  History as HistoryIcon, Languages, Lightbulb, ListFilter, LoaderCircle, LockKeyhole,
  Menu, MessageCircle, Mic, RotateCcw, ScanLine, Search, Send, ShieldCheck, Sparkles,
  Target, TrendingUp, Volume2, X, Zap, Crop,
} from 'lucide-react';
import { analyzeQuestion, askAI, checkHealth } from './services/api.js';
import { readHistory, saveHistoryItem } from './utils/history.js';

const subjects = ['All subjects', 'Mathematics', 'Programming', 'Science', 'English', 'Reasoning', 'Aptitude', 'Other'];

export default function App() {
  const [view, setView] = useState('home');
  const [history, setHistory] = useState(readHistory);
  const [analysis, setAnalysis] = useState(null);
  const [typed, setTyped] = useState('');
  const [composer, setComposer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [apiReady, setApiReady] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [cropPhoto, setCropPhoto] = useState(false);
  const [flashAvailable, setFlashAvailable] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState('English');
  const [filter, setFilter] = useState('All subjects');
  const [search, setSearch] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => { checkHealth().then((health) => setApiReady(health.ready)); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => () => stopCamera(), []);

  async function analyze(payload) {
    setError(''); setAnalysis(null); setView('home'); setBusy(true); setComposer(false); setStatus('Reading your question');
    const steps = ['Reading your question', 'Understanding the subject', 'Working through the solution', 'Checking the answer'];
    let index = 0;
    const timer = window.setInterval(() => { index = Math.min(index + 1, steps.length - 1); setStatus(steps[index]); }, 2200);
    try {
      const result = await analyzeQuestion({ ...payload, answerLanguage: language });
      if (!result.readable || !result.answer) {
        setAnalysis(result);
        setError('Question could not be read clearly. Try a sharper image or type the question instead.');
        return false;
      } else {
        setAnalysis(result); setView('answer'); setChatMessages([]);
        saveHistoryItem(result); setHistory(readHistory()); setApiReady(true);
        return true;
      }
    } catch (cause) {
      setError(cause.message);
      if (cause.message.includes('GEMINI_API_KEY') || cause.message.includes('Failed to fetch')) setApiReady(false);
      return false;
    } finally { window.clearInterval(timer); setBusy(false); setStatus(''); }
  }

  function chooseFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const pdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!pdf && !['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type)) {
      setError('Choose a JPG, PNG, WEBP, HEIC, or PDF file.'); return;
    }
    if (file.size > 12 * 1024 * 1024) { setError('That file is larger than 12 MB. Choose a smaller file.'); return; }
    analyze({ file: pdf && file.type !== 'application/pdf' ? new File([file], file.name, { type: 'application/pdf' }) : file });
  }

  async function openCamera() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access is unavailable in this browser. Upload an image instead.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream; setPhoto(null); setRotated(false); setCropPhoto(false); setFlashOn(false);
      setFlashAvailable(Boolean(stream.getVideoTracks()[0].getCapabilities?.().torch)); setCameraOpen(true);
      window.setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 50);
    } catch { setError('Camera permission was denied or no camera was found. Upload an image or type your question instead.'); }
  }

  function stopCamera() { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraOpen(false); }

  async function toggleFlash() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !flashAvailable) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !flashOn }] }); setFlashOn(!flashOn);
    } catch { setError('Flash control is unavailable on this camera.'); }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) { setError('The camera is still starting. Please try again.'); return; }
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (rotated) { context.translate(canvas.width, canvas.height); context.rotate(Math.PI); }
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
        setPhoto({ file: new File([blob], 'question-scan.jpg', { type: 'image/jpeg' }), url: URL.createObjectURL(blob) });
        setRotated(false);
      }
    }, 'image/jpeg', 0.92);
  }

  async function analyzeCapture() {
    if (!photo?.file) return;
    try {
      let file = photo.file;
      if (cropPhoto) {
        const image = await createImageBitmap(file);
        const left = Math.round(image.width * 0.12); const top = Math.round(image.height * 0.13);
        const width = Math.round(image.width * 0.76); const height = Math.round(image.height * 0.74);
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(image, left, top, width, height, 0, 0, width, height);
        image.close();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        if (blob) file = new File([blob], 'question-crop.jpg', { type: 'image/jpeg' });
      }
      URL.revokeObjectURL(photo.url); stopCamera(); analyze({ file });
    } catch {
      setError('The photo could not be prepared. Retake the photo or upload an image instead.');
    }
  }

  async function rotatePhoto() {
    if (!photo?.file) { setRotated(!rotated); return; }
    try {
      const image = await createImageBitmap(photo.file);
      const canvas = document.createElement('canvas'); canvas.width = image.height; canvas.height = image.width;
      const context = canvas.getContext('2d'); context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(Math.PI / 2); context.drawImage(image, -image.width / 2, -image.height / 2);
      image.close();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (blob) {
        URL.revokeObjectURL(photo.url);
        setPhoto({ file: new File([blob], 'question-rotated.jpg', { type: 'image/jpeg' }), url: URL.createObjectURL(blob) });
      }
    } catch { setError('The photo could not be rotated. Try capturing it again.'); }
  }

  function retakePhoto() {
    URL.revokeObjectURL(photo?.url); setPhoto(null); setRotated(false); setCropPhoto(false); openCamera();
  }

  async function ask(question, mode = 'follow-up') {
    if (!question.trim()) return;
    const prompt = question.trim(); setChatInput('');
    setChatMessages((messages) => [...messages, { role: 'user', text: prompt }, { role: 'assistant', text: '', loading: true }]);
    try {
      const result = await askAI({ question: prompt, context: analysis, mode, answerLanguage: language });
      setChatMessages((messages) => [...messages.slice(0, -1), { role: 'assistant', text: result.answer }]);
    } catch (cause) {
      setChatMessages((messages) => [...messages.slice(0, -1), { role: 'assistant', text: cause.message, error: true }]);
    }
  }

  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('Voice input is not supported by this browser. Type your question instead.'); return; }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = { English: 'en-US', Hindi: 'hi-IN', Telugu: 'te-IN' }[language];
      recognition.interimResults = false; recognition.maxAlternatives = 1;
      recognition.onresult = (event) => setChatInput(event.results[0][0].transcript);
      recognition.onerror = () => setError('Voice input could not be captured. Check microphone permission and try again.');
      recognition.onend = () => setListening(false);
      recognition.start(); setListening(true);
    } catch { setListening(false); setError('Voice input could not be started. Check microphone permission and try again.'); }
  }

  function editQuestion() {
    setTyped(analysis?.detectedText || ''); setComposer(true); setAnalysis(null); setView('home');
  }

  function openHistory(item) { setAnalysis(item.analysis); setView('answer'); setChatMessages([]); }

  const filteredHistory = history.filter((item) =>
    (filter === 'All subjects' || item.subject.toLowerCase().includes(filter.toLowerCase())) &&
    `${item.text} ${item.subject} ${item.topic}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => { setView('home'); setAnalysis(null); setMobileNav(false); }} aria-label="Question Scanner home"><span className="brand-mark"><ScanLine size={22} /></span><span className="brand-name">question<span>scanner</span></span></button>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Main navigation">
        <button className={`nav-link ${view === 'home' || view === 'answer' ? 'active' : ''}`} onClick={() => { setView('home'); setAnalysis(null); setMobileNav(false); }}><Aperture size={18} /><span>Scanner</span><span className="nav-shortcut">01</span></button>
        <button className={`nav-link ${view === 'history' ? 'active' : ''}`} onClick={() => { setView('history'); setMobileNav(false); }}><HistoryIcon size={18} /><span>History</span><span className="nav-count">{history.length}</span></button>
        <button className={`nav-link ${view === 'progress' ? 'active' : ''}`} onClick={() => { setView('progress'); setMobileNav(false); }}><TrendingUp size={18} /><span>Your progress</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="privacy-card"><LockKeyhole size={15} /><div><strong>Private by design</strong><p>Images aren’t saved after analysis.</p></div></div><div className="sidebar-footer"><i className={`status-dot ${apiReady ? 'online' : ''}`} />{apiReady ? 'AI ready to help' : 'AI connection needed'}<CircleHelp size={14} className="status-help" /></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{view === 'answer' ? 'Your answer' : view === 'history' ? 'History' : view === 'progress' ? 'Your progress' : 'Question scanner'}</strong></div><div className="topbar-actions"><div className="language-select"><Languages size={15} /><select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Answer language"><option>English</option><option>Hindi</option><option>Telugu</option></select><ChevronDown size={13} /></div><span className="topbar-divider" /><button className="avatar" aria-label="Student profile">S</button></div></header>
      <div className="page-content">
        {error && <div className="alert-banner" role="alert"><CircleHelp size={18} /><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Dismiss message"><X size={16} /></button></div>}
        {view === 'home' && <HomeView busy={busy} status={status} apiReady={apiReady} onCamera={openCamera} onUpload={() => fileRef.current?.click()} onPDF={() => fileRef.current?.click()} onType={() => setComposer(!composer)} composer={composer} typed={typed} setTyped={setTyped} onSubmit={() => analyze({ question: typed })} />}
        {view === 'answer' && analysis && <AnswerView analysis={analysis} answerLanguage={language} onEdit={editQuestion} onSolveQuestion={(question) => analyze({ question })} onSolveAll={async (questions) => { for (const question of questions) { if (!await analyze({ question: question.text })) break; } }} onTeach={() => { setChatOpen(true); ask('Teach me the concept behind this question. Explain what idea is being tested and how to solve similar questions.', 'teach'); }} onChat={() => setChatOpen(true)} onPractice={() => { setChatOpen(true); ask('Give me a new practice question that tests the same concept. Do not include the answer yet.', 'practice'); }} onAsk={ask} />}
        {view === 'history' && <HistoryView items={filteredHistory} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} onOpen={openHistory} />}
        {view === 'progress' && <ProgressView history={history} onOpenHistory={() => setView('history')} />}
      </div>
    </main>

    <input ref={fileRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf" onChange={chooseFile} />
    {cameraOpen && <CameraModal videoRef={videoRef} photo={photo} rotated={rotated} cropPhoto={cropPhoto} setCropPhoto={setCropPhoto} flashAvailable={flashAvailable} flashOn={flashOn} onFlash={toggleFlash} onRotate={rotatePhoto} onRetake={retakePhoto} onClose={() => { if (photo?.url) URL.revokeObjectURL(photo.url); stopCamera(); }} onCapture={capturePhoto} onAnalyze={analyzeCapture} onUpload={() => { if (photo?.url) URL.revokeObjectURL(photo.url); stopCamera(); fileRef.current?.click(); }} />}
    {chatOpen && <ChatPanel messages={chatMessages} input={chatInput} setInput={setChatInput} listening={listening} onVoice={startVoiceInput} onSend={ask} onClose={() => setChatOpen(false)} endRef={chatEndRef} />}
  </div>;
}

function HomeView({ busy, status, apiReady, onCamera, onUpload, onPDF, onType, composer, typed, setTyped, onSubmit }) {
  return <>
    <section className="hero"><div className="hero-copy"><span className="eyebrow"><i /> YOUR PERSONAL STUDY SPACE</span><h1>Hard question?<br /><span>Let’s figure it out.</span></h1><p>Scan it, solve it, really understand it. One question at a time.</p></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-outer" /><div className="orbit orbit-inner" /><div className="orbit-center"><ScanLine size={27} /></div><i className="orbit-dot dot-one" /><i className="orbit-dot dot-two" /><i className="orbit-dot dot-three" /><span className="orbit-label">THINK CLEARER</span></div><span className="hero-index">01 <i>/ 04</i></span></section>
    <section className="scanner-section"><header className="section-heading"><div><span className="section-kicker">GET STARTED</span><h2>Bring us a question</h2><p>We’ll help you go from “huh?” to “got it.”</p></div><span className="workflow-label"><Sparkles size={13} /> SCAN · UNDERSTAND · LEARN</span></header>
      <div className="input-grid"><button className="scan-primary" onClick={onCamera} disabled={busy}><span className="scan-icon"><Focus size={23} /></span><span className="scan-card-copy"><strong>Scan a question</strong><small>Use your camera to capture it</small></span><ArrowRight className="scan-arrow" size={18} /><span className="camera-label">CAMERA</span></button><button className="input-option" onClick={onUpload} disabled={busy}><span className="option-icon upload-icon"><CloudUpload size={20} /></span><span><strong>Upload an image</strong><small>JPG, PNG, WEBP · up to 12 MB</small></span><ArrowUpRight className="option-arrow" size={16} /></button><button className="input-option" onClick={onPDF} disabled={busy}><span className="option-icon pdf-icon"><FileText size={20} /></span><span><strong>Upload a PDF</strong><small>Question pages from a document</small></span><ArrowUpRight className="option-arrow" size={16} /></button><button className="input-option" onClick={onType} disabled={busy}><span className="option-icon type-icon"><BookOpen size={19} /></span><span><strong>Type a question</strong><small>Paste text or write it out</small></span><ArrowUpRight className="option-arrow" size={16} /></button></div>
      {composer && <form className="question-composer" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><label htmlFor="question-input">YOUR QUESTION</label><textarea id="question-input" value={typed} onChange={(event) => setTyped(event.target.value)} placeholder="Type or paste your question here..." autoFocus maxLength={6000} /><div className="composer-bottom"><span>{typed.length} / 6,000</span><button className="button-dark" type="submit" disabled={!typed.trim() || busy}><Sparkles size={16} /> Understand question</button></div></form>}
      {busy && <div className="analysis-progress" aria-live="polite"><span className="progress-scan-icon"><LoaderCircle size={20} className="spin" /></span><div><strong>{status || 'Getting started...'}</strong><p>Reading carefully and checking the solution before we show it.</p></div><div className="progress-track"><i /></div></div>}
    </section>
    <section className="bottom-row"><div className="how-card"><div className="bottom-title"><span className="section-kicker">MADE FOR THE “WHY?”</span><BookOpen size={18} /></div><div className="how-steps"><span><i>01</i> Read</span><ChevronRight size={13} /><span><i>02</i> Reason</span><ChevronRight size={13} /><span><i>03</i> Verify</span><ChevronRight size={13} /><span><i>04</i> Learn</span></div><p>Answers come with explanations. Every time.</p></div><div className={`connection-card ${apiReady ? 'connected' : ''}`}><span className="connection-icon">{apiReady ? <Check size={17} /> : <Sparkles size={17} />}</span><div><strong>{apiReady ? 'Your AI tutor is connected' : 'Ready when you are'}</strong><p>{apiReady ? 'Ask follow-ups and explore the “why.”' : 'Connect the AI service to start scanning.'}</p></div><i className="connection-dot" /></div></section>
    <footer className="page-footer"><span>SCAN · UNDERSTAND · SOLVE · LEARN</span><span><ShieldCheck size={13} /> Your uploads are processed, not stored.</span></footer>
  </>;
}

function AnswerView({ analysis, answerLanguage, onEdit, onSolveQuestion, onSolveAll, onTeach, onChat, onPractice, onAsk }) {
  const uncertain = analysis.ocrConfidence === 'low' || analysis.verification?.confidence === 'low' || analysis.verification?.verified === false;
  return <div className="answer-page"><button className="back-link" onClick={onEdit}><ArrowLeft size={15} /> Your question</button><header className="answer-head"><div><span className="section-kicker">QUESTION ANALYSIS</span><h1>Here’s what we found.</h1></div><span className={`confidence-pill ${uncertain ? 'confidence-low' : ''}`}><i />{uncertain ? 'Needs a closer look' : 'Answer checked'}</span></header>
    {uncertain && <div className="confidence-warning"><CircleHelp size={18} /><div><strong>We’re not fully confident in this answer.</strong><p>{analysis.verification?.note || 'Part of the question may be unclear. Please check the extracted text before relying on the solution.'}</p></div><button onClick={onEdit}>Edit question</button></div>}
    {analysis.questions?.length > 1 && <section className="detected-questions"><header><span className="section-kicker">QUESTIONS FOUND</span><button className="solve-all-button" onClick={() => onSolveAll(analysis.questions)}><Sparkles size={14} /> Solve all</button></header>{analysis.questions.map((question, index) => <div key={index}><b>{String(index + 1).padStart(2, '0')}</b><span>{question.text}</span><button className="solve-one-button" onClick={() => onSolveQuestion(question.text)}>Solve <ArrowRight size={13} /></button></div>)}</section>}
    <article className="question-card"><header><span className="question-card-label"><ScanLine size={15} /> DETECTED QUESTION</span><button className="edit-button" onClick={onEdit}>Edit <ArrowUpRight size={14} /></button></header><p>{analysis.detectedText}</p><footer><span>{analysis.subject || 'General'} <i>·</i> {analysis.topic || 'Question'}</span><span className={`read-confidence ${analysis.ocrConfidence === 'low' ? 'read-low' : ''}`}><Target size={13} /> Reading confidence: {analysis.ocrConfidence || 'not provided'}</span></footer></article>
    {analysis.options?.length > 0 && <section className="answer-options"><span className="section-kicker">ANSWER OPTIONS</span><div className="option-list">{analysis.options.map((option, index) => <div key={option.label || index} className={`answer-option ${option.correct ? 'option-correct' : ''}`}><span className="answer-option-label">{option.label || String.fromCharCode(65 + index)}</span><span>{option.text}</span>{option.correct && <span className="correct-label"><Check size={13} /> Correct</span>}</div>)}</div><div className="why-others">{analysis.options.filter((option) => !option.correct).map((option) => <button key={option.label} onClick={() => onAsk(`Why is option ${option.label} (${option.text}) not the best answer?`)}>Why not {option.label}? <ArrowUpRight size={13} /></button>)}</div></section>}
    <section className="solution-card"><header className="solution-header"><span className="answer-check"><Check size={18} /></span><div><span className="section-kicker">THE ANSWER</span><h2>{analysis.answer}</h2></div><span className="solution-verified"><ShieldCheck size={15} />{analysis.verification?.verified ? 'Verified' : 'Solution'}</span></header><div className="solution-explanation"><span className="section-kicker">WHY IT WORKS</span><p>{analysis.explanation}</p></div>{analysis.steps?.length > 0 && <div className="solution-steps"><span className="section-kicker">STEP BY STEP</span>{analysis.steps.map((step, index) => <div className="solution-step" key={index}><b>{String(index + 1).padStart(2, '0')}</b><p>{step}</p></div>)}</div>}</section>
    <section className="teach-card"><div className="teach-main"><span className="teach-icon"><Lightbulb size={20} /></span><span><strong>Want to really understand it?</strong><small>Learn the concept, not just the answer.</small></span><button className="teach-button" onClick={onTeach}><GraduationCap size={16} /> Teach me</button></div><div className="teach-prompts"><button onClick={() => onAsk('What concept is used in this question?')}>What concept is used?</button><button onClick={() => onAsk('How do I solve similar questions?')}>How to solve similar questions?</button><button onClick={() => onAsk('Give me another worked example.')}>Show a worked example</button></div></section>
    <div className="answer-actions"><button className="button-dark" onClick={onChat}><MessageCircle size={16} /> Ask about this question</button><button className="secondary-button" onClick={onPractice}><RotateCcw size={15} /> Generate practice question</button><button className="icon-button answer-audio" onClick={() => { if ('speechSynthesis' in window) { const speech = new SpeechSynthesisUtterance(`${analysis.answer}. ${analysis.explanation}`); speech.lang = { English: 'en-US', Hindi: 'hi-IN', Telugu: 'te-IN' }[answerLanguage]; window.speechSynthesis.speak(speech); } }} title="Read answer aloud"><Volume2 size={17} /></button></div>
    <footer className="page-footer"><span>SCAN · UNDERSTAND · SOLVE · LEARN</span><span><ShieldCheck size={13} /> AI answers can make mistakes. Check your work.</span></footer>
  </div>;
}

function HistoryView({ items, filter, setFilter, search, setSearch, onOpen }) {
  return <div className="history-page"><header className="view-heading"><div><span className="section-kicker">YOUR STUDY TRAIL</span><h1>A little wiser, every time.</h1><p>Questions you’ve worked through, all in one place.</p></div><span className="history-total"><HistoryIcon size={16} /> {items.length} questions</span></header><div className="history-tools"><label className="history-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a question..." /></label><label className="history-filter"><ListFilter size={15} /><select value={filter} onChange={(event) => setFilter(event.target.value)}>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select><ChevronDown size={14} /></label></div>{items.length ? <div className="history-list">{items.map((item) => <button className="history-item" key={item.id} onClick={() => onOpen(item)}><span className="history-item-icon"><FileText size={17} /></span><span className="history-item-main"><strong>{item.text || 'Untitled question'}</strong><small>{item.subject} <i>·</i> {item.topic} <i>·</i> {new Date(item.createdAt).toLocaleDateString()}</small></span><span className={`history-answer-status ${item.verified ? 'verified' : ''}`}>{item.verified ? <><Check size={13} /> Checked</> : 'Reviewed'}</span><ChevronRight className="history-chevron" size={17} /></button>)}</div> : <div className="empty-state"><span><BookOpen size={24} /></span><h2>{search || filter !== 'All subjects' ? 'No matches this time.' : 'Your story starts with a question.'}</h2><p>{search || filter !== 'All subjects' ? 'Try a different search or subject.' : 'Once you solve your first question, you’ll find it here.'}</p></div>}</div>;
}

function ProgressView({ history, onOpenHistory }) {
  const subjectsUsed = [...new Set(history.map((item) => item.subject))];
  const verified = history.filter((item) => item.verified).length;
  const recent = history.slice(0, 4);
  return <div className="progress-page"><header className="view-heading"><div><span className="section-kicker">A VIEW OF YOUR GROWTH</span><h1>Look how far you’ve come.</h1><p>Every question is a little more understanding.</p></div><span className="streak-pill"><Sparkles size={15} /> Keep your curiosity going</span></header><div className="stats-grid"><StatCard primary title="QUESTIONS SOLVED" value={history.length} note="Questions in your history" icon={<BookOpen size={14} />} /><StatCard title="VERIFIED SOLUTIONS" value={verified} note="Independently checked" icon={<ShieldCheck size={14} />} /><StatCard title="SUBJECTS EXPLORED" value={subjectsUsed.length} note="Keep branching out" icon={<Languages size={14} />} /></div><div className="progress-detail-grid"><section className="topic-card"><header><div><span className="section-kicker">YOUR CURIOSITY, BY SUBJECT</span><h2>Topics you’ve explored</h2></div><TrendingUp size={18} /></header>{subjectsUsed.length ? subjectsUsed.map((subject) => { const count = history.filter((item) => item.subject === subject).length; return <div className="topic-row" key={subject}><span className="topic-name"><i />{subject}</span><span className="topic-count">{count} {count === 1 ? 'question' : 'questions'}</span><span className="topic-meter"><i style={{ width: `${Math.max(16, count / history.length * 100)}%` }} /></span></div>; }) : <div className="topic-empty"><GraduationCap size={21} /><p>Your first question will set your progress in motion.</p></div>}</section><section className="recent-card"><header><div><span className="section-kicker">JUST KEEP GOING</span><h2>Recently worked on</h2></div><button onClick={onOpenHistory}>All history <ArrowRight size={14} /></button></header>{recent.length ? recent.map((item) => <div className="recent-row" key={item.id}><span className="recent-check"><Check size={14} /></span><span><strong>{item.topic}</strong><small>{item.subject}</small></span><time>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>) : <div className="topic-empty"><Target size={21} /><p>Each answer is a new step forward.</p></div>}</section></div><div className="progress-note"><Sparkles size={17} /><p><strong>Learning is a journey, not a score.</strong> This dashboard reflects questions on this device. Your history stays private and local.</p></div></div>;
}

function StatCard({ primary, title, value, note, icon }) {
  return <article className={`stat-card ${primary ? 'stat-primary' : ''}`}><span>{title}</span><strong>{value}</strong><small>{icon}{note}</small><span className="stat-decoration">{primary ? <ScanLine size={72} /> : <Check size={18} />}</span></article>;
}

function CameraModal({ videoRef, photo, rotated, cropPhoto, setCropPhoto, flashAvailable, flashOn, onFlash, onRotate, onRetake, onClose, onCapture, onAnalyze, onUpload }) {
  return <div className="modal-backdrop"><section className="camera-modal" role="dialog" aria-modal="true" aria-label="Scan a question"><header><div><span className="eyebrow">{photo ? 'PHOTO REVIEW' : 'LIVE CAMERA'}</span><h2>{photo ? 'Looks readable?' : 'Frame your question'}</h2></div><button className="icon-button on-dark" onClick={onClose} aria-label="Close camera"><X size={20} /></button></header><div className="camera-stage">{photo ? <img className="photo-preview" src={photo.url} alt="Captured question preview" /> : <video ref={videoRef} autoPlay playsInline muted style={{ transform: rotated ? 'rotate(180deg)' : undefined }} />}<div className="scan-corners" /><span className="camera-hint">{photo ? 'Check the framing before continuing' : 'Keep the full question inside the frame'}</span>{!photo && flashAvailable && <button className={`camera-flash ${flashOn ? 'flash-on' : ''}`} onClick={onFlash} aria-label={flashOn ? 'Turn flash off' : 'Turn flash on'} title={flashOn ? 'Turn flash off' : 'Turn flash on'}><Zap size={16} /></button>}<button className="camera-rotate" onClick={onRotate} aria-label={photo ? 'Rotate photo' : 'Rotate camera preview'} title={photo ? 'Rotate photo 90 degrees' : 'Rotate camera preview 180 degrees'}><RotateCcw size={17} /></button></div><footer>{photo ? <><button className="secondary-button" onClick={onRetake}><RotateCcw size={15} /> Retake</button><button className={`crop-toggle ${cropPhoto ? 'crop-active' : ''}`} onClick={() => setCropPhoto(!cropPhoto)}><Crop size={15} /> {cropPhoto ? 'Frame crop on' : 'Crop to frame'}</button><button className="button-dark analyze-capture" onClick={onAnalyze}><Sparkles size={15} /> Analyze question</button></> : <><button className="secondary-button" onClick={onUpload}><CloudUpload size={16} /> Upload instead</button><button className="capture-button" onClick={onCapture} aria-label="Capture question"><span /></button><span className="camera-foot-label">CAPTURE</span></>}</footer></section></div>;
}

function ChatPanel({ messages, input, setInput, listening, onVoice, onSend, onClose, endRef }) {
  return <aside className="chat-panel"><header><span className="chat-heading-icon"><Sparkles size={18} /></span><div><strong>Your study buddy</strong><small>Knows this question’s context</small></div><button className="icon-button" onClick={onClose} aria-label="Close tutor"><X size={18} /></button></header><div className="chat-body">{!messages.length && <div className="chat-welcome"><Sparkles size={23} /><h3>Curiosity looks good on you.</h3><p>Ask about this solution, or choose a starting point.</p><div className="suggestion-list"><button onClick={() => onSend('Explain this in simpler words.')}>Explain in simpler words <ArrowUpRight size={14} /></button><button onClick={() => onSend('What concept is being tested here?')}>What concept is being tested? <ArrowUpRight size={14} /></button><button onClick={() => onSend('Give me another example.')}>Show me another example <ArrowUpRight size={14} /></button></div></div>}{messages.map((message, index) => <div key={index} className={`chat-message ${message.role} ${message.error ? 'chat-error' : ''}`}>{message.loading ? <span className="typing-dots"><i /><i /><i /></span> : message.text}</div>)}<div ref={endRef} /></div><form className="chat-compose" onSubmit={(event) => { event.preventDefault(); onSend(input); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={listening ? 'Listening…' : 'Ask a follow-up...'} aria-label="Ask a follow-up" /><button className={`voice-button ${listening ? 'voice-active' : ''}`} type="button" onClick={onVoice} aria-label={listening ? 'Listening for a question' : 'Ask by voice'} title="Ask by voice"><Mic size={16} /></button><button type="submit" disabled={!input.trim()} aria-label="Send question"><Send size={17} /></button></form></aside>;
}
