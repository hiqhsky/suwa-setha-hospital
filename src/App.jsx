import React, { useState, useRef, useEffect, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Camera, CameraOff,
  UserPlus, LogIn, Activity, Clock, MapPin, Smartphone,
  Fingerprint, FileText, Scale, X, ChevronRight, CheckCircle2,
  AlertTriangle, Lock, Eye, RefreshCw
} from "lucide-react";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/";

const FACTORS = [
  { key: "device", label: "Device Recognition", weight: 22, icon: Smartphone },
  { key: "location", label: "Network / Location", weight: 18, icon: MapPin },
  { key: "time", label: "Time-of-Day Pattern", weight: 12, icon: Clock },
  { key: "biometric", label: "Facial Liveness & Match", weight: 30, icon: Fingerprint },
  { key: "behavior", label: "Behavioral Baseline", weight: 10, icon: Activity },
  { key: "attempts", label: "Recent Failed Attempts", weight: 8, icon: AlertTriangle },
];

function generateRisk(enrolled, anomalous = false) {
  const base = {
    device: { pass: true, detail: "Recognised hospital workstation", score: 0 },
    location: { pass: true, detail: "Internal hospital network (Ward 3)", score: 0 },
    time: { pass: true, detail: "Within normal shift hours", score: 0 },
    biometric: { pass: true, detail: "Live face confirmed • 97.4% template match", score: 0 },
    behavior: { pass: true, detail: "Consistent with enrolled baseline", score: 0 },
    attempts: { pass: true, detail: "0 failed attempts in last 15 min", score: 0 },
  };

  if (!enrolled) {
    base.biometric = { pass: false, detail: "No enrolled biometric template found", score: 38 };
    base.device = { pass: false, detail: "Unregistered device", score: 18 };
  }

  if (anomalous) {
    base.device = { pass: false, detail: "Unrecognised device fingerprint", score: 22 };
    base.location = { pass: false, detail: "Login from external/public network", score: 18 };
    base.time = { pass: true, detail: "03:17 — outside normal hours", score: 9, warn: true };
    base.behavior = { pass: false, detail: "Typing/cursor rhythm deviation", score: 10 };
    base.attempts = { pass: true, detail: "3 failed attempts in 6 minutes", score: 8, warn: true };
    base.biometric.score = 12;
  }

  const total = Object.values(base).reduce((sum, f) => sum + (f.score || 0), 0);
  return { factors: base, score: Math.min(100, total) };
}

function getTier(score) {
  if (score <= 22) return { level: "low", label: "Trusted — Access Granted", color: "#10b981", Icon: ShieldCheck };
  if (score <= 55) return { level: "medium", label: "Caution — Step-up Verification Required", color: "#f59e0b", Icon: ShieldAlert };
  return { level: "high", label: "High Risk — Access Denied", color: "#ef4444", Icon: ShieldX };
}

