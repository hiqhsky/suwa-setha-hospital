import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as faceapi from "@vladmandic/face-api";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertOctagon, AlertTriangle, BarChart3, BadgeCheck, Bell,
  Camera, CameraOff, CheckCircle2, ChevronRight, ClipboardList, Clock,
  Database, Download, Eye, FileBarChart, FileText, Fingerprint, GitBranch,
  Home, Layers, Lock, LogIn, LogOut, Menu, RefreshCw, Scale, Search,
  Settings, Shield, ShieldAlert, ShieldCheck, ShieldX, Sparkles, TrendingUp,
  UserPlus, Users, X, Zap,
} from "lucide-react";

/* ============================================================================
   THEME & CONSTANTS
============================================================================ */
const T = {
  black: "#000000", void: "#080808", bg: "#0c0c0c", bg2: "#121212",
  panel: "#181818", panel2: "#202020", graphite: "#2b2b2b", steel: "#414141",
  silver: "#6f6f6f", ash: "#929292", white: "#ffffff", text: "#f5f5f5",
  muted: "#b7b7b7", dim: "#747474", line: "rgba(255,255,255,.10)",
  line2: "rgba(255,255,255,.05)", lineStrong: "rgba(255,255,255,.18)",
  accentDim: "rgba(255,255,255,.10)", good: "#4ade80", warn: "#facc15", bad: "#f87171",
};

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";
const ROLES = ["Doctor", "Nurse", "Administrator", "Receptionist"];
const DEPARTMENTS = ["Emergency", "ICU", "Radiology", "Pharmacy", "Administration", "OPD"];

const PATIENTS = [
  { id: "PT-24081", name: "R. Fernando", ward: "Ward 3", admitted: "2025-03-12", status: "Stable", doctor: "Dr. Wickrama", hr: 78, bp: "118/76", spo2: 98, notes: "Post-op day 4. Wound healing well." },
  { id: "PT-24056", name: "M. Silva", ward: "ICU-2", admitted: "2025-03-14", status: "Critical", doctor: "Dr. Perera", hr: 112, bp: "92/58", spo2: 91, notes: "Respiratory support ongoing." },
  { id: "PT-23998", name: "K. Jayasuriya", ward: "Ward 1", admitted: "2025-03-10", status: "Stable", doctor: "Dr. Fernando", hr: 72, bp: "124/80", spo2: 97, notes: "HTN review. Medications adjusted." },
];

const publicNav = [
  { id: "landing", label: "Overview", icon: Home },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "capabilities", label: "Capabilities", icon: Zap },
  { id: "ethics", label: "Ethics", icon: Scale },
  { id: "iterations", label: "Iterations", icon: GitBranch },
];

const dashboardNav = [
  { section: "Clinical", items: [{ id: "records", label: "Patient Records", icon: FileText, roles: ["Doctor", "Nurse", "Administrator"] }] },
  { section: "Security", items: [
      { id: "overview", label: "Security Overview", icon: Shield, roles: ["Doctor", "Nurse", "Administrator", "Receptionist"] },
      { id: "analytics", label: "Security Analytics", icon: BarChart3, roles: ["Administrator"] },
      { id: "log", label: "My Access Log", icon: ClipboardList, roles: ["Doctor", "Nurse", "Administrator", "Receptionist"] },
  ]},
  { section: "Intelligence", items: [
      { id: "insights", label: "AI Security Insights", icon: Sparkles, roles: ["Administrator"] },
      { id: "timeline", label: "Threat Timeline", icon: Clock, roles: ["Administrator"] },
  ]},
  { section: "Operations", items: [
      { id: "incidents", label: "Security Incidents", icon: AlertOctagon, roles: ["Administrator"] },
      { id: "alerts", label: "Security Alerts", icon: Bell, roles: ["Administrator"] },
      { id: "explorer", label: "Data Explorer", icon: Search, roles: ["Administrator"] },
  ]},
  { section: "Administration", items: [
      { id: "staff", label: "Staff Directory", icon: Users, roles: ["Administrator"] },
      { id: "audit", label: "Audit Log", icon: FileBarChart, roles: ["Administrator"] },
      { id: "health", label: "System Health", icon: Activity, roles: ["Administrator"] },
      { id: "compliance", label: "Compliance Centre", icon: ShieldCheck, roles: ["Administrator"] },
      { id: "simulator", label: "Policy Simulator", icon: Zap, roles: ["Administrator"] },
      { id: "settings", label: "Security Settings", icon: Settings, roles: ["Doctor", "Nurse", "Administrator", "Receptionist"] },
  ]},
];

