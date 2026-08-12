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
  Activity,
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  BadgeCheck,
  Bell,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Database,
  Download,
  Eye,
  FileBarChart,
  FileText,
  Fingerprint,
  GitBranch,
  Home,
  Layers,
  Lock,
  LogIn,
  LogOut,
  Menu,
  RefreshCw,
  Scale,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";

const T = {
  black: "#000000",
  void: "#080808",
  bg: "#0c0c0c",
  bg2: "#121212",
  panel: "#181818",
  panel2: "#202020",
  graphite: "#2b2b2b",
  steel: "#414141",
  silver: "#6f6f6f",
  ash: "#929292",
  white: "#ffffff",
  text: "#f5f5f5",
  muted: "#b7b7b7",
  dim: "#747474",
  line: "rgba(255,255,255,.10)",
  line2: "rgba(255,255,255,.05)",
  lineStrong: "rgba(255,255,255,.18)",
  accentDim: "rgba(255,255,255,.10)",
};

const MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/";

const ROLES = ["Doctor", "Nurse", "Administrator", "Receptionist"];
const DEPARTMENTS = [
  "Emergency",
  "ICU",
  "Radiology",
  "Pharmacy",
  "Administration",
  "OPD",
];

const PATIENTS = [
  {
    id: "PT-24081",
    name: "R. Fernando",
    ward: "Ward 3",
    admitted: "2025-03-12",
    status: "Stable",
    doctor: "Dr. Wickrama",
    hr: 78,
    bp: "118/76",
    spo2: 98,
    notes: "Post-op day 4. Wound healing well. Discharge planning underway.",
  },
  {
    id: "PT-24056",
    name: "M. Silva",
    ward: "ICU-2",
    admitted: "2025-03-14",
    status: "Critical",
    doctor: "Dr. Perera",
    hr: 112,
    bp: "92/58",
    spo2: 91,
    notes: "Respiratory support ongoing. Family briefed 07:40.",
  },
  {
    id: "PT-23998",
    name: "K. Jayasuriya",
    ward: "Ward 1",
    admitted: "2025-03-10",
    status: "Stable",
    doctor: "Dr. Fernando",
    hr: 72,
    bp: "124/80",
    spo2: 97,
    notes: "HTN review. Medications adjusted. Labs pending.",
  },
  {
    id: "PT-24102",
    name: "A. Bandara",
    ward: "Ward 5",
    admitted: "2025-03-15",
    status: "Discharged",
    doctor: "Dr. Wickrama",
    hr: 68,
    bp: "120/78",
    spo2: 99,
    notes: "Discharged on oral antibiotics. Follow-up in 1 week.",
  },
  {
    id: "PT-24077",
    name: "S. Gunasekara",
    ward: "Emergency",
    admitted: "2025-03-16",
    status: "Critical",
    doctor: "Dr. Perera",
    hr: 124,
    bp: "88/54",
    spo2: 89,
    notes: "Trauma case. Stabilization in progress. CT scan pending.",
  },
];

const publicNav = [
  { id: "landing", label: "Overview", icon: Home },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "capabilities", label: "Capabilities", icon: Zap },
  { id: "ethics", label: "Ethics", icon: Scale },
  { id: "iterations", label: "Iterations", icon: GitBranch },
];

const dashboardNav = [
  {
    section: "Clinical",
    items: [
      { id: "records", label: "Patient Records", icon: FileText, roles: ["Doctor", "Nurse", "Administrator"] },
    ],
  },
  {
    section: "Security",
    items: [
      { id: "overview", label: "Security Overview", icon: Shield, roles: ["Doctor", "Nurse", "Administrator", "Receptionist"] },
      { id: "analytics", label: "Security Analytics", icon: BarChart3, roles: ["Administrator"] },
      { id: "log", label: "My Access Log", icon: ClipboardList, roles: ["Doctor", "Nurse", "Administrator", "Receptionist"] },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { id: "insights", label: "AI Security Insights", icon: Sparkles, roles: ["Administrator"] },
      { id: "timeline", label: "Threat Timeline", icon: Clock, roles: ["Administrator"] },
    ],
  },
  {
    section: "Operations",
    items: [
      { id: "incidents", label: "Security Incidents", icon: AlertOctagon, roles: ["Administrator"] },
      { id: "alerts", label: "Security Alerts", icon: Bell, roles: ["Administrator"] },
      { id: "explorer", label: "Data Explorer", icon: Search, roles: ["Administrator"] },
    ],
  },
  {
    section: "Administration",
    items: [
      { id: "staff", label: "Staff Directory", icon: Users, roles: ["Administrator"] },
      { id: "audit", label: "Audit Log", icon: FileBarChart, roles: ["Administrator"] },
      { id: "health", label: "System Health", icon: Activity, roles: ["Administrator"] },
      { id: "settings", label: "Security Settings", icon: Settings, roles: ["Doctor", "Nurse", "Administrator", "Receptionist"] },
    ],
  },
];

const pageMeta = {
  overview: { title: "Security Overview", section: "SECURITY" },
  records: { title: "Patient Records", section: "CLINICAL" },
  analytics: { title: "Security Analytics", section: "SECURITY" },
  log: { title: "My Access Log", section: "SECURITY" },
  insights: { title: "AI Security Insights", section: "INTELLIGENCE" },
  timeline: { title: "Threat Timeline", section: "INTELLIGENCE" },
  incidents: { title: "Security Incidents", section: "OPERATIONS" },
  alerts: { title: "Security Alerts", section: "OPERATIONS" },
  explorer: { title: "Data Explorer", section: "OPERATIONS" },
  staff: { title: "Staff Directory", section: "ADMINISTRATION" },
  audit: { title: "Audit Log", section: "ADMINISTRATION" },
  health: { title: "System Health", section: "ADMINISTRATION" },
  settings: { title: "Security Settings", section: "ADMINISTRATION" },
};

function normalizeUser(user) {
  return {
    userId: user.userId || user.staffId,
    staffId: user.staffId,
    name: user.name || "Unnamed Staff",
    role: user.role || "Doctor",
    department: user.department || user.dept || "Administration",
    captures: Array.isArray(user.captures) ? user.captures : [],
    enrolledAt: user.enrolledAt || Date.now(),
  };
}

function normalizeEvent(event) {
  return {
    ...event,
    userId: event.userId || event.staffId || "unknown",
    staffId: event.staffId || "—",
    userName: event.userName || event.user || "Unknown",
    role: event.role || "—",
    department: event.department || event.dept || "—",
    timestamp: typeof event.timestamp === "number"
      ? event.timestamp
      : event.time
        ? Date.parse(event.time) || Date.now()
        : Date.now(),
    riskScore: Number(event.riskScore ?? event.score ?? 0),
    riskLevel: event.riskLevel || event.tier || "high",
    outcome: event.outcome || "Denied",
    device: event.device || "Unknown Device",
    location: event.location || "Unknown Location",
    factors: Array.isArray(event.factors) ? event.factors : [],
  };
}

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbName = "SuwaSethaDB";
    this.version = 5;
  }

  async init() {
    if (this.db) return this.db;
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB is not available in this browser.");
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onerror = () => reject(request.error || new Error("Database open failed"));
      request.onblocked = () => reject(new Error("Database upgrade is blocked by another tab."));
      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        const ensureStore = (name, options, indexes) => {
          const store = database.objectStoreNames.contains(name)
            ? event.target.transaction.objectStore(name)
            : database.createObjectStore(name, options);
          indexes.forEach(([indexName, keyPath]) => {
            if (!store.indexNames.contains(indexName)) {
              store.createIndex(indexName, keyPath, { unique: false });
            }
          });
        };
        ensureStore("users", { keyPath: "staffId" }, [["name", "name"], ["role", "role"], ["department", "department"]]);
        ensureStore("authenticationEvents", { keyPath: "id", autoIncrement: true }, [["userId", "userId"], ["staffId", "staffId"], ["timestamp", "timestamp"], ["outcome", "outcome"], ["riskLevel", "riskLevel"], ["department", "department"]]);
        ensureStore("incidents", { keyPath: "id", autoIncrement: true }, [["timestamp", "timestamp"], ["status", "status"], ["eventId", "eventId"]]);
        ensureStore("alerts", { keyPath: "id", autoIncrement: true }, [["timestamp", "timestamp"], ["read", "read"], ["eventId", "eventId"]]);
        ensureStore("auditLogs", { keyPath: "id", autoIncrement: true }, [["timestamp", "timestamp"], ["action", "action"], ["userId", "userId"]]);
      };
      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
        };
        resolve(this.db);
      };
    });
  }

  async put(storeName, value) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).put(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async add(storeName, value) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).add(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName, indexName = null, direction = "prev", limit = 500) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const source = indexName ? store.index(indexName) : store;
      const request = source.openCursor(null, indexName ? direction : "next");
      const results = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }
        results.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, key) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async update(storeName, key, updates) {
    const current = await this.get(storeName, key);
    if (!current) throw new Error(`${storeName} record not found`);
    return this.put(storeName, { ...current, ...updates });
  }

  async users() {
    const users = await this.getAll("users", "name", "next");
    return users.map(normalizeUser);
  }

  async events() {
    const events = await this.getAll("authenticationEvents", "timestamp", "prev");
    return events.map(normalizeEvent);
  }

  async incidents() {
    return this.getAll("incidents", "timestamp", "prev");
  }

  async alerts() {
    return this.getAll("alerts", "timestamp", "prev");
  }

  async audits() {
    return this.getAll("auditLogs", "timestamp", "prev");
  }
}

