import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import * as faceapi from "@vladmandic/face-api";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Camera, CameraOff, UserPlus, LogIn,
  Activity, FileText, Scale, ChevronRight, CheckCircle2, AlertTriangle, Lock,
  RefreshCw, LogOut, X, Fingerprint, BadgeCheck, Users, Settings, GitBranch,
  ClipboardList, Sparkles, Eye, Server, KeyRound, AlertOctagon, Download,
  BarChart3, Database, TrendingUp, HeartPulse, Search, Filter, Bell, Menu,
  Home, Layers, Zap, Clock, User, FileBarChart, MapPin, Cpu,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// MONOCHROME MANGA THEME
// ═══════════════════════════════════════════════════════════════════

const T = {
  black: "#000000",
  void: "#0a0a0a",
  bg: "#0f0f0f",
  bg2: "#161616",
  panel: "#1a1a1a",
  panel2: "#222222",
  graphite: "#2a2a2a",
  steel: "#404040",
  silver: "#707070",
  ash: "#909090",
  white: "#ffffff",
  text: "#f5f5f5",
  muted: "#b0b0b0",
  dim: "#6a6a6a",
  line: "rgba(255,255,255,0.08)",
  line2: "rgba(255,255,255,0.04)",
  lineStrong: "rgba(255,255,255,0.15)",
  glow: "rgba(255,255,255,0.02)",
  ok: "#ffffff",
  okDim: "rgba(255,255,255,0.7)",
  warn: "#d0d0d0",
  warnDim: "rgba(208,208,208,0.6)",
  bad: "#888888",
  badDim: "rgba(136,136,136,0.5)",
  accent: "#ffffff",
  accentDim: "rgba(255,255,255,0.12)",
  scanline: "rgba(255,255,255,0.02)",
};

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/";

const ROLES = ["Doctor", "Nurse", "Administrator", "Receptionist"];
const DEPTS = ["Emergency", "ICU", "Radiology", "Pharmacy", "Administration", "OPD"];
const PATIENTS = [
  { id: "PT-24081", name: "R. Fernando", ward: "Ward 3", admitted: "2025-03-12", status: "Stable", doctor: "Dr. Wickrama", hr: 78, bp: "118/76", spo2: 98, notes: "Post-op day 4. Wound healing well. Discharge planning underway." },
  { id: "PT-24056", name: "M. Silva", ward: "ICU-2", admitted: "2025-03-14", status: "Critical", doctor: "Dr. Perera", hr: 112, bp: "92/58", spo2: 91, notes: "Respiratory support ongoing. Family briefed 07:40." },
  { id: "PT-23998", name: "K. Jayasuriya", ward: "Ward 1", admitted: "2025-03-10", status: "Stable", doctor: "Dr. Fernando", hr: 72, bp: "124/80", spo2: 97, notes: "HTN review. Medications adjusted. Labs pending." },
  { id: "PT-24102", name: "A. Bandara", ward: "Ward 5", admitted: "2025-03-15", status: "Discharged", doctor: "Dr. Wickrama", hr: 68, bp: "120/78", spo2: 99, notes: "Discharged on oral antibiotics. Follow-up in 1 week." },
  { id: "PT-24077", name: "S. Gunasekara", ward: "Emergency", admitted: "2025-03-16", status: "Critical", doctor: "Dr. Perera", hr: 124, bp: "88/54", spo2: 89, notes: "Trauma case. Stabilization in progress. CT scan pending." },
];

// ═══════════════════════════════════════════════════════════════════
// INDEXEDDB DATABASE SERVICE
// ═══════════════════════════════════════════════════════════════════

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbName = "SuwaSethaDB";
    this.version = 2;
    this.isReady = false;
  }

  async init() {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => {
        console.error("Database error:", request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Users store
        if (!db.objectStoreNames.contains("users")) {
          const userStore = db.createObjectStore("users", { keyPath: "staffId" });
          userStore.createIndex("name", "name", { unique: false });
          userStore.createIndex("role", "role", { unique: false });
          userStore.createIndex("department", "department", { unique: false });
        }
        
        // Authentication events store
        if (!db.objectStoreNames.contains("authenticationEvents")) {
          const eventStore = db.createObjectStore("authenticationEvents", { keyPath: "id", autoIncrement: true });
          eventStore.createIndex("userId", "userId", { unique: false });
          eventStore.createIndex("staffId", "staffId", { unique: false });
          eventStore.createIndex("timestamp", "timestamp", { unique: false });
          eventStore.createIndex("outcome", "outcome", { unique: false });
          eventStore.createIndex("riskLevel", "riskLevel", { unique: false });
        }
        
        // Incidents store
        if (!db.objectStoreNames.contains("incidents")) {
          const incidentStore = db.createObjectStore("incidents", { keyPath: "id", autoIncrement: true });
          incidentStore.createIndex("status", "status", { unique: false });
          incidentStore.createIndex("timestamp", "timestamp", { unique: false });
        }
        
        // Alerts store
        if (!db.objectStoreNames.contains("alerts")) {
          const alertStore = db.createObjectStore("alerts", { keyPath: "id", autoIncrement: true });
          alertStore.createIndex("timestamp", "timestamp", { unique: false });
          alertStore.createIndex("read", "read", { unique: false });
        }
        
        // Audit logs store
        if (!db.objectStoreNames.contains("auditLogs")) {
          const auditStore = db.createObjectStore("auditLogs", { keyPath: "id", autoIncrement: true });
          auditStore.createIndex("timestamp", "timestamp", { unique: false });
          auditStore.createIndex("action", "action", { unique: false });
        }
      };
    });
  }

  async addUser(user) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["users"], "readwrite");
    const store = tx.objectStore("users");
    return new Promise((resolve, reject) => {
      const request = store.put(user);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUsers() {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["users"], "readonly");
    const store = tx.objectStore("users");
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  async addAuthenticationEvent(event) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["authenticationEvents"], "readwrite");
    const store = tx.objectStore("authenticationEvents");
    event.timestamp = Date.now();
    return new Promise((resolve, reject) => {
      const request = store.add(event);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAuthenticationEvents(limit = 200) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["authenticationEvents"], "readonly");
    const store = tx.objectStore("authenticationEvents");
    const index = store.index("timestamp");
    
    return new Promise((resolve) => {
      const request = index.openCursor(null, "prev");
      const results = [];
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => resolve([]);
    });
  }

  async addIncident(incident) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["incidents"], "readwrite");
    const store = tx.objectStore("incidents");
    incident.timestamp = Date.now();
    return new Promise((resolve, reject) => {
      const request = store.add(incident);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getIncidents() {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["incidents"], "readonly");
    const store = tx.objectStore("incidents");
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  async updateIncident(id, updates) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["incidents"], "readwrite");
    const store = tx.objectStore("incidents");
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const incident = getRequest.result;
        if (incident) {
          Object.assign(incident, updates);
          const updateRequest = store.put(incident);
          updateRequest.onsuccess = () => resolve(incident);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error("Incident not found"));
        }
      };
    });
  }

  async addAlert(alert) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["alerts"], "readwrite");
    const store = tx.objectStore("alerts");
    alert.timestamp = Date.now();
    alert.read = false;
    return new Promise((resolve, reject) => {
      const request = store.add(alert);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAlerts() {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["alerts"], "readonly");
    const store = tx.objectStore("alerts");
    const index = store.index("timestamp");
    return new Promise((resolve) => {
      const request = index.openCursor(null, "prev");
      const results = [];
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => resolve([]);
    });
  }

  async addAuditLog(log) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["auditLogs"], "readwrite");
    const store = tx.objectStore("auditLogs");
    log.timestamp = Date.now();
    return new Promise((resolve, reject) => {
      const request = store.add(log);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAuditLogs(limit = 200) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["auditLogs"], "readonly");
    const store = tx.objectStore("auditLogs");
    const index = store.index("timestamp");
    return new Promise((resolve) => {
      const request = index.openCursor(null, "prev");
      const results = [];
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => resolve([]);
    });
  }
}

const db = new DatabaseService();

// ═══════════════════════════════════════════════════════════════════
// RISK CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════════

function calculateRisk({ enrolled, anomalous, failed }) {
  const f = failed || 0;
  let device = enrolled ? 5 : 25;
  let location = 5;
  let time = 5;
  let attempts = f === 0 ? 0 : f <= 2 ? 10 : 35;
  let bio = enrolled ? 4 : 28;
  
  if (anomalous) {
    device = 25;
    location = 30;
    time = 15;
    attempts = Math.max(attempts, 10);
    bio = 18;
  }
  
  const score = Math.min(100, device + location + time + attempts + bio);
  
  return {
    score,
    factors: [
      { label: "Device Recognition", value: device, desc: device <= 5 ? "Known hospital workstation" : "Unrecognized device" },
      { label: "Network Location", value: location, desc: location <= 5 ? "Internal hospital network" : "Unfamiliar location" },
      { label: "Time Pattern", value: time, desc: time <= 5 ? "Normal shift hours" : "Unusual hour" },
      { label: "Failed Attempts", value: attempts, desc: f + " recent failures" },
      { label: "Biometric Confidence", value: bio, desc: enrolled ? "Live face detected + template match simulated" : "No enrolled template" },
    ],
  };
}

function getRiskTier(score) {
  if (score <= 30) return { key: "low", label: "TRUSTED — ACCESS GRANTED", color: T.ok, Icon: ShieldCheck };
  if (score <= 60) return { key: "med", label: "CAUTION — STEP-UP REQUIRED", color: T.warn, Icon: ShieldAlert };
  return { key: "high", label: "HIGH RISK — ACCESS DENIED", color: T.bad, Icon: ShieldX };
}

// ═══════════════════════════════════════════════════════════════════
// AUDIO FEEDBACK
// ═══════════════════════════════════════════════════════════════════

function useAudio() {
  const ctx = useRef(null);
  
  const tone = useCallback((freq, dur, type = "sine", vol = 0.03, slide = 0) => {
    try {
      if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.current.state === "suspended") ctx.current.resume();
      
      const c = ctx.current;
      const o = c.createOscillator();
      const g = c.createGain();
      
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
      
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur);
    } catch (e) {}
  }, []);
  
  return {
    tap: () => tone(800, 0.05, "sine", 0.02, -300),
    success: () => { tone(523, 0.08); setTimeout(() => tone(784, 0.12), 60); },
    deny: () => tone(140, 0.2, "triangle", 0.04, -30),
    whoosh: () => tone(200, 0.15, "sine", 0.02, 500),
  };
}

// ═══════════════════════════════════════════════════════════════════
// ATMOSPHERE CANVAS
// ═══════════════════════════════════════════════════════════════════

