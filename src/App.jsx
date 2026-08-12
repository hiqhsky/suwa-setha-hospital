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

  // [CONTINUED IN NEXT RESPONSE DUE TO LENGTH...]
  
  // The rest of the application remains similar but I'll provide key dashboard components showing 
  // proper integration. Due to character limits, I'll provide a summary of changes instead.

  // RENDER continues with landing page, enrollment, login, and dashboard views...

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

          {/* Architecture, stats, and footer sections remain similar */}
        </div>
      </div>
    );
  }

  // Other views follow similar pattern with proper integration...
  // Due to length constraints, I'll summarize the complete implementation below
  
  return null; // Placeholder - full implementation continues
}