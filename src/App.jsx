import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as faceapi from "@vladmandic/face-api";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Camera, CameraOff, UserPlus, LogIn,
  Activity, FileText, Scale, ChevronRight, CheckCircle2, AlertTriangle, Lock,
  RefreshCw, LogOut, X, Fingerprint, BadgeCheck, Users, Settings, GitBranch,
  ClipboardList, Sparkles, Eye, Server, KeyRound, AlertOctagon, Download,
  BarChart3, Database, TrendingUp, HeartPulse, Search, Filter, Bell, Menu,
  Home, Layers, Zap, Clock, User, FileBarChart, MapPin, Cpu, Activity as ActivityIcon,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// MONOCHROME MANGA THEME
// ═══════════════════════════════════════════════════════════════════

const T = {
  // Core blacks and whites
  black: "#000000",
  void: "#0a0a0a",
  bg: "#0f0f0f",
  bg2: "#161616",
  panel: "#1a1a1a",
  panel2: "#222222",
  
  // Greys
  graphite: "#2a2a2a",
  steel: "#404040",
  silver: "#707070",
  ash: "#909090",
  
  // Text
  white: "#ffffff",
  text: "#f5f5f5",
  muted: "#b0b0b0",
  dim: "#6a6a6a",
  
  // Monochrome accents
  line: "rgba(255,255,255,0.08)",
  line2: "rgba(255,255,255,0.04)",
  lineStrong: "rgba(255,255,255,0.15)",
  glow: "rgba(255,255,255,0.02)",
  
  // Status (monochrome)
  ok: "#ffffff",
  okDim: "rgba(255,255,255,0.7)",
  warn: "#d0d0d0",
  warnDim: "rgba(208,208,208,0.6)",
  bad: "#888888",
  badDim: "rgba(136,136,136,0.5)",
  
  // Functional
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
    this.version = 1;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Users store
        if (!db.objectStoreNames.contains("users")) {
          const userStore = db.createObjectStore("users", { keyPath: "staffId" });
          userStore.createIndex("name", "name", { unique: false });
          userStore.createIndex("role", "role", { unique: false });
          userStore.createIndex("dept", "dept", { unique: false });
        }
        
        // Security events store
        if (!db.objectStoreNames.contains("securityEvents")) {
          const eventStore = db.createObjectStore("securityEvents", { keyPath: "id", autoIncrement: true });
          eventStore.createIndex("user", "user", { unique: false });
          eventStore.createIndex("staffId", "staffId", { unique: false });
          eventStore.createIndex("timestamp", "timestamp", { unique: false });
          eventStore.createIndex("outcome", "outcome", { unique: false });
          eventStore.createIndex("tier", "tier", { unique: false });
        }
      };
    });
  }

  async addUser(user) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["users"], "readwrite");
    const store = tx.objectStore("users");
    return store.put(user);
  }

  async getUsers() {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["users"], "readonly");
    const store = tx.objectStore("users");
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });
  }

  async addSecurityEvent(event) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["securityEvents"], "readwrite");
    const store = tx.objectStore("securityEvents");
    event.timestamp = Date.now();
    return store.add(event);
  }

  async getSecurityEvents(limit = 200) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["securityEvents"], "readonly");
    const store = tx.objectStore("securityEvents");
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
    });
  }

  async updateSecurityEvent(id, updates) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(["securityEvents"], "readwrite");
    const store = tx.objectStore("securityEvents");
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const event = getRequest.result;
        if (event) {
          Object.assign(event, updates);
          const updateRequest = store.put(event);
          updateRequest.onsuccess = () => resolve(event);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error("Event not found"));
        }
      };
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
      { label: "Location Match", value: location, desc: location <= 5 ? "Internal hospital network" : "Unfamiliar location" },
      { label: "Time-of-Day", value: time, desc: time <= 5 ? "Normal shift hours" : "Unusual hour" },
      { label: "Recent Failed Attempts", value: attempts, desc: f + " recent failures" },
      { label: "Biometric Confidence", value: bio, desc: enrolled ? "Live face + template match" : "No enrolled template" },
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
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }, []);
  
  return {
    tap: () => tone(800, 0.05, "sine", 0.02, -300),
    success: () => { tone(523, 0.08); setTimeout(() => tone(784, 0.12), 60); },
    deny: () => tone(140, 0.2, "triangle", 0.04, -30),
    whoosh: () => tone(200, 0.15, "sine", 0.02, 500),
  };
}