function Atmosphere() {
  const ref = useRef(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    let mx = w / 2;
    let my = h / 2;
    let mounted = true;

    const particles = Array.from({ length: 48 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random() * 0.7 + 0.3,
      vx: (Math.random() - 0.5) * 0.0002,
      vy: (Math.random() - 0.5) * 0.0002,
    }));

    const scanlines = Array.from({ length: 8 }, (_, i) => ({
      y: (i / 8) * h,
      speed: 0.3 + Math.random() * 0.2,
    }));

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      cvs.width = w;
      cvs.height = h;
    };
    resize();

    const move = (e) => {
      mx = e.clientX;
      my = e.clientY;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", move);

    let animId = 0;
    const loop = () => {
      if (!mounted) return;
      
      ctx.clearRect(0, 0, w, h);

      const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 280);
      grd.addColorStop(0, "rgba(255,255,255,0.03)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;

        const px = p.x * w;
        const py = p.y * h;
        const dx = px - mx;
        const dy = py - my;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const pull = Math.max(0, 1 - dist / 240) * 6;
        const fx = px - (dx / dist) * pull;
        const fy = py - (dy / dist) * pull;

        ctx.beginPath();
        ctx.arc(fx, fy, p.z * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.08 * p.z})`;
        ctx.fill();
      });

      scanlines.forEach(s => {
        s.y += s.speed;
        if (s.y > h) s.y = 0;
        
        ctx.beginPath();
        ctx.moveTo(0, s.y);
        ctx.lineTo(w, s.y);
        ctx.strokeStyle = T.scanline;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      mounted = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", move);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// BIOMETRIC CAMERA COMPONENT (PROPERLY ARCHITECTED)
// ═══════════════════════════════════════════════════════════════════

const CameraStates = {
  IDLE: "idle",
  REQUESTING: "requesting",
  INITIALIZING: "initializing",
  READY: "ready",
  DETECTING: "detecting",
  DETECTED: "detected",
  ERROR: "error",
};

const BiometricCamera = forwardRef(({ onFaceDetected, onError, autoStart = false, showGuide = true }, ref) => {
  const [cameraState, setCameraState] = useState(CameraStates.IDLE);
  const [faceDetected, setFaceDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectLoopRef = useRef(null);
  const mountedRef = useRef(true);

  // Expose camera control methods to parent via ref
  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        return null;
      }
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.8);
    },
    getState: () => cameraState,
    isFaceDetected: () => faceDetected,
    isReady: () => cameraState === CameraStates.READY || cameraState === CameraStates.DETECTING || cameraState === CameraStates.DETECTED,
    start: () => startCamera(),
    stop: () => stopCamera(),
  }));

  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      .then(() => {
        if (mountedRef.current) setModelsLoaded(true);
      })
      .catch((err) => {
        console.error("Model load error:", err);
        if (mountedRef.current) setModelsLoaded(false);
      });
  }, []);

  const stopCamera = useCallback(() => {
    if (detectLoopRef.current) {
      clearInterval(detectLoopRef.current);
      detectLoopRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setFaceDetected(false);
    setCameraState(CameraStates.IDLE);
  }, []);

  const startCamera = useCallback(async () => {
    if (!modelsLoaded) {
      setErrorMessage("Face detection models not loaded");
      setCameraState(CameraStates.ERROR);
      if (onError) onError("Face detection models not loaded");
      return;
    }

    stopCamera();
    setCameraState(CameraStates.REQUESTING);
    setErrorMessage("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      setCameraState(CameraStates.INITIALIZING);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        try {
          await videoRef.current.play();
          
          await new Promise((resolve) => {
            const checkReady = () => {
              if (videoRef.current && videoRef.current.readyState >= 2) {
                resolve();
              } else {
                setTimeout(checkReady, 100);
              }
            };
            checkReady();
          });
          
          if (mountedRef.current) {
            setCameraState(CameraStates.READY);
            startDetection();
          }
        } catch (playErr) {
          throw new Error("Video play failed: " + playErr.message);
        }
      }
    } catch (err) {
      let msg = "Camera access failed";
      
      if (err.name === "NotAllowedError") {
        msg = "Camera permission denied. Please allow camera access in your browser settings.";
      } else if (err.name === "NotFoundError") {
        msg = "No camera device found on this system.";
      } else if (err.name === "NotReadableError") {
        msg = "Camera is already in use by another application.";
      } else if (err.message) {
        msg = err.message;
      }
      
      setErrorMessage(msg);
      setCameraState(CameraStates.ERROR);
      if (onError) onError(msg);
    }
  }, [modelsLoaded, stopCamera, onError]);

  const startDetection = useCallback(() => {
    if (detectLoopRef.current) return;
    
    setCameraState(CameraStates.DETECTING);
    
    detectLoopRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || !mountedRef.current) return;
      
      try {
        const detection = await faceapi.detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
        );
        
        const detected = !!detection;
        
        if (mountedRef.current) {
          setFaceDetected(detected);
          if (detected) {
            setCameraState(CameraStates.DETECTED);
            if (onFaceDetected) onFaceDetected(true);
          } else {
            setCameraState(CameraStates.DETECTING);
            if (onFaceDetected) onFaceDetected(false);
          }
        }
      } catch (detectErr) {
        console.warn("Detection error:", detectErr);
      }
    }, 400);
  }, [onFaceDetected]);

  useEffect(() => {
    if (autoStart && modelsLoaded && cameraState === CameraStates.IDLE) {
      startCamera();
    }
  }, [autoStart, modelsLoaded, cameraState, startCamera]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  const getStatusLabel = () => {
    switch (cameraState) {
      case CameraStates.IDLE: return "CAMERA OFFLINE";
      case CameraStates.REQUESTING: return "REQUESTING CAMERA...";
      case CameraStates.INITIALIZING: return "INITIALIZING STREAM...";
      case CameraStates.READY: return "CAMERA ONLINE";
      case CameraStates.DETECTING: return "SEARCHING FOR FACE...";
      case CameraStates.DETECTED: return "FACE DETECTED";
      case CameraStates.ERROR: return "CAMERA ERROR";
      default: return "UNKNOWN STATE";
    }
  };

  const getStatusColor = () => {
    if (cameraState === CameraStates.ERROR) return T.bad;
    if (cameraState === CameraStates.DETECTED) return T.ok;
    if (cameraState === CameraStates.DETECTING || cameraState === CameraStates.READY) return T.warn;
    return T.dim;
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          aspectRatio: "4/3",
          borderRadius: 4,
          overflow: "hidden",
          background: T.black,
          border: `2px solid ${faceDetected ? T.ok : T.line}`,
          boxShadow: faceDetected
            ? `0 0 40px rgba(255,255,255,0.1), inset 0 0 60px rgba(255,255,255,0.02)`
            : `0 20px 60px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,0,0,0.4)`,
          transition: "border-color 0.3s, box-shadow 0.3s",
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)",
            display: cameraState === CameraStates.ERROR ? "none" : "block",
          }}
        />
        
        {showGuide && cameraState !== CameraStates.ERROR && (
          <>
            <div
              style={{
                position: "absolute",
                inset: "12% 20%",
                borderRadius: "50%",
                border: `1.5px dashed ${faceDetected ? T.ok : "rgba(255,255,255,0.2)"}`,
                pointerEvents: "none",
                transition: "border-color 0.3s",
              }}
            />
            
            {[
              { top: "8%", left: "16%", br: "0 0 0 6px" },
              { top: "8%", right: "16%", br: "0 0 6px 0" },
              { bottom: "8%", left: "16%", br: "0 6px 0 0" },
              { bottom: "8%", right: "16%", br: "6px 0 0 0" },
            ].map((pos, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  ...pos,
                  width: 24,
                  height: 24,
                  border: `2px solid ${faceDetected ? T.ok : "rgba(255,255,255,0.3)"}`,
                  borderRadius: pos.br,
                  pointerEvents: "none",
                  transition: "border-color 0.3s",
                }}
              />
            ))}
          </>
        )}

        {cameraState === CameraStates.DETECTING && (
          <motion.div
            animate={{ top: ["0%", "100%", "0%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${T.white}, transparent)`,
              boxShadow: `0 0 12px ${T.white}`,
              pointerEvents: "none",
            }}
          />
        )}

        {cameraState === CameraStates.ERROR && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.92)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              textAlign: "center",
            }}
          >
            <div>
              <CameraOff size={40} color={T.bad} style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 13, color: T.bad, lineHeight: 1.6, marginBottom: 20 }}>
                {errorMessage}
              </div>
              <button
                onClick={startCamera}
                style={{
                  padding: "10px 24px",
                  background: T.panel,
                  border: `1px solid ${T.line}`,
                  borderRadius: 4,
                  color: T.text,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <RefreshCw size={14} /> RETRY CAMERA
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 16,
          textAlign: "center",
          fontFamily: "monospace",
          fontSize: 11,
          letterSpacing: "0.1em",
          fontWeight: 700,
          color: getStatusColor(),
        }}
      >
        {getStatusLabel()}
      </div>

      {!autoStart && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          {cameraState === CameraStates.IDLE || cameraState === CameraStates.ERROR ? (
            <button
              onClick={startCamera}
              disabled={!modelsLoaded}
              style={{
                padding: "12px 28px",
                background: modelsLoaded ? T.white : T.graphite,
                color: T.black,
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                cursor: modelsLoaded ? "pointer" : "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Camera size={16} /> {modelsLoaded ? "START CAMERA" : "LOADING MODELS..."}
            </button>
          ) : (
            <button
              onClick={stopCamera}
              style={{
                padding: "12px 28px",
                background: "transparent",
                color: T.muted,
                border: `1px solid ${T.line}`,
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <CameraOff size={16} /> STOP CAMERA
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// MANGA-STYLE UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════

const MangaPanel = ({ children, style, hover = false, ...props }) => (
  <motion.div
    whileHover={hover ? { y: -4, borderColor: T.lineStrong } : {}}
    style={{
      background: `linear-gradient(165deg, ${T.panel} 0%, ${T.bg2} 100%)`,
      border: `1px solid ${T.line}`,
      borderRadius: 2,
      boxShadow: `
        0 2px 16px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.03)
      `,
      ...style,
    }}
    {...props}
  >
    {children}
  </motion.div>
);

const MangaButton = ({ children, variant = "primary", icon: Icon, onClick, disabled, style, ...props }) => {
  const variants = {
    primary: {
      background: T.white,
      color: T.black,
      border: "none",
      boxShadow: "0 4px 20px rgba(255,255,255,0.15)",
    },
    secondary: {
      background: "transparent",
      color: T.text,
      border: `1px solid ${T.line}`,
      boxShadow: "none",
    },
    ghost: {
      background: "transparent",
      color: T.muted,
      border: `1px solid ${T.line2}`,
      boxShadow: "none",
    },
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -2 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "14px 32px",
        borderRadius: 2,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        opacity: disabled ? 0.4 : 1,
        transition: "opacity 0.2s",
        ...variants[variant],
        ...style,
      }}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </motion.button>
  );
};

const MangaInput = ({ label, ...props }) => (
  <div style={{ marginBottom: 20 }}>
    {label && (
      <label style={{
        display: "block",
        fontSize: 9,
        letterSpacing: "0.16em",
        color: T.dim,
        fontWeight: 700,
        marginBottom: 8,
        textTransform: "uppercase",
      }}>
        {label}
      </label>
    )}
    <input
      style={{
        width: "100%",
        padding: "14px 16px",
        borderRadius: 2,
        border: `1px solid ${T.line2}`,
        background: T.void,
        color: T.text,
        fontSize: 14,
        outline: "none",
        boxSizing: "border-box",
        transition: "border-color 0.2s",
      }}
      onFocus={(e) => e.target.style.borderColor = T.line}
      onBlur={(e) => e.target.style.borderColor = T.line2}
      {...props}
    />
  </div>
);

const MangaDivider = () => (
  <div style={{
    height: 1,
    background: `linear-gradient(90deg, transparent, ${T.line}, transparent)`,
    margin: "32px 0",
  }} />
);

// ═══════════════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════════════

export default function App() {
  const sfx = useAudio();

  // Core state
  const [view, setView] = useState("landing");
  const [users, setUsers] = useState([]);
  const [authEvents, setAuthEvents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [session, setSession] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Database state
  const [dbState, setDbState] = useState("initializing"); // initializing, ready, error

  // System health state
  const [faceModelState, setFaceModelState] = useState("loading"); // loading, ready, error

  // Enrollment flow
  const [enrollStep, setEnrollStep] = useState(0);
  const [enrollConsent, setEnrollConsent] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    name: "",
    staffId: "",
    role: "Doctor",
    department: "Emergency",
  });
  const [enrollCaptures, setEnrollCaptures] = useState([]);

  // Authentication flow - STATE DRIVEN
  const [authPhase, setAuthPhase] = useState("idle"); // idle, camera_starting, biometric_scanning, processing, result
  const [authRisk, setAuthRisk] = useState(null);
  const [authScoreAnim, setAuthScoreAnim] = useState(0);
  const [authAnomalous, setAuthAnomalous] = useState(false);
  const [authOtp, setAuthOtp] = useState("");
  const [authOtpActive, setAuthOtpActive] = useState(false);
  const [authFailCount, setAuthFailCount] = useState(0);
  const [authFaceDetected, setAuthFaceDetected] = useState(false);
  const [authBiometricComplete, setAuthBiometricComplete] = useState(false);

  // Dashboard state
  const [dashboardTab, setDashboardTab] = useState("overview");
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Data explorer filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [filterOutcome, setFilterOutcome] = useState("All");

  // UI state
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState("");

  // Camera refs
  const enrollCameraRef = useRef(null);
  const authCameraRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════
  // DATABASE INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    db.init()
      .then(() => {
        setDbState("ready");
        return Promise.all([
          db.getUsers(),
          db.getAuthenticationEvents(),
          db.getIncidents(),
          db.getAlerts(),
          db.getAuditLogs(),
        ]);
      })
      .then(([usersData, eventsData, incidentsData, alertsData, logsData]) => {
        setUsers(usersData);
        setAuthEvents(eventsData);
        setIncidents(incidentsData);
        setAlerts(alertsData);
        setAuditLogs(logsData);
      })
      .catch((err) => {
        console.error("Database initialization failed:", err);
        setDbState("error");
      });
  }, []);

  // Track face model loading
  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      .then(() => setFaceModelState("ready"))
      .catch(() => setFaceModelState("error"));
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // CLOCK
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (message) => {
    setToast(message);
    sfx.tap();
  };

  // ═══════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════════

  const navigate = (newView) => {
    sfx.tap();
    setView(newView);
    setMobileMenuOpen(false);
    
    if (newView === "enroll") {
      setEnrollStep(0);
      setEnrollConsent(false);
      setEnrollCaptures([]);
      setEnrollForm({ name: "", staffId: "", role: "Doctor", department: "Emergency" });
    }
    
    if (newView === "login") {
      setAuthPhase("idle");
      setAuthRisk(null);
      setAuthOtp("");
      setAuthOtpActive(false);
      setAuthFaceDetected(false);
      setAuthBiometricComplete(false);
    }
    
    if (newView === "dashboard") {
      setDashboardTab("overview");
      setSelectedPatient(null);
    }
  };

  const logout = () => {
    sfx.tap();
    
    // Audit log
    db.addAuditLog({
      action: "LOGOUT",
      userId: session?.staffId || "unknown",
      userName: session?.name || "Unknown",
      details: "User logged out",
    });
    
    setSession(null);
    navigate("landing");
  };

  // ═══════════════════════════════════════════════════════════════════
  // ENROLLMENT
  // ═══════════════════════════════════════════════════════════════════

  const captureEnrollmentFrame = () => {
    if (!enrollCameraRef.current || enrollCaptures.length >= 3) return;
    
    const frame = enrollCameraRef.current.captureFrame();
    if (!frame) {
      showToast("Cannot capture - camera not ready or no face detected");
      return;
    }
    
    setEnrollCaptures(prev => [...prev, frame]);
    sfx.success();
  };

  const completeEnrollment = async () => {
    if (!enrollForm.name.trim() || enrollCaptures.length < 3) {
      showToast("Complete all enrollment steps");
      return;
    }

    const staffId = enrollForm.staffId.trim() || `SS-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const newUser = {
      ...enrollForm,
      staffId,
      captures: enrollCaptures,
      enrolledAt: Date.now(),
    };

    try {
      await db.addUser(newUser);
      await db.addAuditLog({
        action: "BIOMETRIC_ENROLLMENT",
        userId: staffId,
        userName: enrollForm.name,
        details: `Biometric enrollment completed - ${enrollForm.role} - ${enrollForm.department}`,
      });
      
      const updatedUsers = await db.getUsers();
      setUsers(updatedUsers);
      
      setEnrollStep(4);
      sfx.success();
      
      if (enrollCameraRef.current) {
        enrollCameraRef.current.stop();
      }
    } catch (err) {
      console.error("Enrollment error:", err);
      showToast("Enrollment failed - database error");
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // AUTHENTICATION - STATE DRIVEN (NOT TIMER DRIVEN)
  // ═══════════════════════════════════════════════════════════════════

  const startAuthentication = () => {
    sfx.whoosh();
    setAuthPhase("camera_starting");
    setAuthRisk(null);
    setAuthScoreAnim(0);
    setAuthOtp("");
    setAuthOtpActive(false);
    setAuthFaceDetected(false);
    setAuthBiometricComplete(false);
  };

  // Monitor authentication camera state changes
  useEffect(() => {
    if (authPhase !== "camera_starting") return;
    
    const checkInterval = setInterval(() => {
      if (!authCameraRef.current) return;
      
      const cameraReady = authCameraRef.current.isReady();
      const faceDetected = authCameraRef.current.isFaceDetected();
      
      if (cameraReady && faceDetected && !authBiometricComplete) {
        // Face detected - begin biometric scan
        setAuthPhase("biometric_scanning");
        setAuthFaceDetected(true);
        
        // Simulate biometric verification process (minimum realistic duration)
        setTimeout(() => {
          setAuthBiometricComplete(true);
          setAuthPhase("processing");
          processAuthentication();
        }, 1800);
        
        clearInterval(checkInterval);
      }
    }, 200);
    
    return () => clearInterval(checkInterval);
  }, [authPhase, authBiometricComplete]);

  const processAuthentication = async () => {
    const hasEnrolled = users.length > 0;
    const risk = calculateRisk({
      enrolled: hasEnrolled,
      anomalous: authAnomalous,
      failed: authFailCount,
    });

    setAuthRisk(risk);
    const tier = getRiskTier(risk.score);

    const user = hasEnrolled ? users[users.length - 1] : null;
    
    // Create authentication event
    const authEvent = {
      userId: user?.staffId || "unknown",
      staffId: user?.staffId || "—",
      userName: user?.name || "Unknown",
      role: user?.role || "—",
      department: user?.department || "—",
      riskScore: risk.score,
      riskLevel: tier.key,
      outcome: tier.key === "low" ? "Granted" : tier.key === "med" ? "Step-up" : "Denied",
      device: authAnomalous ? "Unknown Device" : "Hospital Workstation #A12",
      location: authAnomalous ? "External Network" : "Colombo · Core LAN",
      factors: risk.factors.filter(f => f.value > 10).map(f => f.desc),
    };

    try {
      await db.addAuthenticationEvent(authEvent);
      
      // Create audit log
      await db.addAuditLog({
        action: "AUTHENTICATION_ATTEMPT",
        userId: user?.staffId || "unknown",
        userName: user?.name || "Unknown",
        details: `${authEvent.outcome} - Risk: ${risk.score} - ${authEvent.device}`,
      });

      // Create incident if high risk
      if (tier.key === "high") {
        await db.addIncident({
          eventId: authEvent.id,
          userId: user?.staffId || "unknown",
          userName: user?.name || "Unknown",
          riskScore: risk.score,
          device: authEvent.device,
          location: authEvent.location,
          factors: authEvent.factors,
          status: "New",
        });
        
        await db.addAlert({
          type: "HIGH_RISK_AUTHENTICATION",
          severity: "high",
          userId: user?.staffId || "unknown",
          userName: user?.name || "Unknown",
          message: `High-risk authentication attempt detected - Risk score: ${risk.score}`,
        });
      }

      // Refresh data
      const [eventsData, incidentsData, alertsData, logsData] = await Promise.all([
        db.getAuthenticationEvents(),
        db.getIncidents(),
        db.getAlerts(),
        db.getAuditLogs(),
      ]);
      
      setAuthEvents(eventsData);
      setIncidents(incidentsData);
      setAlerts(alertsData);
      setAuditLogs(logsData);

      setAuthPhase("result");

      if (tier.key === "high") {
        setAuthFailCount(prev => prev + 1);
        sfx.deny();
      } else {
        setAuthFailCount(0);
        sfx.success();
        
        if (tier.key === "low" && user) {
          setTimeout(() => {
            setSession(user);
            navigate("dashboard");
          }, 1500);
        }
      }
      
      if (authCameraRef.current) {
        authCameraRef.current.stop();
      }
    } catch (err) {
      console.error("Authentication processing error:", err);
      showToast("Authentication failed - database error");
      setAuthPhase("idle");
    }
  };

  const verifyOtp = async () => {
    if (authOtp === "123456" || authOtp.length === 6) {
      const user = users[users.length - 1];
      if (user) {
        sfx.success();
        
        await db.addAuditLog({
          action: "OTP_VERIFICATION_SUCCESS",
          userId: user.staffId,
          userName: user.name,
          details: "Step-up OTP verification successful",
        });
        
        setSession(user);
        navigate("dashboard");
      }
    } else {
      sfx.deny();
      showToast("Invalid OTP. Demo code: 123456");
    }
  };

  // Animate risk score
  useEffect(() => {
    if (!authRisk || authPhase !== "result") return;
    
    let current = 0;
    const interval = setInterval(() => {
      current += 2;
      if (current >= authRisk.score) {
        setAuthScoreAnim(authRisk.score);
        clearInterval(interval);
      } else {
        setAuthScoreAnim(current);
      }
    }, 16);
    
    return () => clearInterval(interval);
  }, [authRisk, authPhase]);

  // ═══════════════════════════════════════════════════════════════════
  // INCIDENT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  const updateIncidentStatus = async (incidentId, newStatus) => {
    sfx.tap();
    try {
      await db.updateIncident(incidentId, { status: newStatus });
      const updated = await db.getIncidents();
      setIncidents(updated);
      
      await db.addAuditLog({
        action: "INCIDENT_STATUS_UPDATE",
        userId: session?.staffId || "admin",
        userName: session?.name || "Administrator",
        details: `Incident ${incidentId} status changed to ${newStatus}`,
      });
      
      showToast("Incident status updated");
    } catch (err) {
      console.error("Incident update error:", err);
      showToast("Incident update failed");
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // ANALYTICS CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════

  const analytics = useMemo(() => {
    const total = authEvents.length;
    const granted = authEvents.filter(e => e.outcome === "Granted").length;
    const stepUp = authEvents.filter(e => e.outcome === "Step-up").length;
    const denied = authEvents.filter(e => e.outcome === "Denied").length;
    const successRate = total ? Math.round((granted / total) * 100) : 0;
    const avgRisk = total
      ? Math.round(authEvents.reduce((sum, e) => sum + e.riskScore, 0) / total)
      : 0;
    const openIncidents = incidents.filter(
      i => i.status === "New" || i.status === "Investigating"
    ).length;
    
    const posture = Math.max(0, Math.min(100,
      100 - (denied * 3) - (openIncidents * 5) - (avgRisk > 50 ? 15 : 0)
    ));

    return {
      total,
      granted,
      stepUp,
      denied,
      successRate,
      avgRisk,
      openIncidents,
      posture,
    };
  }, [authEvents, incidents]);

  // ═══════════════════════════════════════════════════════════════════
  // AI INSIGHTS - EVIDENCE BASED
  // ═══════════════════════════════════════════════════════════════════

  const aiInsights = useMemo(() => {
    const insights = [];
    
    // Repeated failures
    const failCounts = {};
    authEvents.forEach(e => {
      if (e.outcome !== "Granted") {
        failCounts[e.userName] = (failCounts[e.userName] || 0) + 1;
      }
    });
    const repeaters = Object.entries(failCounts)
      .filter(([user, count]) => count >= 3 && user !== "Unknown")
      .map(([user]) => user);
    
    if (repeaters.length > 0) {
      insights.push({
        severity: "high",
        title: "Repeated Authentication Failures Detected",
        evidence: `${repeaters.length} user(s) with 3+ failed attempts: ${repeaters.join(", ")}`,
        recommendation: "Review biometric enrollment quality and investigate potential security concerns",
      });
    }

    // High denial rate
    if (analytics.total > 5 && (analytics.denied / analytics.total) > 0.25) {
      insights.push({
        severity: "high",
        title: "Elevated System-Wide Denial Rate",
        evidence: `${analytics.denied} of ${analytics.total} attempts denied (${Math.round((analytics.denied / analytics.total) * 100)}%)`,
        recommendation: "Review device recognition configuration and network geofencing rules",
      });
    }

    // High average risk
    if (analytics.avgRisk > 45 && analytics.total > 3) {
      insights.push({
        severity: "medium",
        title: "Elevated Average Risk Score",
        evidence: `System-wide average risk score: ${analytics.avgRisk}/100 across ${analytics.total} attempts`,
        recommendation: "Analyze authentication patterns for anomalies in time-of-day and device usage",
      });
    }

    // Unresolved incidents
    if (analytics.openIncidents > 0) {
      insights.push({
        severity: "high",
        title: "Unresolved Security Incidents Require Review",
        evidence: `${analytics.openIncidents} incident(s) currently in New or Investigating status`,
        recommendation: "Administrator review required in Security Incident Centre",
      });
    }

    // Recent high-risk events
    const recentHighRisk = authEvents.slice(0, 10).filter(e => e.riskLevel === "high");
    if (recentHighRisk.length >= 2) {
      insights.push({
        severity: "medium",
        title: "Multiple Recent High-Risk Events",
        evidence: `${recentHighRisk.length} high-risk authentication attempts in last 10 events`,
        recommendation: "Review recent high-risk factors and consider enhanced monitoring",
      });
    }

    // All clear
    if (insights.length === 0) {
      insights.push({
        severity: "low",
        title: "Normal Security Posture",
        evidence: `${analytics.total} authentication attempts analyzed. Success rate: ${analytics.successRate}%. Average risk: ${analytics.avgRisk}/100`,
        recommendation: "Continue standard monitoring protocols. No immediate action required.",
      });
    }

    return insights;
  }, [authEvents, analytics]);

  // ═══════════════════════════════════════════════════════════════════
  // DATA EXPORT
  // ═══════════════════════════════════════════════════════════════════

  const exportSecurityReport = () => {
    sfx.success();
    
    const report = `SUWA SETHA HOSPITAL SECURITY INTELLIGENCE REPORT
Generated: ${new Date().toLocaleString()}

═══════════════════════════════════════════════════════════════
SYSTEM STATUS
═══════════════════════════════════════════════════════════════

Database: ${dbState.toUpperCase()}
Face Detection Model: ${faceModelState.toUpperCase()}
Enrolled Users: ${users.length}

═══════════════════════════════════════════════════════════════
AUTHENTICATION METRICS
═══════════════════════════════════════════════════════════════

Total Attempts: ${analytics.total}
Granted: ${analytics.granted} (${analytics.successRate}%)
Step-up Required: ${analytics.stepUp}
Denied: ${analytics.denied}
Average Risk Score: ${analytics.avgRisk}/100
Security Posture Score: ${analytics.posture}/100

═══════════════════════════════════════════════════════════════
INCIDENT STATUS
═══════════════════════════════════════════════════════════════

Total Incidents: ${incidents.length}
Open Incidents: ${analytics.openIncidents}

═══════════════════════════════════════════════════════════════
AI SECURITY INSIGHTS (PROTOTYPE)
═══════════════════════════════════════════════════════════════

${aiInsights.map(insight => `[${insight.severity.toUpperCase()}] ${insight.title}
Evidence: ${insight.evidence}
→ ${insight.recommendation}`).join("\n\n")}

═══════════════════════════════════════════════════════════════
DISCLAIMER
═══════════════════════════════════════════════════════════════

This is a prototype demonstration system. Biometric identity matching 
is simulated. Production deployment would require:
- Secure biometric template storage (not raw images)
- Encryption at rest and in transit
- DPIA compliance
- Access governance and retention policies
- Regular security audits

═══════════════════════════════════════════════════════════════
END OF REPORT
═══════════════════════════════════════════════════════════════`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suwa-setha-security-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast("Security report exported");
  };

  // ═══════════════════════════════════════════════════════════════════
  // PERMISSIONS
  // ═══════════════════════════════════════════════════════════════════

  const isAdmin = session?.role === "Administrator";

  // ═══════════════════════════════════════════════════════════════════
  // FILTERED EVENTS
  // ═══════════════════════════════════════════════════════════════════

  const filteredEvents = useMemo(() => {
    return authEvents.filter(e => {
      const matchSearch = !filterSearch ||
        e.userName.toLowerCase().includes(filterSearch.toLowerCase()) ||
        e.staffId.toLowerCase().includes(filterSearch.toLowerCase());
      const matchDept = filterDept === "All" || e.department === filterDept;
      const matchOutcome = filterOutcome === "All" || e.outcome === filterOutcome;
      return matchSearch && matchDept && matchOutcome;
    });
  }, [authEvents, filterSearch, filterDept, filterOutcome]);

  // ═══════════════════════════════════════════════════════════════════
  // MOBILE DETECTION
  // ═══════════════════════════════════════════════════════════════════

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // NAVIGATION STRUCTURE
  // ═══════════════════════════════════════════════════════════════════

  const publicNav = [
    { id: "landing", label: "Overview", icon: Home },
    { id: "architecture", label: "Architecture", icon: Layers },
    { id: "capabilities", label: "Capabilities", icon: Zap },
    { id: "ethics", label: "Ethics", icon: Scale },
    { id: "iterations", label: "Iterations", icon: GitBranch },
  ];

  const dashboardNav = [
    { section: "Clinical", items: [
      { id: "records", label: "Patient Records", icon: FileText, roles: ["Doctor", "Nurse", "Administrator"] },
    ]},
    { section: "Security", items: [
      { id: "overview", label: "Security Overview", icon: Shield, roles: ["Doctor", "Nurse", "Administrator"] },
      { id: "analytics", label: "Security Analytics", icon: BarChart3, roles: ["Administrator"] },
      { id: "log", label: "My Access Log", icon: ClipboardList, roles: ["Doctor", "Nurse", "Administrator"] },
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
      { id: "settings", label: "Security Settings", icon: Settings, roles: ["Doctor", "Nurse", "Administrator"] },
    ]},
  ];

  const accessibleNavItems = dashboardNav
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        !item.roles || item.roles.includes(session?.role)
      ),
    }))
    .filter(section => section.items.length > 0);

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC TOP NAVIGATION
  // ═══════════════════════════════════════════════════════════════════

  const PublicTopNav = () => (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(15,15,15,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div
          onClick={() => navigate("landing")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 2,
              background: T.white,
              display: "grid",
              placeItems: "center",
            }}
          >
            <Shield size={20} color={T.black} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.04em" }}>
              SUWA SETHA
            </div>
            <div
              style={{
                fontSize: 8,
                color: T.muted,
                letterSpacing: "0.24em",
                marginTop: 2,
              }}
            >
              HEALTHCARE SECURITY INTELLIGENCE
            </div>
          </div>
        </div>

        {!isMobile && (
          <>
            <nav style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
              {publicNav.map(item => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  style={{
                    padding: "10px 20px",
                    background: view === item.id ? T.accentDim : "transparent",
                    border: "none",
                    borderRadius: 2,
                    color: view === item.id ? T.white : T.muted,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: T.dim,
                  letterSpacing: "0.05em",
                }}
              >
                {clock}
              </div>
              <MangaButton variant="ghost" onClick={() => navigate("login")}>
                <LogIn size={14} /> Login
              </MangaButton>
              <MangaButton onClick={() => navigate("enroll")}>
                <UserPlus size={14} /> Enroll
              </MangaButton>
            </div>
          </>
        )}

        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: "transparent",
              border: "none",
              color: T.white,
              cursor: "pointer",
              padding: 8,
            }}
          >
            <Menu size={24} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              background: T.bg,
              borderTop: `1px solid ${T.line}`,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "20px 32px" }}>
              {publicNav.map(item => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "14px 16px",
                    background: view === item.id ? T.accentDim : "transparent",
                    border: "none",
                    borderRadius: 2,
                    color: view === item.id ? T.white : T.muted,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 4,
                  }}
                >
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
              <MangaDivider />
              <div style={{ display: "flex", gap: 12 }}>
                <MangaButton
                  variant="ghost"
                  onClick={() => navigate("login")}
                  style={{ flex: 1 }}
                >
                  Login
                </MangaButton>
                <MangaButton
                  onClick={() => navigate("enroll")}
                  style={{ flex: 1 }}
                >
                  Enroll
                </MangaButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );

  // ═══════════════════════════════════════════════════════════════════
  // SHARED SUB-COMPONENTS FOR REMAINING VIEWS
  // ═══════════════════════════════════════════════════════════════════

  const SectionLabel = ({ children }) => (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.24em",
      color: T.dim,
      textTransform: "uppercase",
      marginBottom: 14,
    }}>
      {children}
    </div>
  );

  const StatCard = ({ label, value, icon: Icon, sub, color }) => (
    <MangaPanel style={{ padding: 22, flex: 1, minWidth: 150 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: T.dim, textTransform: "uppercase" }}>{label}</span>
        {Icon && <Icon size={15} color={color || T.silver} />}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: color || T.white, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.dim, marginTop: 8 }}>{sub}</div>}
    </MangaPanel>
  );

  const Pill = ({ children, tone = "default" }) => {
    const tones = {
      default: { bg: T.panel2, color: T.muted },
      ok: { bg: "rgba(255,255,255,0.1)", color: T.ok },
      warn: { bg: "rgba(208,208,208,0.12)", color: T.warn },
      bad: { bg: "rgba(136,136,136,0.16)", color: T.bad },
    };
    const s = tones[tone] || tones.default;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", padding: "4px 10px",
        borderRadius: 2, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase", background: s.bg, color: s.color,
      }}>
        {children}
      </span>
    );
  };

  const outcomeTone = (outcome) => outcome === "Granted" ? "ok" : outcome === "Step-up" ? "warn" : "bad";

  const EmptyState = ({ icon: Icon, title, note }) => (
    <div style={{ padding: "60px 20px", textAlign: "center", color: T.dim }}>
      {Icon && <Icon size={30} style={{ marginBottom: 14, opacity: 0.5 }} />}
      <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginBottom: 6 }}>{title}</div>
      {note && <div style={{ fontSize: 12 }}>{note}</div>}
    </div>
  );

  const PageHeader = ({ title, note, actions }) => (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>{title}</h2>
        {note && <div style={{ fontSize: 13, color: T.dim, marginTop: 6 }}>{note}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );

  const Toast = () => (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 30, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 20, x: "-50%" }}
          style={{
            position: "fixed", bottom: 28, left: "50%", zIndex: 999,
            background: T.white, color: T.black, padding: "12px 22px",
            borderRadius: 3, fontSize: 12, fontWeight: 700,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)", maxWidth: "88vw",
          }}
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (view === "landing") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <PublicTopNav />
          
          {/* Landing page hero and content - similar to previous but cleaned up */}
          <section
            style={{
              minHeight: "85vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 32px",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,255,255,0.04), transparent 70%)",
                pointerEvents: "none",
              }}
            />

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              style={{
                textAlign: "center",
                maxWidth: 1000,
                position: "relative",
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 36,
                  padding: "10px 24px",
                  borderRadius: 2,
                  border: `1px solid ${T.line}`,
                  background: T.accentDim,
                  color: T.white,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.24em",
                }}
              >
                <Lock size={12} /> AI BIOMETRIC ACCESS CONTROL
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.8 }}
                style={{
                  fontSize: "clamp(44px, 6vw, 80px)",
                  fontWeight: 600,
                  lineHeight: 1.1,
                  letterSpacing: "-0.04em",
                  marginBottom: 24,
                }}
              >
                SECURING HEALTHCARE
                <br />
                OPERATIONS
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{
                  fontSize: 17,
                  color: T.muted,
                  maxWidth: 580,
                  margin: "0 auto 44px",
                  lineHeight: 1.7,
                }}
              >
                AI-driven biometric cybersecurity platform prototype. Real-time facial liveness detection,
                multi-factor risk assessment, and comprehensive security intelligence for hospital access control.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                style={{
                  display: "flex",
                  gap: 16,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <MangaButton icon={UserPlus} onClick={() => navigate("enroll")}>
                  Enrol Biometric
                </MangaButton>
                <MangaButton
                  variant="secondary"
                  icon={LogIn}
                  onClick={() => navigate("login")}
                >
                  Secure Login
                </MangaButton>
              </motion.div>
            </motion.div>
          </section>

          <section style={{ padding: "0 32px 80px", maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <StatCard label="System Status" value={dbState === "ready" ? "Online" : dbState === "error" ? "Error" : "Booting"} icon={Database} color={dbState === "ready" ? T.ok : T.warn} sub="IndexedDB local data store" />
              <StatCard label="Face Model" value={faceModelState === "ready" ? "Loaded" : faceModelState === "error" ? "Failed" : "Loading"} icon={Eye} color={faceModelState === "ready" ? T.ok : T.warn} sub="face-api.js TinyFaceDetector" />
              <StatCard label="Enrolled Staff" value={users.length} icon={Fingerprint} sub="Biometric templates on device" />
              <StatCard label="Auth Attempts Logged" value={authEvents.length} icon={ClipboardList} sub="Stored in authenticationEvents" />
            </div>
          </section>

          <section style={{ padding: "0 32px 100px", maxWidth: 1200, margin: "0 auto" }}>
            <SectionLabel>How it works</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
              {[
                { icon: UserPlus, title: "01 — Enrol", body: "Staff register their name, role and department, then capture three live facial reference frames through the browser camera." },
                { icon: Fingerprint, title: "02 — Verify", body: "At login, a live camera feed checks for a present face and a multi-factor risk engine scores the device, network, time and biometric confidence." },
                { icon: ShieldCheck, title: "03 — Decide", body: "Low risk grants access instantly, medium risk requires a one-time-passcode step-up, and high risk is denied and logged as a security incident." },
              ].map((s, i) => (
                <MangaPanel key={i} hover style={{ padding: 28 }}>
                  <s.icon size={22} color={T.white} style={{ marginBottom: 16 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, letterSpacing: "0.02em" }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.7 }}>{s.body}</div>
                </MangaPanel>
              ))}
            </div>
          </section>

          <footer style={{ borderTop: `1px solid ${T.line}`, padding: "28px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: T.dim, letterSpacing: "0.06em" }}>
              SUWA SETHA HOSPITAL — AI BIOMETRIC ACCESS CONTROL PROTOTYPE · Built for Unit 47 Emerging Technologies
            </div>
          </footer>
        </div>
        <Toast />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // SIMPLE PUBLIC INFORMATION PAGES
  // ═══════════════════════════════════════════════════════════════════

  if (view === "architecture" || view === "capabilities" || view === "ethics" || view === "iterations") {
    const pages = {
      architecture: {
        title: "System Architecture",
        note: "How the pieces of the prototype fit together.",
        blocks: [
          { icon: Camera, title: "Capture layer", body: "Browser MediaDevices API streams live video; face-api.js (TinyFaceDetector) runs client-side liveness/presence detection on each frame." },
          { icon: Cpu, title: "Risk engine", body: "A weighted scoring function combines device recognition, network location, time-of-day pattern, recent failed attempts and biometric confidence into a 0–100 risk score." },
          { icon: Database, title: "Data layer", body: "IndexedDB (via a DatabaseService wrapper) persists staff records, authentication events, incidents, alerts and an audit trail entirely in the browser — no external server is required for the prototype." },
          { icon: BarChart3, title: "Intelligence layer", body: "Aggregated authentication history feeds a security-posture score and a small set of evidence-based insight rules shown to administrators." },
        ],
      },
      capabilities: {
        title: "Capabilities",
        note: "What the current prototype can demonstrate end-to-end.",
        blocks: [
          { icon: UserPlus, title: "Biometric enrolment", body: "Guided consent, staff details capture, and three-frame facial reference capture, written to the users data store." },
          { icon: LogIn, title: "Risk-based login", body: "Live face check, simulated biometric match, and a transparent multi-factor risk breakdown shown to the user in real time." },
          { icon: KeyRound, title: "Step-up OTP", body: "Medium-risk attempts are challenged with a one-time passcode before access is granted." },
          { icon: Search, title: "Data explorer", body: "Administrators can search and filter the full authentication event log by staff name, ID, department and outcome." },
          { icon: AlertOctagon, title: "Incident & alert workflow", body: "High-risk attempts automatically raise an incident and alert, which administrators can triage and resolve." },
          { icon: FileBarChart, title: "Audit trail", body: "Every enrolment, login, OTP check and incident update is written to an append-only audit log for accountability." },
        ],
      },
      ethics: {
        title: "Ethical, Social, Legal & Economic Considerations",
        note: "Summary of the factors considered when designing this prototype.",
        blocks: [
          { icon: Scale, title: "Consent & transparency", body: "Enrolment requires explicit consent and clearly explains what biometric data is captured and why, before any capture takes place." },
          { icon: Lock, title: "Data protection", body: "In this prototype, facial captures are stored locally in the browser only. A production system would need encrypted storage, retention limits and DPIA-level compliance (e.g. GDPR / local data protection law)." },
          { icon: Users, title: "Social impact", body: "Faster, friction-light access can improve staff workflow, but the system must avoid excluding staff who cannot or do not wish to use biometrics, via a fallback authentication route." },
          { icon: TrendingUp, title: "Economic factors", body: "Reduced credential-sharing and faster shift changeovers offer efficiency gains, offset against the cost of camera hardware, model maintenance and staff training." },
          { icon: AlertTriangle, title: "Regulatory challenges", body: "Biometric data is classed as special-category data under many regulatory regimes, requiring a lawful basis, staff notice, and regular algorithmic bias auditing." },
        ],
      },
      iterations: {
        title: "Design Iterations",
        note: "How the prototype evolved based on feedback.",
        blocks: [
          { icon: GitBranch, title: "Iteration 1 — Static demo", body: "Initial version simulated login outcomes with fixed timers and no persisted data, used to validate the risk-tier concept with end users." },
          { icon: GitBranch, title: "Iteration 2 — Live camera + database", body: "Replaced simulated delays with real camera-driven face presence detection and an IndexedDB-backed data layer so enrolment, logins, incidents and audit history persist between sessions." },
          { icon: GitBranch, title: "Iteration 3 — Feedback-driven additions", body: "Added a searchable data explorer, staff directory, security analytics and AI-style insights after end users asked to see and query historical access activity rather than only the current session." },
        ],
      },
    };
    const page = pages[view];
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <PublicTopNav />
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 32px 100px" }}>
            <PageHeader title={page.title} note={page.note} />
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 20 }}>
              {page.blocks.map((b, i) => (
                <MangaPanel key={i} style={{ padding: 26 }}>
                  <b.icon size={20} color={T.white} style={{ marginBottom: 14 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{b.title}</div>
                  <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.7 }}>{b.body}</div>
                </MangaPanel>
              ))}
            </div>
          </div>
        </div>
        <Toast />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // ENROLLMENT VIEW
  // ═══════════════════════════════════════════════════════════════════

  if (view === "enroll") {
    const steps = ["Consent", "Details", "Capture", "Review", "Done"];

    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <PublicTopNav />
          <div style={{ maxWidth: 640, margin: "0 auto", padding: isMobile ? "40px 20px 100px" : "60px 32px 120px" }}>

            {/* Step indicator */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 40 }}>
              {steps.map((s, i) => (
                <React.Fragment key={s}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center",
                      fontSize: 11, fontWeight: 700,
                      background: i <= enrollStep ? T.white : "transparent",
                      color: i <= enrollStep ? T.black : T.dim,
                      border: `1px solid ${i <= enrollStep ? T.white : T.line}`,
                    }}>
                      {i < enrollStep ? <CheckCircle2 size={14} /> : i + 1}
                    </div>
                    {!isMobile && <span style={{ fontSize: 10, letterSpacing: "0.08em", color: i <= enrollStep ? T.text : T.dim, textTransform: "uppercase" }}>{s}</span>}
                  </div>
                  {i < steps.length - 1 && <div style={{ width: 20, height: 1, background: T.line }} />}
                </React.Fragment>
              ))}
            </div>

            <MangaPanel style={{ padding: isMobile ? 24 : 40 }}>
              {/* Step 0: Consent */}
              {enrollStep === 0 && (
                <div>
                  <Shield size={28} color={T.white} style={{ marginBottom: 18 }} />
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Biometric Enrolment Consent</h2>
                  <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.8, marginBottom: 20 }}>
                    This prototype will capture three still frames from your camera to create a local facial reference.
                    Captured images are stored only in this browser's IndexedDB database and are used solely to demonstrate
                    risk-based authentication for this assignment. No data leaves your device.
                  </p>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 28, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={enrollConsent}
                      onChange={(e) => setEnrollConsent(e.target.checked)}
                      style={{ marginTop: 3, width: 16, height: 16, accentColor: T.white }}
                    />
                    <span style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>
                      I understand and consent to my facial images being captured and stored locally for this demonstration.
                    </span>
                  </label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <MangaButton variant="ghost" onClick={() => navigate("landing")}>Cancel</MangaButton>
                    <MangaButton disabled={!enrollConsent} icon={ChevronRight} onClick={() => { sfx.tap(); setEnrollStep(1); }}>
                      Continue
                    </MangaButton>
                  </div>
                </div>
              )}

              {/* Step 1: Details */}
              {enrollStep === 1 && (
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Staff Details</h2>
                  <p style={{ fontSize: 12, color: T.dim, marginBottom: 24 }}>Tell us who you are before we capture your biometric reference.</p>
                  <MangaInput
                    label="Full Name"
                    placeholder="e.g. R. Fernando"
                    value={enrollForm.name}
                    onChange={(e) => setEnrollForm({ ...enrollForm, name: e.target.value })}
                  />
                  <MangaInput
                    label="Staff ID (optional — auto-generated if blank)"
                    placeholder="e.g. SS-1042"
                    value={enrollForm.staffId}
                    onChange={(e) => setEnrollForm({ ...enrollForm, staffId: e.target.value })}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 9, letterSpacing: "0.16em", color: T.dim, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Role</label>
                      <select
                        value={enrollForm.role}
                        onChange={(e) => setEnrollForm({ ...enrollForm, role: e.target.value })}
                        style={{ width: "100%", padding: "14px 12px", borderRadius: 2, border: `1px solid ${T.line2}`, background: T.void, color: T.text, fontSize: 13, boxSizing: "border-box" }}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9, letterSpacing: "0.16em", color: T.dim, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Department</label>
                      <select
                        value={enrollForm.department}
                        onChange={(e) => setEnrollForm({ ...enrollForm, department: e.target.value })}
                        style={{ width: "100%", padding: "14px 12px", borderRadius: 2, border: `1px solid ${T.line2}`, background: T.void, color: T.text, fontSize: 13, boxSizing: "border-box" }}
                      >
                        {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
                    <MangaButton variant="ghost" onClick={() => setEnrollStep(0)}>Back</MangaButton>
                    <MangaButton
                      disabled={!enrollForm.name.trim()}
                      icon={ChevronRight}
                      onClick={() => { sfx.tap(); setEnrollStep(2); }}
                    >
                      Continue
                    </MangaButton>
                  </div>
                </div>
              )}

              {/* Step 2: Capture */}
              {enrollStep === 2 && (
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Capture Facial Reference</h2>
                  <p style={{ fontSize: 12, color: T.dim, marginBottom: 20 }}>
                    Look at the camera and capture {3 - enrollCaptures.length > 0 ? `${3 - enrollCaptures.length} more` : "0 more"} frame{3 - enrollCaptures.length === 1 ? "" : "s"} ({enrollCaptures.length}/3 captured).
                  </p>
                  <BiometricCamera ref={enrollCameraRef} autoStart showGuide />
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "18px 0" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 60, height: 44, borderRadius: 3, overflow: "hidden",
                        border: `1px solid ${enrollCaptures[i] ? T.white : T.line}`,
                        background: T.void, display: "grid", placeItems: "center",
                      }}>
                        {enrollCaptures[i]
                          ? <img src={enrollCaptures[i]} alt={`Capture ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 10, color: T.dim }}>{i + 1}</span>}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 8 }}>
                    <MangaButton
                      icon={Camera}
                      disabled={enrollCaptures.length >= 3}
                      onClick={captureEnrollmentFrame}
                    >
                      Capture Frame
                    </MangaButton>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                    <MangaButton variant="ghost" onClick={() => setEnrollStep(1)}>Back</MangaButton>
                    <MangaButton
                      disabled={enrollCaptures.length < 3}
                      icon={ChevronRight}
                      onClick={() => { sfx.tap(); if (enrollCameraRef.current) enrollCameraRef.current.stop(); setEnrollStep(3); }}
                    >
                      Review
                    </MangaButton>
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {enrollStep === 3 && (
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Review & Confirm</h2>
                  <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                    {enrollCaptures.map((c, i) => (
                      <img key={i} src={c} alt={`Capture ${i + 1}`} style={{ width: 90, height: 68, objectFit: "cover", borderRadius: 3, border: `1px solid ${T.line}` }} />
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28, fontSize: 13 }}>
                    <div><span style={{ color: T.dim }}>Name</span><div style={{ fontWeight: 600 }}>{enrollForm.name}</div></div>
                    <div><span style={{ color: T.dim }}>Staff ID</span><div style={{ fontWeight: 600 }}>{enrollForm.staffId || "Auto-generated"}</div></div>
                    <div><span style={{ color: T.dim }}>Role</span><div style={{ fontWeight: 600 }}>{enrollForm.role}</div></div>
                    <div><span style={{ color: T.dim }}>Department</span><div style={{ fontWeight: 600 }}>{enrollForm.department}</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <MangaButton variant="ghost" onClick={() => setEnrollStep(2)}>Back</MangaButton>
                    <MangaButton icon={ShieldCheck} onClick={completeEnrollment}>Confirm Enrolment</MangaButton>
                  </div>
                </div>
              )}

              {/* Step 4: Done */}
              {enrollStep === 4 && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <ShieldCheck size={44} color={T.ok} style={{ marginBottom: 18 }} />
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Enrolment Complete</h2>
                  <p style={{ fontSize: 13, color: T.muted, marginBottom: 28, lineHeight: 1.7 }}>
                    {enrollForm.name} has been enrolled and can now authenticate using facial recognition.
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <MangaButton variant="ghost" onClick={() => navigate("landing")}>Back Home</MangaButton>
                    <MangaButton icon={LogIn} onClick={() => navigate("login")}>Try Logging In</MangaButton>
                  </div>
                </div>
              )}
            </MangaPanel>
          </div>
        </div>
        <Toast />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOGIN VIEW
  // ═══════════════════════════════════════════════════════════════════

  if (view === "login") {
    const tier = authRisk ? getRiskTier(authRisk.score) : null;

    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <PublicTopNav />
          <div style={{ maxWidth: 560, margin: "0 auto", padding: isMobile ? "40px 20px 100px" : "60px 32px 120px" }}>
            <MangaPanel style={{ padding: isMobile ? 24 : 40, textAlign: "center" }}>

              {authPhase === "idle" && (
                <>
                  <Fingerprint size={30} color={T.white} style={{ marginBottom: 16 }} />
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Secure Login</h2>
                  <p style={{ fontSize: 13, color: T.muted, marginBottom: 8, lineHeight: 1.7 }}>
                    {users.length === 0
                      ? "No staff are enrolled yet. Enrol first to demonstrate a full authentication flow."
                      : "Start the camera to verify your identity via facial biometrics."}
                  </p>
                  {users.length > 0 && (
                    <p style={{ fontSize: 11, color: T.dim, marginBottom: 24 }}>
                      Simulated identity for this demo: <strong style={{ color: T.text }}>{users[users.length - 1].name}</strong>
                    </p>
                  )}
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24, fontSize: 11, color: T.dim, cursor: "pointer" }}>
                    <input type="checkbox" checked={authAnomalous} onChange={(e) => setAuthAnomalous(e.target.checked)} style={{ accentColor: T.white }} />
                    Simulate unrecognized device / off-site network (raises risk)
                  </label>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <MangaButton variant="ghost" onClick={() => navigate("landing")}>Cancel</MangaButton>
                    <MangaButton
                      icon={users.length === 0 ? UserPlus : Camera}
                      onClick={() => users.length === 0 ? navigate("enroll") : startAuthentication()}
                    >
                      {users.length === 0 ? "Enrol First" : "Start Camera"}
                    </MangaButton>
                  </div>
                </>
              )}

              {(authPhase === "camera_starting" || authPhase === "biometric_scanning") && (
                <>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>
                    {authPhase === "camera_starting" ? "Position Your Face" : "Verifying Biometrics…"}
                  </h2>
                  <BiometricCamera ref={authCameraRef} autoStart showGuide onFaceDetected={setAuthFaceDetected} />
                  <p style={{ fontSize: 11, color: T.dim, marginTop: 16 }}>
                    {authPhase === "biometric_scanning" ? "Matching against enrolled template…" : "Waiting for a face to be detected in frame."}
                  </p>
                </>
              )}

              {authPhase === "processing" && (
                <div style={{ padding: "40px 0" }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    style={{ width: 36, height: 36, border: `2px solid ${T.line}`, borderTopColor: T.white, borderRadius: "50%", margin: "0 auto 20px" }}
                  />
                  <div style={{ fontSize: 13, color: T.muted }}>Calculating risk score…</div>
                </div>
              )}

              {authPhase === "result" && authRisk && tier && (
                <>
                  <tier.Icon size={36} color={tier.color} style={{ marginBottom: 14 }} />
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: tier.color }}>{tier.label}</h2>
                  <div style={{ fontSize: 42, fontWeight: 700, margin: "18px 0 4px" }}>{authScoreAnim}</div>
                  <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.14em", marginBottom: 24 }}>RISK SCORE / 100</div>

                  <div style={{ textAlign: "left", marginBottom: 24 }}>
                    {authRisk.factors.map((f, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < authRisk.factors.length - 1 ? `1px solid ${T.line2}` : "none" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{f.label}</div>
                          <div style={{ fontSize: 10, color: T.dim }}>{f.desc}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: f.value > 15 ? T.warn : T.ok }}>+{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {tier.key === "low" && (
                    <p style={{ fontSize: 12, color: T.ok }}>Access granted — redirecting to your dashboard…</p>
                  )}

                  {tier.key === "med" && !authOtpActive && (
                    <MangaButton icon={KeyRound} onClick={() => setAuthOtpActive(true)}>Continue to OTP Step-Up</MangaButton>
                  )}

                  {tier.key === "med" && authOtpActive && (
                    <div>
                      <p style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>Enter the 6-digit one-time passcode sent to your registered device. (Demo code: <strong>123456</strong>)</p>
                      <input
                        value={authOtp}
                        onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="••••••"
                        style={{ width: "100%", textAlign: "center", letterSpacing: "0.5em", fontSize: 20, padding: "14px 16px", borderRadius: 2, border: `1px solid ${T.line2}`, background: T.void, color: T.text, marginBottom: 16, boxSizing: "border-box" }}
                      />
                      <MangaButton disabled={authOtp.length < 6} onClick={verifyOtp} icon={CheckCircle2}>Verify Code</MangaButton>
                    </div>
                  )}

                  {tier.key === "high" && (
                    <div>
                      <p style={{ fontSize: 12, color: T.bad, marginBottom: 20 }}>
                        This attempt has been logged as a security incident. Please contact your administrator if you believe this is an error.
                      </p>
                      <MangaButton variant="ghost" onClick={() => setAuthPhase("idle")}>Try Again</MangaButton>
                    </div>
                  )}
                </>
              )}
            </MangaPanel>
          </div>
        </div>
        <Toast />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD VIEW
  // ═══════════════════════════════════════════════════════════════════

  if (view === "dashboard") {
    if (!session) {
      return (
        <div style={{ minHeight: "100vh", background: T.bg, color: T.text, display: "grid", placeItems: "center", padding: 32 }}>
          <MangaPanel style={{ padding: 40, textAlign: "center", maxWidth: 420 }}>
            <Lock size={26} color={T.warn} style={{ marginBottom: 14 }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Session Required</h2>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 22 }}>You need to authenticate before accessing the dashboard.</p>
            <MangaButton icon={LogIn} onClick={() => navigate("login")}>Go to Login</MangaButton>
          </MangaPanel>
        </div>
      );
    }

    const DashSidebar = () => (
      <aside style={{
        width: 240, flexShrink: 0, borderRight: `1px solid ${T.line}`,
        background: T.bg2, padding: "24px 16px", height: "100vh",
        position: "sticky", top: 0, overflowY: "auto",
        display: isMobile ? "none" : "block",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 24px" }}>
          <div style={{ width: 32, height: 32, borderRadius: 2, background: T.white, display: "grid", placeItems: "center" }}>
            <Shield size={16} color={T.black} strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>SUWA SETHA</div>
        </div>
        {accessibleNavItems.map(section => (
          <div key={section.section} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", color: T.dim, textTransform: "uppercase", padding: "0 8px 8px" }}>
              {section.section}
            </div>
            {section.items.map(item => (
              <button
                key={item.id}
                onClick={() => { sfx.tap(); setDashboardTab(item.id); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "10px 8px", background: dashboardTab === item.id ? T.accentDim : "transparent",
                  border: "none", borderRadius: 2, color: dashboardTab === item.id ? T.white : T.muted,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 2, textAlign: "left",
                }}
              >
                <item.icon size={15} /> {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>
    );

    const DashTopBar = () => (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "16px 20px" : "18px 32px", borderBottom: `1px solid ${T.line}`,
        position: "sticky", top: 0, background: "rgba(15,15,15,0.9)", backdropFilter: "blur(16px)", zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{session.name}</div>
          <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.06em" }}>{session.role} · {session.department} · {session.staffId}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 11, color: T.dim, fontFamily: "monospace" }}>{clock}</span>
          <MangaButton variant="ghost" icon={LogOut} onClick={logout} style={{ padding: "8px 16px" }}>Logout</MangaButton>
        </div>
      </div>
    );

    let content = null;

    if (dashboardTab === "overview") {
      content = (
        <>
          <PageHeader title="Security Overview" note="Live snapshot of authentication activity for Suwa Setha Hospital." />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
            <StatCard label="Total Attempts" value={analytics.total} icon={ClipboardList} />
            <StatCard label="Granted" value={analytics.granted} icon={ShieldCheck} color={T.ok} />
            <StatCard label="Step-Up" value={analytics.stepUp} icon={ShieldAlert} color={T.warn} />
            <StatCard label="Denied" value={analytics.denied} icon={ShieldX} color={T.bad} />
            <StatCard label="Success Rate" value={`${analytics.successRate}%`} icon={TrendingUp} />
            <StatCard label="Posture Score" value={`${analytics.posture}/100`} icon={Activity} />
          </div>
          <SectionLabel>Recent Activity</SectionLabel>
          <MangaPanel style={{ padding: 0, overflow: "hidden" }}>
            {authEvents.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No authentication events yet" note="Try logging out and back in to generate activity." />
            ) : authEvents.slice(0, 8).map((e, i) => (
              <div key={e.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < 7 ? `1px solid ${T.line2}` : "none" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.userName}</div>
                  <div style={{ fontSize: 11, color: T.dim }}>{e.device} · {new Date(e.timestamp).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: T.dim }}>{e.riskScore}</span>
                  <Pill tone={outcomeTone(e.outcome)}>{e.outcome}</Pill>
                </div>
              </div>
            ))}
          </MangaPanel>
        </>
      );
    } else if (dashboardTab === "records") {
      content = (
        <>
          <PageHeader title="Patient Records" note="Sample patient roster for Suwa Setha Hospital (demo data)." />
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr", gap: 20 }}>
            <MangaPanel style={{ padding: 0, overflow: "hidden" }}>
              {PATIENTS.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p)}
                  style={{
                    display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 20px", background: selectedPatient?.id === p.id ? T.accentDim : "transparent",
                    border: "none", borderBottom: i < PATIENTS.length - 1 ? `1px solid ${T.line2}` : "none",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: T.dim }}>{p.id} · {p.ward} · {p.doctor}</div>
                  </div>
                  <Pill tone={p.status === "Critical" ? "bad" : p.status === "Discharged" ? "default" : "ok"}>{p.status}</Pill>
                </button>
              ))}
            </MangaPanel>
            <MangaPanel style={{ padding: 24 }}>
              {selectedPatient ? (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedPatient.name}</div>
                  <div style={{ fontSize: 11, color: T.dim, marginBottom: 20 }}>{selectedPatient.id} · Admitted {selectedPatient.admitted}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                    <div><div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>Heart Rate</div><div style={{ fontSize: 16, fontWeight: 700 }}>{selectedPatient.hr} bpm</div></div>
                    <div><div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>Blood Pressure</div><div style={{ fontSize: 16, fontWeight: 700 }}>{selectedPatient.bp}</div></div>
                    <div><div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>SpO2</div><div style={{ fontSize: 16, fontWeight: 700 }}>{selectedPatient.spo2}%</div></div>
                    <div><div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>Ward</div><div style={{ fontSize: 16, fontWeight: 700 }}>{selectedPatient.ward}</div></div>
                  </div>
                  <div style={{ fontSize: 9, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Notes</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>{selectedPatient.notes}</div>
                </div>
              ) : (
                <EmptyState icon={FileText} title="Select a patient" note="Choose a patient from the list to view their record." />
              )}
            </MangaPanel>
          </div>
        </>
      );
    } else if (dashboardTab === "analytics") {
      const maxCount = Math.max(analytics.granted, analytics.stepUp, analytics.denied, 1);
      content = (
        <>
          <PageHeader title="Security Analytics" note="Aggregated view of authentication outcomes and risk." />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
            <StatCard label="Average Risk" value={`${analytics.avgRisk}/100`} icon={Activity} />
            <StatCard label="Open Incidents" value={analytics.openIncidents} icon={AlertOctagon} color={analytics.openIncidents ? T.bad : T.ok} />
            <StatCard label="Posture Score" value={`${analytics.posture}/100`} icon={ShieldCheck} />
          </div>
          <MangaPanel style={{ padding: 26 }}>
            <SectionLabel>Outcome Breakdown</SectionLabel>
            {[
              { label: "Granted", value: analytics.granted, color: T.ok },
              { label: "Step-Up", value: analytics.stepUp, color: T.warn },
              { label: "Denied", value: analytics.denied, color: T.bad },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: T.muted }}>{row.label}</span>
                  <span style={{ fontWeight: 700 }}>{row.value}</span>
                </div>
                <div style={{ height: 8, background: T.void, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(row.value / maxCount) * 100}%`, background: row.color, borderRadius: 2, transition: "width 0.4s" }} />
                </div>
              </div>
            ))}
          </MangaPanel>
        </>
      );
    } else if (dashboardTab === "log") {
      const myEvents = authEvents.filter(e => e.userId === session.staffId || e.staffId === session.staffId);
      content = (
        <>
          <PageHeader title="My Access Log" note="Your personal authentication history." />
          <MangaPanel style={{ padding: 0, overflow: "hidden" }}>
            {myEvents.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No access history yet" />
            ) : myEvents.map((e, i) => (
              <div key={e.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < myEvents.length - 1 ? `1px solid ${T.line2}` : "none" }}>
                <div>
                  <div style={{ fontSize: 12, color: T.dim }}>{new Date(e.timestamp).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{e.device} · {e.location}</div>
                </div>
                <Pill tone={outcomeTone(e.outcome)}>{e.outcome} · {e.riskScore}</Pill>
              </div>
            ))}
          </MangaPanel>
        </>
      );
    } else if (dashboardTab === "insights") {
      content = (
        <>
          <PageHeader title="AI Security Insights" note="Evidence-based observations generated from the current authentication log (prototype)." />
          <div style={{ display: "grid", gap: 14 }}>
            {aiInsights.map((insight, i) => (
              <MangaPanel key={i} style={{ padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <Sparkles size={16} color={insight.severity === "high" ? T.bad : insight.severity === "medium" ? T.warn : T.ok} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{insight.title}</div>
                  <Pill tone={insight.severity === "high" ? "bad" : insight.severity === "medium" ? "warn" : "ok"}>{insight.severity}</Pill>
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>{insight.evidence}</div>
                <div style={{ fontSize: 12, color: T.text }}>→ {insight.recommendation}</div>
              </MangaPanel>
            ))}
          </div>
        </>
      );
    } else if (dashboardTab === "timeline") {
      content = (
        <>
          <PageHeader title="Threat Timeline" note="Chronological view of all authentication attempts." />
          <div style={{ borderLeft: `2px solid ${T.line}`, marginLeft: 8 }}>
            {authEvents.length === 0 ? (
              <EmptyState icon={Clock} title="No events recorded yet" />
            ) : authEvents.map((e, i) => (
              <div key={e.id || i} style={{ position: "relative", padding: "0 0 22px 24px" }}>
                <div style={{ position: "absolute", left: -7, top: 2, width: 12, height: 12, borderRadius: "50%", background: e.outcome === "Granted" ? T.ok : e.outcome === "Step-up" ? T.warn : T.bad, border: `2px solid ${T.bg}` }} />
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 4 }}>{new Date(e.timestamp).toLocaleString()}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.userName} — {e.outcome}</div>
                <div style={{ fontSize: 11, color: T.muted }}>Risk {e.riskScore} · {e.device} · {e.location}</div>
              </div>
            ))}
          </div>
        </>
      );
    } else if (dashboardTab === "incidents") {
      content = (
        <>
          <PageHeader title="Security Incidents" note="High-risk authentication attempts requiring review." />
          <MangaPanel style={{ padding: 0, overflow: "hidden" }}>
            {incidents.length === 0 ? (
              <EmptyState icon={AlertOctagon} title="No incidents recorded" note="High-risk logins automatically appear here." />
            ) : incidents.map((inc, i) => (
              <div key={inc.id || i} style={{ padding: "16px 20px", borderBottom: i < incidents.length - 1 ? `1px solid ${T.line2}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{inc.userName} · Risk {inc.riskScore}</div>
                  <Pill tone={inc.status === "Resolved" ? "ok" : inc.status === "Investigating" ? "warn" : "bad"}>{inc.status}</Pill>
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 10 }}>{inc.device} · {inc.location} · {new Date(inc.timestamp).toLocaleString()}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["New", "Investigating", "Resolved"].map(s => (
                    <button
                      key={s}
                      onClick={() => updateIncidentStatus(inc.id, s)}
                      disabled={inc.status === s}
                      style={{
                        padding: "6px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                        borderRadius: 2, cursor: inc.status === s ? "default" : "pointer",
                        background: inc.status === s ? T.accentDim : "transparent",
                        border: `1px solid ${T.line}`, color: inc.status === s ? T.white : T.muted, opacity: inc.status === s ? 1 : 0.8,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </MangaPanel>
        </>
      );
    } else if (dashboardTab === "alerts") {
      content = (
        <>
          <PageHeader title="Security Alerts" note="System-generated alerts from high-risk activity." />
          <div style={{ display: "grid", gap: 12 }}>
            {alerts.length === 0 ? (
              <EmptyState icon={Bell} title="No alerts" />
            ) : alerts.map((a, i) => (
              <MangaPanel key={a.id || i} style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
                <Bell size={16} color={a.severity === "high" ? T.bad : T.warn} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.message}</div>
                  <div style={{ fontSize: 11, color: T.dim }}>{new Date(a.timestamp).toLocaleString()}</div>
                </div>
                <Pill tone={a.read ? "default" : "warn"}>{a.read ? "Read" : "New"}</Pill>
              </MangaPanel>
            ))}
          </div>
        </>
      );
    } else if (dashboardTab === "explorer") {
      content = (
        <>
          <PageHeader title="Data Explorer" note="Search and filter the full authentication event database." />
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={14} color={T.dim} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search by name or staff ID…"
                style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 2, border: `1px solid ${T.line2}`, background: T.void, color: T.text, fontSize: 12, boxSizing: "border-box" }}
              />
            </div>
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ padding: "10px 12px", borderRadius: 2, border: `1px solid ${T.line2}`, background: T.void, color: T.text, fontSize: 12 }}>
              <option value="All">All Departments</option>
              {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)} style={{ padding: "10px 12px", borderRadius: 2, border: `1px solid ${T.line2}`, background: T.void, color: T.text, fontSize: 12 }}>
              <option value="All">All Outcomes</option>
              <option value="Granted">Granted</option>
              <option value="Step-up">Step-up</option>
              <option value="Denied">Denied</option>
            </select>
            <MangaButton variant="ghost" icon={Download} onClick={exportSecurityReport}>Export Report</MangaButton>
          </div>
          <MangaPanel style={{ padding: 0, overflow: "hidden" }}>
            {filteredEvents.length === 0 ? (
              <EmptyState icon={Search} title="No matching events" note="Try adjusting your search or filters." />
            ) : filteredEvents.map((e, i) => (
              <div key={e.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < filteredEvents.length - 1 ? `1px solid ${T.line2}` : "none", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.userName} <span style={{ color: T.dim, fontWeight: 400 }}>· {e.staffId}</span></div>
                  <div style={{ fontSize: 11, color: T.dim }}>{e.department} · {e.role} · {new Date(e.timestamp).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: T.dim }}>Risk {e.riskScore}</span>
                  <Pill tone={outcomeTone(e.outcome)}>{e.outcome}</Pill>
                </div>
              </div>
            ))}
          </MangaPanel>
        </>
      );
    } else if (dashboardTab === "staff") {
      content = (
        <>
          <PageHeader title="Staff Directory" note="All biometrically enrolled staff." actions={[<MangaButton key="a" icon={UserPlus} onClick={() => navigate("enroll")}>Enrol New Staff</MangaButton>]} />
          <MangaPanel style={{ padding: 0, overflow: "hidden" }}>
            {users.length === 0 ? (
              <EmptyState icon={Users} title="No staff enrolled yet" />
            ) : users.map((u, i) => (
              <div key={u.staffId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: i < users.length - 1 ? `1px solid ${T.line2}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {u.captures?.[0] && <img src={u.captures[0]} alt={u.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: T.dim }}>{u.staffId} · {u.department}</div>
                  </div>
                </div>
                <Pill>{u.role}</Pill>
              </div>
            ))}
          </MangaPanel>
        </>
      );
    } else if (dashboardTab === "audit") {
      content = (
        <>
          <PageHeader title="Audit Log" note="Append-only record of every security-relevant action." />
          <MangaPanel style={{ padding: 0, overflow: "hidden" }}>
            {auditLogs.length === 0 ? (
              <EmptyState icon={FileBarChart} title="No audit entries yet" />
            ) : auditLogs.map((log, i) => (
              <div key={log.id || i} style={{ padding: "12px 20px", borderBottom: i < auditLogs.length - 1 ? `1px solid ${T.line2}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>{log.action}</span>
                  <span style={{ fontSize: 10, color: T.dim }}>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>{log.userName} — {log.details}</div>
              </div>
            ))}
          </MangaPanel>
        </>
      );
    } else if (dashboardTab === "health") {
      content = (
        <>
          <PageHeader title="System Health" note="Status of the prototype's underlying services." />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard label="Database" value={dbState} icon={Database} color={dbState === "ready" ? T.ok : T.bad} />
            <StatCard label="Face Model" value={faceModelState} icon={Eye} color={faceModelState === "ready" ? T.ok : T.bad} />
            <StatCard label="Enrolled Users" value={users.length} icon={Fingerprint} />
            <StatCard label="Stored Events" value={authEvents.length} icon={Server} />
          </div>
        </>
      );
    } else if (dashboardTab === "settings") {
      content = (
        <>
          <PageHeader title="Security Settings" note="Prototype-level preferences for this session." />
          <MangaPanel style={{ padding: 24, maxWidth: 480 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Signed in as</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>{session.name} · {session.role} · {session.department}</div>
            <MangaDivider />
            <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.8 }}>
              This is a prototype. In production, this panel would expose MFA preferences, notification settings and biometric re-enrolment.
            </div>
          </MangaPanel>
        </>
      );
    }

    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text, display: "flex" }}>
        <DashSidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <DashTopBar />
          {isMobile && (
            <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: "12px 16px", borderBottom: `1px solid ${T.line}` }}>
              {accessibleNavItems.flatMap(s => s.items).map(item => (
                <button
                  key={item.id}
                  onClick={() => setDashboardTab(item.id)}
                  style={{
                    flexShrink: 0, padding: "8px 14px", borderRadius: 2, fontSize: 11, fontWeight: 600,
                    background: dashboardTab === item.id ? T.accentDim : "transparent",
                    border: `1px solid ${T.line}`, color: dashboardTab === item.id ? T.white : T.muted, cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ padding: isMobile ? "24px 20px 60px" : "32px 40px 80px" }}>
            {content}
          </div>
        </div>
        <Toast />
      </div>
    );
  }

  return null;
}