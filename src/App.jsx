import { useState, useEffect, useRef } from 'react'
import './App.css'
// Firebase and Tools
import { db, auth, storage } from './firebase'
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, deleteDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "firebase/auth"
import { analyzeIntent, getLegalAdvice } from './services/ai'
import { locales } from './locales'

function App() {
  const [lang, setLang] = useState('te') // Default to Telugu
  const [isLoggedIn, setIsLoggedIn] = useState(true) // Bypassed for development
  const [onboarded, setOnboarded] = useState(true) // Bypassed for development
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)

  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationId, setVerificationId] = useState(null)
  const [otp, setOtp] = useState('')
  const [authStep, setAuthStep] = useState('phone') 
  const [uan, setUan] = useState('9876543210') 

  const [activeScreen, setActiveScreen] = useState(0)

  // App States
  const [isRecording, setIsRecording] = useState(false)
  const [audioURL, setAudioURL] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [complaintText, setComplaintText] = useState('')
  const [issueType, setIssueType] = useState('unpaid_wages')
  const [complaints, setComplaints] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Government Schemes
  const [schemes, setSchemes] = useState([])
  const [adminTab, setAdminTab] = useState('complaints') // 'complaints' | 'schemes'
  const [schemeForm, setSchemeForm] = useState({ name: '', description: '', eligibility: '', benefit: '', category: 'insurance' })
  const [isAddingScheme, setIsAddingScheme] = useState(false)
  const [offlineQueue, setOfflineQueue] = useState(JSON.parse(localStorage.getItem('saathi_queue') || '[]'))
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const videoRef = useRef(null)

  // Profile data
  const [job, setJob] = useState('Construction (నిర్మాణ రంగా)')
  const [income, setIncome] = useState('₹8,000 - 12,000')

  const [chatMessages, setChatMessages] = useState([
    { id: 1, text: "Namaste! I am your Legal Saathi. How can I help you regarding labor laws?", sender: 'bot' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isChatRecording, setIsChatRecording] = useState(false)

  // Audio & Speech References
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recognitionRef = useRef(null)

  const t = locales[lang]

  const categoryIcons = { insurance: '🛡️', pension: '👴', health: '🏥', housing: '🏠', education: '📚', employment: '💼', welfare: '🤝' }
  const categoryColors = { insurance: '#E1F5FE', pension: '#FFF9C4', health: '#F8BBD0', housing: '#E8F5E9', education: '#E3F2FD', employment: '#F3E5F5', welfare: '#FFF3E0' }

  useEffect(() => {
    // Listen to complaints
    const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
    const unsubscribeComplaints = onSnapshot(q, (snapshot) => {
      setComplaints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to schemes
    const sq = query(collection(db, "schemes"), orderBy("createdAt", "desc"));
    const unsubscribeSchemes = onSnapshot(sq, (snapshot) => {
      setSchemes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeComplaints();
      unsubscribeSchemes();
    };
  }, []);
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (offlineQueue.length > 0) syncOfflineComplaints();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineQueue]);

  const syncOfflineComplaints = async () => {
    console.log("🔄 Internet restored. Syncing offline complaints...");
    for (const item of offlineQueue) {
      try {
        await addDoc(collection(db, "complaints"), { ...item, timestamp: serverTimestamp() });
      } catch (e) { console.error("Sync error:", e); }
    }
    setOfflineQueue([]);
    localStorage.setItem('saathi_queue', '[]');
    alert(lang === 'te' ? '✅ ఆఫ్‌లైన్ ఫిర్యాదులు సింక్ అయ్యాయి!' : '✅ Offline complaints synced successfully!');
  };

  const handleImageAnalysis = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAnalysisLoading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const mimeType = file.type;
      setSelectedImage(reader.result);
      
      const result = await analyzeImage({ inlineData: { data: base64, mimeType } }, lang);
      setComplaintText(result);
      setAnalysisLoading(false);
    };
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error(err);
      alert("Camera blocked!");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    const base64withType = canvas.toDataURL('image/jpeg');
    const base64 = base64withType.split(',')[1];
    
    setSelectedImage(base64withType);
    stopCamera();
    
    setAnalysisLoading(true);
    const result = await analyzeImage({ inlineData: { data: base64, mimeType: 'image/jpeg' } }, lang);
    setComplaintText(result);
    setAnalysisLoading(false);
  };

  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) return;
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': (response) => {
        console.log("Recaptcha resolved");
      }
    });
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (phoneNumber.length < 10) return alert('Enter valid 10-digit number');
    
    setLoading(true);
    try {
      setupRecaptcha();
      const formattedPhone = `+91${phoneNumber}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setVerificationId(confirmation);
      setAuthStep('otp');
    } catch (err) {
      console.error(err);
      alert('Error sending OTP. Check Firebase settings.');
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (otp.length < 6) return alert('Enter 6-digit OTP');
    
    setLoading(true);
    try {
      await verificationId.confirm(otp);
      // onAuthStateChanged will handle the rest
    } catch (err) {
      alert('Invalid OTP. Please try again.');
    }
    setLoading(false);
  };


  useEffect(() => {
    const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComplaints(data);
    });

    // Listen to schemes collection (public)
    const schemesQuery = query(collection(db, "schemes"), orderBy("createdAt", "desc"));
    const unsubSchemes = onSnapshot(schemesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchemes(data);
    });

    return () => { unsubscribe(); unsubSchemes(); };
  }, [isAdmin]); // Only depends on admin state for data fetching

  // 🎙️ SPEECH RECOGNITION (Standalone effect to avoid stale activeScreen closure)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
    }

    recognitionRef.current.lang = lang === 'en' ? 'en-IN' : 'te-IN';

    recognitionRef.current.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      const cleanText = transcript.trim();
      if (activeScreen === 3 || activeScreen === 0) setComplaintText(cleanText);
      if (activeScreen === 2) setChatInput(cleanText);
    };

  }, [lang, activeScreen]);

  const go = (idx) => setActiveScreen(idx);

  // 🎙 START RECORDING + TRANSCRIBING
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));

        // If on home screen, analyze intent and auto-route
        if (activeScreen === 0 && complaintText) {
          setIsTyping(true);
          const result = await analyzeIntent(complaintText);
          setIsTyping(false);
          if (result.targetIdx !== 0) {
            go(result.targetIdx);
          }
        }
      };
      mediaRecorderRef.current.start();
      if (recognitionRef.current) recognitionRef.current.start();
      setIsRecording(true);
    } catch (err) { alert("Microphone blocked!"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
  };

  const handleSubmit = async () => {
    if (!complaintText.trim() && !audioBlob && !selectedImage) return alert('Enter details, speak, or take a photo');
    setIsSubmitting(true);
    
    const complaintData = {
      uan, 
      worker: 'Ramesh Kumar',
      issue: complaintText.slice(0, 40) + '...', 
      details: complaintText, 
      status: 'pending',
      audioURL: null,
      imageURL: selectedImage,
      date: new Date().toLocaleDateString()
    }

    if (!isOnline) {
      const newQueue = [...offlineQueue, complaintData];
      setOfflineQueue(newQueue);
      localStorage.setItem('saathi_queue', JSON.stringify(newQueue));
      alert(lang === 'te' ? '⚠️ ఇంటర్నెట్ లేదు! ఫిర్యాదు ఆఫ్‌లైన్‌లో సేవ్ చేయబడింది.' : '⚠️ No Internet! Saved offline. Will sync when online.');
      setComplaintText(''); setSelectedImage(null); setAudioURL(null);
      go(4); 
      setIsSubmitting(false);
      return;
    }

    try {
      if (audioBlob) {
        const audioRef = ref(storage, `complaints/${uan}_${Date.now()}.webm`);
        await uploadBytes(audioRef, audioBlob);
        complaintData.audioURL = await getDownloadURL(audioRef);
      }
      await addDoc(collection(db, "complaints"), { ...complaintData, createdAt: serverTimestamp() });
      alert(lang === 'te' ? '✅ ఫిర్యాదు విజయవంతంగా దాఖలు చేయబడింది!' : '✅ Complaint filed successfully!');
      setComplaintText(''); setAudioBlob(null); setAudioURL(null); setSelectedImage(null);
      go(4);
    } catch (err) {
      console.error(err);
      alert('Error submitting complaint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    // Local bypass logout
    setIsLoggedIn(false);
    setOnboarded(false);
  };

  // 🔊 TEXT TO SPEECH
  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Stop current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'te' ? 'te-IN' : 'en-IN';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const resolveComplaint = (id) => updateDoc(doc(db, "complaints", id), { status: 'resolved' });

  // 📋 SCHEME MANAGEMENT (Admin)
  const handleAddScheme = async () => {
    if (!schemeForm.name.trim() || !schemeForm.description.trim()) return alert('Name and description are required');
    setIsAddingScheme(true);
    try {
      await addDoc(collection(db, "schemes"), {
        ...schemeForm,
        status: 'active',
        createdAt: serverTimestamp()
      });
      setSchemeForm({ name: '', description: '', eligibility: '', benefit: '', category: 'insurance' });
    } catch (e) { alert('Failed to add scheme'); console.error(e); }
    setIsAddingScheme(false);
  };

  const deleteScheme = async (id) => {
    if (!confirm('Delete this scheme?')) return;
    try { await deleteDoc(doc(db, "schemes", id)); } catch (e) { console.error(e); }
  };

  const handleChatSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMsg = { id: Date.now(), text: chatInput, sender: 'user' };
    setChatMessages(prev => [...prev, userMsg]);
    const query = chatInput;
    setChatInput('');
    setIsTyping(true);
    
    const response = await getLegalAdvice(query, lang, { job, income });
    
    setChatMessages(prev => [...prev, { id: Date.now() + 1, text: response, sender: 'bot' }]);
    setIsTyping(false);
    speak(response); // Speak the response!
  };

  const toggleChatRecording = async () => {
    if (isChatRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsChatRecording(false);
      // Auto-submit if we have a question
      if (chatInput.trim()) {
        setTimeout(() => handleChatSubmit(), 300); // Small delay to ensure state sync
      }
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.lang = lang === 'en' ? 'en-IN' : 'te-IN';
        recognitionRef.current.start();
      }
      setIsChatRecording(true);
    }
  };


  const LangToggle = () => (
    <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 100, display: 'flex', gap: '8px' }}>
      <button onClick={() => setLang(lang === 'en' ? 'te' : 'en')} style={{ background: '#fff', border: '1px solid #0F6E56', color: '#0F6E56', padding: '5px 10px', borderRadius: '15px', fontSize: '11px', fontWeight: 'bold' }}>{lang === 'en' ? 'తెలుగు' : 'EN'}</button>
    </div>
  )

  // 🛡 ADMIN VIEW
  if (isAdmin) {
    return (
      <div className="app-container" style={{ background: '#f4f4f4', padding: '20px', overflowY: 'auto' }}>
        <LangToggle />
        <div style={{ marginBottom: '20px', marginTop: '40px' }}><h2>{t.admin_title} 🛡</h2><p style={{ opacity: 0.7 }}>Dashboard for Volunteers</p></div>

        {/* Admin Stats */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}><h3>{complaints.length}</h3><p className="section-label">{t.total_complaints}</p></div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}><h3>{complaints.filter(c => c.status === 'pending').length}</h3><p className="section-label">{t.pending_tasks}</p></div>
          <div className="card" style={{ flex: 1, textAlign: 'center' }}><h3>{schemes.length}</h3><p className="section-label">{lang === 'te' ? 'పథకాలు' : 'Schemes'}</p></div>
        </div>

        {/* Admin Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button onClick={() => setAdminTab('complaints')} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', background: adminTab === 'complaints' ? '#0F6E56' : '#fff', color: adminTab === 'complaints' ? '#fff' : '#1a1a1a', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>📋 {lang === 'te' ? 'ఫిర్యాదులు' : 'Complaints'}</button>
          <button onClick={() => setAdminTab('schemes')} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', background: adminTab === 'schemes' ? '#0F6E56' : '#fff', color: adminTab === 'schemes' ? '#fff' : '#1a1a1a', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>🏛️ {lang === 'te' ? 'పథకాలు నిర్వహణ' : 'Manage Schemes'}</button>
        </div>

        {/* COMPLAINTS TAB */}
        {adminTab === 'complaints' && (
          <div>
            <input type="text" className="card" placeholder={t.search_placeholder} style={{ width: '100%', marginBottom: '15px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {complaints.map(c => (
                <div className="card" key={c.id} style={{ borderLeft: c.status === 'pending' ? '4px solid #cc0000' : '4px solid #0F6E56' }}>
                  <p className="card-title">{c.issue}</p>
                  <p style={{ fontSize: '12px', color: '#666' }}>"{c.details}"</p>
                  {c.audioURL && <audio controls src={c.audioURL} style={{ width: '100%', height: '30px', marginTop: '8px' }} />}
                  {c.status === 'pending' && <button className="cta-btn" style={{ padding: '8px', fontSize: '11px', marginTop: '10px' }} onClick={() => resolveComplaint(c.id)}>🚀 {t.mark_resolved}</button>}
                </div>
              ))}
              {complaints.length === 0 && <p style={{ textAlign: 'center', color: '#aaa', padding: '30px' }}>{lang === 'te' ? 'ఫిర్యాదులు ఇంకా లేవు' : 'No complaints yet'}</p>}
            </div>
          </div>
        )}

        {/* SCHEMES TAB */}
        {adminTab === 'schemes' && (
          <div>
            {/* Add Scheme Form */}
            <div className="card" style={{ marginBottom: '16px', border: '2px dashed rgba(15, 110, 86, 0.3)', background: '#FAFFFE' }}>
              <p className="section-label" style={{ marginBottom: '12px' }}>➕ {lang === 'te' ? 'కొత్త పథకం జోడించండి' : 'Add New Government Scheme'}</p>
              <input type="text" placeholder={lang === 'te' ? 'పథకం పేరు (ఉదా: PMSBY)' : 'Scheme Name (e.g., PMSBY)'} value={schemeForm.name} onChange={e => setSchemeForm({...schemeForm, name: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '13px', marginBottom: '8px', outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
              <textarea placeholder={lang === 'te' ? 'పథకం వివరణ' : 'Scheme Description'} value={schemeForm.description} onChange={e => setSchemeForm({...schemeForm, description: e.target.value})} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '13px', marginBottom: '8px', resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
              <input type="text" placeholder={lang === 'te' ? 'అర్హత (ఉదా: 18-50 ఏళ్ళు, e-Shram నోందణి)' : 'Eligibility (e.g., Age 18-50, e-Shram registered)'} value={schemeForm.eligibility} onChange={e => setSchemeForm({...schemeForm, eligibility: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '13px', marginBottom: '8px', outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
              <input type="text" placeholder={lang === 'te' ? 'ప్రయోజనం (ఉదా: ₹2 లక్షల బీమా)' : 'Benefit (e.g., ₹2 Lakh Insurance Cover)'} value={schemeForm.benefit} onChange={e => setSchemeForm({...schemeForm, benefit: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '13px', marginBottom: '8px', outline: 'none', fontFamily: 'Outfit, sans-serif' }} />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>{lang === 'te' ? 'వర్గం:' : 'Category:'}</label>
                <select value={schemeForm.category} onChange={e => setSchemeForm({...schemeForm, category: e.target.value})} style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '13px', outline: 'none', fontFamily: 'Outfit, sans-serif', background: '#fff' }}>
                  <option value="insurance">{lang === 'te' ? '🛡️ బీమా' : '🛡️ Insurance'}</option>
                  <option value="pension">{lang === 'te' ? '👴 పెన్షన్' : '👴 Pension'}</option>
                  <option value="health">{lang === 'te' ? '🏥 ఆరోగ్యం' : '🏥 Health'}</option>
                  <option value="housing">{lang === 'te' ? '🏠 గృహ నిర్మాణం' : '🏠 Housing'}</option>
                  <option value="education">{lang === 'te' ? '📚 విద్య' : '📚 Education'}</option>
                  <option value="employment">{lang === 'te' ? '💼 ఉపాధి' : '💼 Employment'}</option>
                  <option value="welfare">{lang === 'te' ? '🤝 సంక్షేమం' : '🤝 Welfare'}</option>
                </select>
              </div>
              <button className="cta-btn" onClick={handleAddScheme} disabled={isAddingScheme} style={{ margin: 0, width: '100%' }}>{isAddingScheme ? '...' : (lang === 'te' ? '✅ పథకం ప్రచురించండి' : '✅ Publish Scheme')}</button>
            </div>

            {/* Existing Schemes List */}
            <p className="section-label" style={{ marginBottom: '10px' }}>{lang === 'te' ? `ప్రచురించిన పథకాలు (${schemes.length})` : `Published Schemes (${schemes.length})`}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {schemes.map(s => (
                <div className="card" key={s.id} style={{ borderLeft: `4px solid ${s.status === 'active' ? '#0F6E56' : '#aaa'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <p className="card-title">{categoryIcons[s.category] || '📋'} {s.name}</p>
                      <p style={{ fontSize: '12px', color: '#666', margin: '4px 0' }}>{s.description}</p>
                      {s.eligibility && <p style={{ fontSize: '11px', color: '#0F6E56', marginTop: '4px' }}>👤 {s.eligibility}</p>}
                      {s.benefit && <p style={{ fontSize: '11px', color: '#854F0B', marginTop: '2px' }}>💰 {s.benefit}</p>}
                    </div>
                    <button onClick={() => deleteScheme(s.id)} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '4px', color: '#cc0000', opacity: 0.6 }} title="Delete">🗑️</button>
                  </div>
                  <span className="badge" style={{ background: '#E1F5EE', color: '#0F6E56', marginTop: '8px' }}>{s.category}</span>
                </div>
              ))}
              {schemes.length === 0 && <p style={{ textAlign: 'center', color: '#aaa', padding: '30px' }}>{lang === 'te' ? 'ఇంకా పథకాలు జోడించబడలేదు' : 'No schemes added yet. Add your first scheme above!'}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 0: return (
        <div className="screen active">
          <div className="screen-body" style={{ paddingTop: '20px' }}>
            <p className="section-label">{t.recommended}</p>
            <div className="card" onClick={() => go(1)}>
              <div className="card-row">
                <div className="icon-box" style={{ background: '#EEEDFE' }}><svg width="22" height="22" stroke="#534AB7" strokeWidth="1.5" fill="none"><path d="M3 4h16v14a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" /></svg></div>
                <div style={{ flex: 1 }}><p className="card-title">Check Eligibility</p><p className="card-sub">PMJJBY, PMSBY, Pension schemes</p></div>
                <span className="chevron">›</span>
              </div>
            </div>
            <div className="card" onClick={() => alert('Call connecting to volunteer...')}>
              <div className="card-row">
                <div className="icon-box" style={{ background: '#FAEEDA' }}><svg width="22" height="22" stroke="#854F0B" strokeWidth="1.5" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg></div>
                <div style={{ flex: 1 }}><p className="card-title">{t.volunteer_btn}</p><p className="card-sub">24/7 Digital support</p></div>
                <span className="chevron">›</span>
              </div>
            </div>
          </div>
        </div>
      )
      case 1: return (
        <div className="screen active">
          <div className="topbar"><div><h1>{t.nav_schemes}</h1><p>{lang === 'te' ? 'ప్రభుత్వ పథకాలు' : 'Government Schemes'}</p></div></div>
          <div className="screen-body">
            {schemes.length > 0 ? schemes.map(s => (
              <div key={s.id} className="card">
                <div className="card-row">
                  <div className="icon-box" style={{ background: categoryColors[s.category] || '#EEEDFE', fontSize: '20px' }}>{categoryIcons[s.category] || '📋'}</div>
                  <div style={{ flex: 1 }}>
                    <p className="card-title">{s.name}</p>
                    <p className="card-sub">{s.description}</p>
                  </div>
                </div>
                {s.eligibility && <div style={{ marginTop: '10px', padding: '8px 12px', background: '#F8FBF9', borderRadius: '8px' }}><p style={{ fontSize: '11px', color: '#0F6E56', fontWeight: 600, margin: 0 }}>👤 {lang === 'te' ? 'అర్హత' : 'Eligibility'}</p><p style={{ fontSize: '12px', color: '#444', margin: '2px 0 0' }}>{s.eligibility}</p></div>}
                {s.benefit && <div style={{ marginTop: '6px', padding: '8px 12px', background: '#FFFAF0', borderRadius: '8px' }}><p style={{ fontSize: '11px', color: '#854F0B', fontWeight: 600, margin: 0 }}>💰 {lang === 'te' ? 'ప్రయోజనం' : 'Benefit'}</p><p style={{ fontSize: '12px', color: '#444', margin: '2px 0 0' }}>{s.benefit}</p></div>}
                <span className="badge" style={{ background: '#E1F5EE', color: '#0F6E56', marginTop: '8px' }}>{categoryIcons[s.category]} {s.category}</span>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa' }}>
                <p style={{ fontSize: '40px', marginBottom: '10px' }}>🏛️</p>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>{lang === 'te' ? 'పథకాలు తర్వాత అందుబాటులో ఉంటాయి' : 'Schemes coming soon'}</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>{lang === 'te' ? 'అడ్మిన్ పథకాలను జోడిస్తారు' : 'Admin will publish schemes here'}</p>
              </div>
            )}
          </div>
        </div>
      )
      case 3: return (
        <div className="screen active">
          <div className="topbar"><div><h1>{t.nav_complaint}</h1><p>Secure File Management</p></div></div>
          <div className="screen-body">
            {isCameraOpen ? (
              <div className="camera-overlay">
                <video ref={videoRef} autoPlay playsInline muted className="camera-video"></video>
                <div className="camera-controls">
                  <button onClick={stopCamera} className="camera-btn secondary">✕</button>
                  <button onClick={capturePhoto} className="camera-btn primary">📸 Capture Hazard</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '15px' }}>
                  <button className="cta-btn" onClick={() => isRecording ? stopRecording() : startRecording()} style={{ background: isRecording ? '#cc0000' : '#0F6E56', height: '60px', margin: 0, fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span>{isRecording ? "🔴 STOP" : "🎙️"}</span>
                    <span style={{ fontSize: '10px' }}>{isRecording ? "" : "Voice"}</span>
                  </button>
                  
                  <button className="cta-btn" onClick={startCamera} style={{ background: '#EEEDFE', border: '1px solid #534AB7', color: '#534AB7', height: '60px', margin: 0, fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span>📸</span>
                    <span style={{ fontSize: '10px' }}>Live</span>
                  </button>

                  <div style={{ position: 'relative' }}>
                    <input type="file" accept="image/*" onChange={handleImageAnalysis} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }} />
                    <button className="cta-btn" style={{ background: '#FAEEDA', border: '1px solid #854F0B', color: '#854F0B', height: '60px', width: '100%', margin: 0, fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span>📁</span>
                      <span style={{ fontSize: '10px' }}>Gallery</span>
                    </button>
                  </div>
                </div>
                
                <div className="card" style={{ minHeight: '120px', background: '#fff', border: isRecording || analysisLoading ? '2.5px solid #0F6E56' : '1px solid #eee' }}>
                  {selectedImage && <img src={selectedImage} alt="Preview" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '10px', marginBottom: '10px' }} />}
                  <p className="section-label">{analysisLoading ? (lang === 'te' ? "AI విశ్లేషిస్తోంది..." : "AI Reviewing Site...") : (isRecording ? "Listening..." : "Live Transcript:")}</p>
                  <p style={{ marginTop: '10px', fontSize: '12px', fontStyle: analysisLoading ? 'italic' : 'normal', lineHeight: '1.4' }}>{analysisLoading ? "Checking safety rules..." : (complaintText || "...")}</p>
                </div>
                {audioURL && <div className="card" style={{ background: '#E1F5EE' }}><audio controls src={audioURL} style={{ width: '100%', marginTop: '5px' }} /><button className="cta-btn" style={{ background: '#cc0000', padding: '5px', marginTop: '8px', fontSize: '11px' }} onClick={() => { setAudioURL(null); setAudioBlob(null); setComplaintText('') }}>{t.delete_btn}</button></div>}
                <button className="cta-btn" onClick={handleSubmit} disabled={isSubmitting} style={{ marginTop: '15px' }}>{isSubmitting ? '...' : t.submit_complaint}</button>
              </>
            )}
          </div>
        </div>
      )
      case 4: 
        const userComplaints = complaints.filter(c => c.uan === uan);
        return (
          <div className="screen active">
            <div className="topbar"><div><h1>{t.nav_track}</h1><p>Worker Profile & History</p></div></div>
            <div className="screen-body">
              {/* Profile Card */}
              <div className="card" style={{ background: 'linear-gradient(to bottom, #FAFFFE, #fff)', border: '1.5px solid #E1F5EE' }}>
                <div className="profile-header">
                  <div className="avatar-circle">R</div>
                  <div>
                    <p className="profile-name">Ramesh Kumar</p>
                    <p className="section-label">UAN: {uan}</p>
                  </div>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <div className="detail-row"><span className="detail-label">{t.job_type}</span><span className="detail-value">{job}</span></div>
                  <div className="detail-row"><span className="detail-label">{t.income}</span><span className="detail-value">{income}</span></div>
                  <div className="detail-row"><span className="detail-label">{t.total_complaints}</span><span className="detail-value" style={{ color: '#0F6E56' }}>{userComplaints.length}</span></div>
                </div>
              </div>

              <p className="section-label" style={{ marginTop: '10px' }}>{t.recent_activity}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {userComplaints.length > 0 ? userComplaints.map(c => (
                  <div key={c.id} className="card" style={{ borderLeft: c.status === 'pending' ? '4px solid #cc0000' : '4px solid #0F6E56' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p className="card-title">{c.issue}</p>
                      <span className="badge" style={{ 
                        background: c.status === 'pending' ? '#FFEBEB' : '#E1F5EE', 
                        color: c.status === 'pending' ? '#cc0000' : '#0F6E56' 
                      }}>
                        {c.status === 'pending' ? t.status_pending : t.status_resolved}
                      </span>
                    </div>
                    <p className="card-sub" style={{ margin: '4px 0 8px' }}>{c.details}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#aaa' }}>ID: ...{c.id.slice(-6)}</span>
                      {c.status === 'resolved' && <span style={{ fontSize: '11px', color: '#0F6E56', fontWeight: 600 }}>✅ Completed</span>}
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa' }}>
                    <p style={{ fontSize: '40px' }}>📄</p>
                    <p style={{ fontSize: '12px', fontWeight: 600 }}>No complaints filed yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="app-container">
      <LangToggle />
      {/* <div id="recaptcha-container"></div>  (Disabled) */}
      <div className="screens-wrapper">{renderScreen()}</div>
      {!isAdmin && (
        <nav className="bottom-nav">
          {[{ h: t.nav_home, i: 0, d: "M3 11L11 3l8 8v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-9z" }, { h: t.nav_schemes, i: 1, d: "M3 4h16m-16 5h16m-16 5h16" }, { h: t.nav_complaint, i: 3, d: "M11 3L3 19h16L11 3z" }, { h: t.nav_track, i: 4, d: "M11 8a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.8 3.1-7 7-7s7 3.2 7 7" }
          ].map(it => <div key={it.i} className={`nav-item ${activeScreen === it.i ? 'active' : ''}`} onClick={() => go(it.i)}><svg width="22" height="22" viewBox="0 0 22 22"><path d={it.d} stroke="currentColor" strokeWidth="1.5" /></svg><span>{it.h}</span></div>)}
        </nav>
      )}
    </div>
  )
}

export default App