// ═══════════════════════════════════════════════════════════════════
// MANGA ATMOSPHERE CANVAS
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

    // Scanlines
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

      // Subtle radial glow around cursor
      const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 280);
      grd.addColorStop(0, "rgba(255,255,255,0.03)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      // Particles with cursor interaction
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

      // Animated scanlines
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
// BIOMETRIC CAMERA COMPONENT
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

function BiometricCamera({ onFaceDetected, onError, autoStart = false, showGuide = true }) {
  const [cameraState, setCameraState] = useState(CameraStates.IDLE);
  const [faceDetected, setFaceDetected] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectLoopRef = useRef(null);
  const mountedRef = useRef(true);

  // Load face detection models
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
          
          // Wait for video to be ready
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

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && modelsLoaded && cameraState === CameraStates.IDLE) {
      startCamera();
    }
  }, [autoStart, modelsLoaded, cameraState, startCamera]);

  // Cleanup on unmount
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
      {/* Video frame */}
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
        
        {/* Face guide overlay */}
        {showGuide && cameraState !== CameraStates.ERROR && (
          <>
            {/* Oval guide */}
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
            
            {/* Corner markers */}
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

        {/* Scanning animation */}
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

        {/* Error state */}
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

      {/* Status bar */}
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

      {/* Manual controls */}
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
}

// ═══════════════════════════════════════════════════════════════════
// MANGA-STYLE COMPONENTS
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
  const [securityEvents, setSecurityEvents] = useState([]);
  const [session, setSession] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Enrollment flow
  const [enrollStep, setEnrollStep] = useState(0);
  const [enrollConsent, setEnrollConsent] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    name: "",
    staffId: "",
    role: "Doctor",
    dept: "Emergency",
  });
  const [enrollCaptures, setEnrollCaptures] = useState([]);

  // Authentication flow
  const [authPhase, setAuthPhase] = useState("idle");
  const [authRisk, setAuthRisk] = useState(null);
  const [authScoreAnim, setAuthScoreAnim] = useState(0);
  const [authAnomalous, setAuthAnomalous] = useState(false);
  const [authOtp, setAuthOtp] = useState("");
  const [authOtpActive, setAuthOtpActive] = useState(false);
  const [authFailCount, setAuthFailCount] = useState(0);

  // Dashboard state
  const [dashboardTab, setDashboardTab] = useState("overview");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Data explorer filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDept, setFilterDept] = useState("All");
  const [filterOutcome, setFilterOutcome] = useState("All");

  // UI state
  const [toast, setToast] = useState("");
  const [clock, setClock] = useState("");

  // Camera refs for enrollment capture
  const enrollVideoRef = useRef(null);
  const enrollStreamRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════
  // DATABASE INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    db.init().then(() => {
      // Load users
      db.getUsers().then(setUsers);
      
      // Load security events
      db.getSecurityEvents().then(setSecurityEvents);
    });
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
    
    // Reset states when navigating
    if (newView === "enroll") {
      setEnrollStep(0);
      setEnrollConsent(false);
      setEnrollCaptures([]);
      setEnrollForm({ name: "", staffId: "", role: "Doctor", dept: "Emergency" });
    }
    
    if (newView === "login") {
      setAuthPhase("idle");
      setAuthRisk(null);
      setAuthOtp("");
      setAuthOtpActive(false);
    }
    
    if (newView === "dashboard") {
      setDashboardTab("overview");
      setSelectedPatient(null);
    }
  };

  const logout = () => {
    sfx.tap();
    setSession(null);
    navigate("landing");
  };

  // ═══════════════════════════════════════════════════════════════════
  // ENROLLMENT
  // ═══════════════════════════════════════════════════════════════════

  const captureEnrollmentFrame = () => {
    if (!enrollVideoRef.current || enrollCaptures.length >= 3) return;
    
    const video = enrollVideoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setEnrollCaptures(prev => [...prev, dataUrl]);
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
      enrolledAt: new Date().toISOString(),
    };

    await db.addUser(newUser);
    const updatedUsers = await db.getUsers();
    setUsers(updatedUsers);
    
    setEnrollStep(4);
    sfx.success();
    
    // Stop camera
    if (enrollStreamRef.current) {
      enrollStreamRef.current.getTracks().forEach(t => t.stop());
      enrollStreamRef.current = null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════

  const startAuthentication = () => {
    sfx.whoosh();
    setAuthPhase("scanning");
    setAuthRisk(null);
    setAuthScoreAnim(0);
    setAuthOtp("");
    setAuthOtpActive(false);

    // Simulate biometric processing
    setTimeout(() => {
      const hasEnrolled = users.length > 0;
      const risk = calculateRisk({
        enrolled: hasEnrolled,
        anomalous: authAnomalous,
        failed: authFailCount,
      });

      setAuthRisk(risk);
      const tier = getRiskTier(risk.score);

      // Create security event
      const user = hasEnrolled ? users[users.length - 1] : null;
      const event = {
        user: user ? user.name : "Unknown",
        staffId: user ? user.staffId : "—",
        role: user ? user.role : "—",
        dept: user ? user.dept : "—",
        time: new Date().toLocaleString("en-GB"),
        score: risk.score,
        tier: tier.key,
        outcome: tier.key === "low" ? "Granted" : tier.key === "med" ? "Step-up" : "Denied",
        device: authAnomalous ? "Unknown Device" : "Hospital Workstation #A12",
        location: authAnomalous ? "External Network" : "Colombo · Core LAN",
        factors: risk.factors.filter(f => f.value > 10).map(f => f.desc),
        incidentStatus: tier.key === "high" ? "New" : null,
      };

      db.addSecurityEvent(event).then(() => {
        db.getSecurityEvents().then(setSecurityEvents);
      });

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
    }, 2800);
  };

  const verifyOtp = () => {
    if (authOtp === "123456" || authOtp.length === 6) {
      const user = users[users.length - 1];
      if (user) {
        sfx.success();
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

  const updateIncidentStatus = async (eventId, newStatus) => {
    sfx.tap();
    await db.updateSecurityEvent(eventId, { incidentStatus: newStatus });
    const updated = await db.getSecurityEvents();
    setSecurityEvents(updated);
    showToast("Incident status updated");
  };

  // ═══════════════════════════════════════════════════════════════════
  // ANALYTICS CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════

  const analytics = useMemo(() => {
    const total = securityEvents.length;
    const granted = securityEvents.filter(e => e.outcome === "Granted").length;
    const stepUp = securityEvents.filter(e => e.outcome === "Step-up").length;
    const denied = securityEvents.filter(e => e.outcome === "Denied").length;
    const successRate = total ? Math.round((granted / total) * 100) : 0;
    const avgRisk = total
      ? Math.round(securityEvents.reduce((sum, e) => sum + e.score, 0) / total)
      : 0;
    const openIncidents = securityEvents.filter(
      e => e.incidentStatus === "New" || e.incidentStatus === "Investigating"
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
  }, [securityEvents]);

  // ═══════════════════════════════════════════════════════════════════
  // AI INSIGHTS
  // ═══════════════════════════════════════════════════════════════════

  const aiInsights = useMemo(() => {
    const insights = [];
    
    // Repeated failures
    const failCounts = {};
    securityEvents.forEach(e => {
      if (e.outcome !== "Granted") {
        failCounts[e.user] = (failCounts[e.user] || 0) + 1;
      }
    });
    const repeaters = Object.entries(failCounts)
      .filter(([user, count]) => count >= 2 && user !== "Unknown")
      .map(([user]) => user);
    
    if (repeaters.length > 0) {
      insights.push({
        severity: "medium",
        title: "Repeated Authentication Failures",
        message: `Multiple failed attempts detected for: ${repeaters.join(", ")}`,
        recommendation: "Review user credentials and biometric enrollment quality",
      });
    }

    // High denial rate
    if (analytics.total > 5 && (analytics.denied / analytics.total) > 0.25) {
      insights.push({
        severity: "high",
        title: "Elevated Denial Rate",
        message: `${Math.round((analytics.denied / analytics.total) * 100)}% of authentication attempts denied`,
        recommendation: "Investigate device recognition and network geofencing configuration",
      });
    }

    // High average risk
    if (analytics.avgRisk > 45) {
      insights.push({
        severity: "medium",
        title: "Elevated Average Risk Score",
        message: `System-wide average risk score is ${analytics.avgRisk}/100`,
        recommendation: "Review anomalous login patterns and time-of-day analysis",
      });
    }

    // Unresolved incidents
    if (analytics.openIncidents > 0) {
      insights.push({
        severity: "high",
        title: "Unresolved Security Incidents",
        message: `${analytics.openIncidents} incident(s) require administrator attention`,
        recommendation: "Review and resolve open incidents in the Incident Centre",
      });
    }

    // All clear
    if (insights.length === 0) {
      insights.push({
        severity: "low",
        title: "Normal Security Posture",
        message: "No significant anomalies detected. All authentication patterns within normal parameters.",
        recommendation: "Continue monitoring for emerging threats",
      });
    }

    return insights;
  }, [securityEvents, analytics]);

  // ═══════════════════════════════════════════════════════════════════
  // DATA EXPORT
  // ═══════════════════════════════════════════════════════════════════

  const exportSecurityReport = () => {
    sfx.success();
    
    const report = `SUWA SETHA HOSPITAL SECURITY INTELLIGENCE REPORT
Generated: ${new Date().toLocaleString()}

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

Open Incidents: ${analytics.openIncidents}

═══════════════════════════════════════════════════════════════
AI SECURITY INSIGHTS
═══════════════════════════════════════════════════════════════

${aiInsights.map(insight => `[${insight.severity.toUpperCase()}] ${insight.title}
${insight.message}
→ ${insight.recommendation}`).join("\n\n")}

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
  // FILTERED EVENTS FOR DATA EXPLORER
  // ═══════════════════════════════════════════════════════════════════

  const filteredEvents = useMemo(() => {
    return securityEvents.filter(e => {
      const matchSearch = !filterSearch ||
        e.user.toLowerCase().includes(filterSearch.toLowerCase()) ||
        e.staffId.toLowerCase().includes(filterSearch.toLowerCase());
      const matchDept = filterDept === "All" || e.dept === filterDept;
      const matchOutcome = filterOutcome === "All" || e.outcome === filterOutcome;
      return matchSearch && matchDept && matchOutcome;
    });
  }, [securityEvents, filterSearch, filterDept, filterOutcome]);

  // ═══════════════════════════════════════════════════════════════════
  // RESPONSIVE BREAKPOINTS
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
  // RENDER: TOP NAVIGATION (PUBLIC)
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
        {/* Logo */}
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

        {/* Desktop Nav */}
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

        {/* Mobile Menu Button */}
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

      {/* Mobile Menu */}
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
  // RENDER: AUTHENTICATED NAVIGATION
  // ═══════════════════════════════════════════════════════════════════

  const AuthenticatedNav = () => (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      {!isMobile && (
        <aside
          style={{
            width: 260,
            flexShrink: 0,
            background: T.bg2,
            borderRight: `1px solid ${T.line}`,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* User Profile */}
          <div
            style={{
              padding: "24px 20px",
              borderBottom: `1px solid ${T.line}`,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: T.panel,
                border: `1px solid ${T.line}`,
                display: "grid",
                placeItems: "center",
                color: T.white,
                fontWeight: 700,
                fontSize: 16,
                marginBottom: 12,
              }}
            >
              {session.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{session.name}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
              {session.role} · {session.dept}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 9,
                fontFamily: "monospace",
                color: T.dim,
                letterSpacing: "0.05em",
              }}
            >
              {session.staffId}
            </div>
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: "20px 12px" }}>
            {accessibleNavItems.map(section => (
              <div key={section.section} style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    color: T.dim,
                    fontWeight: 700,
                    padding: "0 12px 8px",
                  }}
                >
                  {section.section.toUpperCase()}
                </div>
                {section.items.map(item => {
                  const isActive = dashboardTab === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      whileHover={{ x: 4 }}
                      onClick={() => {
                        sfx.tap();
                        setDashboardTab(item.id);
                        setSelectedPatient(null);
                        setMobileMenuOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        padding: "12px 16px",
                        background: isActive ? T.accentDim : "transparent",
                        border: "none",
                        borderRadius: 2,
                        color: isActive ? T.white : T.muted,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        marginBottom: 2,
                        transition: "background 0.2s, color 0.2s",
                      }}
                    >
                      <item.icon size={16} />
                      <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                      {item.id === "alerts" && analytics.openIncidents > 0 && (
                        <span
                          style={{
                            background: T.white,
                            color: T.black,
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 999,
                          }}
                        >
                          {analytics.openIncidents}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Logout */}
          <div style={{ padding: "16px 12px", borderTop: `1px solid ${T.line}` }}>
            <MangaButton
              variant="ghost"
              icon={LogOut}
              onClick={logout}
              style={{ width: "100%", justifyContent: "center" }}
            >
              Logout
            </MangaButton>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Bar */}
        <div
          style={{
            height: 64,
            borderBottom: `1px solid ${T.line}`,
            background: T.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            gap: 20,
          }}
        >
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

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.12em" }}>
              SECURITY / {dashboardTab.toUpperCase()}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
              {accessibleNavItems
                .flatMap(s => s.items)
                .find(item => item.id === dashboardTab)?.label || "Dashboard"}
            </div>
          </div>

          <div
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              color: T.muted,
              letterSpacing: "0.05em",
            }}
          >
            {clock}
          </div>

          {!isMobile && (
            <div
              style={{
                padding: "8px 16px",
                background: T.panel,
                border: `1px solid ${T.line}`,
                borderRadius: 2,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: analytics.posture >= 80 ? T.ok : analytics.posture >= 60 ? T.warn : T.bad,
              }}
            >
              POSTURE {analytics.posture}/100
            </div>
          )}
        </div>

        {/* Dashboard Content */}
        <div style={{ flex: 1, overflow: "auto", background: T.bg }}>
          {renderDashboardContent()}
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.7)",
                zIndex: 100,
              }}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                bottom: 0,
                width: "80%",
                maxWidth: 300,
                background: T.bg2,
                zIndex: 101,
                overflowY: "auto",
                boxShadow: "4px 0 20px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ padding: "24px 20px", borderBottom: `1px solid ${T.line}` }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{session.name}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
                  {session.role} · {session.dept}
                </div>
              </div>

              <nav style={{ padding: "20px 12px" }}>
                {accessibleNavItems.map(section => (
                  <div key={section.section} style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.16em",
                        color: T.dim,
                        fontWeight: 700,
                        padding: "0 12px 8px",
                      }}
                    >
                      {section.section.toUpperCase()}
                    </div>
                    {section.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          sfx.tap();
                          setDashboardTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          width: "100%",
                          padding: "12px 16px",
                          background: dashboardTab === item.id ? T.accentDim : "transparent",
                          border: "none",
                          borderRadius: 2,
                          color: dashboardTab === item.id ? T.white : T.muted,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          marginBottom: 2,
                        }}
                      >
                        <item.icon size={16} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </nav>

              <div style={{ padding: "16px 12px", borderTop: `1px solid ${T.line}` }}>
                <MangaButton
                  variant="ghost"
                  icon={LogOut}
                  onClick={logout}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Logout
                </MangaButton>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD CONTENT RENDERER
  // ═══════════════════════════════════════════════════════════════════

  const renderDashboardContent = () => {
    const content = (() => {
      switch (dashboardTab) {
        case "overview":
          return <DashboardOverview />;
        case "records":
          return <PatientRecords />;
        case "analytics":
          return <SecurityAnalytics />;
        case "log":
          return <AccessLog />;
        case "insights":
          return <AIInsights />;
        case "timeline":
          return <ThreatTimeline />;
        case "incidents":
          return <IncidentCentre />;
        case "alerts":
          return <SecurityAlerts />;
        case "explorer":
          return <DataExplorer />;
        case "staff":
          return <StaffDirectory />;
        case "audit":
          return <AuditLog />;
        case "health":
          return <SystemHealth />;
        case "settings":
          return <SecuritySettings />;
        default:
          return <DashboardOverview />;
      }
    })();

    return (
      <motion.div
        key={dashboardTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        {content}
      </motion.div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: OVERVIEW
  // ═══════════════════════════════════════════════════════════════════

  const DashboardOverview = () => (
    <div style={{ padding: 40 }}>
      {/* Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[
          { label: "Total Attempts", value: analytics.total, icon: Activity },
          { label: "Success Rate", value: `${analytics.successRate}%`, icon: ShieldCheck },
          { label: "Avg Risk", value: analytics.avgRisk, icon: TrendingUp },
          { label: "Open Incidents", value: analytics.openIncidents, icon: AlertOctagon },
        ].map((metric, i) => (
          <MangaPanel key={i} style={{ padding: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  color: T.dim,
                  fontWeight: 700,
                }}
              >
                {metric.label.toUpperCase()}
              </div>
              <metric.icon size={16} color={T.muted} />
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                fontFamily: "monospace",
                letterSpacing: "-0.02em",
              }}
            >
              {metric.value}
            </div>
          </MangaPanel>
        ))}
      </div>

      {/* Recent Activity */}
      <MangaPanel style={{ padding: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
          Recent Authentication Activity
        </h3>
        {securityEvents.slice(0, 8).map(event => (
          <div
            key={event.id}
            style={{
              padding: "14px 0",
              borderBottom: `1px solid ${T.line2}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{event.user}</div>
              <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
                {event.time} · {event.device}
              </div>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "monospace",
                color: event.tier === "low" ? T.ok : event.tier === "med" ? T.warn : T.bad,
              }}
            >
              {event.score}
            </div>
            <div
              style={{
                padding: "4px 12px",
                borderRadius: 2,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                background:
                  event.outcome === "Granted"
                    ? "rgba(255,255,255,0.1)"
                    : event.outcome === "Step-up"
                    ? "rgba(208,208,208,0.08)"
                    : "rgba(136,136,136,0.08)",
                color:
                  event.outcome === "Granted"
                    ? T.ok
                    : event.outcome === "Step-up"
                    ? T.warn
                    : T.bad,
              }}
            >
              {event.outcome}
            </div>
          </div>
        ))}
      </MangaPanel>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: PATIENT RECORDS
  // ═══════════════════════════════════════════════════════════════════

  const PatientRecords = () => (
    <div style={{ padding: 40 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectedPatient ? "1fr 380px" : "1fr",
          gap: 24,
        }}
      >
        <MangaPanel>
          <div
            style={{
              padding: "20px 28px",
              borderBottom: `1px solid ${T.line}`,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Patient Records
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: T.dim, textAlign: "left" }}>
                  {["Name", "ID", "Ward", "Admitted", "Status"].map(header => (
                    <th
                      key={header}
                      style={{
                        padding: "16px 20px",
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        fontWeight: 700,
                      }}
                    >
                      {header.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PATIENTS.map(patient => (
                  <motion.tr
                    key={patient.id}
                    whileHover={{ background: T.glow }}
                    onClick={() => {
                      sfx.tap();
                      setSelectedPatient(patient);
                    }}
                    style={{
                      borderTop: `1px solid ${T.line2}`,
                      cursor: "pointer",
                      background:
                        selectedPatient?.id === patient.id ? T.accentDim : "transparent",
                    }}
                  >
                    <td style={{ padding: "18px 20px", fontWeight: 600 }}>
                      {patient.name}
                    </td>
                    <td
                      style={{
                        padding: "18px 20px",
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: T.muted,
                      }}
                    >
                      {patient.id}
                    </td>
                    <td style={{ padding: "18px 20px" }}>{patient.ward}</td>
                    <td style={{ padding: "18px 20px", color: T.muted }}>
                      {patient.admitted}
                    </td>
                    <td style={{ padding: "18px 20px" }}>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: 2,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          background:
                            patient.status === "Critical"
                              ? "rgba(136,136,136,0.15)"
                              : patient.status === "Stable"
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(255,255,255,0.03)",
                          color:
                            patient.status === "Critical"
                              ? T.bad
                              : patient.status === "Stable"
                              ? T.ok
                              : T.dim,
                        }}
                      >
                        {patient.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </MangaPanel>

        {selectedPatient && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <MangaPanel style={{ padding: 28 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 20,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                    {selectedPatient.name}
                  </h3>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: T.dim,
                      marginTop: 4,
                    }}
                  >
                    {selectedPatient.id}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPatient(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: T.muted,
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {[
                  { label: "HR", value: selectedPatient.hr },
                  { label: "BP", value: selectedPatient.bp },
                  { label: "SpO2", value: `${selectedPatient.spo2}%` },
                ].map(vital => (
                  <div
                    key={vital.label}
                    style={{
                      background: T.void,
                      border: `1px solid ${T.line2}`,
                      borderRadius: 2,
                      padding: 14,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 8,
                        color: T.dim,
                        letterSpacing: "0.1em",
                        marginBottom: 4,
                      }}
                    >
                      {vital.label}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{vital.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, marginBottom: 6 }}>
                <strong>Doctor:</strong> {selectedPatient.doctor}
              </div>
              <div style={{ fontSize: 12, marginBottom: 16 }}>
                <strong>Ward:</strong> {selectedPatient.ward}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: T.muted,
                  lineHeight: 1.7,
                  padding: 16,
                  background: T.void,
                  borderRadius: 2,
                  border: `1px solid ${T.line2}`,
                }}
              >
                {selectedPatient.notes}
              </div>
            </MangaPanel>
          </motion.div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: SECURITY ANALYTICS
  // ═══════════════════════════════════════════════════════════════════

  const SecurityAnalytics = () => (
    <div style={{ padding: 40 }}>
      <div style={{ display: "grid", gap: 24 }}>
        {/* Outcomes Chart */}
        <MangaPanel style={{ padding: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
            Authentication Outcomes
          </h3>
          <div
            style={{
              display: "flex",
              gap: 24,
              alignItems: "flex-end",
              height: 180,
            }}
          >
            {[
              { label: "Granted", value: analytics.granted, color: T.ok },
              { label: "Step-up", value: analytics.stepUp, color: T.warn },
              { label: "Denied", value: analytics.denied, color: T.bad },
            ].map(bar => (
              <div
                key={bar.label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    fontFamily: "monospace",
                  }}
                >
                  {bar.value}
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{
                    height: analytics.total
                      ? `${(bar.value / analytics.total) * 140}px`
                      : "4px",
                  }}
                  style={{
                    width: "100%",
                    background: bar.color,
                    borderRadius: "4px 4px 0 0",
                    minHeight: 4,
                  }}
                />
                <div style={{ fontSize: 11, color: T.dim }}>{bar.label}</div>
              </div>
            ))}
          </div>
        </MangaPanel>

        {/* Risk Timeline */}
        <MangaPanel style={{ padding: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
            Risk Score Timeline
          </h3>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "flex-end",
              height: 140,
              overflowX: "auto",
              padding: "0 4px",
            }}
          >
            {securityEvents.slice(0, 30).reverse().map(event => (
              <div
                key={event.id}
                title={`${event.user}: ${event.score}`}
                style={{
                  minWidth: 12,
                  height: `${Math.max(4, event.score * 1.3)}px`,
                  background:
                    event.tier === "high" ? T.bad : event.tier === "med" ? T.warn : T.ok,
                  borderRadius: "2px 2px 0 0",
                }}
              />
            ))}
            {securityEvents.length === 0 && (
              <div style={{ color: T.dim, fontSize: 13, padding: 20 }}>
                No authentication data yet
              </div>
            )}
          </div>
        </MangaPanel>

        {/* Department Distribution */}
        <MangaPanel style={{ padding: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
            Department Activity
          </h3>
          {DEPTS.map(dept => {
            const count = securityEvents.filter(e => e.dept === dept).length;
            const pct = analytics.total ? (count / analytics.total) * 100 : 0;
            return (
              <div key={dept} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{dept}</span>
                  <span style={{ color: T.dim }}>{count}</span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: T.void,
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    style={{
                      height: "100%",
                      background: T.white,
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </MangaPanel>

        {/* Security Posture */}
        <MangaPanel style={{ padding: 32, textAlign: "center" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              color: T.dim,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            SECURITY POSTURE SCORE
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              fontFamily: "monospace",
              letterSpacing: "-0.04em",
              color:
                analytics.posture >= 80 ? T.ok : analytics.posture >= 60 ? T.warn : T.bad,
            }}
          >
            {analytics.posture}/100
          </div>
        </MangaPanel>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: ACCESS LOG
  // ═══════════════════════════════════════════════════════════════════

  const AccessLog = () => {
    const userEvents = securityEvents.filter(e => e.user === session.name);

    return (
      <div style={{ padding: 40 }}>
        <MangaPanel>
          <div
            style={{
              padding: "20px 28px",
              borderBottom: `1px solid ${T.line}`,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            My Access Log
          </div>
          {userEvents.length === 0 ? (
            <div style={{ padding: 64, textAlign: "center", color: T.dim }}>
              No authentication events recorded
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: T.dim, textAlign: "left" }}>
                  {["Time", "Device", "Location", "Score", "Outcome"].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: "16px 20px",
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        fontWeight: 700,
                      }}
                    >
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {userEvents.map(event => (
                  <tr key={event.id} style={{ borderTop: `1px solid ${T.line2}` }}>
                    <td
                      style={{
                        padding: "16px 20px",
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: T.muted,
                      }}
                    >
                      {event.time}
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: 12 }}>{event.device}</td>
                    <td style={{ padding: "16px 20px", fontSize: 12 }}>{event.location}</td>
                    <td
                      style={{
                        padding: "16px 20px",
                        fontFamily: "monospace",
                        fontWeight: 700,
                      }}
                    >
                      {event.score}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 2,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          background:
                            event.outcome === "Granted"
                              ? "rgba(255,255,255,0.08)"
                              : event.outcome === "Step-up"
                              ? "rgba(208,208,208,0.06)"
                              : "rgba(136,136,136,0.06)",
                          color:
                            event.outcome === "Granted"
                              ? T.ok
                              : event.outcome === "Step-up"
                              ? T.warn
                              : T.bad,
                        }}
                      >
                        {event.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MangaPanel>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: AI INSIGHTS
  // ═══════════════════════════════════════════════════════════════════

  const AIInsights = () => (
    <div style={{ padding: 40 }}>
      <MangaPanel style={{ padding: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <Sparkles size={24} color={T.white} />
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>AI Security Intelligence</h2>
        </div>

        {aiInsights.map((insight, i) => (
          <div
            key={i}
            style={{
              padding: "20px 24px",
              background: T.void,
              borderRadius: 2,
              marginBottom: 16,
              borderLeft: `3px solid ${
                insight.severity === "high"
                  ? T.bad
                  : insight.severity === "medium"
                  ? T.warn
                  : T.ok
              }`,
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.12em",
                color: T.dim,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {insight.severity.toUpperCase()}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
              {insight.title}
            </div>
            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.7, marginBottom: 12 }}>
              {insight.message}
            </div>
            <div
              style={{
                fontSize: 12,
                color: T.white,
                padding: "10px 14px",
                background: T.panel,
                borderRadius: 2,
                border: `1px solid ${T.line}`,
              }}
            >
              → {insight.recommendation}
            </div>
          </div>
        ))}
      </MangaPanel>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: THREAT TIMELINE
  // ═══════════════════════════════════════════════════════════════════

  const ThreatTimeline = () => (
    <div style={{ padding: 40 }}>
      <MangaPanel style={{ padding: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>
          Threat Timeline
        </h2>

        <div style={{ position: "relative", paddingLeft: 40 }}>
          {/* Timeline line */}
          <div
            style={{
              position: "absolute",
              left: 8,
              top: 0,
              bottom: 0,
              width: 2,
              background: T.line,
            }}
          />

          {securityEvents.slice(0, 20).map((event, i) => (
            <div key={event.id} style={{ position: "relative", marginBottom: 28 }}>
              {/* Timeline dot */}
              <div
                style={{
                  position: "absolute",
                  left: -36,
                  top: 4,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background:
                    event.tier === "high" ? T.bad : event.tier === "med" ? T.warn : T.ok,
                  border: `2px solid ${T.bg}`,
                  boxShadow: `0 0 0 2px ${
                    event.tier === "high" ? T.bad : event.tier === "med" ? T.warn : T.ok
                  }`,
                }}
              />

              <div
                style={{
                  padding: "16px 20px",
                  background: T.void,
                  border: `1px solid ${T.line2}`,
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{event.user}</div>
                    <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
                      {event.time} · {event.device}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 20,
                      fontWeight: 700,
                      color:
                        event.tier === "high"
                          ? T.bad
                          : event.tier === "med"
                          ? T.warn
                          : T.ok,
                    }}
                  >
                    {event.score}
                  </div>
                </div>
                {event.factors && event.factors.length > 0 && (
                  <div style={{ fontSize: 12, color: T.muted }}>
                    {event.factors.join(" · ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </MangaPanel>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: INCIDENT CENTRE
  // ═══════════════════════════════════════════════════════════════════

  const IncidentCentre = () => {
    const incidents = securityEvents.filter(e => e.incidentStatus);

    return (
      <div style={{ padding: 40 }}>
        <MangaPanel>
          <div
            style={{
              padding: "20px 28px",
              borderBottom: `1px solid ${T.line}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 700 }}>Security Incident Centre</h2>
            <div style={{ fontSize: 11, color: T.dim }}>
              {analytics.openIncidents} open
            </div>
          </div>

          {incidents.length === 0 ? (
            <div style={{ padding: 64, textAlign: "center", color: T.dim }}>
              No security incidents recorded
            </div>
          ) : (
            <div>
              {incidents.map(incident => (
                <div
                  key={incident.id}
                  style={{
                    padding: "20px 28px",
                    borderBottom: `1px solid ${T.line2}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                        INC-{incident.id.toString().slice(-6)} · {incident.user}
                      </div>
                      <div style={{ fontSize: 11, color: T.dim }}>
                        {incident.time} · Risk {incident.score} · {incident.device}
                      </div>
                    </div>
                    <select
                      value={incident.incidentStatus}
                      onChange={e => updateIncidentStatus(incident.id, e.target.value)}
                      style={{
                        background: T.void,
                        color: T.white,
                        border: `1px solid ${T.line}`,
                        borderRadius: 2,
                        padding: "8px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <option>New</option>
                      <option>Investigating</option>
                      <option>Resolved</option>
                    </select>
                  </div>
                  {incident.factors && incident.factors.length > 0 && (
                    <div style={{ fontSize: 12, color: T.muted }}>
                      {incident.factors.join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </MangaPanel>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: SECURITY ALERTS
  // ═══════════════════════════════════════════════════════════════════

  const SecurityAlerts = () => {
    const alerts = securityEvents.filter(e => e.tier !== "low");

    return (
      <div style={{ padding: 40 }}>
        <MangaPanel>
          <div
            style={{
              padding: "20px 28px",
              borderBottom: `1px solid ${T.line}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 700 }}>Security Alerts</h2>
            <div style={{ fontSize: 11, color: T.dim }}>{alerts.length} total</div>
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: 64, textAlign: "center", color: T.dim }}>
              No security alerts
            </div>
          ) : (
            <div>
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  style={{
                    padding: "18px 28px",
                    borderBottom: `1px solid ${T.line2}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 20,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      {alert.user} · {alert.outcome}
                    </div>
                    <div style={{ fontSize: 11, color: T.dim }}>
                      {alert.time} · {alert.device}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 20,
                      fontWeight: 700,
                      color: alert.tier === "high" ? T.bad : T.warn,
                    }}
                  >
                    {alert.score}
                  </div>
                </div>
              ))}
            </div>
          )}
        </MangaPanel>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: DATA EXPLORER
  // ═══════════════════════════════════════════════════════════════════

  const DataExplorer = () => (
    <div style={{ padding: 40 }}>
      <MangaPanel>
        {/* Filters */}
        <div
          style={{
            padding: "20px 28px",
            borderBottom: `1px solid ${T.line}`,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Search
              size={14}
              color={T.dim}
              style={{ position: "absolute", left: 12, top: 12 }}
            />
            <input
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Search by name or staff ID..."
              style={{
                width: "100%",
                padding: "10px 14px 10px 36px",
                background: T.void,
                border: `1px solid ${T.line2}`,
                borderRadius: 2,
                color: T.text,
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            style={{
              padding: "10px 14px",
              background: T.void,
              border: `1px solid ${T.line2}`,
              borderRadius: 2,
              color: T.text,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <option>All</option>
            {DEPTS.map(d => (
              <option key={d}>{d}</option>
            ))}
          </select>

          <select
            value={filterOutcome}
            onChange={e => setFilterOutcome(e.target.value)}
            style={{
              padding: "10px 14px",
              background: T.void,
              border: `1px solid ${T.line2}`,
              borderRadius: 2,
              color: T.text,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <option>All</option>
            <option>Granted</option>
            <option>Step-up</option>
            <option>Denied</option>
          </select>

          <MangaButton
            variant="ghost"
            onClick={() => {
              setFilterSearch("");
              setFilterDept("All");
              setFilterOutcome("All");
            }}
          >
            Reset
          </MangaButton>

          <MangaButton icon={Download} onClick={exportSecurityReport}>
            Export
          </MangaButton>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: T.dim, textAlign: "left" }}>
                {["User", "Staff ID", "Dept", "Time", "Score", "Outcome"].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: "14px 20px",
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      fontWeight: 700,
                    }}
                  >
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.slice(0, 50).map(event => (
                <tr key={event.id} style={{ borderTop: `1px solid ${T.line2}` }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>{event.user}</td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontFamily: "monospace",
                      fontSize: 11,
                    }}
                  >
                    {event.staffId}
                  </td>
                  <td style={{ padding: "14px 20px" }}>{event.dept}</td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: T.muted,
                    }}
                  >
                    {event.time}
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontFamily: "monospace",
                      fontWeight: 700,
                    }}
                  >
                    {event.score}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 2,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        background:
                          event.outcome === "Granted"
                            ? "rgba(255,255,255,0.08)"
                            : event.outcome === "Step-up"
                            ? "rgba(208,208,208,0.06)"
                            : "rgba(136,136,136,0.06)",
                        color:
                          event.outcome === "Granted"
                            ? T.ok
                            : event.outcome === "Step-up"
                            ? T.warn
                            : T.bad,
                      }}
                    >
                      {event.outcome}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredEvents.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: 64, textAlign: "center", color: T.dim }}
                  >
                    No matching records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </MangaPanel>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: STAFF DIRECTORY
  // ═══════════════════════════════════════════════════════════════════

  const StaffDirectory = () => (
    <div style={{ padding: 40 }}>
      <MangaPanel>
        <div
          style={{
            padding: "20px 28px",
            borderBottom: `1px solid ${T.line}`,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Staff Directory
        </div>

        {users.length === 0 ? (
          <div style={{ padding: 64, textAlign: "center", color: T.dim }}>
            No enrolled staff members
          </div>
        ) : (
          <div>
            {users.map(user => {
              const userEvents = securityEvents.filter(e => e.staffId === user.staffId);
              const userFails = userEvents.filter(e => e.outcome !== "Granted").length;
              
              return (
                <div
                  key={user.staffId}
                  style={{
                    display: "flex",
                    gap: 20,
                    padding: "18px 28px",
                    borderBottom: `1px solid ${T.line2}`,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: T.panel,
                      border: `1px solid ${T.line}`,
                      display: "grid",
                      placeItems: "center",
                      color: T.white,
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
                      {user.role} · {user.dept}
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: T.muted, textAlign: "right" }}>
                    {userEvents.length} attempts · {userFails} failed
                  </div>

                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: T.white,
                      fontWeight: 600,
                    }}
                  >
                    {user.staffId}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </MangaPanel>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: AUDIT LOG
  // ═══════════════════════════════════════════════════════════════════

  const AuditLog = () => (
    <div style={{ padding: 40 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>System Audit Log</h2>
        <MangaButton icon={Download} onClick={exportSecurityReport}>
          Export
        </MangaButton>
      </div>

      <MangaPanel>
        {securityEvents.length === 0 ? (
          <div style={{ padding: 64, textAlign: "center", color: T.dim }}>
            No audit events recorded
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: T.dim, textAlign: "left" }}>
                {["User", "Time", "Score", "Outcome"].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: "16px 24px",
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      fontWeight: 700,
                    }}
                  >
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {securityEvents.map(event => (
                <tr key={event.id} style={{ borderTop: `1px solid ${T.line2}` }}>
                  <td style={{ padding: "16px 24px", fontWeight: 600 }}>{event.user}</td>
                  <td
                    style={{
                      padding: "16px 24px",
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: T.muted,
                    }}
                  >
                    {event.time}
                  </td>
                  <td
                    style={{
                      padding: "16px 24px",
                      fontFamily: "monospace",
                      fontWeight: 700,
                    }}
                  >
                    {event.score}
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 2,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        background:
                          event.outcome === "Granted"
                            ? "rgba(255,255,255,0.08)"
                            : event.outcome === "Step-up"
                            ? "rgba(208,208,208,0.06)"
                            : "rgba(136,136,136,0.06)",
                        color:
                          event.outcome === "Granted"
                            ? T.ok
                            : event.outcome === "Step-up"
                            ? T.warn
                            : T.bad,
                      }}
                    >
                      {event.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MangaPanel>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: SYSTEM HEALTH
  // ═══════════════════════════════════════════════════════════════════

  const SystemHealth = () => (
    <div style={{ padding: 40 }}>
      <MangaPanel style={{ padding: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 28 }}>
          System Health Status
        </h2>

        <div style={{ display: "grid", gap: 20 }}>
          {[
            { label: "Camera System", status: "ONLINE", icon: Camera },
            { label: "Face Detection Model", status: "READY", icon: Eye },
            { label: "Security Database", status: "ONLINE", icon: Database },
            { label: "Analytics Engine", status: "ACTIVE", icon: BarChart3 },
            { label: "Audit System", status: "ACTIVE", icon: FileBarChart },
          ].map((system, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "18px 24px",
                background: T.void,
                border: `1px solid ${T.line}`,
                borderRadius: 2,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <system.icon size={20} color={T.white} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{system.label}</span>
              </div>
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 2,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  background: "rgba(255,255,255,0.08)",
                  color: T.ok,
                }}
              >
                {system.status}
              </span>
            </div>
          ))}
        </div>
      </MangaPanel>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD: SECURITY SETTINGS
  // ═══════════════════════════════════════════════════════════════════

  const SecuritySettings = () => (
    <div style={{ padding: 40 }}>
      <MangaPanel style={{ padding: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          Security Settings
        </h2>
        <p style={{ color: T.muted, fontSize: 14, marginBottom: 28 }}>
          Your biometric enrollment and security preferences
        </p>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            ENROLLED BIOMETRIC FRAMES
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {session.captures && session.captures.length > 0 ? (
              session.captures.map((capture, i) => (
                <img
                  key={i}
                  src={capture}
                  alt={`Biometric frame ${i + 1}`}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 2,
                    objectFit: "cover",
                    border: `1px solid ${T.line}`,
                  }}
                />
              ))
            ) : (
              <div style={{ color: T.dim, fontSize: 13 }}>
                No biometric frames enrolled. Re-enroll to capture reference images.
              </div>
            )}
          </div>
        </div>

        <MangaDivider />

        <MangaButton
          onClick={() => {
            navigate("enroll");
          }}
        >
          Re-enroll Biometric Profile
        </MangaButton>
      </MangaPanel>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: LANDING PAGE
  // ═══════════════════════════════════════════════════════════════════

  if (view === "landing") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <PublicTopNav />

          {/* Hero Section */}
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
            {/* Background glow */}
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
              {/* Badge */}
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

              {/* Title */}
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

              {/* Subtitle */}
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
                The Suwa Setha biometric cybersecurity platform. Live facial liveness,
                transparent multi-factor risk intelligence, immutable audit — built for
                clinical trust.
              </motion.p>

              {/* CTA Buttons */}
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

          {/* Architecture Section */}
          <section
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "100px 40px 80px",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ textAlign: "center", marginBottom: 64 }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  color: T.white,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                ARCHITECTURE
              </div>
              <h2
                style={{
                  fontSize: 38,
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                }}
              >
                How Protection Works
              </h2>
            </motion.div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 20,
              }}
            >
              {[
                {
                  icon: Camera,
                  num: "01",
                  title: "Liveness Scan",
                  desc: "Real webcam face-presence detection confirms a living subject before scoring begins — not a static photo spoof.",
                },
                {
                  icon: Activity,
                  num: "02",
                  title: "Risk Intelligence",
                  desc: "Five weighted signals: device, network geofence, time-of-day, failure pressure, and biometric confidence.",
                },
                {
                  icon: Database,
                  num: "03",
                  title: "Security Data Layer",
                  desc: "Every attempt is stored as a structured security record, feeding real-time analytics and incident detection.",
                },
                {
                  icon: ShieldCheck,
                  num: "04",
                  title: "Governed Access",
                  desc: "Trusted entry, step-up OTP, or hard deny with incident log. Every decision is explainable for audit.",
                },
              ].map((item, i) => (
                <MangaPanel
                  key={i}
                  hover
                  style={{ padding: "40px 32px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 24,
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        background: T.accentDim,
                        border: `1px solid ${T.line}`,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <item.icon size={24} color={T.white} />
                    </div>
                    <span
                      style={{
                        fontFamily: "monospace",
                        color: T.dim,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {item.num}
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      marginBottom: 12,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      color: T.muted,
                      fontSize: 14,
                      lineHeight: 1.7,
                    }}
                  >
                    {item.desc}
                  </p>
                </MangaPanel>
              ))}
            </div>
          </section>

          {/* Stats Section */}
          <section
            style={{
              borderTop: `1px solid ${T.line}`,
              borderBottom: `1px solid ${T.line}`,
              background: T.bg2,
            }}
          >
            <div
              style={{
                maxWidth: 1200,
                margin: "0 auto",
                padding: "64px 40px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 32,
              }}
            >
              {[
                { value: users.length, label: "Enrolled Identities" },
                { value: securityEvents.length, label: "Security Events Logged" },
                { value: "5", label: "Risk Factors" },
                { value: "100%", label: "Client-Side Privacy" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  style={{ textAlign: "center" }}
                >
                  <div
                    style={{
                      fontSize: 48,
                      fontWeight: 700,
                      fontFamily: "monospace",
                      letterSpacing: "-0.04em",
                      color: T.white,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.dim,
                      letterSpacing: "0.16em",
                      marginTop: 8,
                      textTransform: "uppercase",
                    }}
                  >
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer
            style={{
              textAlign: "center",
              padding: "56px 40px 72px",
              borderTop: `1px solid ${T.line}`,
              fontSize: 11,
              color: T.dim,
              letterSpacing: "0.06em",
              lineHeight: 1.9,
            }}
          >
            SECURING HEALTHCARE OPERATIONS — AI-DRIVEN BIOMETRIC CYBERSECURITY
            PLATFORM FOR SUWA SETHA HOSPITAL
            <br />
            PROTOTYPE · IDENTITY MATCHING SIMULATED · LIVENESS DETECTION REAL ·
            FICTIONAL CLINICAL DATA ONLY
          </footer>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: ENROLLMENT
  // ═══════════════════════════════════════════════════════════════════

  if (view === "enroll") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <PublicTopNav />

          <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 32px 100px" }}>
            {/* Progress Indicators */}
            <div style={{ display: "flex", gap: 12, marginBottom: 48 }}>
              {["Consent", "Details", "Capture", "Complete"].map((label, i) => {
                const active = enrollStep === i || (enrollStep === 3 && i === 2) || (enrollStep >= 4 && i === 3);
                const done = enrollStep > i;
                return (
                  <div key={label} style={{ flex: 1 }}>
                    <div
                      style={{
                        height: 2,
                        borderRadius: 2,
                        marginBottom: 12,
                        background: done || active ? T.white : T.line2,
                        transition: "background 0.3s",
                      }}
                    />
                    <div
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        color: active || done ? T.white : T.dim,
                        textAlign: "center",
                        transition: "color 0.3s",
                      }}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {/* Step 0: Consent */}
              {enrollStep === 0 && (
                <motion.div
                  key="consent"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <MangaPanel style={{ padding: 44 }}>
                    <h2
                      style={{
                        fontSize: 26,
                        fontWeight: 600,
                        letterSpacing: "-0.03em",
                        marginBottom: 16,
                      }}
                    >
                      Biometric Consent
                    </h2>
                    <p
                      style={{
                        color: T.muted,
                        fontSize: 15,
                        lineHeight: 1.75,
                        marginBottom: 32,
                      }}
                    >
                      You are about to enroll a facial biometric profile for access to
                      Suwa Setha clinical systems. Three live reference frames will be
                      captured. In production only an irreversible template is stored.
                    </p>
                    <label
                      style={{
                        display: "flex",
                        gap: 16,
                        padding: 20,
                        borderRadius: 2,
                        cursor: "pointer",
                        marginBottom: 36,
                        border: `1px solid ${enrollConsent ? T.line : T.line2}`,
                        background: T.void,
                        transition: "border-color 0.2s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enrollConsent}
                        onChange={e => setEnrollConsent(e.target.checked)}
                        style={{
                          marginTop: 4,
                          accentColor: T.white,
                          width: 18,
                          height: 18,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 14, lineHeight: 1.6 }}>
                        I understand and consent to biometric enrollment for hospital
                        system access.
                      </span>
                    </label>
                    <MangaButton
                      icon={ChevronRight}
                      disabled={!enrollConsent}
                      onClick={() => {
                        sfx.tap();
                        setEnrollStep(1);
                      }}
                    >
                      Continue
                    </MangaButton>
                  </MangaPanel>
                </motion.div>
              )}

              {/* Step 1: Details */}
              {enrollStep === 1 && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <MangaPanel style={{ padding: 44 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 32 }}>
                      Staff Profile
                    </h2>

                    <MangaInput
                      label="Full Name"
                      value={enrollForm.name}
                      onChange={e =>
                        setEnrollForm({ ...enrollForm, name: e.target.value })
                      }
                      placeholder="Dr. Nimal Perera"
                    />

                    <MangaInput
                      label="Staff ID (Optional)"
                      value={enrollForm.staffId}
                      onChange={e =>
                        setEnrollForm({ ...enrollForm, staffId: e.target.value })
                      }
                      placeholder="Auto-generated if left blank"
                    />

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 20,
                        marginBottom: 32,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: 9,
                            letterSpacing: "0.16em",
                            color: T.dim,
                            fontWeight: 700,
                            marginBottom: 8,
                            textTransform: "uppercase",
                          }}
                        >
                          Role
                        </label>
                        <select
                          value={enrollForm.role}
                          onChange={e =>
                            setEnrollForm({ ...enrollForm, role: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "14px 16px",
                            borderRadius: 2,
                            border: `1px solid ${T.line2}`,
                            background: T.void,
                            color: T.text,
                            fontSize: 14,
                            cursor: "pointer",
                          }}
                        >
                          {ROLES.map(r => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: 9,
                            letterSpacing: "0.16em",
                            color: T.dim,
                            fontWeight: 700,
                            marginBottom: 8,
                            textTransform: "uppercase",
                          }}
                        >
                          Department
                        </label>
                        <select
                          value={enrollForm.dept}
                          onChange={e =>
                            setEnrollForm({ ...enrollForm, dept: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "14px 16px",
                            borderRadius: 2,
                            border: `1px solid ${T.line2}`,
                            background: T.void,
                            color: T.text,
                            fontSize: 14,
                            cursor: "pointer",
                          }}
                        >
                          {DEPTS.map(d => (
                            <option key={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <MangaButton
                      icon={ChevronRight}
                      onClick={() => {
                        if (!enrollForm.name.trim()) {
                          showToast("Please enter your name");
                          return;
                        }
                        sfx.tap();
                        setEnrollStep(2);
                      }}
                    >
                      Enable Camera
                    </MangaButton>
                  </MangaPanel>
                </motion.div>
              )}

              {/* Step 2: Capture */}
              {enrollStep === 2 && (
                <motion.div
                  key="capture"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <MangaPanel style={{ padding: 44 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
                      Live Capture
                    </h2>
                    <p style={{ color: T.muted, fontSize: 14, marginBottom: 28 }}>
                      Three frames · Real face-presence detection
                    </p>

                    <BiometricCamera
                      autoStart
                      onFaceDetected={detected => {
                        if (!enrollVideoRef.current && detected) {
                          const videoElement = document.querySelector('video');
                          if (videoElement) enrollVideoRef.current = videoElement;
                        }
                      }}
                      onError={err => showToast(err)}
                    />

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 14,
                        margin: "28px 0",
                      }}
                    >
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          style={{
                            width: 88,
                            height: 88,
                            borderRadius: 2,
                            overflow: "hidden",
                            border: `1px solid ${
                              enrollCaptures[i] ? T.white : T.line2
                            }`,
                            background: T.void,
                            flexShrink: 0,
                          }}
                        >
                          {enrollCaptures[i] ? (
                            <img
                              src={enrollCaptures[i]}
                              alt={`Capture ${i + 1}`}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                height: "100%",
                                display: "grid",
                                placeItems: "center",
                                color: T.dim,
                                fontFamily: "monospace",
                              }}
                            >
                              {i + 1}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        justifyContent: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <MangaButton
                        icon={Camera}
                        onClick={captureEnrollmentFrame}
                        disabled={enrollCaptures.length >= 3}
                      >
                        Capture {Math.min(enrollCaptures.length + 1, 3)} / 3
                      </MangaButton>

                      {enrollCaptures.length >= 3 && (
                        <MangaButton
                          variant="secondary"
                          onClick={() => {
                            sfx.tap();
                            setEnrollStep(3);
                          }}
                        >
                          Continue
                        </MangaButton>
                      )}
                    </div>
                  </MangaPanel>
                </motion.div>
              )}

              {/* Step 3: Confirm */}
              {enrollStep === 3 && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <MangaPanel style={{ padding: 44, textAlign: "center" }}>
                    <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
                      Confirm Enrollment
                    </h2>
                    <p style={{ color: T.muted, marginBottom: 28 }}>
                      {enrollForm.name} · {enrollForm.role} · {enrollForm.dept}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 12,
                        marginBottom: 36,
                        flexWrap: "wrap",
                      }}
                    >
                      {enrollCaptures.map((capture, i) => (
                        <img
                          key={i}
                          src={capture}
                          alt={`Capture ${i + 1}`}
                          style={{
                            width: 100,
                            height: 100,
                            borderRadius: 2,
                            objectFit: "cover",
                            border: `1px solid ${T.white}`,
                          }}
                        />
                      ))}
                    </div>

                    <MangaButton icon={BadgeCheck} onClick={completeEnrollment}>
                      Complete Enrollment
                    </MangaButton>
                  </MangaPanel>
                </motion.div>
              )}

              {/* Step 4: Complete */}
              {enrollStep === 4 && (
                <motion.div
                  key="complete"
                  initial={{ scale: 0.94, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <MangaPanel style={{ padding: 64, textAlign: "center" }}>
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 180, damping: 18 }}
                    >
                      <CheckCircle2 size={80} color={T.white} style={{ marginBottom: 24 }} />
                    </motion.div>

                    <h2 style={{ fontSize: 28, fontWeight: 600, marginBottom: 12 }}>
                      Enrollment Complete
                    </h2>
                    <p style={{ color: T.muted, marginBottom: 24 }}>
                      Biometric profile ready for authentication
                    </p>

                    <div
                      style={{
                        display: "inline-block",
                        padding: "16px 32px",
                        marginBottom: 36,
                        border: `1px solid ${T.line}`,
                        borderRadius: 2,
                        fontFamily: "monospace",
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        fontSize: 20,
                      }}
                    >
                      {users.length > 0 ? users[users.length - 1].staffId : ""}
                    </div>

                    <div>
                      <MangaButton
                        onClick={() => {
                          sfx.tap();
                          navigate("login");
                        }}
                      >
                        Proceed to Secure Login
                      </MangaButton>
                    </div>
                  </MangaPanel>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: LOGIN / AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════

  if (view === "login") {
    const tier = authRisk ? getRiskTier(authRisk.score) : null;
    const TierIcon = tier?.Icon;

    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <PublicTopNav />

          <div style={{ maxWidth: 600, margin: "0 auto", padding: "56px 32px 100px" }}>
            <MangaPanel style={{ padding: 48 }}>
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em" }}>
                  Biometric Authentication
                </h2>
                <p style={{ color: T.muted, fontSize: 14, marginTop: 8 }}>
                  Multi-factor AI risk assessment
                </p>
              </div>

              {/* Biometric Scanner Visualization */}
              <div
                style={{
                  position: "relative",
                  width: 280,
                  height: 280,
                  margin: "0 auto 32px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: T.black,
                  border: `2px solid ${
                    authPhase === "scanning"
                      ? T.white
                      : tier
                      ? tier.color
                      : T.line
                  }`,
                  boxShadow:
                    authPhase === "scanning"
                      ? `0 0 60px rgba(255,255,255,0.15)`
                      : `0 20px 60px rgba(0,0,0,0.6)`,
                  transition: "border-color 0.3s, box-shadow 0.3s",
                }}
              >
                {authPhase === "scanning" ? (
                  <BiometricCamera autoStart showGuide={false} />
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {authPhase === "result" && TierIcon ? (
                      <TierIcon size={76} color={tier.color} />
                    ) : (
                      <Fingerprint size={64} color={T.dim} />
                    )}
                  </div>
                )}
              </div>

              {/* Status */}
              <p
                style={{
                  textAlign: "center",
                  fontWeight: 600,
                  fontSize: 13,
                  color: T.muted,
                  marginBottom: 28,
                  fontFamily: "monospace",
                  letterSpacing: "0.06em",
                }}
              >
                {authPhase === "idle" && "INITIATE SECURE SCAN"}
                {authPhase === "scanning" && "BIOMETRIC SCAN IN PROGRESS..."}
                {authPhase === "result" && tier && (
                  <span style={{ color: tier.color, fontSize: 15 }}>{tier.label}</span>
                )}
              </p>

              {/* Start Button */}
              {authPhase === "idle" && (
                <MangaButton
                  icon={Fingerprint}
                  onClick={startAuthentication}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Start Secure Scan
                </MangaButton>
              )}

              {/* Result */}
              {authPhase === "result" && authRisk && tier && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  {/* Risk Score */}
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.24em",
                        color: T.dim,
                        marginBottom: 8,
                      }}
                    >
                      AI RISK SCORE
                    </div>
                    <div
                      style={{
                        fontSize: 68,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        color: tier.color,
                        lineHeight: 1,
                      }}
                    >
                      {authScoreAnim}
                    </div>
                  </div>

                  {/* Risk Factors */}
                  <div
                    style={{
                      background: T.void,
                      borderRadius: 2,
                      padding: 20,
                      border: `1px solid ${T.line2}`,
                      marginBottom: 20,
                    }}
                  >
                    {authRisk.factors.map(factor => (
                      <div key={factor.label} style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{factor.label}</span>
                          <span
                            style={{
                              fontFamily: "monospace",
                              color: factor.value > 15 ? T.bad : T.muted,
                            }}
                          >
                            +{factor.value}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 4,
                            background: T.black,
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, factor.value * 2.5)}%` }}
                            transition={{ duration: 0.8 }}
                            style={{
                              height: "100%",
                              background:
                                factor.value > 15
                                  ? T.bad
                                  : factor.value > 8
                                  ? T.warn
                                  : T.ok,
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>
                          {factor.desc}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Step-up OTP */}
                  {tier.key === "med" && (
                    <div
                      style={{
                        border: `1px solid ${T.line}`,
                        background: T.accentDim,
                        borderRadius: 2,
                        padding: 20,
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          marginBottom: 12,
                          fontSize: 13,
                        }}
                      >
                        STEP-UP VERIFICATION REQUIRED
                      </div>
                      {!authOtpActive ? (
                        <MangaButton
                          variant="ghost"
                          onClick={() => {
                            sfx.tap();
                            setAuthOtpActive(true);
                          }}
                        >
                          Send OTP
                        </MangaButton>
                      ) : (
                        <div style={{ display: "flex", gap: 10 }}>
                          <input
                            value={authOtp}
                            onChange={e => setAuthOtp(e.target.value)}
                            maxLength={6}
                            placeholder="Enter OTP"
                            style={{
                              flex: 1,
                              padding: "12px 16px",
                              background: T.void,
                              border: `1px solid ${T.line}`,
                              borderRadius: 2,
                              color: T.text,
                              fontSize: 14,
                              fontFamily: "monospace",
                              letterSpacing: "0.2em",
                              outline: "none",
                            }}
                          />
                          <MangaButton onClick={verifyOtp}>Verify</MangaButton>
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: T.dim, marginTop: 10 }}>
                        Demo code: 123456
                      </div>
                    </div>
                  )}

                  {/* Denied */}
                  {tier.key === "high" && (
                    <div
                      style={{
                        border: `1px solid ${T.line}`,
                        background: "rgba(136,136,136,0.08)",
                        borderRadius: 2,
                        padding: 24,
                        marginBottom: 16,
                        textAlign: "center",
                      }}
                    >
                      <AlertTriangle color={T.bad} size={32} style={{ marginBottom: 12 }} />
                      <div style={{ fontWeight: 700, color: T.bad }}>
                        Access Denied — Incident Logged
                      </div>
                    </div>
                  )}

                  {/* Granted */}
                  {tier.key === "low" && (
                    <div
                      style={{
                        textAlign: "center",
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 16,
                      }}
                    >
                      Opening clinical portal...
                    </div>
                  )}

                  {/* New Scan */}
                  <MangaButton
                    variant="ghost"
                    icon={RefreshCw}
                    onClick={() => {
                      sfx.tap();
                      setAuthPhase("idle");
                      setAuthRisk(null);
                    }}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    New Scan
                  </MangaButton>
                </motion.div>
              )}

              {/* Simulate Suspicious Login */}
              <label
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 24,
                  fontSize: 12,
                  color: T.dim,
                  cursor: "pointer",
                  alignItems: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={authAnomalous}
                  onChange={e => setAuthAnomalous(e.target.checked)}
                  style={{ accentColor: T.white }}
                />
                Simulate suspicious login
              </label>

              {users.length === 0 && (
                <p style={{ marginTop: 16, fontSize: 12, color: T.warn, textAlign: "center" }}>
                  No enrollment — scans will score high risk
                </p>
              )}
            </MangaPanel>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: AUTHENTICATED DASHBOARD
  // ═══════════════════════════════════════════════════════════════════

  if (view === "dashboard" && session) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <AuthenticatedNav />
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              style={{
                position: "fixed",
                bottom: 32,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 200,
                background: T.panel,
                border: `1px solid ${T.line}`,
                borderRadius: 2,
                padding: "14px 28px",
                color: T.white,
                fontSize: 13,
                fontWeight: 600,
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: ETHICS
  // ═══════════════════════════════════════════════════════════════════

  if (view === "ethics") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <PublicTopNav />

          <div style={{ maxWidth: 800, margin: "0 auto", padding: "64px 32px 100px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 36 }}>
              <Scale size={28} color={T.white} />
              <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em" }}>
                Ethics and Legal
              </h1>
            </div>

            {[
              {
                title: "What is Real vs Simulated",
                content:
                  "Liveness uses real in-browser face-api.js detection. Identity matching is simulated with transparent weights so every score remains explainable. Demo frames stay in local storage only.",
              },
              {
                title: "Data Protection Principles",
                content:
                  "Mandatory consent before camera. Minimization and purpose limitation. Production requires DPIA, encryption, retention limits, and erasure under GDPR-style rules and Sri Lanka PDPA.",
              },
              {
                title: "Risks in Healthcare Biometrics",
                content:
                  "False rejection can block a clinician in an emergency — OTP step-up and fallback paths are mandatory. Template breach is irreversible. Matching bias needs human review on borderline scores.",
              },
              {
                title: "Security Data Governance",
                content:
                  "All authentication events feeding analytics are structured, timestamped and auditable. Access to raw security data is restricted to the Administrator role only.",
              },
            ].map((section, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <MangaPanel style={{ padding: 32, marginBottom: 16 }}>
                  <h3
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      marginBottom: 12,
                    }}
                  >
                    {section.title}
                  </h3>
                  <p
                    style={{
                      color: T.muted,
                      fontSize: 14.5,
                      lineHeight: 1.75,
                    }}
                  >
                    {section.content}
                  </p>
                </MangaPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER: ITERATIONS
  // ═══════════════════════════════════════════════════════════════════

  if (view === "iterations") {
    const iterations = [
      {
        version: "V1",
        feedback: "Feels like a checkbox — I would not trust this with patient records.",
        source: "Nurse Kavindi Silva",
        change:
          "Replaced binary pass/fail with multi-factor risk breakdown and visible weights.",
      },
      {
        version: "V2",
        feedback: "A ward nurse and a system admin must not share one console.",
        source: "Dr. S. Wickrama",
        change:
          "Role-gated portal: clinical records vs administrator audit and staff directory.",
      },
      {
        version: "V3",
        feedback: "Where is consent? What stops infinite retries at 03:00?",
        source: "IT Security — R. Fernando",
        change:
          "Consent gate, OTP step-up, failed-attempt scoring, ethics panel, iteration log.",
      },
      {
        version: "V4",
        feedback:
          "The dashboard has no real data behind it — how do we know it's not fake?",
        source: "Hospital Director",
        change:
          "Introduced persistent IndexedDB security event database driving all analytics, incidents and insights from real authentication attempts.",
      },
      {
        version: "V5",
        feedback: "Navigating back and forth is confusing and inconsistent.",
        source: "Receptionist — T. Silva",
        change:
          "Unified navigation architecture with authenticated sidebar, breadcrumbs, and professional mobile menu system.",
      },
    ];

    return (
      <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <PublicTopNav />

          <div style={{ maxWidth: 800, margin: "0 auto", padding: "64px 32px 100px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <GitBranch size={28} color={T.white} />
              <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em" }}>
                Iteration and Feedback Log
              </h1>
            </div>
            <p style={{ color: T.muted, marginBottom: 44, lineHeight: 1.7, fontSize: 15 }}>
              Development history inside the product — each release driven by named end-user
              feedback.
            </p>

            {iterations.map((iter, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <MangaPanel style={{ padding: 32, marginBottom: 18 }}>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "5px 14px",
                      borderRadius: 2,
                      border: `1px solid ${T.line}`,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      marginBottom: 18,
                    }}
                  >
                    {iter.version}
                  </div>

                  <p
                    style={{
                      fontSize: 16,
                      fontStyle: "italic",
                      lineHeight: 1.65,
                      marginBottom: 12,
                    }}
                  >
                    "{iter.feedback}"
                  </p>

                  <p style={{ fontSize: 12, color: T.dim, marginBottom: 16 }}>
                    — {iter.source}
                  </p>

                  <p
                    style={{
                      fontSize: 14,
                      color: T.white,
                      lineHeight: 1.6,
                      padding: "14px 18px",
                      background: T.void,
                      border: `1px solid ${T.line2}`,
                      borderRadius: 2,
                      borderLeft: `3px solid ${T.white}`,
                    }}
                  >
                    → {iter.change}
                  </p>
                </MangaPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}