const db = new DatabaseService();

const CameraStates = {
  IDLE: "idle",
  LOADING_MODEL: "loading_model",
  REQUESTING: "requesting",
  INITIALIZING: "initializing",
  READY: "ready",
  DETECTING: "detecting",
  DETECTED: "detected",
  ERROR: "error",
};

let faceModelPromise = null;
async function loadFaceModel() {
  if (faceModelPromise) return faceModelPromise;
  faceModelPromise = faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  try {
    await faceModelPromise;
    return true;
  } catch (error) {
    faceModelPromise = null;
    throw error;
  }
}

const BiometricCamera = forwardRef(function BiometricCamera(
  { autoStart = false, showGuide = true, onFaceDetected, onStateChange, onError },
  ref,
) {
  const [state, setState] = useState(CameraStates.IDLE);
  const [faceDetected, setFaceDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const detectionBusyRef = useRef(false);
  const mountedRef = useRef(true);
  const startTokenRef = useRef(0);
  const faceCallbackRef = useRef(onFaceDetected);
  const stateCallbackRef = useRef(onStateChange);
  const errorCallbackRef = useRef(onError);

  useEffect(() => { faceCallbackRef.current = onFaceDetected; }, [onFaceDetected]);
  useEffect(() => { stateCallbackRef.current = onStateChange; }, [onStateChange]);
  useEffect(() => { errorCallbackRef.current = onError; }, [onError]);

  const updateState = useCallback((next) => {
    if (!mountedRef.current) return;
    setState(next);
    stateCallbackRef.current?.(next);
  }, []);

  const stop = useCallback(() => {
    startTokenRef.current += 1;
    if (detectionTimerRef.current) {
      clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    detectionBusyRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
      videoRef.current.srcObject = null;
    }
    if (mountedRef.current) {
      setFaceDetected(false);
      updateState(CameraStates.IDLE);
      faceCallbackRef.current?.(false);
    }
  }, [updateState]);

  const detectOnce = useCallback(async () => {
    if (!mountedRef.current || !videoRef.current || videoRef.current.readyState < 2 || detectionBusyRef.current) return;
    detectionBusyRef.current = true;
    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
      );
      if (!mountedRef.current) return;
      const detected = Boolean(detection);
      setFaceDetected(detected);
      faceCallbackRef.current?.(detected);
      updateState(detected ? CameraStates.DETECTED : CameraStates.DETECTING);
    } catch (error) {
      console.warn("Face detection error", error);
    } finally {
      detectionBusyRef.current = false;
    }
  }, [updateState]);

  const start = useCallback(async () => {
    const token = ++startTokenRef.current;
    stop();
    updateState(CameraStates.LOADING_MODEL);
    setErrorMessage("");
    try {
      await loadFaceModel();
      if (!mountedRef.current || token !== startTokenRef.current) return;
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support webcam access.");
      updateState(CameraStates.REQUESTING);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!mountedRef.current || token !== startTokenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      updateState(CameraStates.INITIALIZING);
      const video = videoRef.current;
      if (!video) throw new Error("Camera video element is unavailable.");
      video.srcObject = stream;
      await new Promise((resolve, reject) => {
        let done = false;
        const finish = () => { if (!done) { done = true; video.removeEventListener("loadedmetadata", finish); resolve(); } };
        video.addEventListener("loadedmetadata", finish, { once: true });
        if (video.readyState >= 1) finish();
        setTimeout(() => done ? null : finish(), 3000);
        setTimeout(() => { if (!done) reject(new Error("Camera stream did not become ready.")); }, 5000);
      });
      await video.play();
      if (!mountedRef.current || token !== startTokenRef.current) return;
      updateState(CameraStates.READY);
      await detectOnce();
      if (mountedRef.current && token === startTokenRef.current) {
        detectionTimerRef.current = setInterval(detectOnce, 500);
      }
    } catch (error) {
      if (!mountedRef.current || token !== startTokenRef.current) return;
      let message = "Camera access failed.";
      if (error?.name === "NotAllowedError") message = "Camera permission was denied. Allow camera access in your browser and retry.";
      else if (error?.name === "NotFoundError") message = "No camera device was found on this system.";
      else if (error?.name === "NotReadableError") message = "The camera is already being used by another application.";
      else if (error?.message) message = error.message;
      setErrorMessage(message);
      updateState(CameraStates.ERROR);
      errorCallbackRef.current?.(message);
    }
  }, [detectOnce, stop, updateState]);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || videoRef.current.readyState < 2 || !streamRef.current || !faceDetected) return null;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  }, [faceDetected]);

  useImperativeHandle(ref, () => ({
    start,
    stop,
    captureFrame,
    isFaceDetected: () => faceDetected,
    isReady: () => [CameraStates.READY, CameraStates.DETECTING, CameraStates.DETECTED].includes(state),
    getState: () => state,
  }), [captureFrame, faceDetected, start, state, stop]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoStart) start();
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [autoStart, start, stop]);

  const status = {
    [CameraStates.IDLE]: "CAMERA OFFLINE",
    [CameraStates.LOADING_MODEL]: "INITIALIZING BIOMETRIC ENGINE",
    [CameraStates.REQUESTING]: "REQUESTING CAMERA...",
    [CameraStates.INITIALIZING]: "INITIALIZING STREAM...",
    [CameraStates.READY]: "CAMERA ONLINE",
    [CameraStates.DETECTING]: "SEARCHING FOR FACE...",
    [CameraStates.DETECTED]: "FACE DETECTED",
    [CameraStates.ERROR]: "CAMERA ERROR",
  }[state];
  const statusColor = state === CameraStates.ERROR ? T.bad : state === CameraStates.DETECTED ? T.white : T.muted;

  return (
    <div>
      <div className="scanner-frame">
        <video ref={videoRef} muted playsInline autoPlay className="scanner-video" aria-label="Biometric camera preview" />
        {showGuide && state !== CameraStates.ERROR && <><div className={`face-guide ${faceDetected ? "face-guide-active" : ""}`} /><div className="scanner-corner tl" /><div className="scanner-corner tr" /><div className="scanner-corner bl" /><div className="scanner-corner br" /></>}
        {(state === CameraStates.DETECTING || state === CameraStates.DETECTED) && <motion.div animate={{ top: ["8%", "92%", "8%"] }} transition={{ duration: 2.3, repeat: Infinity, ease: "linear" }} className="scan-line" />}
        {state === CameraStates.ERROR && <div className="camera-error"><CameraOff size={42} /><strong>CAMERA ERROR</strong><span>{errorMessage}</span><MangaButton variant="secondary" icon={RefreshCw} onClick={start}>Retry Camera</MangaButton></div>}
      </div>
      <div className="camera-status" style={{ color: statusColor }}>{status}</div>
      {!autoStart && state === CameraStates.IDLE && <div className="center mt-16"><MangaButton icon={Camera} onClick={start}>Start Camera</MangaButton></div>}
    </div>
  );
});
function useAudio() {
  const ctxRef = useRef(null);
  const tone = useCallback((freq, duration, type = "sine", volume = 0.025) => {
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio is non-critical.
    }
  }, []);
  return {
    tap: () => tone(760, 0.045, "sine", 0.018),
    success: () => tone(620, 0.10, "sine", 0.02),
    deny: () => tone(150, 0.16, "triangle", 0.03),
    whoosh: () => tone(260, 0.13, "sine", 0.018),
  };
}

function Atmosphere() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationId = 0;
    const points = Array.from({ length: 34 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00015,
      vy: (Math.random() - 0.5) * 0.00015,
    }));
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      points.forEach((point) => {
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < 0 || point.x > 1) point.vx *= -1;
        if (point.y < 0 || point.y > 1) point.vy *= -1;
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath();
        ctx.arc(point.x * width, point.y * height, 1, 0, Math.PI * 2);
        ctx.fill();
      });
      animationId = requestAnimationFrame(render);
    };
    window.addEventListener("resize", resize);
    render();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="atmosphere" aria-hidden="true" />;
}