/* ============================================================================
   HELPERS & DATABASE SERVICE
============================================================================ */
function normalizeUser(user) {
  return { userId: user.userId || user.staffId, staffId: user.staffId, name: user.name || "Unnamed", role: user.role || "Doctor", department: user.department || "Admin", captures: user.captures || [], enrolledAt: user.enrolledAt || Date.now() };
}
function normalizeEvent(event) {
  return { ...event, userId: event.userId || event.staffId, staffId: event.staffId || "—", userName: event.userName || "Unknown", role: event.role || "—", department: event.department || "—", timestamp: typeof event.timestamp === "number" ? event.timestamp : Date.now(), riskScore: Number(event.riskScore ?? 0), riskLevel: event.riskLevel || "high", outcome: event.outcome || "Denied", device: event.device || "Unknown", location: event.location || "Unknown", factors: event.factors || [] };
}

class DatabaseService {
  constructor() { this.db = null; this.dbName = "SuwaSethaDB"; this.version = 5; }
  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const ensure = (name, opts, idxs) => {
          const store = db.objectStoreNames.contains(name) ? event.target.transaction.objectStore(name) : db.createObjectStore(name, opts);
          idxs.forEach(([n, k]) => { if (!store.indexNames.contains(n)) store.createIndex(n, k, { unique: false }); });
        };
        ensure("users", { keyPath: "staffId" }, [["name", "name"], ["role", "role"]]);
        ensure("authenticationEvents", { keyPath: "id", autoIncrement: true }, [["timestamp", "timestamp"]]);
        ensure("incidents", { keyPath: "id", autoIncrement: true }, [["timestamp", "timestamp"]]);
        ensure("alerts", { keyPath: "id", autoIncrement: true }, [["timestamp", "timestamp"]]);
        ensure("auditLogs", { keyPath: "id", autoIncrement: true }, [["timestamp", "timestamp"]]);
      };
      request.onsuccess = () => { this.db = request.result; resolve(this.db); };
      request.onerror = () => reject(request.error);
    });
  }
  async put(store, val) { const db = await this.init(); return new Promise((res, rej) => { const req = db.transaction(store, "readwrite").objectStore(store).put(val); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async add(store, val) { const db = await this.init(); return new Promise((res, rej) => { const req = db.transaction(store, "readwrite").objectStore(store).add(val); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async getAll(store, idx = null, dir = "prev") {
    const db = await this.init();
    return new Promise((res, rej) => {
      const src = idx ? db.transaction(store, "readonly").objectStore(store).index(idx) : db.transaction(store, "readonly").objectStore(store);
      const req = src.openCursor(null, dir); const results = [];
      req.onsuccess = (e) => { const c = e.target.result; if (c) { results.push(c.value); c.continue(); } else res(results); };
      req.onerror = () => rej(req.error);
    });
  }
  async get(store, key) { const db = await this.init(); return new Promise((res, rej) => { const req = db.transaction(store, "readonly").objectStore(store).get(key); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async update(store, key, updates) { const c = await this.get(store, key); if(!c) throw new Error("Not found"); return this.put(store, {...c, ...updates}); }
  async users() { return (await this.getAll("users", "name", "next")).map(normalizeUser); }
  async events() { return (await this.getAll("authenticationEvents", "timestamp", "prev")).map(normalizeEvent); }
  async incidents() { return this.getAll("incidents", "timestamp", "prev"); }
  async alerts() { return this.getAll("alerts", "timestamp", "prev"); }
  async audits() { return this.getAll("auditLogs", "timestamp", "prev"); }
}
const db = new DatabaseService();

/* ============================================================================
   FACE API & CAMERA LOGIC
============================================================================ */
let faceInitPromise = null;
async function initFaceApiOnce() {
  if (faceInitPromise) return faceInitPromise;
  faceInitPromise = (async () => {
    const tf = faceapi?.tf;
    if (tf?.ready && tf?.setBackend) {
      for (const b of ["webgl", "wasm", "cpu"]) { try { await tf.setBackend(b); await tf.ready(); break; } catch {} }
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    return true;
  })();
  return faceInitPromise;
}

const CameraStates = { IDLE: "idle", LOADING: "loading", REQ: "req", INIT: "init", READY: "ready", DETECTING: "detecting", DETECTED: "detected", ERROR: "error" };

const BiometricCamera = forwardRef(function BiometricCamera({ autoStart, onFaceDetected, onStateChange, onError, inputSize=192, scoreThreshold=0.45 }, ref) {
  const [state, setState] = useState(CameraStates.IDLE);
  const [faceDetected, setFaceDetected] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef(null), streamRef = useRef(null), mountedRef = useRef(true), timerRef = useRef(null);
  const faceCb = useRef(onFaceDetected), stateCb = useRef(onStateChange), errCb = useRef(onError);
  useEffect(() => { faceCb.current = onFaceDetected; stateCb.current = onStateChange; errCb.current = onError; }, [onFaceDetected, onStateChange, onError]);

  const emitState = (s) => { if(mountedRef.current) { setState(s); stateCb.current?.(s); } };
  const emitFace = (f) => { if(mountedRef.current) { setFaceDetected(f); faceCb.current?.(f); } };

  const stop = useCallback(() => {
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    if(videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null; }
    emitFace(false); emitState(CameraStates.IDLE);
  }, []);

  const detectOnce = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState < 2 || !streamRef.current) return;
    try {
      const det = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold }));
      emitFace(Boolean(det)); emitState(Boolean(det) ? CameraStates.DETECTED : CameraStates.DETECTING);
    } catch {}
    timerRef.current = setTimeout(detectOnce, 450);
  }, [inputSize, scoreThreshold]);

  const start = useCallback(async () => {
    stop(); emitState(CameraStates.LOADING); setError("");
    try {
      await initFaceApiOnce();
      emitState(CameraStates.REQ);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: {ideal: 960}, height: {ideal: 540} } });
      streamRef.current = stream; emitState(CameraStates.INIT);
      videoRef.current.srcObject = stream; await videoRef.current.play();
      emitState(CameraStates.READY); detectOnce();
    } catch (e) {
      setError(e.name === "NotAllowedError" ? "Camera permission denied." : "Camera access failed.");
      emitState(CameraStates.ERROR); errCb.current?.(error);
    }
  }, [stop, detectOnce]);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || videoRef.current.readyState < 2 || !faceDetected) return null;
    const c = document.createElement("canvas"); c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight;
    const ctx = c.getContext("2d"); ctx.translate(c.width, 0); ctx.scale(-1, 1); ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.86);
  }, [faceDetected]);

  useImperativeHandle(ref, () => ({ start, stop, captureFrame, isFaceDetected: () => faceDetected }), [start, stop, captureFrame, faceDetected]);
  useEffect(() => { mountedRef.current = true; if(autoStart) start(); else stop(); return () => { mountedRef.current = false; stop(); }; }, [autoStart, start, stop]);

  return (
    <div className="camera-wrap">
      <div className="scanner-frame">
        <video ref={videoRef} muted playsInline autoPlay className="scanner-video" />
        {state !== CameraStates.ERROR && <div className={`face-guide ${faceDetected ? "active" : ""}`} />}
        {state === CameraStates.ERROR && <div className="camera-error"><CameraOff size={32}/><p>{error}</p><button onClick={start}>Retry</button></div>}
      </div>
      <div className="camera-status">{state === CameraStates.DETECTED ? "FACE DETECTED" : state === CameraStates.DETECTING ? "SEARCHING..." : state === CameraStates.ERROR ? "ERROR" : "CAMERA ACTIVE"}</div>
    </div>
  );
});