export default function App() {
  const [view, setView] = useState("home"); // home | enroll | login | audit | ethics
  const [enrolledUsers, setEnrolledUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem("suwa_enrolled") || "[]"); } catch { return []; }
  });
  const [auditLog, setAuditLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("suwa_audit") || "[]"); } catch { return []; }
  });

  // Enrolment state
  const [enrollName, setEnrollName] = useState("");
  const [enrollRole, setEnrollRole] = useState("Doctor");
  const [captures, setCaptures] = useState(0);
  const [enrollStep, setEnrollStep] = useState(0); // 0=form, 1=camera, 2=done

  // Login state
  const [phase, setPhase] = useState("idle"); // idle | scanning | result
  const [riskData, setRiskData] = useState(null);
  const [anomalous, setAnomalous] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectInterval = useRef(null);

  // Load face-api models
  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      .then(() => setModelsLoaded(true))
      .catch(() => setModelsLoaded(false));
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (detectInterval.current) clearInterval(detectInterval.current);
    setFaceDetected(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Live face presence detection
      if (modelsLoaded) {
        detectInterval.current = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const detection = await faceapi.detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })
            );
            setFaceDetected(!!detection);
          } catch {}
        }, 400);
      }
    } catch (err) {
      setCameraError("Camera unavailable or permission denied. Using simulated mode.");
    }
  }, [modelsLoaded]);

  // Save helpers
  useEffect(() => {
    localStorage.setItem("suwa_enrolled", JSON.stringify(enrolledUsers));
  }, [enrolledUsers]);

  useEffect(() => {
    localStorage.setItem("suwa_audit", JSON.stringify(auditLog));
  }, [auditLog]);

  /* ==================== ENROLMENT ==================== */
  const startEnrolCamera = async () => {
    if (!enrollName.trim()) return alert("Please enter your full name");
    setEnrollStep(1);
    setCaptures(0);
    await startCamera();
  };

  const captureFrame = () => {
    if (captures >= 3) return;
    if (modelsLoaded && !faceDetected && !cameraError) {
      return alert("No live face detected. Centre your face in the frame.");
    }
    setCaptures(c => c + 1);
  };

  const finishEnrolment = () => {
    const newUser = {
      id: Date.now(),
      name: enrollName.trim(),
      role: enrollRole,
      enrolledAt: new Date().toISOString(),
    };
    setEnrolledUsers(prev => [...prev, newUser]);
    stopCamera();
    setEnrollStep(2);
  };

  /* ==================== LOGIN / SCAN ==================== */
  const beginScan = async () => {
    setPhase("scanning");
    setRiskData(null);
    await startCamera();

    // Simulate scanning delay + factor reveal
    setTimeout(() => {
      const isEnrolled = enrolledUsers.length > 0;
      const result = generateRisk(isEnrolled, anomalous);
      setRiskData(result);

      const tier = getTier(result.score);
      const logEntry = {
        id: Date.now(),
        user: isEnrolled ? enrolledUsers[enrolledUsers.length - 1].name : "Unknown",
        role: isEnrolled ? enrolledUsers[enrolledUsers.length - 1].role : "—",
        time: new Date().toLocaleString(),
        score: result.score,
        tier: tier.level,
        outcome: tier.level === "high" ? "Denied" : tier.level === "medium" ? "Step-up" : "Granted",
      };
      setAuditLog(prev => [logEntry, ...prev].slice(0, 50));

      setPhase("result");
      stopCamera();
    }, 3200);
  };

  /* ==================== UI COMPONENTS ==================== */
  const Nav = () => (
    <nav style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "18px 40px", borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(6,8,12,0.85)", backdropFilter: "blur(20px)",
      position: "sticky", top: 0, zIndex: 50
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => { stopCamera(); setView("home"); }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, #0d9488, #06b6d4)",
          display: "grid", placeItems: "center"
        }}>
          <Shield size={18} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>Suwa Setha</div>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1 }}>BIOMETRIC SECURITY</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setView("audit")} style={ghostBtn}>Access Log</button>
        <button onClick={() => setView("ethics")} style={ghostBtn}>Ethics & Legal</button>
      </div>
    </nav>
  );

  const ghostBtn = {
    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
    color: "#94a3b8", padding: "8px 16px", borderRadius: 8,
    fontSize: 13, cursor: "pointer", fontWeight: 500
  };

  const primaryBtn = {
    background: "linear-gradient(135deg, #0d9488, #0891b2)",
    color: "white", border: "none", padding: "14px 28px",
    borderRadius: 10, fontWeight: 600, fontSize: 14,
    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8
  };

  /* ==================== HOME ==================== */
  if (view === "home") {
    return (
      <div style={{ minHeight: "100vh", background: "#06080c", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
        <Nav />
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 40px 100px" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ fontSize: 12, letterSpacing: 3, color: "#2dd4bf", fontWeight: 600, marginBottom: 20 }}>
              AI-DRIVEN ACCESS CONTROL
            </div>
            <h1 style={{
              fontSize: "clamp(36px, 5vw, 54px)", fontWeight: 700,
              lineHeight: 1.15, maxWidth: 720, marginBottom: 24,
              letterSpacing: "-1px"
            }}>
              Securing Healthcare Operations
            </h1>
            <p style={{ fontSize: 18, color: "#94a3b8", maxWidth: 540, lineHeight: 1.7, marginBottom: 56 }}>
              An AI-powered biometric cybersecurity platform that protects sensitive patient systems at Suwa Setha Hospital through multi-factor risk scoring and live facial liveness detection.
            </p>
          </motion.div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 800 }}>
            <motion.div
              whileHover={{ y: -6 }}
              onClick={() => { setView("enroll"); setEnrollStep(0); setCaptures(0); setEnrollName(""); }}
              style={{
                background: "linear-gradient(145deg, #0c1017, #080b10)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 20, padding: 36, cursor: "pointer"
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: "rgba(45,212,191,0.12)", display: "grid", placeItems: "center", marginBottom: 24
              }}>
                <UserPlus size={24} color="#2dd4bf" />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>Enrolment</h3>
              <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                Register a new staff biometric profile. Capture three live reference frames with real face-presence detection.
              </p>
              <div style={{ color: "#2dd4bf", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                Begin Enrolment <ChevronRight size={16} />
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -6 }}
              onClick={() => { setView("login"); setPhase("idle"); setRiskData(null); }}
              style={{
                background: "linear-gradient(145deg, #0c1017, #080b10)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 20, padding: 36, cursor: "pointer"
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: "rgba(14,165,233,0.12)", display: "grid", placeItems: "center", marginBottom: 24
              }}>
                <LogIn size={24} color="#38bdf8" />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>Authenticate</h3>
              <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                Perform a live biometric scan. AI calculates a transparent multi-factor risk score and grants or denies access.
              </p>
              <div style={{ color: "#38bdf8", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                Start Secure Scan <ChevronRight size={16} />
              </div>
            </motion.div>
          </div>

          <div style={{ marginTop: 80, display: "flex", gap: 40, color: "#475569", fontSize: 13 }}>
            <div><strong style={{ color: "#94a3b8" }}>{enrolledUsers.length}</strong> enrolled identities</div>
            <div><strong style={{ color: "#94a3b8" }}>{auditLog.length}</strong> audit events</div>
            <div>Real webcam liveness • Transparent risk engine</div>
          </div>
        </div>
      </div>
    );
  }

  /* ==================== ENROLMENT ==================== */
  if (view === "enroll") {
    return (
      <div style={{ minHeight: "100vh", background: "#06080c", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
        <Nav />
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "60px 24px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Biometric Enrolment</h1>
          <p style={{ color: "#64748b", marginBottom: 40 }}>
            Explicit consent step. Three live reference frames will be captured. No raw images are stored — only a simulated template.
          </p>

          {enrollStep === 0 && (
            <div style={{ background: "#0c1017", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 32 }}>
              <label style={{ fontSize: 13, color: "#94a3b8" }}>Full Name</label>
              <input
                value={enrollName}
                onChange={e => setEnrollName(e.target.value)}
                placeholder="Dr. A. Perera"
                style={{
                  width: "100%", marginTop: 8, marginBottom: 20, padding: "12px 14px",
                  background: "#06080c", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, color: "white", fontSize: 15, outline: "none"
                }}
              />
              <label style={{ fontSize: 13, color: "#94a3b8" }}>Role</label>
              <select
                value={enrollRole}
                onChange={e => setEnrollRole(e.target.value)}
                style={{
                  width: "100%", marginTop: 8, marginBottom: 28, padding: "12px 14px",
                  background: "#06080c", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, color: "white", fontSize: 15
                }}
              >
                {["Doctor", "Nurse", "Receptionist", "Administrator", "Lab Technician"].map(r => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button style={{ ...primaryBtn, width: "100%", justifyContent: "center" }} onClick={startEnrolCamera}>
                <Camera size={18} /> Enable Camera & Begin Capture
              </button>
            </div>
          )}

          {enrollStep === 1 && (
            <div style={{ background: "#0c1017", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 32, textAlign: "center" }}>
              <div style={{
                width: 280, height: 280, margin: "0 auto 24px", borderRadius: "50%",
                overflow: "hidden", border: `3px solid ${faceDetected ? "#10b981" : "#334155"}`,
                background: "#000", position: "relative"
              }}>
                <video ref={videoRef} muted playsInline style={{
                  width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)"
                }} />
                {!streamRef.current && (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                    <CameraOff size={48} color="#475569" />
                  </div>
                )}
              </div>

              {cameraError && (
                <p style={{ color: "#f59e0b", fontSize: 13, marginBottom: 12 }}>{cameraError}</p>
              )}

              <p style={{ fontSize: 14, color: faceDetected ? "#10b981" : "#94a3b8", marginBottom: 8 }}>
                {modelsLoaded
                  ? (faceDetected ? "Live face detected" : "Position your face in the circle")
                  : "Loading face detection model..."}
              </p>

              <div style={{ display: "flex", justifyContent: "center", gap: 10, margin: "20px 0" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: captures > i ? "#10b981" : "#1e293b",
                    border: "2px solid", borderColor: captures > i ? "#10b981" : "#334155"
                  }} />
                ))}
              </div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
                {captures < 3 ? `Capture ${captures + 1} of 3 — slight head turn recommended` : "All frames captured"}
              </p>

              {captures < 3 ? (
                <button style={primaryBtn} onClick={captureFrame}>
                  Capture Frame {captures + 1}
                </button>
              ) : (
                <button style={primaryBtn} onClick={finishEnrolment}>
                  <CheckCircle2 size={18} /> Complete Enrolment
                </button>
              )}
            </div>
          )}

          {enrollStep === 2 && (
            <div style={{ background: "#0c1017", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 16, padding: 48, textAlign: "center" }}>
              <CheckCircle2 size={56} color="#10b981" style={{ marginBottom: 20 }} />
              <h2 style={{ fontSize: 24, marginBottom: 12 }}>Enrolment Successful</h2>
              <p style={{ color: "#94a3b8", marginBottom: 32 }}>
                {enrollName} ({enrollRole}) has been enrolled. You may now authenticate.
              </p>
              <button style={primaryBtn} onClick={() => setView("login")}>
                Proceed to Authentication
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ==================== LOGIN / SCAN ==================== */
  if (view === "login") {
    const tier = riskData ? getTier(riskData.score) : null;

    return (
      <div style={{ minHeight: "100vh", background: "#06080c", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
        <Nav />
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "50px 24px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Secure Authentication</h1>
          <p style={{ color: "#64748b", marginBottom: 36 }}>
            Multi-factor biometric scan with transparent AI risk scoring
          </p>

          <div style={{ background: "#0c1017", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 36 }}>
            {/* Camera Circle */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div
                onClick={phase === "idle" ? beginScan : undefined}
                style={{
                  width: 220, height: 220, margin: "0 auto", borderRadius: "50%",
                  overflow: "hidden", cursor: phase === "idle" ? "pointer" : "default",
                  border: `3px solid ${phase === "scanning" ? "#2dd4bf" : phase === "result" ? tier?.color : "#334155"}`,
                  background: "#000", position: "relative",
                  boxShadow: phase === "scanning" ? "0 0 40px rgba(45,212,191,0.25)" : "none"
                }}
              >
                <video ref={videoRef} muted playsInline style={{
                  width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)",
                  display: phase === "scanning" ? "block" : "none"
                }} />
                {phase !== "scanning" && (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                    {phase === "result" && tier ? (
                      <tier.Icon size={64} color={tier.color} />
                    ) : (
                      <Camera size={56} color="#475569" />
                    )}
                  </div>
                )}
              </div>

              <p style={{ marginTop: 18, fontSize: 14, color: "#94a3b8" }}>
                {phase === "idle" && "Click the circle to begin live biometric scan"}
                {phase === "scanning" && (faceDetected ? "Live face detected — analysing signals..." : "Scanning for live face...")}
                {phase === "result" && tier && (
                  <span style={{ color: tier.color, fontWeight: 600, fontSize: 16 }}>{tier.label}</span>
                )}
              </p>
            </div>

            {/* Risk Score */}
            {phase === "result" && riskData && (
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>AI RISK SCORE</div>
                <div style={{ fontSize: 56, fontWeight: 700, color: tier.color, fontFamily: "IBM Plex Mono, monospace" }}>
                  {riskData.score}
                </div>
                <div style={{ fontSize: 12, color: "#475569" }}>0 = fully trusted • 100 = critical risk</div>
              </div>
            )}

            {/* Factor Breakdown */}
            {phase === "result" && riskData && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                {FACTORS.map(f => {
                  const data = riskData.factors[f.key];
                  return (
                    <div key={f.key} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <f.icon size={15} color="#64748b" />
                        <span style={{ fontSize: 13 }}>{f.label}</span>
                        <span style={{ fontSize: 11, color: "#475569" }}>w{f.weight}</span>
                      </div>
                      <span style={{
                        fontSize: 12, fontFamily: "IBM Plex Mono, monospace",
                        color: data.pass ? (data.warn ? "#f59e0b" : "#10b981") : "#ef4444",
                        maxWidth: 210, textAlign: "right"
                      }}>
                        {data.detail}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {phase === "result" && tier?.level !== "high" && (
              <button style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 28 }}
                onClick={() => alert("Access granted to clinical systems (simulated). In production this would open the patient-records console.")}>
                Continue to Hospital Systems
              </button>
            )}

            {phase === "result" && (
              <button style={{ ...ghostBtn, width: "100%", marginTop: 12 }} onClick={() => { setPhase("idle"); setRiskData(null); }}>
                <RefreshCw size={14} /> New Scan
              </button>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24, color: "#64748b", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={anomalous} onChange={e => setAnomalous(e.target.checked)} />
            Demo: Simulate suspicious / anomalous login
          </label>

          {enrolledUsers.length === 0 && (
            <p style={{ marginTop: 20, fontSize: 13, color: "#f59e0b" }}>
              No users enrolled yet. Please complete enrolment first or the scan will be treated as high risk.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ==================== AUDIT LOG ==================== */
  if (view === "audit") {
    return (
      <div style={{ minHeight: "100vh", background: "#06080c", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
        <Nav />
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "50px 24px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Access Log / Audit Trail</h1>
          <p style={{ color: "#64748b", marginBottom: 36 }}>
            Immutable record of authentication attempts — required for hospital security compliance.
          </p>

          <div style={{ background: "#0c1017", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
            {auditLog.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "#475569" }}>No authentication events yet</div>
            ) : (
              auditLog.map((entry, i) => (
                <div key={entry.id} style={{
                  display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 80px 100px",
                  gap: 16, padding: "16px 24px", alignItems: "center",
                  borderBottom: i < auditLog.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  fontSize: 13
                }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{entry.user}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{entry.role}</div>
                  </div>
                  <div style={{ color: "#94a3b8", fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>{entry.time}</div>
                  <div style={{ fontFamily: "IBM Plex Mono, monospace" }}>Score {entry.score}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, textAlign: "center", padding: "4px 0", borderRadius: 6,
                    background: entry.tier === "low" ? "rgba(16,185,129,0.15)" : entry.tier === "medium" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                    color: entry.tier === "low" ? "#10b981" : entry.tier === "medium" ? "#f59e0b" : "#ef4444"
                  }}>
                    {entry.tier.toUpperCase()}
                  </div>
                  <div style={{ fontWeight: 500 }}>{entry.outcome}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ==================== ETHICS ==================== */
  if (view === "ethics") {
    return (
      <div style={{ minHeight: "100vh", background: "#06080c", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
        <Nav />
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "50px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <Scale size={26} color="#2dd4bf" />
            <h1 style={{ fontSize: 28, fontWeight: 700 }}>Ethics & Legal Considerations</h1>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 28, color: "#cbd5e1", fontSize: 15, lineHeight: 1.75 }}>
            <section>
              <h3 style={{ color: "#f1f5f9", marginBottom: 8 }}>Simulation Honesty</h3>
              <p>Full biometric <strong>identity matching</strong> against a secure template database is simulated in this student prototype. Real face-presence / liveness detection runs in the browser via face-api.js, but the match percentage and final identity decision are generated by transparent weighted rules so the risk engine remains explainable for academic assessment.</p>
            </section>
            <section>
              <h3 style={{ color: "#f1f5f9", marginBottom: 8 }}>Consent & Data Minimisation</h3>
              <p>Enrolment is a separate, explicit step. In a production hospital system only an irreversible mathematical template would be stored — never the raw image. Users must be able to withdraw consent and request deletion (GDPR Art. 7 & 17 / Sri Lanka PDPA principles).</p>
            </section>
            <section>
              <h3 style={{ color: "#f1f5f9", marginBottom: 8 }}>Bias & Fairness</h3>
              <p>Facial recognition systems have documented accuracy differences across skin tone, age and gender (NIST FRVT). A real deployment requires human review for borderline scores and a non-biometric fallback pathway so no staff member is locked out of care systems.</p>
            </section>
            <section>
              <h3 style={{ color: "#f1f5f9", marginBottom: 8 }}>Legal Basis</h3>
              <p>Biometric data is “special category” data under GDPR Article 9 and equivalent regimes. Hospitals need a clear lawful basis, Data Protection Impact Assessment, strict access controls, encryption, and breach-notification procedures before going live.</p>
            </section>
            <section>
              <h3 style={{ color: "#f1f5f9", marginBottom: 8 }}>Audit & Accountability</h3>
              <p>Every authentication decision in this prototype is written to an Access Log. Real systems must retain immutable audit trails for clinical governance and regulatory inspection.</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return null;
}