function MangaPanel({ children, className = "", style, hover = false }) {
  return (
    <motion.div
      whileHover={hover ? { y: -2, borderColor: T.lineStrong } : undefined}
      className={`manga-panel ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function MangaButton({ children, variant = "primary", icon: Icon, onClick, disabled = false, className = "", type = "button" }) {
  return (
    <motion.button
      type={type}
      whileHover={{ y: disabled ? 0 : -1 }}
      whileTap={{ scale: disabled ? 1 : 0.985 }}
      disabled={disabled}
      onClick={onClick}
      className={`manga-button manga-button-${variant} ${className}`}
    >
      {Icon && <Icon size={16} />}
      {children}
    </motion.button>
  );
}

function MangaInput({ label, ...props }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <input {...props} />
    </label>
  );
}

function MangaSelect({ label, value, onChange, options }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <select value={value} onChange={onChange}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="section-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function StatusPill({ children, tone = "neutral" }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

function StatCard({ label, value, icon: Icon, detail }) {
  return (
    <MangaPanel className="stat-card" hover>
      <div className="stat-top">
        <span className="eyebrow">{label}</span>
        {Icon && <Icon size={18} color={T.muted} />}
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </MangaPanel>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="progress-track">
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} className="progress-value" />
    </div>
  );
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function riskTier(score) {
  if (score <= 30) return { key: "low", label: "TRUSTED — ACCESS GRANTED", tone: "good", Icon: ShieldCheck };
  if (score <= 60) return { key: "med", label: "CAUTION — STEP-UP REQUIRED", tone: "warn", Icon: ShieldAlert };
  return { key: "high", label: "HIGH RISK — ACCESS DENIED", tone: "bad", Icon: ShieldX };
}

function calculateRisk({ enrolled, anomalous = false, failed, scenario = "standard" }) {
  const failures = Number(failed || 0);
  const factor = {
    device: enrolled ? 5 : 25,
    location: 5,
    time: 5,
    attempts: failures === 0 ? 0 : failures <= 2 ? 10 : 35,
    biometric: enrolled ? 4 : 28,
  };
  if (scenario === "elevated") {
    factor.device = 15;
    factor.location = 10;
    factor.time = 10;
    factor.attempts = Math.max(factor.attempts, 10);
    factor.biometric = 8;
  }
  if (anomalous || scenario === "suspicious") {
    factor.device = 25;
    factor.location = 30;
    factor.time = 15;
    factor.attempts = Math.max(factor.attempts, 10);
    factor.biometric = 18;
  }
  const score = Math.min(100, Object.values(factor).reduce((sum, value) => sum + value, 0));
  return {
    score,
    factors: [
      { label: "Device Recognition", value: factor.device, desc: factor.device <= 5 ? "Known hospital workstation" : "Unrecognized device" },
      { label: "Network Location", value: factor.location, desc: factor.location <= 5 ? "Internal hospital network" : "Unfamiliar location" },
      { label: "Time Pattern", value: factor.time, desc: factor.time <= 5 ? "Normal shift pattern" : "Unusual access hour" },
      { label: "Failed Attempts", value: factor.attempts, desc: `${failures} recent failures` },
      { label: "Biometric Presence", value: factor.biometric, desc: enrolled ? "Live face detected · prototype match stage" : "No enrolled profile" },
    ],
  };
}

function EmptyState({ text }) {
  return <div className="empty-state"><Database size={26} /><span>{text}</span></div>;
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-top"><h3>{title}</h3><button onClick={onClose}><X size={18} /></button></div>
        {children}
      </motion.div>
    </div>
  );
}

function EventTable({ events, compact = false }) {
  if (!events.length) return <EmptyState text="No authentication events yet." />;
  return (
    <div className="event-table-wrap">
      <table className="event-table">
        <thead><tr><th>STAFF</th><th>TIME</th><th>RISK</th><th>OUTCOME</th>{!compact && <th>DEVICE</th>}</tr></thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td><strong>{event.userName}</strong><small>{event.staffId}</small></td>
              <td>{formatDate(event.timestamp)}</td>
              <td><strong>{event.riskScore}</strong></td>
              <td><StatusPill tone={event.outcome === "Granted" ? "good" : event.outcome === "Step-up" ? "warn" : "bad"}>{event.outcome}</StatusPill></td>
              {!compact && <td>{event.device}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InsightCard({ insight, large = false }) {
  return (
    <div className={`insight-card ${large ? "insight-large" : ""}`}>
      <div className="insight-top">
        <StatusPill tone={insight.severity === "high" ? "bad" : insight.severity === "medium" ? "warn" : "good"}>{insight.severity}</StatusPill>
        <Sparkles size={16} />
      </div>
      <h3>{insight.title}</h3>
      <p>{insight.evidence}</p>
      <small>Recommendation: {insight.recommendation}</small>
    </div>
  );
}

export default function App() {
  const sfx = useAudio();
  const [view, setView] = useState("landing");
  const [dashboardTab, setDashboardTab] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDashboardMenu, setMobileDashboardMenu] = useState(false);
  const [clock, setClock] = useState("");
  const [toast, setToast] = useState("");
  const [dbState, setDbState] = useState("initializing");
  const [faceModelState, setFaceModelState] = useState("loading");
  const [users, setUsers] = useState([]);
  const [authEvents, setAuthEvents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [session, setSession] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [filterOutcome, setFilterOutcome] = useState("All");

  const [enrollStep, setEnrollStep] = useState(0);
  const [enrollConsent, setEnrollConsent] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ name: "", staffId: "", role: "Doctor", department: "Emergency" });
  const [enrollCaptures, setEnrollCaptures] = useState([]);
  const [authSelectedStaffId, setAuthSelectedStaffId] = useState("");
  const [authPhase, setAuthPhase] = useState("idle");
  const [authRisk, setAuthRisk] = useState(null);
  const [authScoreAnim, setAuthScoreAnim] = useState(0);
  const [authFaceDetected, setAuthFaceDetected] = useState(false);
  const [authOtp, setAuthOtp] = useState("");
  const [authOtpActive, setAuthOtpActive] = useState(false);
  const [authScenario, setAuthScenario] = useState("standard");
  const [authAnomalous, setAuthAnomalous] = useState(false);
  const [authFailCount, setAuthFailCount] = useState(0);
  const [authError, setAuthError] = useState("");

  const enrollCameraRef = useRef(null);
  const authCameraRef = useRef(null);
  const processingTimerRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    setClock(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshData = useCallback(async () => {
    const [usersData, eventsData, incidentsData, alertsData, auditsData] = await Promise.all([
      db.users(),
      db.events(),
      db.incidents(),
      db.alerts(),
      db.audits(),
    ]);
    setUsers(usersData);
    setAuthEvents(eventsData.map(normalizeEvent));
    setIncidents(incidentsData);
    setAlerts(alertsData);
    setAuditLogs(auditsData);
  }, []);

  useEffect(() => {
    let mounted = true;
    db.init()
      .then(() => refreshData())
      .then(() => mounted && setDbState("ready"))
      .catch((error) => {
        console.error(error);
        if (mounted) setDbState("error");
      });
    loadFaceModel()
      .then(() => mounted && setFaceModelState("ready"))
      .catch((error) => {
        console.error(error);
        if (mounted) setFaceModelState("error");
      });
    return () => { mounted = false; };
  }, [refreshData]);

  useEffect(() => () => {
    if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    sfx.tap();
  }, [sfx]);

  const leaveCameras = useCallback(() => {
    enrollCameraRef.current?.stop();
    authCameraRef.current?.stop();
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  }, []);

  const navigate = useCallback((nextView) => {
    sfx.tap();
    leaveCameras();
    setMobileMenuOpen(false);
    setMobileDashboardMenu(false);
    setView(nextView);
    if (nextView === "enroll") {
      setEnrollStep(0);
      setEnrollConsent(false);
      setEnrollCaptures([]);
      setEnrollForm({ name: "", staffId: "", role: "Doctor", department: "Emergency" });
    }
    if (nextView === "login") {
      setAuthSelectedStaffId("");
      setAuthPhase("idle");
      setAuthRisk(null);
      setAuthScoreAnim(0);
      setAuthFaceDetected(false);
      setAuthOtp("");
      setAuthOtpActive(false);
      setAuthError("");
    }
    if (nextView === "dashboard") setDashboardTab("overview");
  }, [leaveCameras, sfx]);

  const selectedAuthUser = useMemo(
    () => users.find((user) => user.staffId === authSelectedStaffId) || null,
    [authSelectedStaffId, users],
  );

  const accessibleNavItems = useMemo(() => dashboardNav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(session?.role)),
    }))
    .filter((section) => section.items.length > 0), [session]);

  const analytics = useMemo(() => {
    const total = authEvents.length;
    const granted = authEvents.filter((e) => e.outcome === "Granted").length;
    const stepUp = authEvents.filter((e) => e.outcome === "Step-up").length;
    const denied = authEvents.filter((e) => e.outcome === "Denied").length;
    const avgRisk = total ? Math.round(authEvents.reduce((sum, e) => sum + Number(e.riskScore || 0), 0) / total) : 0;
    const openIncidents = incidents.filter((i) => i.status !== "Resolved").length;
    const highRisk = authEvents.filter((e) => e.riskLevel === "high").length;
    const unreadAlerts = alerts.filter((a) => !a.read).length;
    const successRate = total ? Math.round((granted / total) * 100) : 0;
    const posture = Math.max(0, Math.min(100, 100 - (denied * 3) - (openIncidents * 5) - (avgRisk > 50 ? 12 : 0)));
    return { total, granted, stepUp, denied, avgRisk, openIncidents, highRisk, unreadAlerts, successRate, posture };
  }, [alerts, authEvents, incidents]);

  const filteredEvents = useMemo(() => authEvents.filter((event) => {
    const q = filterSearch.trim().toLowerCase();
    const matchSearch = !q || `${event.userName} ${event.staffId}`.toLowerCase().includes(q);
    const matchDept = filterDept === "All" || event.department === filterDept;
    const matchOutcome = filterOutcome === "All" || event.outcome === filterOutcome;
    return matchSearch && matchDept && matchOutcome;
  }), [authEvents, filterDept, filterOutcome, filterSearch]);

  const aiInsights = useMemo(() => {
    const insights = [];
    const failedByUser = {};
    authEvents.forEach((event) => {
      if (event.outcome !== "Granted") failedByUser[event.userName] = (failedByUser[event.userName] || 0) + 1;
    });
    const repeaters = Object.entries(failedByUser).filter(([, count]) => count >= 3);
    if (repeaters.length) {
      insights.push({ severity: "high", title: "Repeated Authentication Failures", evidence: `${repeaters.map(([name, count]) => `${name} (${count})`).join(", ")}`, recommendation: "Review the affected enrollment and recent access activity." });
    }
    if (analytics.total >= 5 && analytics.denied / analytics.total > 0.25) {
      insights.push({ severity: "high", title: "Elevated Denial Rate", evidence: `${analytics.denied} of ${analytics.total} recent attempts were denied.`, recommendation: "Review device, network and failed-attempt patterns." });
    }
    if (analytics.avgRisk > 45 && analytics.total >= 4) {
      insights.push({ severity: "medium", title: "Elevated Average Risk", evidence: `Average risk is ${analytics.avgRisk}/100 across ${analytics.total} events.`, recommendation: "Review unusual device, time and location factors." });
    }
    if (analytics.openIncidents > 0) {
      insights.push({ severity: "high", title: "Open Security Incidents", evidence: `${analytics.openIncidents} incident(s) remain unresolved.`, recommendation: "Review the Incident Centre and close resolved cases." });
    }
    if (!insights.length) {
      insights.push({ severity: "low", title: "Normal Security Posture", evidence: `${analytics.total} authentication event(s) analyzed.`, recommendation: "Continue normal monitoring." });
    }
    return insights;
  }, [analytics, authEvents]);

  const postureTone = analytics.posture >= 80 ? "good" : analytics.posture >= 60 ? "warn" : "bad";

  const addAudit = useCallback(async (action, details, user = session) => {
    await db.add("auditLogs", {
      timestamp: Date.now(),
      action,
      userId: user?.staffId || "system",
      userName: user?.name || "System",
      details,
    });
  }, [session]);

  const captureEnrollmentFrame = () => {
    if (enrollCaptures.length >= 3) return;
    const camera = enrollCameraRef.current;
    if (!camera?.isFaceDetected()) {
      showToast("No face detected. Position your face inside the guide.");
      return;
    }
    const frame = camera.captureFrame();
    if (!frame) {
      showToast("Camera is not ready.");
      return;
    }
    setEnrollCaptures((current) => [...current, frame]);
    sfx.success();
  };

  const completeEnrollment = async () => {
    if (!enrollForm.name.trim() || !enrollConsent || enrollCaptures.length !== 3) {
      showToast("Complete consent, staff details and all three biometric captures.");
      return;
    }
    const suppliedId = enrollForm.staffId.trim();
    const staffId = suppliedId || `SS-${Math.floor(1000 + Math.random() * 9000)}`;
    if (users.some((u) => u.staffId === staffId)) {
      showToast("That Staff ID is already enrolled.");
      return;
    }
    const user = normalizeUser({ ...enrollForm, staffId, userId: staffId, captures: enrollCaptures, enrolledAt: Date.now() });
    try {
      await db.put("users", user);
      await addAudit("BIOMETRIC_ENROLLMENT", `Biometric prototype enrollment completed for ${user.name} (${user.staffId}).`, user);
      await refreshData();
      enrollCameraRef.current?.stop();
      setEnrollStep(4);
      sfx.success();
    } catch (error) {
      console.error(error);
      showToast("Enrollment failed. Please check the database status and retry.");
    }
  };

  const beginAuthentication = () => {
    if (!selectedAuthUser) {
      showToast("Select an enrolled Staff ID before starting the scan.");
      return;
    }
    if (faceModelState !== "ready") {
      showToast("Biometric engine is not ready yet.");
      return;
    }
    setAuthError("");
    setAuthRisk(null);
    setAuthOtp("");
    setAuthOtpActive(false);
    setAuthFaceDetected(false);
    setAuthPhase("camera_starting");
    sfx.whoosh();
  };

  const processAuthentication = useCallback(async () => {
    if (!selectedAuthUser || authPhase !== "processing") return;
    const risk = calculateRisk({ enrolled: true, anomalous: authAnomalous, failed: authFailCount, scenario: authScenario });
    const tier = riskTier(risk.score);
    const event = {
      userId: selectedAuthUser.staffId,
      staffId: selectedAuthUser.staffId,
      userName: selectedAuthUser.name,
      role: selectedAuthUser.role,
      department: selectedAuthUser.department,
      riskScore: risk.score,
      riskLevel: tier.key,
      outcome: tier.key === "low" ? "Granted" : tier.key === "med" ? "Step-up" : "Denied",
      device: authAnomalous ? "Unknown Device" : "Hospital Workstation #A12",
      location: authAnomalous ? "External Network" : "Colombo · Core LAN",
      factors: risk.factors.filter((factor) => factor.value > 10).map((factor) => factor.desc),
      timestamp: Date.now(),
    };
    try {
      const eventId = await db.add("authenticationEvents", event);
      await addAudit("AUTHENTICATION_ATTEMPT", `${event.outcome} · Risk ${risk.score}/100 · ${selectedAuthUser.staffId}`, selectedAuthUser);
      if (tier.key === "high") {
        const incidentId = await db.add("incidents", {
          eventId,
          userId: selectedAuthUser.staffId,
          userName: selectedAuthUser.name,
          staffId: selectedAuthUser.staffId,
          department: selectedAuthUser.department,
          riskScore: risk.score,
          riskLevel: tier.key,
          device: event.device,
          location: event.location,
          factors: event.factors,
          status: "New",
          timestamp: Date.now(),
        });
        await db.add("alerts", {
          eventId,
          incidentId,
          type: "HIGH_RISK_AUTHENTICATION",
          severity: "high",
          userId: selectedAuthUser.staffId,
          userName: selectedAuthUser.name,
          message: `High-risk authentication detected for ${selectedAuthUser.staffId}. Risk ${risk.score}/100.`,
          read: false,
          timestamp: Date.now(),
        });
        setAuthFailCount((count) => count + 1);
      } else {
        setAuthFailCount(0);
      }
      await refreshData();
      setAuthRisk(risk);
      setAuthScoreAnim(0);
      setAuthPhase("result");
      authCameraRef.current?.stop();
      tier.key === "high" ? sfx.deny() : sfx.success();
    } catch (error) {
      console.error(error);
      setAuthError("Authentication could not be completed because the security database failed.");
      setAuthPhase("idle");
      authCameraRef.current?.stop();
    }
  }, [addAudit, authAnomalous, authFailCount, authPhase, authScenario, refreshData, selectedAuthUser, sfx]);

  useEffect(() => {
    if (authPhase !== "processing") return undefined;
    processingTimerRef.current = setTimeout(() => processAuthentication(), 1400);
    return () => {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
    };
  }, [authPhase, processAuthentication]);

  useEffect(() => {
    if (!authRisk || authPhase !== "result") return undefined;
    let value = 0;
    const timer = setInterval(() => {
      value += 2;
      if (value >= authRisk.score) {
        value = authRisk.score;
        clearInterval(timer);
      }
      setAuthScoreAnim(value);
    }, 18);
    return () => clearInterval(timer);
  }, [authPhase, authRisk]);

  const handleAuthCameraState = useCallback((state) => {
    if (authPhase === "camera_starting" && [CameraStates.READY, CameraStates.DETECTING].includes(state)) {
      setAuthPhase("camera_ready");
    }
  }, [authPhase]);

  const handleAuthFace = useCallback((detected) => {
    setAuthFaceDetected(detected);
    if (detected && (authPhase === "camera_starting" || authPhase === "camera_ready")) {
      setAuthPhase("biometric_scanning");
      processingTimerRef.current = setTimeout(() => {
        if (authCameraRef.current?.isFaceDetected()) {
          setAuthPhase("processing");
        } else {
          setAuthPhase("camera_ready");
        }
      }, 1400);
    }
  }, [authPhase]);

  const verifyOtp = async () => {
    if (authOtp !== "123456") {
      sfx.deny();
      showToast("Invalid OTP. Demo code: 123456");
      await addAudit("OTP_VERIFICATION_FAILURE", `Invalid demo OTP attempt for ${selectedAuthUser?.staffId || "unknown"}.`, selectedAuthUser);
      return;
    }
    if (!selectedAuthUser) return;
    await addAudit("OTP_VERIFICATION_SUCCESS", "Step-up OTP verification successful.", selectedAuthUser);
    setSession(selectedAuthUser);
    navigate("dashboard");
  };

  const logout = async () => {
    await addAudit("LOGOUT", "User logged out.");
    setSession(null);
    navigate("landing");
  };

  const updateIncidentStatus = async (incidentId, status) => {
    try {
      await db.update("incidents", incidentId, { status, updatedAt: Date.now() });
      await addAudit("INCIDENT_STATUS_UPDATE", `Incident ${incidentId} changed to ${status}.`);
      await refreshData();
      showToast("Incident status updated.");
    } catch (error) {
      console.error(error);
      showToast("Incident update failed.");
    }
  };

  const markAlertRead = async (alertId) => {
    try {
      await db.update("alerts", alertId, { read: true });
      await refreshData();
    } catch (error) {
      console.error(error);
    }
  };

  const exportSecurityReport = () => {
    const lines = [
      "SUWA SETHA HOSPITAL — SECURITY INTELLIGENCE REPORT",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      `Database: ${dbState.toUpperCase()}`,
      `Face Detection Model: ${faceModelState.toUpperCase()}`,
      `Enrolled Staff: ${users.length}`,
      `Total Authentication Attempts: ${analytics.total}`,
      `Granted: ${analytics.granted}`,
      `Step-up: ${analytics.stepUp}`,
      `Denied: ${analytics.denied}`,
      `Average Risk: ${analytics.avgRisk}/100`,
      `Security Posture: ${analytics.posture}/100`,
      `Open Incidents: ${analytics.openIncidents}`,
      `Unread Alerts: ${analytics.unreadAlerts}`,
      "",
      "AI-ASSISTED SECURITY INSIGHTS",
      ...aiInsights.map((insight) => `[${insight.severity.toUpperCase()}] ${insight.title}\nEvidence: ${insight.evidence}\nRecommendation: ${insight.recommendation}`),
      "",
      "PROTOTYPE DISCLAIMER",
      "Biometric identity matching is represented as a prototype concept. Production deployment would require secure biometric templates, encryption, retention governance, DPIA review, access governance and independent security testing.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `suwa-setha-security-report-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Security report exported.");
  };

  const goDashboard = (tab) => {
    const allowed = accessibleNavItems.some((section) => section.items.some((item) => item.id === tab));
    if (!allowed) {
      setDashboardTab("overview");
      showToast("Access restricted.");
      return;
    }
    setDashboardTab(tab);
    setMobileDashboardMenu(false);
  };

  const commonShell = (content) => (
    <div className="app-shell">
      <Atmosphere />
      {content}
      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }} className="toast">{toast}</motion.div>}
      </AnimatePresence>
    </div>
  );

  function PublicNav() {
    return (
      <header className="public-nav">
        <button className="brand" onClick={() => navigate("landing")}>
          <span className="brand-mark"><Shield size={20} /></span>
          <span><strong>SUWA SETHA</strong><small>HEALTHCARE SECURITY INTELLIGENCE</small></span>
        </button>
        <nav className="public-links">
          {publicNav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}>{item.label}</button>)}
        </nav>
        <div className="public-actions">
          <span className="clock">{clock}</span>
          <MangaButton variant="ghost" icon={LogIn} onClick={() => navigate("login")}>Login</MangaButton>
          <MangaButton icon={UserPlus} onClick={() => navigate("enroll")}>Enrol</MangaButton>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Open navigation"><Menu /></button>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div className="mobile-public-menu" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              {publicNav.map((item) => <button key={item.id} onClick={() => navigate(item.id)}>{item.label}</button>)}
              <div className="mobile-menu-actions"><MangaButton variant="ghost" onClick={() => navigate("login")}>Login</MangaButton><MangaButton onClick={() => navigate("enroll")}>Enrol</MangaButton></div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    );
  }

  function AuthShell() {
    const meta = pageMeta[dashboardTab] || pageMeta.overview;
    return (
      <div className="dashboard-shell">
        <aside className={`dashboard-sidebar ${mobileDashboardMenu ? "mobile-open" : ""}`}>
          <div className="sidebar-top">
            <div className="sidebar-brand"><span className="brand-mark"><Shield size={17} /></span><span><strong>SUWA SETHA</strong><small>SECURE HEALTHCARE</small></span></div>
            <button className="sidebar-close mobile-only" onClick={() => setMobileDashboardMenu(false)}><X size={20} /></button>
          </div>
          <div className="sidebar-user">
            <div className="avatar">{session?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
            <div><strong>{session?.name}</strong><small>{session?.role} · {session?.department}</small></div>
          </div>
          <nav className="dashboard-nav">
            {accessibleNavItems.map((section) => (
              <div key={section.section} className="nav-group">
                <div className="nav-group-title">{section.section}</div>
                {section.items.map((item) => (
                  <button key={item.id} className={dashboardTab === item.id ? "active" : ""} onClick={() => goDashboard(item.id)}>
                    <item.icon size={16} />{item.label}{item.id === "alerts" && analytics.unreadAlerts > 0 && <span className="nav-badge">{analytics.unreadAlerts}</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom"><MangaButton variant="ghost" icon={LogOut} onClick={logout}>Logout</MangaButton></div>
        </aside>
        {mobileDashboardMenu && <div className="drawer-overlay mobile-only" onClick={() => setMobileDashboardMenu(false)} />}
        <main className="dashboard-main">
          <header className="dashboard-topbar">
            <div className="topbar-left"><button className="mobile-menu-btn mobile-only" onClick={() => setMobileDashboardMenu(true)}><Menu /></button><div><div className="eyebrow">{meta.section}</div><h1>{meta.title}</h1></div></div>
            <div className="topbar-right"><span className={`status-pill status-${postureTone}`}>POSTURE {analytics.posture}/100</span><span className="clock">{clock}</span></div>
          </header>
          <div className="dashboard-content">{renderDashboardTab()}</div>
        </main>
      </div>
    );
  }

  function renderDashboardTab() {
    switch (dashboardTab) {
      case "records": return PatientRecords();
      case "analytics": return SecurityAnalytics();
      case "log": return AccessLog();
      case "insights": return AIInsights();
      case "timeline": return ThreatTimeline();
      case "incidents": return IncidentCentre();
      case "alerts": return SecurityAlerts();
      case "explorer": return DataExplorer();
      case "staff": return StaffDirectory();
      case "audit": return AuditLog();
      case "health": return SystemHealth();
      case "settings": return SecuritySettings();
      case "overview":
      default: return DashboardOverview();
    }
  }

  function DashboardOverview() {
    return (
      <div className="page-stack">
        <div className="hero-panel"><div><div className="eyebrow">SECURE HEALTHCARE COMMAND CENTRE</div><h2>AI-ASSISTED BIOMETRIC SECURITY</h2><p>Monitor access, investigate risk and keep sensitive clinical systems protected with a unified security view.</p></div><div className="hero-score"><span>SECURITY POSTURE</span><strong>{analytics.posture}</strong><small>/ 100</small></div></div>
        <div className="stats-grid">
          <StatCard label="Authentication Attempts" value={analytics.total} icon={Activity} />
          <StatCard label="Success Rate" value={`${analytics.successRate}%`} icon={ShieldCheck} />
          <StatCard label="Average Risk" value={`${analytics.avgRisk}/100`} icon={TrendingUp} />
          <StatCard label="Open Incidents" value={analytics.openIncidents} icon={AlertOctagon} />
        </div>
        <div className="two-col">
          <MangaPanel><SectionHeader eyebrow="LIVE SIGNALS" title="Recent Authentication Activity" /><EventTable events={authEvents.slice(0, 6)} compact /></MangaPanel>
          <MangaPanel><SectionHeader eyebrow="INTELLIGENCE" title="Current Security Insights" /><div className="stack-list">{aiInsights.slice(0, 3).map((insight) => <InsightCard key={insight.title} insight={insight} />)}</div></MangaPanel>
        </div>
      </div>
    );
  }

  function PatientRecords() {
    return (
      <div className="page-stack"><SectionHeader eyebrow="CLINICAL PORTAL" title="Patient Records" description="Fictional clinical data used to demonstrate secure role-based hospital access." />
        <div className="patient-grid">{PATIENTS.map((patient) => <button key={patient.id} className="patient-card" onClick={() => setSelectedPatient(patient)}><div className="patient-card-top"><span>{patient.id}</span><StatusPill tone={patient.status === "Critical" ? "bad" : patient.status === "Stable" ? "good" : "neutral"}>{patient.status}</StatusPill></div><strong>{patient.name}</strong><small>{patient.ward} · {patient.doctor}</small><div className="patient-vitals"><span>HR {patient.hr}</span><span>BP {patient.bp}</span><span>SpO₂ {patient.spo2}%</span></div></button>)}</div>
        {selectedPatient && <Modal title={selectedPatient.name} onClose={() => setSelectedPatient(null)}><div className="detail-grid"><div><span>Patient ID</span><strong>{selectedPatient.id}</strong></div><div><span>Ward</span><strong>{selectedPatient.ward}</strong></div><div><span>Status</span><strong>{selectedPatient.status}</strong></div><div><span>Attending</span><strong>{selectedPatient.doctor}</strong></div></div><p className="modal-note">{selectedPatient.notes}</p></Modal>}
      </div>
    );
  }

  function SecurityAnalytics() {
    const maxBar = Math.max(1, ...authEvents.slice(0, 12).map((event) => event.riskScore));
    const departmentCounts = DEPARTMENTS.map((department) => ({ department, count: authEvents.filter((e) => e.department === department).length })).filter((item) => item.count > 0);
    return (
      <div className="page-stack"><SectionHeader eyebrow="DATA INTELLIGENCE" title="Security Analytics" description="Persistent authentication data transformed into operational security intelligence." action={<MangaButton variant="secondary" icon={Download} onClick={exportSecurityReport}>Export Report</MangaButton>} />
        <div className="stats-grid"><StatCard label="Attempts" value={analytics.total} icon={Activity} /><StatCard label="Granted" value={analytics.granted} icon={ShieldCheck} /><StatCard label="Step-up" value={analytics.stepUp} icon={ShieldAlert} /><StatCard label="Denied" value={analytics.denied} icon={ShieldX} /></div>
        <div className="two-col"><MangaPanel><SectionHeader eyebrow="RISK TREND" title="Recent Risk Scores" /><div className="bar-chart">{authEvents.slice(0, 12).reverse().map((event) => <div className="bar-item" key={event.id}><div className="bar-label"><span>{event.userName}</span><strong>{event.riskScore}</strong></div><ProgressBar value={(event.riskScore / maxBar) * 100} /></div>)}</div></MangaPanel><MangaPanel><SectionHeader eyebrow="DEPARTMENT ACTIVITY" title="Security Events by Department" /><div className="bar-chart">{departmentCounts.map((item) => <div className="bar-item" key={item.department}><div className="bar-label"><span>{item.department}</span><strong>{item.count}</strong></div><ProgressBar value={(item.count / Math.max(1, analytics.total)) * 100} /></div>)}{departmentCounts.length === 0 && <EmptyState text="No authentication data yet." />}</div></MangaPanel></div>
        <MangaPanel><SectionHeader eyebrow="SECURITY POSTURE" title={`${analytics.posture}/100`} description="Calculated from denial rate, average risk and unresolved incidents." /><div className="posture-large"><div className={`posture-ring posture-${postureTone}`}><strong>{analytics.posture}</strong><span>/100</span></div><div className="posture-factors"><div><span>Average Risk</span><strong>{analytics.avgRisk}</strong></div><div><span>High-Risk Events</span><strong>{analytics.highRisk}</strong></div><div><span>Open Incidents</span><strong>{analytics.openIncidents}</strong></div><div><span>Unread Alerts</span><strong>{analytics.unreadAlerts}</strong></div></div></div></MangaPanel>
      </div>
    );
  }

  function AccessLog() {
    const mine = authEvents.filter((event) => event.staffId === session?.staffId);
    return <div className="page-stack"><SectionHeader eyebrow="PERSONAL SECURITY" title="My Access Log" description="Authentication history associated with your enrolled staff identity." />{mine.length ? <MangaPanel><EventTable events={mine} /></MangaPanel> : <EmptyState text="No authentication history for this account yet." />}</div>;
  }

  function AIInsights() {
    return <div className="page-stack"><SectionHeader eyebrow="PROTOTYPE INTELLIGENCE" title="AI Security Insights" description="Evidence-based prototype intelligence derived from persisted security events." /><div className="stack-list">{aiInsights.map((insight) => <InsightCard key={`${insight.title}-${insight.severity}`} insight={insight} large />)}</div></div>;
  }

  function ThreatTimeline() {
    const items = [...authEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);
    return <div className="page-stack"><SectionHeader eyebrow="THREAT INTELLIGENCE" title="Threat Timeline" description="Chronological narrative of recent access and security events." />{items.length ? <div className="timeline">{items.map((event) => <div className="timeline-item" key={event.id}><div className="timeline-dot" /><div className="timeline-card"><div className="timeline-top"><strong>{event.outcome}</strong><span>{formatDate(event.timestamp)}</span></div><div>{event.userName} · {event.staffId}</div><small>Risk {event.riskScore}/100 · {event.device} · {event.location}</small></div></div>)}</div> : <EmptyState text="No security events have been recorded." />}</div>;
  }

  function IncidentCentre() {
    return <div className="page-stack"><SectionHeader eyebrow="RESPONSE OPERATIONS" title="Security Incidents" description="Investigate and resolve high-risk authentication events." />{incidents.length ? <div className="incident-list">{incidents.map((incident) => <MangaPanel key={incident.id}><div className="incident-top"><div><div className="eyebrow">INCIDENT #{incident.id}</div><h3>{incident.userName} · {incident.staffId}</h3></div><StatusPill tone={incident.status === "Resolved" ? "good" : "bad"}>{incident.status}</StatusPill></div><div className="detail-grid"><div><span>Risk</span><strong>{incident.riskScore}/100</strong></div><div><span>Department</span><strong>{incident.department}</strong></div><div><span>Device</span><strong>{incident.device}</strong></div><div><span>Created</span><strong>{formatDate(incident.timestamp)}</strong></div></div><div className="button-row">{["New", "Investigating", "Resolved"].map((status) => <MangaButton key={status} variant={incident.status === status ? "primary" : "ghost"} onClick={() => updateIncidentStatus(incident.id, status)}>{status}</MangaButton>)}</div></MangaPanel>)}</div> : <EmptyState text="No security incidents have been created." />}</div>;
  }

  function SecurityAlerts() {
    return <div className="page-stack"><SectionHeader eyebrow="ALERT OPERATIONS" title="Security Alerts" description="Persistent alerts generated by security events." />{alerts.length ? <div className="stack-list">{alerts.map((alert) => <MangaPanel key={alert.id} className={alert.read ? "alert-read" : ""}><div className="incident-top"><div><div className="eyebrow">{alert.type}</div><h3>{alert.message}</h3><small>{formatDate(alert.timestamp)} · {alert.userName} · {alert.userId}</small></div><StatusPill tone={alert.severity === "high" ? "bad" : "warn"}>{alert.severity.toUpperCase()}</StatusPill></div>{!alert.read && <MangaButton variant="ghost" onClick={() => markAlertRead(alert.id)}>Mark Read</MangaButton>}</MangaPanel>)}</div> : <EmptyState text="No security alerts have been generated." />}</div>;
  }

  function DataExplorer() {
    return <div className="page-stack"><SectionHeader eyebrow="SECURITY DATA" title="Data Explorer" description="Search and filter persistent authentication events." /><MangaPanel><div className="filter-grid"><MangaInput label="Search" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Name or staff ID" /><MangaSelect label="Department" value={filterDept} onChange={(e) => setFilterDept(e.target.value)} options={["All", ...DEPARTMENTS]} /><MangaSelect label="Outcome" value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)} options={["All", "Granted", "Step-up", "Denied"]} /><MangaButton variant="ghost" onClick={() => { setFilterSearch(""); setFilterDept("All"); setFilterOutcome("All"); }}>Reset</MangaButton></div></MangaPanel><MangaPanel><EventTable events={filteredEvents} /></MangaPanel></div>;
  }

  function StaffDirectory() {
    return <div className="page-stack"><SectionHeader eyebrow="ADMINISTRATION" title="Staff Directory" description="Security-oriented staff overview based on enrolled identities." /><div className="patient-grid">{users.map((user) => { const mine = authEvents.filter((e) => e.staffId === user.staffId); const avg = mine.length ? Math.round(mine.reduce((s, e) => s + e.riskScore, 0) / mine.length) : 0; return <MangaPanel key={user.staffId}><div className="patient-card-top"><span>{user.staffId}</span><StatusPill tone="good">ENROLLED</StatusPill></div><h3>{user.name}</h3><p>{user.role} · {user.department}</p><div className="detail-grid"><div><span>Attempts</span><strong>{mine.length}</strong></div><div><span>Avg Risk</span><strong>{avg}</strong></div><div><span>High Risk</span><strong>{mine.filter((e) => e.riskLevel === "high").length}</strong></div><div><span>Last Access</span><strong>{mine[0] ? formatDate(mine[0].timestamp) : "—"}</strong></div></div></MangaPanel>; })}</div>{!users.length && <EmptyState text="No staff are enrolled yet." />}</div>;
  }

  function AuditLog() {
    return <div className="page-stack"><SectionHeader eyebrow="GOVERNANCE" title="Audit Log" description="Traceable record of authentication and administrative actions." /><MangaPanel><div className="audit-table">{auditLogs.map((log) => <div className="audit-row" key={log.id}><div><strong>{log.action}</strong><small>{log.userName} · {log.userId}</small></div><span>{formatDate(log.timestamp)}</span><p>{log.details}</p></div>)}{!auditLogs.length && <EmptyState text="No audit records yet." />}</div></MangaPanel></div>;
  }

  function SystemHealth() {
    const rows = [
      { label: "Security Database", state: dbState, icon: Database },
      { label: "Face Detection Model", state: faceModelState, icon: Eye },
      { label: "Authentication Engine", state: "ready", icon: Fingerprint },
      { label: "Analytics Engine", state: "ready", icon: BarChart3 },
      { label: "Audit System", state: "ready", icon: FileBarChart },
    ];
    return <div className="page-stack"><SectionHeader eyebrow="SYSTEM HEALTH" title="Platform Status" description="Live status derived from the actual application subsystems." /><div className="health-grid">{rows.map((row) => <MangaPanel key={row.label} className="health-row"><div><row.icon size={19} /><div><strong>{row.label}</strong><small>{row.state.toUpperCase()}</small></div></div><StatusPill tone={row.state === "ready" ? "good" : row.state === "error" ? "bad" : "warn"}>{row.state}</StatusPill></MangaPanel>)}</div></div>;
  }

  function SecuritySettings() {
    return <div className="page-stack"><SectionHeader eyebrow="PERSONAL SECURITY" title="Security Settings" description="Prototype security preferences and biometric status." /><MangaPanel><div className="settings-section"><div className="setting-row"><div><strong>Biometric Enrollment</strong><small>Current status for your account.</small></div><StatusPill tone="good">ACTIVE</StatusPill></div><div className="setting-row"><div><strong>Role</strong><small>{session?.role}</small></div><StatusPill>{session?.department}</StatusPill></div><div className="setting-row"><div><strong>Security Guidance</strong><small>Never share credentials or bypass biometric controls in a production environment.</small></div></div></div></MangaPanel></div>;
  }

  function ArchitecturePage() {
    const cards = [
      ["01", "BIOMETRIC", "Real webcam capture and face-presence detection."],
      ["02", "AI RISK", "Contextual scoring across device, network, time and failed attempts."],
      ["03", "SECURITY DATA", "Persistent authentication events stored for analysis."],
      ["04", "RESPONSE", "Alerts, incidents and auditability for administrator review."],
    ];
    return commonShell(<>{PublicNav()}<div className="public-page"><SectionHeader eyebrow="SYSTEM ARCHITECTURE" title="Security Pipeline" description="The prototype connects biometric access, AI-assisted risk analysis and persistent security intelligence." /><div className="architecture-grid">{cards.map(([n, title, text]) => <MangaPanel key={n} hover><span className="panel-number">{n}</span><h3>{title}</h3><p>{text}</p></MangaPanel>)}</div></div></>);
  }

  function CapabilitiesPage() {
    const capabilities = [
      [Fingerprint, "Biometric Access", "Real-time face presence detection with controlled webcam lifecycle."],
      [ShieldAlert, "Risk-Based Access", "Contextual risk scoring determines trusted, step-up or denied outcomes."],
      [Database, "Security Database", "IndexedDB persistence for users, authentication events, incidents, alerts and audit records."],
      [BarChart3, "Security Analytics", "Historical security data becomes operational metrics and trends."],
      [Sparkles, "AI-Assisted Insights", "Evidence-based prototype insights derived from stored security events."],
      [Users, "Role-Based Access", "Different hospital staff roles receive appropriate system capabilities."],
    ];
    return commonShell(<>{PublicNav()}<div className="public-page"><SectionHeader eyebrow="PLATFORM CAPABILITIES" title="What the Prototype Demonstrates" /><div className="capability-grid">{capabilities.map(([Icon, title, text]) => <MangaPanel key={title} hover><Icon size={22} /><h3>{title}</h3><p>{text}</p></MangaPanel>)}</div></div></>);
  }

  function EthicsPage() {
    const sections = [
      ["Consent & Privacy", "Biometric capture requires explicit consent in the prototype, while production deployment would require stronger privacy controls and data-governance processes."],
      ["Security", "Biometric references are sensitive. Production deployment would require encryption, secure template handling, key management, retention controls and independent testing."],
      ["Fairness & Accessibility", "False rejects, accessibility needs and demographic performance differences must be considered before real clinical deployment."],
      ["Governance", "Hospital administrators need auditable controls, clear roles, incident procedures and documented accountability."],
    ];
    return commonShell(<>{PublicNav()}<div className="public-page"><SectionHeader eyebrow="ETHICS & GOVERNANCE" title="Responsible Biometric Security" description="The prototype is intentionally transparent about its limits and the controls a real deployment would require." /><div className="stack-list">{sections.map(([title, text]) => <MangaPanel key={title}><h3>{title}</h3><p>{text}</p></MangaPanel>)}</div></div></>);
  }

  function IterationsPage() {
    const iterations = [
      ["V1", "Basic biometric access concept", "Initial concept explored biometric authentication for hospital system access."],
      ["V2", "Contextual risk scoring", "Added device, network, time and failed-attempt factors instead of binary pass/fail access."],
      ["V3", "Consent and step-up", "Added explicit biometric consent, OTP step-up and retry controls."],
      ["V4", "Persistent security data", "Added IndexedDB persistence so analytics and incidents are backed by stored authentication events."],
      ["V5", "Navigation and usability", "Unified navigation, role-aware views and a more coherent security command-centre experience."],
    ];
    return commonShell(<>{PublicNav()}<div className="public-page"><SectionHeader eyebrow="ITERATION LOG" title="Prototype Evolution" description="Documented design progression for the Emerging Technologies assignment." /><div className="timeline">{iterations.map(([version, title, text]) => <div className="timeline-item" key={version}><div className="timeline-dot" /><MangaPanel className="timeline-card"><div className="eyebrow">{version}</div><h3>{title}</h3><p>{text}</p></MangaPanel></div>)}</div></div></>);
  }

  function LandingPage() {
    return commonShell(<>{PublicNav()}<div className="landing"><section className="landing-hero"><div className="hero-copy"><div className="eyebrow hero-eyebrow">AI BIOMETRIC ACCESS CONTROL · SUWA SETHA</div><h1>SECURING<br /><span>HEALTHCARE</span><br />OPERATIONS</h1><p>AI-assisted biometric cybersecurity prototype combining real-time face detection, contextual risk assessment and persistent security intelligence.</p><div className="button-row"><MangaButton icon={UserPlus} onClick={() => navigate("enroll")}>Enrol Biometric</MangaButton><MangaButton variant="secondary" icon={LogIn} onClick={() => navigate("login")}>Secure Login</MangaButton></div></div><div className="hero-scanner"><div className="hero-circle"><Fingerprint size={100} /><span>SECURITY<br />INTELLIGENCE</span></div></div></section><section className="public-section"><SectionHeader eyebrow="THE SYSTEM" title="One connected security workflow" /><div className="architecture-grid"><MangaPanel><span className="panel-number">01</span><h3>Biometric</h3><p>Real webcam + face presence.</p></MangaPanel><MangaPanel><span className="panel-number">02</span><h3>Risk</h3><p>Contextual AI-assisted score.</p></MangaPanel><MangaPanel><span className="panel-number">03</span><h3>Data</h3><p>Persistent security events.</p></MangaPanel><MangaPanel><span className="panel-number">04</span><h3>Response</h3><p>Insights, alerts and audit.</p></MangaPanel></div></section></div></>);
  }

  function EnrollmentPage() {
    return commonShell(<>{PublicNav()}<div className="public-page narrow"><SectionHeader eyebrow="BIOMETRIC ENROLMENT" title="Create a secure staff profile" description="Prototype biometric enrollment using three real camera captures." /><div className="progress-steps">{["CONSENT", "DETAILS", "CAPTURE", "CONFIRM", "COMPLETE"].map((step, index) => <div key={step} className={enrollStep >= index ? "step active" : "step"}><span>{index + 1}</span>{step}</div>)}</div><AnimatePresence mode="wait">
      {enrollStep === 0 && <motion.div key="consent" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}><MangaPanel><div className="center-icon"><Lock size={30} /></div><h3>Biometric Consent</h3><p className="center-text">This prototype captures three facial reference frames for demonstration. Production systems would require secure biometric templates, retention rules, access governance and explicit privacy controls.</p><label className="consent-box"><input type="checkbox" checked={enrollConsent} onChange={(e) => setEnrollConsent(e.target.checked)} /><span>I understand and consent to prototype biometric capture.</span></label><MangaButton disabled={!enrollConsent} icon={ChevronRight} onClick={() => setEnrollStep(1)}>Continue</MangaButton></MangaPanel></motion.div>}
      {enrollStep === 1 && <motion.div key="details" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}><MangaPanel><h3>Staff Profile</h3><div className="form-grid"><MangaInput label="Full Name" value={enrollForm.name} onChange={(e) => setEnrollForm({ ...enrollForm, name: e.target.value })} placeholder="Dr. Nimal Perera" /><MangaInput label="Staff ID (Optional)" value={enrollForm.staffId} onChange={(e) => setEnrollForm({ ...enrollForm, staffId: e.target.value })} placeholder="SS-1042" /><MangaSelect label="Role" value={enrollForm.role} onChange={(e) => setEnrollForm({ ...enrollForm, role: e.target.value })} options={ROLES} /><MangaSelect label="Department" value={enrollForm.department} onChange={(e) => setEnrollForm({ ...enrollForm, department: e.target.value })} options={DEPARTMENTS} /></div><MangaButton icon={Camera} onClick={() => { if (!enrollForm.name.trim()) return showToast("Enter the staff name first."); setEnrollStep(2); }}>Enable Camera</MangaButton></MangaPanel></motion.div>}
      {enrollStep === 2 && <motion.div key="capture" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}><MangaPanel><h3>Live Biometric Capture</h3><p>Three frames · real face-presence detection</p><BiometricCamera ref={enrollCameraRef} autoStart showGuide onError={showToast} /><div className="capture-strip">{[0, 1, 2].map((index) => <div className="capture-box" key={index}>{enrollCaptures[index] ? <img src={enrollCaptures[index]} alt={`Capture ${index + 1}`} /> : <span>{index + 1}</span>}</div>)}</div><div className="button-row center"><MangaButton icon={Camera} onClick={captureEnrollmentFrame} disabled={enrollCaptures.length >= 3}>Capture {Math.min(enrollCaptures.length + 1, 3)} / 3</MangaButton>{enrollCaptures.length === 3 && <MangaButton variant="secondary" onClick={() => setEnrollStep(3)}>Continue</MangaButton>}</div></MangaPanel></motion.div>}
      {enrollStep === 3 && <motion.div key="confirm" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}><MangaPanel><h3>Confirm Enrollment</h3><p>{enrollForm.name} · {enrollForm.role} · {enrollForm.department}</p><div className="capture-strip confirm-strip">{enrollCaptures.map((capture, index) => <img key={index} src={capture} alt={`Capture ${index + 1}`} />)}</div><MangaButton icon={BadgeCheck} onClick={completeEnrollment}>Complete Enrollment</MangaButton></MangaPanel></motion.div>}
      {enrollStep === 4 && <motion.div key="complete" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}><MangaPanel><div className="success-screen"><CheckCircle2 size={62} /><div className="eyebrow">ENROLLMENT COMPLETE</div><h3>{enrollForm.name}</h3><p>Staff ID: {enrollForm.staffId || users.find((u) => u.name === enrollForm.name)?.staffId || "Assigned"}</p><MangaButton onClick={() => navigate("login")}>Proceed to Secure Login</MangaButton></div></MangaPanel></motion.div>}
    </AnimatePresence></div></>);
  }

  function LoginPage() {
    const tier = authRisk ? riskTier(authRisk.score) : null;
    return commonShell(<>{PublicNav()}<div className="public-page narrow login-page"><SectionHeader eyebrow="SECURE ACCESS" title="Biometric Authentication" description="Prototype identity selection → real camera → face detection → AI-assisted risk assessment." />
      {!users.length ? <MangaPanel><EmptyState text="No staff profiles are enrolled yet. Complete biometric enrollment first." /><div className="center mt-16"><MangaButton icon={UserPlus} onClick={() => navigate("enroll")}>Enrol Staff</MangaButton></div></MangaPanel> : <>
        <MangaPanel>
          <MangaSelect label="Select Enrolled Staff ID" value={authSelectedStaffId} onChange={(e) => { setAuthSelectedStaffId(e.target.value); setAuthPhase("idle"); setAuthRisk(null); setAuthError(""); }} options={["", ...users.map((user) => user.staffId)]} />
          {selectedAuthUser && <div className="selected-identity"><div className="avatar">{selectedAuthUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div><div><span>AUTHENTICATING</span><strong>{selectedAuthUser.name}</strong><small>{selectedAuthUser.staffId} · {selectedAuthUser.role} · {selectedAuthUser.department}</small></div></div>}
        </MangaPanel>
        <MangaPanel className="login-scanner-panel">
          <div className="auth-phase-label">{authPhase === "idle" ? "READY FOR SECURE SCAN" : authPhase === "camera_starting" ? "INITIALIZING CAMERA" : authPhase === "camera_ready" ? "SEARCHING FOR FACE" : authPhase === "biometric_scanning" ? "BIOMETRIC PROCESSING" : authPhase === "processing" ? "CALCULATING RISK" : authPhase === "result" && tier ? tier.label : "AUTHENTICATION"}</div>
          {authPhase !== "result" && selectedAuthUser && <BiometricCamera ref={authCameraRef} autoStart={authPhase !== "idle"} showGuide onFaceDetected={handleAuthFace} onStateChange={handleAuthCameraState} onError={(message) => { setAuthError(message); showToast(message); }} />}
          {authPhase === "idle" && <div className="scanner-idle"><Fingerprint size={76} /><p>SELECT STAFF ID THEN INITIALIZE SECURE SCAN</p></div>}
          {authError && <div className="error-banner"><AlertTriangle size={16} />{authError}</div>}
          {authPhase === "idle" && <div className="center mt-16"><MangaButton disabled={!selectedAuthUser} icon={Fingerprint} onClick={beginAuthentication}>Start Secure Scan</MangaButton></div>}
          {authPhase !== "idle" && authPhase !== "result" && <div className="scan-meta"><span><Eye size={14} /> FACE {authFaceDetected ? "DETECTED" : "SEARCHING"}</span><span><Database size={14} /> DB {dbState.toUpperCase()}</span></div>}
          {authPhase === "result" && authRisk && tier && <div className="auth-result"><div className="risk-score"><span>AI RISK SCORE</span><strong>{authScoreAnim}</strong><small>/ 100</small></div><StatusPill tone={tier.tone}>{tier.label}</StatusPill><div className="risk-factors">{authRisk.factors.map((factor) => <div key={factor.label} className="risk-factor"><div><span>{factor.label}</span><strong>+{factor.value}</strong></div><ProgressBar value={Math.min(100, factor.value * 2.5)} /><small>{factor.desc}</small></div>)}</div>{tier.key === "med" && <div className="otp-box"><div className="eyebrow">STEP-UP VERIFICATION</div>{!authOtpActive ? <MangaButton variant="ghost" icon={Bell} onClick={() => setAuthOtpActive(true)}>Send Demo OTP</MangaButton> : <><div className="otp-row"><input value={authOtp} onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" /><MangaButton onClick={verifyOtp}>Verify</MangaButton></div><small>Demo code: 123456</small></>}</div>}{tier.key === "high" && <div className="denied-box"><ShieldX size={34} /><strong>ACCESS DENIED</strong><span>Security incident and alert recorded.</span></div>}{tier.key === "low" && <div className="success-box"><ShieldCheck size={34} /><div><strong>ACCESS AUTHORIZED</strong><span>Identity verified for this prototype flow.</span></div><MangaButton onClick={() => { setSession(selectedAuthUser); navigate("dashboard"); }}>Enter Portal</MangaButton></div>}<div className="button-row center"><MangaButton variant="ghost" icon={RefreshCw} onClick={() => { setAuthPhase("idle"); setAuthRisk(null); setAuthOtp(""); setAuthOtpActive(false); setAuthFaceDetected(false); }}>New Scan</MangaButton></div></div>}
        </MangaPanel>
      </>}
      <MangaPanel className="prototype-note"><strong>Prototype note</strong><span>Face detection is real. Identity matching remains a prototype concept; production deployment would require secure biometric templates, identity matching and governance controls.</span></MangaPanel>
      <MangaPanel className="prototype-note"><MangaSelect label="Demonstration Security Scenario" value={authScenario} onChange={(e) => { setAuthScenario(e.target.value); setAuthAnomalous(e.target.value === "suspicious"); }} options={["standard", "elevated", "suspicious"]} /><span>Standard demonstrates trusted access, Elevated demonstrates step-up verification, and Suspicious demonstrates high-risk denial with incident/alert creation.</span></MangaPanel>
    </div></>);
  }

  if (view === "landing") return LandingPage();
  if (view === "architecture") return ArchitecturePage();
  if (view === "capabilities") return CapabilitiesPage();
  if (view === "ethics") return EthicsPage();
  if (view === "iterations") return IterationsPage();
  if (view === "enroll") return EnrollmentPage();
  if (view === "login") return LoginPage();
  if (view === "dashboard" && session) return commonShell(AuthShell());
  if (view === "dashboard" && !session) {
    return commonShell(
      <div className="public-page narrow">
        <MangaPanel>
          <div className="center-icon"><ShieldX size={28} /></div>
          <SectionHeader eyebrow="ACCESS RESTRICTED" title="Authentication Required" description="A valid hospital security session is required to enter the protected portal." />
          <div className="center"><MangaButton icon={LogIn} onClick={() => navigate("login")}>Return to Secure Login</MangaButton></div>
        </MangaPanel>
      </div>,
    );
  }
  return LandingPage();
}
