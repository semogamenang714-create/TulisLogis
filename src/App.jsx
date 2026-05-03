import React, { useState, useEffect } from 'react';
import { 
  Home, PenTool, History, BarChart3, Newspaper, 
  ChevronRight, ArrowLeft, Lightbulb, List, Activity, 
  X, Target, User, Quote, Sparkles, BookOpen, RotateCw, 
  Award, Search, Database, MessageSquare, Plus, Trash2, 
  Link as LinkIcon, Loader2, Copy, Check, Save, Download
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc } from 'firebase/firestore';

// --- INITIALIZATION ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// API Keys - Gunakan Environment Variables jika di Vercel untuk keamanan maksimal
const GEMINI_API_KEY = ""; 
const FIRECRAWL_API_KEY = "fc-3484766d29634fdeb5fa99998b523efc"; 

const App = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState('home'); 
  const [view, setView] = useState('main'); 
  const [user, setUser] = useState(null);
  
  // Data States
  const [news, setNews] = useState([]);
  const [history, setHistory] = useState([]);
  const [aiTopics, setAiTopics] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // UI States
  const [showAddNews, setShowAddNews] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [newsUrl, setNewsUrl] = useState('');
  const [writingContent, setWritingContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null); 
  const [activeToolbar, setActiveToolbar] = useState(null);
  const [writingMode, setWritingMode] = useState('essay');
  const [dynamicTools, setDynamicTools] = useState({ diksi: [], konjungsi: [] });
  const [copySuccess, setCopySuccess] = useState(false);

  const dailyQuote = { text: "Bahasa menunjukkan bangsa, logika menunjukkan kedewasaan.", author: "Pepatah" };

  // --- FIREBASE SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubAuth = onAuthStateChanged(auth, setUser);
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const newsRef = collection(db, 'artifacts', appId, 'public', 'data', 'news');
    const unsubNews = onSnapshot(newsRef, (snap) => {
      setNews(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });
    const historyRef = collection(db, 'artifacts', appId, 'users', user.uid, 'history');
    const unsubHist = onSnapshot(historyRef, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });
    const topicRef = collection(db, 'artifacts', appId, 'users', user.uid, 'ai_topics');
    const unsubTopics = onSnapshot(topicRef, (snap) => {
      setAiTopics(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });
    return () => { unsubNews(); unsubHist(); unsubTopics(); };
  }, [user]);

  // --- LOGIC: DYNAMIC TOOLS ---
  const generateDynamicTools = async (topicTitle) => {
    if (!topicTitle) return;
    setDynamicTools({ diksi: ["Memuat..."], konjungsi: ["Memuat..."] });
    const prompt = `Berikan JSON murni berisi 8 diksi akademik dan 5 konjungsi formal untuk topik: "${topicTitle}". Format: {"diksi": [], "konjungsi": []}.`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      const data = await res.json();
      setDynamicTools(JSON.parse(data.candidates[0].content.parts[0].text));
    } catch (e) { setDynamicTools({ diksi: ["Esensial", "Signifikan"], konjungsi: ["Namun"] }); }
  };

  useEffect(() => {
    if (view === 'editor' && selectedItem) generateDynamicTools(selectedItem.title || selectedItem.headline);
  }, [view, selectedItem]);

  // --- AI ACTIONS ---
  const analyzeWithAI = async () => {
    if (!writingContent) return;
    setIsAnalyzing(true);
    setAiFeedback(null);
    const prompt = `Analisis tulisan akademik: "${writingContent}". Output JSON murni: {"totalScore": 0, "breakdown": {"logika": 0, "diksi": 0, "alur": 0}, "critique": "Kritik detail", "nonBaku": "Kata slang", "improvement": "Versi perbaikan"}. Skor 0 jika teks tidak akademik.`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      const data = await res.json();
      setAiFeedback(JSON.parse(data.candidates[0].content.parts[0].text));
    } catch (e) { setAiFeedback({ totalScore: 0, critique: "Error AI." }); }
    finally { setIsAnalyzing(false); }
  };

  const copyToClipboard = () => {
    const dummy = document.createElement("textarea");
    document.body.appendChild(dummy);
    dummy.value = writingContent;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // --- RENDERS ---
  const renderHome = () => (
    <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-8 animate-in fade-in">
      <div className="bg-slate-50/80 p-5 rounded-[28px] border border-slate-100 flex items-start gap-3 mt-4">
        <Quote size={14} className="text-red-500 opacity-40 shrink-0 mt-1" />
        <p className="text-[12px] font-serif italic text-slate-500 leading-relaxed">"{dailyQuote.text}"</p>
      </div>
      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <h2 className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-300">News Feed</h2>
          <button onClick={() => setShowAddNews(true)} className="p-2 bg-slate-100 rounded-full text-slate-400"><Plus size={16}/></button>
        </div>
        {news.map((item) => (
          <div key={item.id} className="relative group animate-in slide-in-from-bottom duration-300">
            <div onClick={() => { setSelectedItem(item); setWritingMode('news'); setView('detail'); }} className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm active:scale-[0.98] transition-all cursor-pointer">
              <span className="text-[9px] font-black text-red-600 uppercase tracking-widest block mb-2">{item.source}</span>
              <h3 className="text-base font-bold text-slate-900 leading-tight">{item.title}</h3>
              <p className="text-xs text-slate-400 mt-2 line-clamp-2 font-serif">{item.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-[#FDFCFB] text-slate-900 font-sans max-w-md mx-auto border-x border-slate-50 flex flex-col relative overflow-hidden shadow-2xl">
      {/* PWA-Friendly Meta Tags Simulation in Header */}
      <div className="hidden"><meta name="theme-color" content="#FDFCFB" /><meta name="apple-mobile-web-app-capable" content="yes" /></div>

      {view === 'main' && (
        <header className="p-6 pb-2 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-20">
          <div><h1 className="text-2xl font-black tracking-tighter">Tulis<span className="text-red-600">Logis</span></h1><p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.4em]">Academic Lab</p></div>
          <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-50 flex items-center justify-center"><User size={18} className="text-slate-200" /></div>
        </header>
      )}

      {view === 'main' && (
        <>
          {activeTab === 'home' && renderHome()}
          {activeTab === 'latih' && (
            <div className="flex-1 overflow-y-auto px-6 pt-4 pb-32 space-y-10">
              <div className="flex justify-between items-center"><h2 className="text-2xl font-black tracking-tighter">Arena Latih</h2><div className="flex gap-2"><button onClick={() => generateNewTopic('analisis')} className="p-2 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest">+ Analisis</button><button onClick={() => generateNewTopic('logika')} className="p-2 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest">+ Exam</button></div></div>
              {['analisis', 'logika'].map(type => (
                <div key={type} className="space-y-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-300 ml-2">{type === 'analisis' ? 'Analisis Data' : 'Ujian Logika'}</p>
                  {aiTopics.filter(t => t.type === type).map(t => (
                    <div key={t.id} className="relative group">
                      <button onClick={() => { setSelectedItem(t); setWritingMode(type); setView('editor'); }} className="w-full p-6 bg-white border border-slate-100 rounded-[32px] text-left flex items-center gap-5 shadow-sm active:bg-slate-50 transition-all"><div className={`p-3 rounded-2xl ${type === 'analisis' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{type === 'analisis' ? <Database size={20}/> : <Target size={20}/>}</div><div className="flex-1"><h4 className="text-sm font-bold">{t.title}</h4></div></button>
                      <button onClick={() => deleteItem('topic', t.id)} className="absolute -top-1 -right-1 p-2 bg-white shadow-md rounded-full text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 space-y-6 animate-in fade-in"><h2 className="text-2xl font-black tracking-tighter">Arsip Latihan</h2>{history.map((h, i) => (<div key={i} className="p-6 bg-white border border-slate-50 rounded-[32px] shadow-sm flex justify-between items-center"><div className="flex-1 pr-4"><span className="text-[9px] font-bold text-slate-300 uppercase">{new Date(h.timestamp).toLocaleDateString()}</span><h4 className="text-sm font-bold text-slate-800 line-clamp-1 font-serif mt-1">{h.title}</h4></div><ChevronRight size={18} className="text-slate-100" /></div>))}</div>
          )}
          {activeTab === 'stats' && <div className="flex-1 flex items-center justify-center pt-24 opacity-20"><Activity size={64}/></div>}
        </>
      )}

      {view === 'editor' && (
        <div className="flex-1 bg-[#FDFCFB] flex flex-col animate-in slide-in-from-bottom overflow-hidden relative">
          <header className="p-4 bg-white border-b flex justify-between items-center px-6 sticky top-0 z-20"><button onClick={() => setView('main')} className="p-2"><ArrowLeft size={18}/></button><div className="flex gap-2"><button onClick={copyToClipboard} className="p-2 bg-slate-100 rounded-full text-slate-400 transition-all active:scale-90">{copySuccess ? <Check size={18} className="text-emerald-500"/> : <Copy size={18}/>}</button><button onClick={async () => { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), { title: selectedItem.title, content: writingContent, timestamp: new Date().toISOString() }); setView('main'); setActiveTab('history'); setWritingContent(''); setAiFeedback(null); }} className="bg-slate-900 text-white px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest">Simpan</button></div></header>
          <div className="flex-1 overflow-y-auto px-6 py-8 pb-48">
            <div className="mb-6 p-8 bg-white border border-slate-100 rounded-[40px] shadow-sm"><h2 className="text-[9px] font-black uppercase text-slate-300 mb-2">Instruksi</h2><div className="text-[13px] font-serif text-slate-600 leading-relaxed whitespace-pre-line">{selectedItem?.prompt || selectedItem?.content}</div>{selectedItem?.data && <div className="mt-3 p-3 bg-slate-50 rounded-xl text-[10px] font-mono text-slate-400">{selectedItem.data}</div>}</div>
            <div className="bg-white border rounded-[48px] p-8 shadow-sm min-h-[400px] transition-all focus-within:shadow-2xl focus-within:border-blue-50/50"><textarea className="w-full h-full min-h-[350px] bg-transparent border-none focus:ring-0 text-[15px] font-serif leading-[1.8] text-slate-800 outline-none resize-none" placeholder="Tuangkan gagasanmu..." value={writingContent} onChange={e => setWritingContent(e.target.value)}/></div>
            {aiFeedback && (
              <div className="mt-8 space-y-4 animate-in zoom-in duration-500 pb-20">
                <div className="p-8 bg-slate-900 rounded-[40px] text-white shadow-xl">
                  <div className="flex justify-between items-center mb-6"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analisis Kualitas</span><span className="text-3xl font-black italic">{aiFeedback.totalScore}</span></div>
                  <div className="grid grid-cols-3 gap-2 mb-8">{Object.entries(aiFeedback.breakdown || {}).map(([key, val]) => (<div key={key} className="p-3 bg-white/5 rounded-2xl border border-white/10 text-center"><p className="text-[14px] font-black">{val}</p><p className="text-[7px] uppercase font-bold text-slate-400">{key}</p></div>))}</div>
                  <div className="space-y-6"><div><p className="text-[9px] font-black uppercase text-blue-400 tracking-widest mb-1">Evaluasi Kritis</p><p className="text-[12px] font-serif leading-relaxed opacity-80">{aiFeedback.critique}</p></div>{aiFeedback.nonBaku && <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20"><p className="text-[9px] font-black uppercase text-red-400 tracking-widest mb-1 flex items-center gap-2">Temuan Non-Baku</p><p className="text-[11px] opacity-90">{aiFeedback.nonBaku}</p></div>}</div>
                </div>
                <div className="p-10 bg-indigo-50 border border-indigo-100 rounded-[40px]"><p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-4">Versi Perbaikan Akademik</p><p className="text-[14px] font-serif text-slate-700 leading-relaxed italic opacity-90">"{aiFeedback.improvement}"</p></div>
              </div>
            )}
          </div>
          <div className="absolute bottom-6 left-10 right-10 bg-white/70 backdrop-blur-3xl border rounded-full flex justify-around p-3 shadow-xl z-30">
            <button onClick={() => setActiveToolbar('Diksi')} className={`flex flex-col items-center gap-1 flex-1 text-slate-300 active:text-blue-600 transition-colors`}><Lightbulb size={20}/><span className="text-[8px] font-black uppercase">Diksi</span></button>
            <button onClick={() => setActiveToolbar('Konjungsi')} className={`flex flex-col items-center gap-1 flex-1 text-slate-300 active:text-blue-600 transition-colors`}><List size={20}/><span className="text-[8px] font-black uppercase">Konjungsi</span></button>
            <div className="w-[1px] h-6 bg-slate-100 mx-2" />
            <button onClick={analyzeWithAI} disabled={isAnalyzing} className={`flex flex-col items-center gap-1.5 flex-1 ${isAnalyzing ? 'animate-pulse text-red-600' : 'text-slate-900'}`}><Sparkles size={22}/><span className="text-[8px] font-black uppercase">Cek AI</span></button>
          </div>
          {activeToolbar && (
            <div className="absolute bottom-32 left-6 right-6 bg-white/95 backdrop-blur-3xl border rounded-[40px] p-8 shadow-2xl z-40 animate-in slide-in-from-bottom">
              <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{activeToolbar} Spesifik</span><button onClick={() => setActiveToolbar(null)}><X size={12}/></button></div>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">{((activeToolbar === 'Diksi' ? dynamicTools.diksi : dynamicTools.konjungsi) || []).map(w => (<button key={w} onClick={() => setWritingContent(p => p + " " + w)} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium active:scale-95 transition-all">{w}</button>))}</div>
            </div>
          )}
        </div>
      )}

      {view === 'main' && (
        <nav className="absolute bottom-8 left-10 right-10 bg-white/80 backdrop-blur-3xl border border-white/50 rounded-full flex justify-around items-center px-4 py-4 z-50 shadow-2xl shadow-slate-200/50">
          {[{ id:'home', icon:Home, label:'Feed' }, { id:'latih', icon:PenTool, label:'Latih' }, { id:'history', icon:History, label:'Arsip' }, { id:'stats', icon:BarChart3, label:'Skill' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === tab.id ? 'text-red-600 scale-110' : 'text-slate-200'}`}><tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} /><span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span></button>
          ))}
        </nav>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Merriweather:ital,wght@0,300;0,700;1,300&display=swap');
        .font-serif { font-family: 'Merriweather', serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
        *:focus { outline: none !important; box-shadow: none !important; }
        textarea:focus { border: none !important; }
        ::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
};

export default App;