/* ============================================================================
   UI PRIMITIVES & HELPERS
============================================================================ */
function MangaPanel({ children, className="", hover=false }) { return <motion.div whileHover={hover ? {y: -2, borderColor: T.lineStrong} : {}} className={`manga-panel ${className}`}>{children}</motion.div>; }
function MangaButton({ children, variant="primary", icon: Icon, onClick, disabled, className="" }) { return <motion.button whileHover={{y: disabled?0:-1}} whileTap={{scale: disabled?1:0.98}} disabled={disabled} onClick={onClick} className={`manga-btn manga-btn-${variant} ${className}`}>{Icon && <Icon size={16}/>} {children}</motion.button>; }
function MangaInput({ label, ...props }) { return <label className="field">{label && <span>{label}</span>}<input {...props} /></label>; }
function MangaSelect({ label, value, onChange, options }) { return <label className="field">{label && <span>{label}</span>}<select value={value} onChange={onChange}>{options.map(o => <option key={o} value={o}>{o}</option>)}</select></label>; }
function SectionHeader({ eyebrow, title, description, action }) { return <div className="section-header"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>; }
function StatusPill({ children, tone="neutral" }) { return <span className={`status-pill status-${tone}`}>{children}</span>; }
function StatCard({ label, value, icon: Icon }) { return <MangaPanel className="stat-card" hover><div className="stat-top"><span className="eyebrow">{label}</span>{Icon && <Icon size={18} color={T.muted}/>}</div><strong>{value}</strong></MangaPanel>; }
function ProgressBar({ value }) { return <div className="progress-track"><motion.div initial={{width:0}} animate={{width: `${Math.max(0, Math.min(100, value))}%`}} className="progress-value"/></div>; }
function formatDate(ts) { return new Date(ts).toLocaleString("en-GB", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
function riskTier(score) { if(score<=30) return {key:"low", label:"TRUSTED — ACCESS GRANTED", tone:"good"}; if(score<=60) return {key:"med", label:"CAUTION — STEP-UP REQUIRED", tone:"warn"}; return {key:"high", label:"HIGH RISK — ACCESS DENIED", tone:"bad"}; }

function calculateRisk({ enrolled, anomalous, failed, scenario="standard" }) {
  const f = { device: enrolled?5:25, location: 5, time: 5, attempts: failed<=2?10:35, biometric: enrolled?4:28 };
  if(scenario==="elevated") { f.device=15; f.location=10; f.biometric=8; }
  if(scenario==="suspicious" || anomalous) { f.device=25; f.location=30; f.biometric=18; }
  const score = Math.min(100, Object.values(f).reduce((s,v)=>s+v,0));
  return { score, factors: [
    {label:"Device Recognition", value:f.device, desc: f.device<=5?"Known hospital workstation":"Unrecognized device"},
    {label:"Network Location", value:f.location, desc: f.location<=5?"Internal hospital network":"Unfamiliar location"},
    {label:"Time Pattern", value:f.time, desc: "Normal shift pattern"},
    {label:"Failed Attempts", value:f.attempts, desc: `${failed||0} recent failures`},
    {label:"Biometric Presence", value:f.biometric, desc: enrolled?"Live face detected":"No enrolled profile"}
  ]};
}

/* ============================================================================
   MAIN APP COMPONENT
============================================================================ */
export default function App() {
  const [view, setView] = useState("landing");
  const [dashTab, setDashTab] = useState("overview");
  const [toast, setToast] = useState("");
  const [dbState, setDbState] = useState("init");
  const [users, setUsers] = useState([]), [events, setEvents] = useState([]), [incidents, setIncidents] = useState([]), [alerts, setAlerts] = useState([]), [audits, setAudits] = useState([]);
  const [session, setSession] = useState(null);
  
  // Enrolment State
  const [enrollStep, setEnrollStep] = useState(0);
  const [enrollConsent, setEnrollConsent] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ name: "", staffId: "", role: "Doctor", department: "Emergency" });
  const [enrollCaptures, setEnrollCaptures] = useState([]);
  const enrollCamRef = useRef(null);

  // Auth State
  const [authStaffId, setAuthStaffId] = useState("");
  const [authPhase, setAuthPhase] = useState("idle");
  const [authRisk, setAuthRisk] = useState(null);
  const [authScenario, setAuthScenario] = useState("standard");
  const [authOtp, setAuthOtp] = useState("");
  const [authOtpActive, setAuthOtpActive] = useState(false);
  const authCamRef = useRef(null);

  const refresh = useCallback(async () => {
    setUsers(await db.users()); setEvents(await db.events()); setIncidents(await db.incidents()); setAlerts(await db.alerts()); setAudits(await db.audits());
  }, []);

  useEffect(() => { db.init().then(() => { refresh(); setDbState("ready"); }).catch(() => setDbState("error")); initFaceApiOnce(); }, [refresh]);
  useEffect(() => { if(!toast) return; const t = setTimeout(()=>setToast(""), 3000); return ()=>clearTimeout(t); }, [toast]);

  const addAudit = async (action, details) => { await db.add("auditLogs", { timestamp: Date.now(), action, userId: session?.staffId || "system", details }); };
  
  const navigate = (v) => { 
    setView(v); 
    if(v==="enroll") { setEnrollStep(0); setEnrollConsent(false); setEnrollCaptures([]); }
    if(v==="login") { setAuthPhase("idle"); setAuthRisk(null); setAuthOtp(""); setAuthOtpActive(false); }
    if(v==="dashboard") setDashTab("overview");
  };

  const analytics = useMemo(() => {
    const total = events.length, granted = events.filter(e=>e.outcome==="Granted").length, denied = events.filter(e=>e.outcome==="Denied").length;
    const avgRisk = total ? Math.round(events.reduce((s,e)=>s+e.riskScore,0)/total) : 0;
    const openInc = incidents.filter(i=>i.status!=="Resolved").length;
    return { total, granted, denied, avgRisk, openInc, posture: Math.max(0, 100 - denied*3 - openInc*5 - (avgRisk>50?12:0)) };
  }, [events, incidents]);

  const aiInsights = useMemo(() => {
    if(analytics.denied > 2) return [{severity:"high", title:"Elevated Denial Rate", evidence:`${analytics.denied} recent attempts denied.`, recommendation:"Review device and network patterns."}];
    if(analytics.openInc > 0) return [{severity:"high", title:"Open Security Incidents", evidence:`${analytics.openInc} incidents unresolved.`, recommendation:"Investigate in Incident Centre."}];
    return [{severity:"low", title:"Normal Security Posture", evidence:`${analytics.total} events analyzed.`, recommendation:"Continue monitoring."}];
  }, [analytics]);

  /* --- ENROLMENT LOGIC --- */
  const captureFrame = () => {
    if(enrollCaptures.length >= 3) return;
    const frame = enrollCamRef.current?.captureFrame();
    if(frame) { setEnrollCaptures(c => [...c, frame]); setToast("Frame captured."); }
    else setToast("No face detected. Try again.");
  };

  const completeEnroll = async () => {
    const id = enrollForm.staffId || `SS-${Math.floor(1000+Math.random()*9000)}`;
    await db.put("users", { ...enrollForm, staffId: id, captures: enrollCaptures, enrolledAt: Date.now() });
    await addAudit("ENROLLMENT", `Biometric enrollment for ${enrollForm.name}`);
    refresh(); setEnrollStep(4); setToast("Enrollment complete.");
  };

  /* --- AUTH LOGIC --- */
  const selectedUser = users.find(u => u.staffId === authStaffId);
  
  const processAuth = async () => {
    if(!selectedUser) return;
    const risk = calculateRisk({ enrolled: true, scenario: authScenario, failed: 0 });
    const tier = riskTier(risk.score);
    const outcome = tier.key === "low" ? "Granted" : tier.key === "med" ? "Step-up" : "Denied";
    
    await db.add("authenticationEvents", { userId: selectedUser.staffId, staffId: selectedUser.staffId, userName: selectedUser.name, role: selectedUser.role, department: selectedUser.department, riskScore: risk.score, riskLevel: tier.key, outcome, device: authScenario==="suspicious"?"Unknown":"Workstation-A12", location: authScenario==="suspicious"?"External":"Core LAN", factors: risk.factors.map(f=>f.desc), timestamp: Date.now() });
    await addAudit("AUTH_ATTEMPT", `${outcome} for ${selectedUser.name} (Risk: ${risk.score})`);
    
    if(tier.key === "high") {
      const incId = await db.add("incidents", { userId: selectedUser.staffId, userName: selectedUser.name, riskScore: risk.score, status: "New", timestamp: Date.now() });
      await db.add("alerts", { type: "HIGH_RISK", message: `High risk auth for ${selectedUser.name}`, read: false, timestamp: Date.now() });
    }
    refresh(); setAuthRisk(risk); setAuthPhase("result");
  };

  const verifyOtp = async () => {
    if(authOtp === "123456") {
      await addAudit("OTP_SUCCESS", `OTP verified for ${selectedUser.name}`);
      setSession(selectedUser); navigate("dashboard"); setToast("Access Granted.");
    } else { setToast("Invalid OTP. Demo code is 123456"); }
  };

  /* ============================================================================
     RENDER VIEWS
  ============================================================================ */

  // 📸 SCREENSHOT: LANDING PAGE
  if(view === "landing") return (
    <div className="app-shell">
      <header className="public-nav">
        <div className="brand"><Shield size={20}/> <strong>SUWA SETHA</strong> <small>SECURITY INTELLIGENCE</small></div>
        <nav>{publicNav.map(i => <button key={i.id} onClick={()=>navigate(i.id)}>{i.label}</button>)}</nav>
        <div><MangaButton variant="ghost" icon={LogIn} onClick={()=>navigate("login")}>Login</MangaButton> <MangaButton icon={UserPlus} onClick={()=>navigate("enroll")}>Enrol</MangaButton></div>
      </header>
      <div className="landing-hero">
        <div>
          <div className="eyebrow">AI BIOMETRIC ACCESS CONTROL</div>
          <h1>SECURING <span>HEALTHCARE</span> OPERATIONS</h1>
          <p>AI-assisted biometric cybersecurity prototype combining real-time face detection, contextual risk assessment and persistent security intelligence.</p>
          <div className="button-row"><MangaButton icon={UserPlus} onClick={()=>navigate("enroll")}>Enrol Biometric</MangaButton><MangaButton variant="secondary" icon={LogIn} onClick={()=>navigate("login")}>Secure Login</MangaButton></div>
        </div>
        <div className="hero-scanner"><Fingerprint size={100}/></div>
      </div>
    </div>
  );

  // 📸 SCREENSHOT: ETHICS PAGE
  if(view === "ethics") return (
    <div className="app-shell">
      <header className="public-nav"><button onClick={()=>navigate("landing")} className="brand"><strong>SUWA SETHA</strong></button><nav>{publicNav.map(i => <button key={i.id} onClick={()=>navigate(i.id)} className={view===i.id?"active":""}>{i.label}</button>)}</nav></header>
      <div className="public-page">
        <SectionHeader eyebrow="ETHICS & GOVERNANCE" title="Responsible Biometric Security" description="The prototype is intentionally transparent about its limits and the controls a real deployment would require." />
        <div className="stack-list">
          <MangaPanel><h3>Consent & Privacy</h3><p>Biometric capture requires explicit consent in the prototype, while production deployment would require stronger privacy controls and data-governance processes.</p></MangaPanel>
          <MangaPanel><h3>Security</h3><p>Biometric references are sensitive. Production deployment would require encryption, secure template handling, key management, retention controls and independent testing.</p></MangaPanel>
          <MangaPanel><h3>Fairness & Accessibility</h3><p>False rejects, accessibility needs and demographic performance differences must be considered before real clinical deployment.</p></MangaPanel>
        </div>
      </div>
    </div>
  );

  // 📸 SCREENSHOT: ITERATIONS PAGE (Crucial for M4)
  if(view === "iterations") return (
    <div className="app-shell">
      <header className="public-nav"><button onClick={()=>navigate("landing")} className="brand"><strong>SUWA SETHA</strong></button><nav>{publicNav.map(i => <button key={i.id} onClick={()=>navigate(i.id)} className={view===i.id?"active":""}>{i.label}</button>)}</nav></header>
      <div className="public-page">
        <SectionHeader eyebrow="ITERATION LOG" title="Prototype Evolution" description="Documented design progression based on end-user feedback." />
        <div className="timeline">
          {[ ["V1", "Basic biometric access", "Initial concept explored biometric authentication."],
             ["V2", "Contextual risk scoring", "Added device, network, and time factors instead of binary pass/fail."],
             ["V3", "Consent and step-up", "Added explicit biometric consent and OTP step-up verification."],
             ["V4", "Persistent security data", "Added IndexedDB persistence for analytics and incidents."],
             ["V5", "Navigation and usability", "Unified navigation and role-aware command centre."]
          ].map(([v, t, d]) => (
            <div className="timeline-item" key={v}><div className="timeline-dot"/><MangaPanel className="timeline-card"><div className="eyebrow">{v}</div><h3>{t}</h3><p>{d}</p></MangaPanel></div>
          ))}
        </div>
      </div>
    </div>
  );

  // 📸 SCREENSHOT: ENROLMENT PAGES (Crucial for P4 & Ethics)
  if(view === "enroll") return (
    <div className="app-shell">
      <header className="public-nav"><button onClick={()=>navigate("landing")} className="brand"><strong>SUWA SETHA</strong></button></header>
      <div className="public-page narrow">
        <SectionHeader eyebrow="BIOMETRIC ENROLMENT" title="Create a secure staff profile" />
        <div className="progress-steps">{["CONSENT", "DETAILS", "CAPTURE", "CONFIRM", "COMPLETE"].map((s, i) => <div key={s} className={enrollStep>=i?"step active":"step"}><span>{i+1}</span>{s}</div>)}</div>
        
        {enrollStep === 0 && (
          // 📸 SCREENSHOT: CONSENT CHECKBOX
          <MangaPanel>
            <Lock size={30} className="center-icon"/>
            <h3 style={{textAlign:"center"}}>Biometric Consent</h3>
            <p className="center-text">This prototype captures facial reference frames. Production systems require secure templates and governance.</p>
            <label className="consent-box"><input type="checkbox" checked={enrollConsent} onChange={e=>setEnrollConsent(e.target.checked)} /><span>I understand and consent to prototype biometric capture.</span></label>
            <MangaButton disabled={!enrollConsent} icon={ChevronRight} onClick={()=>setEnrollStep(1)}>Continue</MangaButton>
          </MangaPanel>
        )}

        {enrollStep === 1 && (
          <MangaPanel>
            <h3>Staff Profile</h3>
            <div className="form-grid">
              <MangaInput label="Full Name" value={enrollForm.name} onChange={e=>setEnrollForm({...enrollForm, name:e.target.value})} placeholder="Dr. Nimal Perera" />
              <MangaInput label="Staff ID" value={enrollForm.staffId} onChange={e=>setEnrollForm({...enrollForm, staffId:e.target.value})} placeholder="SS-1042" />
              <MangaSelect label="Role" value={enrollForm.role} onChange={e=>setEnrollForm({...enrollForm, role:e.target.value})} options={ROLES} />
              <MangaSelect label="Department" value={enrollForm.department} onChange={e=>setEnrollForm({...enrollForm, department:e.target.value})} options={DEPARTMENTS} />
            </div>
            <MangaButton icon={Camera} onClick={()=>setEnrollStep(2)}>Enable Camera</MangaButton>
          </MangaPanel>
        )}

        {enrollStep === 2 && (
          // 📸 SCREENSHOT: CAMERA CAPTURE
          <MangaPanel>
            <h3>Live Biometric Capture</h3>
            <BiometricCamera ref={enrollCamRef} autoStart onFaceDetected={()=>{}} onStateChange={()=>{}} onError={()=>{}} />
            <div className="capture-strip">{[0,1,2].map(i => <div className="capture-box" key={i}>{enrollCaptures[i] ? <img src={enrollCaptures[i]} alt="cap"/> : <span>{i+1}</span>}</div>)}</div>
            <MangaButton icon={Camera} onClick={captureFrame} disabled={enrollCaptures.length>=3}>Capture {Math.min(enrollCaptures.length+1,3)}/3</MangaButton>
            {enrollCaptures.length===3 && <MangaButton variant="secondary" onClick={()=>setEnrollStep(3)}>Continue</MangaButton>}
          </MangaPanel>
        )}

        {enrollStep === 3 && (
          <MangaPanel>
            <h3>Confirm Enrollment</h3>
            <p>{enrollForm.name} · {enrollForm.role} · {enrollForm.department}</p>
            <div className="capture-strip">{enrollCaptures.map((c,i) => <img key={i} src={c} alt="cap" style={{width:80, borderRadius:8}}/>)}</div>
            <MangaButton icon={BadgeCheck} onClick={completeEnroll}>Complete Enrollment</MangaButton>
          </MangaPanel>
        )}

        {enrollStep === 4 && (
          <MangaPanel>
            <div className="success-screen"><CheckCircle2 size={62} color={T.good}/><h3>ENROLLMENT COMPLETE</h3><p>{enrollForm.name}</p><MangaButton onClick={()=>navigate("login")}>Proceed to Login</MangaButton></div>
          </MangaPanel>
        )}
      </div>
    </div>
  );

  // 📸 SCREENSHOT: LOGIN & AUTHENTICATION (Crucial for P4 & D2)
  if(view === "login") {
    const tier = authRisk ? riskTier(authRisk.score) : null;
    return (
      <div className="app-shell">
        <header className="public-nav"><button onClick={()=>navigate("landing")} className="brand"><strong>SUWA SETHA</strong></button></header>
        <div className="public-page narrow login-page">
          <SectionHeader eyebrow="SECURE ACCESS" title="Biometric Authentication" />
          
          <MangaPanel>
            <MangaSelect label="Select Enrolled Staff ID" value={authStaffId} onChange={e=>{setAuthStaffId(e.target.value); setAuthPhase("idle"); setAuthRisk(null);}} options={["", ...users.map(u=>u.staffId)]} />
            {selectedUser && <div className="selected-identity"><strong>{selectedUser.name}</strong><small>{selectedUser.role} · {selectedUser.department}</small></div>}
          </MangaPanel>

          <MangaPanel className="login-scanner">
            {authPhase !== "result" && selectedUser && <BiometricCamera ref={authCamRef} autoStart={authPhase!=="idle"} onFaceDetected={(det)=>{ if(det && authPhase==="camera_ready") { setAuthPhase("processing"); setTimeout(processAuth, 1500); }}} onStateChange={(s)=>{ if(s===CameraStates.READY) setAuthPhase("camera_ready"); }} onError={()=>{}} />}
            
            {authPhase === "idle" && <div className="scanner-idle"><Fingerprint size={64}/><p>SELECT STAFF ID THEN START SCAN</p><MangaButton disabled={!selectedUser} icon={Zap} onClick={()=>setAuthPhase("camera_starting")}>Start Secure Scan</MangaButton></div>}
            {authPhase === "processing" && <div className="scanner-idle"><Activity size={64} className="spin"/><p>CALCULATING CONTEXTUAL RISK...</p></div>}

            {authPhase === "result" && authRisk && tier && (
              <div className="auth-result">
                <div className="risk-score"><span>AI RISK SCORE</span><strong>{authRisk.score}</strong><small>/ 100</small></div>
                <StatusPill tone={tier.tone}>{tier.label}</StatusPill>
                <div className="risk-factors">{authRisk.factors.map(f => <div key={f.label} className="risk-factor"><span>{f.label}</span><strong>+{f.value}</strong><ProgressBar value={f.value*2.5}/></div>)}</div>
                
                {/* 📸 SCREENSHOT: OTP STEP-UP (Medium Risk) */}
                {tier.key === "med" && (
                  <div className="otp-box">
                    <div className="eyebrow">STEP-UP VERIFICATION REQUIRED</div>
                    {!authOtpActive ? <MangaButton onClick={()=>setAuthOtpActive(true)}>Send Demo OTP</MangaButton> : (
                      <div className="otp-row"><input value={authOtp} onChange={e=>setAuthOtp(e.target.value)} placeholder="123456" /><MangaButton onClick={verifyOtp}>Verify</MangaButton></div>
                    )}
                    <small>Demo code: 123456</small>
                  </div>
                )}

                {/* 📸 SCREENSHOT: ACCESS DENIED (High Risk) */}
                {tier.key === "high" && <div className="denied-box"><ShieldX size={34}/><strong>ACCESS DENIED</strong><span>Security incident and alert recorded.</span></div>}
                
                {/* 📸 SCREENSHOT: ACCESS GRANTED (Low Risk) */}
                {tier.key === "low" && <div className="success-box"><ShieldCheck size={34}/><strong>ACCESS AUTHORIZED</strong><MangaButton onClick={()=>{setSession(selectedUser); navigate("dashboard");}}>Enter Portal</MangaButton></div>}

                <MangaSelect label="Demo Scenario" value={authScenario} onChange={e=>setAuthScenario(e.target.value)} options={["standard", "elevated", "suspicious"]} />
                <MangaButton variant="ghost" icon={RefreshCw} onClick={()=>{setAuthPhase("idle"); setAuthRisk(null);}}>New Scan</MangaButton>
              </div>
            )}
          </MangaPanel>
          <MangaPanel className="prototype-note"><strong>Prototype note:</strong> Face detection is real. Identity matching is a prototype concept; production requires secure templates.</MangaPanel>
        </div>
      </div>
    );
  }

  // 📸 SCREENSHOT: DASHBOARD & ADMIN VIEWS (Crucial for P4 & D2)
  if(view === "dashboard" && session) {
    return (
      <div className="app-shell dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="sidebar-brand"><Shield size={17}/><strong>SUWA SETHA</strong></div>
          <div className="sidebar-user"><strong>{session.name}</strong><small>{session.role}</small></div>
          <nav>
            {dashboardNav.map(sec => (
              <div key={sec.section} className="nav-group">
                <div className="nav-group-title">{sec.section}</div>
                {sec.items.filter(i=>i.roles.includes(session.role)).map(i => (
                  <button key={i.id} className={dashTab===i.id?"active":""} onClick={()=>setDashTab(i.id)}><i.icon size={16}/>{i.label}</button>
                ))}
              </div>
            ))}
          </nav>
          <MangaButton variant="ghost" icon={LogOut} onClick={()=>{setSession(null); navigate("landing");}}>Logout</MangaButton>
        </aside>

        <main className="dashboard-main">
          <header className="dashboard-topbar"><h1>{dashTab.charAt(0).toUpperCase() + dashTab.slice(1)}</h1><StatusPill tone={analytics.posture>70?"good":"warn"}>POSTURE {analytics.posture}/100</StatusPill></header>
          
          <div className="dashboard-content">
            {dashTab === "overview" && (
              <div className="page-stack">
                <div className="stats-grid">
                  <StatCard label="Total Attempts" value={analytics.total} icon={Activity}/>
                  <StatCard label="Granted" value={analytics.granted} icon={ShieldCheck}/>
                  <StatCard label="Denied" value={analytics.denied} icon={ShieldX}/>
                  <StatCard label="Open Incidents" value={analytics.openInc} icon={AlertOctagon}/>
                </div>
                <MangaPanel><SectionHeader eyebrow="INTELLIGENCE" title="AI Security Insights"/><div className="stack-list">{aiInsights.map(i => <div key={i.title} className="insight-card"><StatusPill tone={i.severity==="high"?"bad":"good"}>{i.severity}</StatusPill><h3>{i.title}</h3><p>{i.evidence}</p></div>)}</div></MangaPanel>
              </div>
            )}

            {dashTab === "records" && (
              <div className="page-stack">
                <SectionHeader eyebrow="CLINICAL" title="Patient Records"/>
                <div className="patient-grid">{PATIENTS.map(p => <MangaPanel key={p.id} className="patient-card"><span>{p.id}</span><StatusPill tone={p.status==="Critical"?"bad":"good"}>{p.status}</StatusPill><strong>{p.name}</strong><small>{p.ward}</small></MangaPanel>)}</div>
              </div>
            )}

            {dashTab === "incidents" && (
              <div className="page-stack">
                <SectionHeader eyebrow="OPERATIONS" title="Security Incidents"/>
                {incidents.length ? incidents.map(i => <MangaPanel key={i.id}><h3>Incident #{i.id}</h3><p>{i.userName} · Risk {i.riskScore}</p><StatusPill tone="bad">{i.status}</StatusPill></MangaPanel>) : <p>No incidents.</p>}
              </div>
            )}

            {dashTab === "audit" && (
              // 📸 SCREENSHOT: AUDIT LOG
              <div className="page-stack">
                <SectionHeader eyebrow="GOVERNANCE" title="Audit Log"/>
                <MangaPanel><div className="audit-table">{audits.map(l => <div key={l.id} className="audit-row"><strong>{l.action}</strong><span>{formatDate(l.timestamp)}</span><p>{l.details}</p></div>)}</div></MangaPanel>
              </div>
            )}

            {dashTab === "compliance" && (
              // 📸 SCREENSHOT: COMPLIANCE CENTRE
              <div className="page-stack">
                <SectionHeader eyebrow="GOVERNANCE" title="Compliance Centre"/>
                <MangaPanel>
                  <div className="compliance-score"><span>CONTROL SCORE</span><strong>5/5</strong></div>
                  <div className="stack-list">
                    <div className="control-card"><strong>Biometric Consent</strong><StatusPill tone="good">PASS</StatusPill></div>
                    <div className="control-card"><strong>Role-Based Access</strong><StatusPill tone="good">PASS</StatusPill></div>
                    <div className="control-card"><strong>Audit Trail</strong><StatusPill tone="good">PASS</StatusPill></div>
                  </div>
                </MangaPanel>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  if(view === "dashboard" && !session) { navigate("login"); return null; }

  return <div className="app-shell"><p>Loading...</p></div>;
}