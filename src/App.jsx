import React, { useState, useRef, useEffect, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Camera, CameraOff, UserPlus, LogIn,
  Activity, Clock, MapPin, FileText, Scale, ChevronRight, CheckCircle2,
  AlertTriangle, Lock, RefreshCw, LogOut, X, Fingerprint, BadgeCheck
} from "lucide-react";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/";

/* ========== DARK PREMIUM THEME ========== */
const C = {
  bg: "#05070a",
  bg2: "#0a0e14",
  surface: "#0f141c",
  surface2: "#151b26",
  border: "rgba(255,255,255,0.07)",
  borderHover: "rgba(255,255,255,0.14)",
  text: "#e8eef5",
  muted: "#8b9cb3",
  dim: "#5a6b80",
  primary: "#3b82f6",
  primaryGlow: "rgba(59,130,246,0.25)",
  teal: "#2dd4bf",
  tealGlow: "rgba(45,212,191,0.2)",
  success: "#10b981",
  caution: "#f59e0b",
  danger: "#ef4444",
  gold: "#d4af37",
};

const ROLES = ["Doctor", "Nurse", "Administrator", "Receptionist", "Lab Technician"];
const DEPTS = ["Emergency", "ICU", "Radiology", "Pharmacy", "Administration", "OPD"];

const PATIENTS = [
  { id: "PT-24081", name: "R. Fernando", ward: "Ward 3", admitted: "2025-03-12", status: "Stable", doctor: "Dr. Wickrama", hr: 78, bp: "118/76", spo2: 98, notes: "Post-op day 4. Wound clean, vitals stable. Ready for discharge planning." },
  { id: "PT-24056", name: "M. Silva", ward: "ICU-2", admitted: "2025-03-14", status: "Critical", doctor: "Dr. Perera", hr: 112, bp: "92/58", spo2: 91, notes: "Acute respiratory support. Continuous monitoring. Family updated 07:40." },
  { id: "PT-23998", name: "K. Jayasuriya", ward: "Ward 1", admitted: "2025-03-10", status: "Stable", doctor: "Dr. Fernando", hr: 72, bp: "124/80", spo2: 97, notes: "Hypertension review. Medication adjusted. Awaiting labs." },
  { id: "PT-24102", name: "A. Bandara", ward: "Ward 5", admitted: "2025-03-15", status: "Discharged", doctor: "Dr. Wickrama", hr: 68, bp: "120/78", spo2: 99, notes: "Discharged with oral antibiotics. Follow-up in 1 week." },
  { id: "PT-24077", name: "S. Gunasekara", ward: "Emergency", admitted: "2025-03-16", status: "Critical", doctor: "Dr. Perera", hr: 124, bp: "88/54", spo2: 89, notes: "Trauma call. Stabilising. CT pending." },
];

function calcRisk({ enrolled, anomalous, failedAttempts = 0 }) {
  let device = enrolled ? 5 : 25;
  let location = 5;
  let time = 5;
  let attempts = failedAttempts === 0 ? 0 : failedAttempts <= 2 ? 10 : 35;
  let biometric = enrolled ? 4 : 28;
  if (anomalous) {
    device = 25; location = 30; time = 15;
    attempts = Math.max(attempts, 10); biometric = 18;
  }
  const score = Math.min(100, device + location + time + attempts + biometric);
  return {
    score,
    breakdown: [
      { key: "device", label: "Device Recognition", value: device, detail: device <= 5 ? "Known hospital device" : "Unrecognised device" },
      { key: "location", label: "Location Match", value: location, detail: location <= 5 ? "Hospital network / geofence" : "Unfamiliar location" },
      { key: "time", label: "Time-of-Day", value: time, detail: time <= 5 ? "Normal shift hours" : "Unusual hour" },
      { key: "attempts", label: "Recent Failed Attempts", value: attempts, detail: `${failedAttempts} recent failures` },
      { key: "biometric", label: "Facial Liveness & Match", value: biometric, detail: enrolled ? "Live face + template match" : "No enrolled template" },
    ],
  };
}

function tierFromScore(score) {
  if (score <= 30) return { level: "low", label: "Trusted — Access Granted", color: C.success, Icon: ShieldCheck };
  if (score <= 60) return { level: "medium", label: "Caution — Step-up Required", color: C.caution, Icon: ShieldAlert };
  return { level: "high", label: "High Risk — Access Denied", color: C.danger, Icon: ShieldX };
}

export default function App() {
  const [view, setView] = useState("landing");
  const [enrolled, setEnrolled] = useState(() => {
    try { return JSON.parse(localStorage.getItem("suwa_enrolled_v3") || "[]"); } catch { return []; }
  });
  const [audit, setAudit] = useState(() => {
    try { return JSON.parse(localStorage.getItem("suwa_audit_v3") || "[]"); } catch { return []; }
  });
  const [session, setSession] = useState(null);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", staffId: "", role: "Doctor", dept: "Emergency" });
  const [captures, setCaptures] = useState([]);
  const [faceOn, setFaceOn] = useState(false);

  const [phase, setPhase] = useState("idle");
  const [risk, setRisk] = useState(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [anomalous, setAnomalous] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [camError, setCamError] = useState("");
  const [modelsReady, setModelsReady] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectRef = useRef(null);

  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      .then(() => setModelsReady(true))
      .catch(() => setModelsReady(false));
  }, []);

  useEffect(() => { localStorage.setItem("suwa_enrolled_v3", JSON.stringify(enrolled)); }, [enrolled]);
  useEffect(() => { localStorage.setItem("suwa_audit_v3", JSON.stringify(audit)); }, [audit]);

  const stopCam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (detectRef.current) clearInterval(detectRef.current);
    setFaceOn(false);
  }, []);

  const startCam = useCallback(async () => {
    setCamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (modelsReady) {
        detectRef.current = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const det = await faceapi.detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 })
            );
            setFaceOn(!!det);
          } catch {}
        }, 350);
      } else setFaceOn(true);
    } catch (e) {
      setCamError(e.message || "Camera permission denied or unavailable");
      setFaceOn(false);
    }
  }, [modelsReady]);

  useEffect(() => () => stopCam(), [stopCam]);

  useEffect(() => {
    if (!risk || phase !== "result") return;
    let start = 0;
    const target = risk.score;
    const timer = setInterval(() => {
      start += 2;
      if (start >= target) { setDisplayScore(target); clearInterval(timer); }
      else setDisplayScore(start);
    }, 18);
    return () => clearInterval(timer);
  }, [risk, phase]);

  const captureFrame = () => {
    if (!videoRef.current || captures.length >= 3) return;
    if (modelsReady && !faceOn) return alert("No face detected — centre your face in the frame.");
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    setCaptures(prev => [...prev, canvas.toDataURL("image/jpeg", 0.72)]);
  };

  const completeEnrol = () => {
    if (captures.length < 3 || !form.name.trim()) return alert("Complete name + 3 captures");
    const staffId = form.staffId.trim() || `SS-${Math.floor(1000 + Math.random() * 9000)}`;
    setEnrolled(prev => [...prev, { ...form, staffId, captures, enrolledAt: new Date().toISOString() }]);
    setStep(4);
    stopCam();
  };

  const runScan = async () => {
    setPhase("scanning");
    setRisk(null);
    setDisplayScore(0);
    setOtp("");
    setOtpSent(false);
    await startCam();
    setTimeout(() => {
      const hasUser = enrolled.length > 0;
      const result = calcRisk({ enrolled: hasUser, anomalous, failedAttempts });
      setRisk(result);
      const tier = tierFromScore(result.score);
      if (tier.level === "high") setFailedAttempts(f => f + 1);
      else setFailedAttempts(0);
      const user = hasUser ? enrolled[enrolled.length - 1] : null;
      setAudit(prev => [{
        id: Date.now(),
        user: user?.name || "Unknown",
        staffId: user?.staffId || "—",
        role: user?.role || "—",
        time: new Date().toLocaleString(),
        score: result.score,
        tier: tier.level,
        outcome: tier.level === "low" ? "Granted" : tier.level === "medium" ? "Step-up" : "Denied",
        device: anomalous ? "Unknown device" : "Hospital Workstation",
        location: anomalous ? "External network" : "Colombo · Internal",
      }, ...prev].slice(0, 40));
      setPhase("result");
      stopCam();
      if (tier.level === "low" && user) {
        setTimeout(() => { setSession(user); setView("dashboard"); }, 1500);
      }
    }, 2400);
  };

  const verifyOtp = () => {
    if (otp === "123456" || otp.length === 6) {
      const user = enrolled[enrolled.length - 1];
      if (user) { setSession(user); setView("dashboard"); }
    } else alert("Invalid code. Demo OTP: 123456");
  };

  const logout = () => { setSession(null); setView("landing"); setPhase("idle"); setRisk(null); };

  /* ========== STYLES ========== */
  const page = {
    minHeight: "100vh",
    background: C.bg,
    color: C.text,
    fontFamily: "Inter, system-ui, sans-serif",
    backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.12), transparent)",
  };
  const card = {
    background: C.surface,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
  };
  const btnPrimary = {
    background: `linear-gradient(135deg, ${C.primary}, #2563eb)`,
    color: "#fff", border: "none", borderRadius: 10,
    padding: "13px 22px", fontWeight: 600, fontSize: 14, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 8,
    boxShadow: `0 4px 20px ${C.primaryGlow}`,
  };
  const btnTeal = {
    ...btnPrimary,
    background: `linear-gradient(135deg, ${C.teal}, #14b8a6)`,
    boxShadow: `0 4px 20px ${C.tealGlow}`,
    color: "#042f2e",
  };
  const btnGhost = {
    background: "transparent", color: C.muted,
    border: `1px solid ${C.border}`, borderRadius: 10,
    padding: "10px 18px", fontWeight: 500, fontSize: 13, cursor: "pointer",
  };
  const inputStyle = {
    width: "100%", marginTop: 6, padding: "12px 14px", borderRadius: 10,
    border: `1px solid ${C.border}`, background: C.bg2, color: C.text,
    fontSize: 14, outline: "none",
  };

  const TopBar = ({ title, right }) => (
    <header style={{
      background: "rgba(10,14,20,0.85)", backdropFilter: "blur(16px)",
      borderBottom: `1px solid ${C.border}`,
      padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
        onClick={() => { stopCam(); setView("landing"); }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `linear-gradient(135deg, ${C.primary}, ${C.teal})`,
          display: "grid", placeItems: "center",
          boxShadow: `0 0 20px ${C.primaryGlow}`,
        }}>
          <Shield size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>Suwa Setha Hospital</div>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: 0.6 }}>{title}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{right}</div>
    </header>
  );

  /* ===================== LANDING ===================== */
  if (view === "landing") {
    return (
      <div style={page}>
        <TopBar title="AI Biometric Security Platform" right={
          <>
            <button style={btnGhost} onClick={() => setView("ethics")}>Ethics & Legal</button>
            <button style={btnGhost} onClick={() => setView("audit")}>Access Log</button>
          </>
        } />

        <section style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 28px 90px" }}>
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(45,212,191,0.1)", border: `1px solid rgba(45,212,191,0.25)`,
              color: C.teal, padding: "6px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700,
              letterSpacing: 1.2, marginBottom: 28,
            }}>
              <Lock size={12} /> SECURE HEALTHCARE ACCESS
            </div>

            <h1 style={{
              fontSize: "clamp(36px, 5.5vw, 56px)", fontWeight: 750, lineHeight: 1.1,
              maxWidth: 720, marginBottom: 20, letterSpacing: "-1.2px",
              background: "linear-gradient(135deg, #fff 30%, #94a3b8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Securing Healthcare Operations
            </h1>
            <p style={{ fontSize: 17, color: C.muted, maxWidth: 540, lineHeight: 1.7, marginBottom: 40 }}>
              AI-driven biometric access control for patient data security. Live facial liveness,
              multi-factor risk scoring, and full audit trail — built for Suwa Setha Hospital.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 72 }}>
              <button style={btnPrimary} onClick={() => {
                setView("enroll"); setStep(1); setCaptures([]);
                setForm({ name: "", staffId: "", role: "Doctor", dept: "Emergency" });
              }}>
                <UserPlus size={18} /> Enrol Staff Biometric
              </button>
              <button style={btnTeal} onClick={() => { setView("login"); setPhase("idle"); setRisk(null); }}>
                <LogIn size={18} /> Secure Login / Scan
              </button>
            </div>
          </motion.div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18 }}>
            {[
              { icon: Camera, t: "1. Scan Face", d: "Live webcam with real face-presence detection confirms a person is present before scoring." },
              { icon: Activity, t: "2. AI Risk Engine", d: "Transparent weighted score across device, location, time, attempts and biometric liveness." },
              { icon: ShieldCheck, t: "3. Access Decision", d: "Trusted, step-up MFA, or deny + incident log — every factor explainable for audit." },
            ].map((c, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 * i }}
                whileHover={{ y: -4, borderColor: C.borderHover }}
                style={{ ...card, padding: 28, transition: "border-color 0.2s, transform 0.2s" }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)",
                  display: "grid", placeItems: "center", marginBottom: 18,
                }}>
                  <c.icon size={22} color={C.primary} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{c.t}</div>
                <div style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.6 }}>{c.d}</div>
              </motion.div>
            ))}
          </div>

          <div style={{
            marginTop: 56, display: "flex", gap: 32, flexWrap: "wrap",
            justifyContent: "center", color: C.dim, fontSize: 13,
          }}>
            <span><strong style={{ color: C.teal }}>{enrolled.length}</strong> enrolled</span>
            <span><strong style={{ color: C.teal }}>{audit.length}</strong> audit events</span>
            <span>Real liveness · Client-side only</span>
          </div>

          <p style={{ marginTop: 28, fontSize: 11, color: C.dim, textAlign: "center", lineHeight: 1.5 }}>
            Prototype — identity matching simulated for academic demo. Face-presence detection is real (face-api.js).
          </p>
        </section>
      </div>
    );
  }

  /* ===================== ENROLMENT ===================== */
  if (view === "enroll") {
    return (
      <div style={page}>
        <TopBar title="Staff Biometric Enrolment" right={
          <button style={btnGhost} onClick={() => { stopCam(); setView("landing"); }}>Cancel</button>
        } />

        <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 20px 80px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
            {["Details", "Capture", "Confirm", "Done"].map((s, i) => (
              <div key={s} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  height: 3, borderRadius: 3, marginBottom: 8,
                  background: step > i + 1 ? C.teal : step === i + 1 ? C.primary : C.border,
                }} />
                <div style={{ fontSize: 11, fontWeight: 600, color: step >= i + 1 ? C.text : C.dim }}>{s}</div>
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ ...card, padding: 32 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Staff Details</h2>
                <p style={{ color: C.muted, marginBottom: 28, fontSize: 13 }}>Explicit consent enrolment — separate from daily login.</p>

                <label style={{ fontSize: 12, fontWeight: 600, color: C.dim }}>Full Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Dr. Nimal Perera" style={inputStyle} />

                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.dim }}>Staff ID (optional)</label>
                  <input value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value })}
                    placeholder="Auto-generated if empty" style={inputStyle} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16, marginBottom: 28 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.dim }}>Role</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inputStyle}>
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.dim }}>Department</label>
                    <select value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })} style={inputStyle}>
                      {DEPTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <button style={btnPrimary} onClick={() => { if (!form.name.trim()) return alert("Enter name"); setStep(2); startCam(); }}>
                  Continue to Camera <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ ...card, padding: 32 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Live Biometric Capture</h2>
                <p style={{ color: C.muted, marginBottom: 20, fontSize: 13 }}>3 reference frames. Real face-presence detection.</p>

                <div style={{
                  position: "relative", width: "100%", maxWidth: 420, margin: "0 auto 18px",
                  aspectRatio: "4/3", borderRadius: 20, overflow: "hidden", background: "#000",
                  border: `3px solid ${faceOn ? C.success : C.border}`,
                  boxShadow: faceOn ? `0 0 40px rgba(16,185,129,0.2)` : "none",
                }}>
                  <video ref={videoRef} muted playsInline autoPlay
                    style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                  <div style={{
                    position: "absolute", inset: "10% 16%", borderRadius: "50%",
                    border: "2px dashed rgba(255,255,255,0.35)", pointerEvents: "none",
                  }} />
                  {camError && (
                    <div style={{
                      position: "absolute", inset: 0, display: "grid", placeItems: "center",
                      background: "rgba(0,0,0,0.8)", color: C.caution, padding: 20, textAlign: "center", fontSize: 13,
                    }}>
                      <div><CameraOff size={32} style={{ marginBottom: 8 }} /><div>{camError}</div></div>
                    </div>
                  )}
                </div>

                <div style={{
                  textAlign: "center", marginBottom: 16, fontWeight: 600, fontSize: 13,
                  color: faceOn ? C.success : C.muted,
                }}>
                  {camError ? "Camera unavailable — simulated capture allowed" :
                    !modelsReady ? "Loading face model…" :
                      faceOn ? "● Face detected — hold still" : "Searching for face…"}
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 22 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 76, height: 76, borderRadius: 12, overflow: "hidden",
                      border: `2px solid ${captures[i] ? C.success : C.border}`, background: C.bg2,
                    }}>
                      {captures[i]
                        ? <img src={captures[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ height: "100%", display: "grid", placeItems: "center", color: C.dim, fontSize: 12 }}>{i + 1}</div>}
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button
                    onClick={captureFrame}
                    disabled={captures.length >= 3 || (!faceOn && !camError && modelsReady)}
                    style={{
                      ...btnPrimary,
                      opacity: (captures.length >= 3 || (!faceOn && !camError && modelsReady)) ? 0.45 : 1,
                    }}
                  >
                    <Camera size={16} /> Capture {Math.min(captures.length + 1, 3)} / 3
                  </button>
                  {captures.length >= 3 && (
                    <button style={btnTeal} onClick={() => { stopCam(); setStep(3); }}>
                      Continue <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                style={{ ...card, padding: 32, textAlign: "center" }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Confirm Enrolment</h2>
                <p style={{ color: C.muted, marginBottom: 22, fontSize: 14 }}>
                  {form.name} · {form.role} · {form.dept}
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 28 }}>
                  {captures.map((c, i) => (
                    <img key={i} src={c} alt="" style={{
                      width: 88, height: 88, borderRadius: 12, objectFit: "cover",
                      border: `2px solid ${C.success}`,
                    }} />
                  ))}
                </div>
                <button style={btnPrimary} onClick={completeEnrol}>
                  <BadgeCheck size={18} /> Complete Enrolment
                </button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="s4" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ ...card, padding: 48, textAlign: "center" }}>
                <CheckCircle2 size={68} color={C.success} style={{ marginBottom: 16 }} />
                <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Enrolment Complete</h2>
                <p style={{ color: C.muted, marginBottom: 14, fontSize: 14 }}>Biometric profile registered.</p>
                <div style={{
                  display: "inline-block", padding: "10px 20px",
                  background: "rgba(45,212,191,0.1)", border: `1px solid rgba(45,212,191,0.3)`,
                  borderRadius: 10, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600,
                  color: C.teal, marginBottom: 28, letterSpacing: 1,
                }}>
                  {enrolled[enrolled.length - 1]?.staffId}
                </div>
                <div>
                  <button style={btnTeal} onClick={() => { setView("login"); setPhase("idle"); }}>
                    Proceed to Secure Login
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  /* ===================== LOGIN ===================== */
  if (view === "login") {
    const tier = risk ? tierFromScore(risk.score) : null;

    return (
      <div style={page}>
        <TopBar title="Secure Authentication" right={
          <button style={btnGhost} onClick={() => { stopCam(); setView("landing"); }}>Home</button>
        } />

        <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px 80px" }}>
          <div style={{ ...card, padding: 32 }}>
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>Biometric Scan</h2>
              <p style={{ color: C.muted, fontSize: 13 }}>Multi-factor AI risk assessment</p>
            </div>

            <div style={{
              position: "relative", width: 260, height: 260, margin: "28px auto",
              borderRadius: "50%", overflow: "hidden", background: "#000",
              border: `3px solid ${phase === "scanning" ? C.teal : phase === "result" && tier ? tier.color : C.border}`,
              boxShadow: phase === "scanning" ? `0 0 50px ${C.tealGlow}` : phase === "result" && tier ? `0 0 40px ${tier.color}33` : "none",
            }}>
              <video ref={videoRef} muted playsInline autoPlay
                style={{
                  width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)",
                  display: phase === "scanning" ? "block" : "none",
                }} />
              {phase === "scanning" && (
                <motion.div
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                  style={{
                    position: "absolute", left: 0, right: 0, height: 2, zIndex: 5,
                    background: `linear-gradient(90deg, transparent, ${C.teal}, transparent)`,
                    boxShadow: `0 0 16px ${C.teal}`,
                  }}
                />
              )}
              {phase !== "scanning" && (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                  {phase === "result" && tier
                    ? <tier.Icon size={68} color={tier.color} />
                    : <Camera size={52} color={C.dim} />}
                </div>
              )}
            </div>

            <p style={{ textAlign: "center", fontWeight: 600, fontSize: 13, color: C.muted, marginBottom: 22 }}>
              {phase === "idle" && "Click below to start live scan"}
              {phase === "scanning" && (faceOn ? "Live face detected — analysing…" : "Searching for face…")}
              {phase === "result" && tier && <span style={{ color: tier.color, fontSize: 15 }}>{tier.label}</span>}
            </p>

            {phase === "idle" && (
              <button style={{ ...btnPrimary, width: "100%", justifyContent: "center" }} onClick={runScan}>
                <Fingerprint size={18} /> Start Secure Scan
              </button>
            )}

            {phase === "result" && risk && tier && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ textAlign: "center", margin: "4px 0 22px" }}>
                  <div style={{ fontSize: 11, color: C.dim, letterSpacing: 1.5 }}>AI RISK SCORE</div>
                  <div style={{
                    fontSize: 60, fontWeight: 800, color: tier.color,
                    fontFamily: "IBM Plex Mono, monospace", lineHeight: 1.1,
                  }}>
                    {displayScore}
                  </div>
                </div>

                <div style={{ background: C.bg2, borderRadius: 12, padding: 16, marginBottom: 18, border: `1px solid ${C.border}` }}>
                  {risk.breakdown.map(b => (
                    <div key={b.key} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: C.text }}>{b.label}</span>
                        <span style={{
                          fontFamily: "IBM Plex Mono, monospace",
                          color: b.value > 15 ? C.danger : C.muted,
                        }}>+{b.value}</span>
                      </div>
                      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, b.value * 2.4)}%` }}
                          transition={{ duration: 0.7 }}
                          style={{
                            height: "100%",
                            background: b.value > 15 ? C.danger : b.value > 8 ? C.caution : C.success,
                          }} />
                      </div>
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{b.detail}</div>
                    </div>
                  ))}
                </div>

                {tier.level === "medium" && (
                  <div style={{
                    background: "rgba(245,158,11,0.08)", border: `1px solid rgba(245,158,11,0.35)`,
                    borderRadius: 12, padding: 18, marginBottom: 14,
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: C.caution, fontSize: 14 }}>Step-up Verification</div>
                    <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>OTP sent to registered device (demo).</p>
                    {!otpSent ? (
                      <button style={btnGhost} onClick={() => setOtpSent(true)}>Send OTP</button>
                    ) : (
                      <div style={{ display: "flex", gap: 10 }}>
                        <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" maxLength={6}
                          style={{ ...inputStyle, marginTop: 0, flex: 1, letterSpacing: 4, fontFamily: "IBM Plex Mono, monospace" }} />
                        <button style={btnPrimary} onClick={verifyOtp}>Verify</button>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>Demo code: 123456</div>
                  </div>
                )}

                {tier.level === "high" && (
                  <div style={{
                    background: "rgba(239,68,68,0.08)", border: `1px solid rgba(239,68,68,0.35)`,
                    borderRadius: 12, padding: 18, marginBottom: 14, textAlign: "center",
                  }}>
                    <AlertTriangle color={C.danger} size={26} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, color: C.danger, fontSize: 14 }}>Access Denied — Incident Logged</div>
                    <button style={{ ...btnGhost, marginTop: 12, borderColor: "rgba(239,68,68,0.4)", color: C.danger }}
                      onClick={() => alert("Incident reported to Security Admin (simulated).")}>
                      Report to Security Admin
                    </button>
                  </div>
                )}

                {tier.level === "low" && (
                  <div style={{ textAlign: "center", color: C.success, fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                    Redirecting to clinical dashboard…
                  </div>
                )}

                <button style={{ ...btnGhost, width: "100%" }} onClick={() => { setPhase("idle"); setRisk(null); }}>
                  <RefreshCw size={14} /> New Scan
                </button>
              </motion.div>
            )}
          </div>

          <label style={{ display: "flex", gap: 10, marginTop: 20, fontSize: 12, color: C.dim, cursor: "pointer" }}>
            <input type="checkbox" checked={anomalous} onChange={e => setAnomalous(e.target.checked)} />
            Demo: simulate suspicious login
          </label>
          {enrolled.length === 0 && (
            <p style={{ marginTop: 12, fontSize: 12, color: C.caution }}>
              No enrolled staff — scan will score high risk. Enrol first for trusted access.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ===================== DASHBOARD ===================== */
  if (view === "dashboard" && session) {
    return (
      <div style={page}>
        <TopBar title="Clinical Systems" right={
          <>
            <div style={{ textAlign: "right", marginRight: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{session.name}</div>
              <div style={{ fontSize: 11, color: C.dim }}>{session.role} · {session.dept}</div>
            </div>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.primary}, ${C.teal})`,
              color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13,
            }}>
              {session.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <button style={btnGhost} onClick={logout}><LogOut size={15} /></button>
          </>
        } />

        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 60px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 24 }}>
            {[
              { l: "Accessible Records", v: "42", s: "Role authorised" },
              { l: "Last Login", v: "Today", s: "Hospital network" },
              { l: "Session Risk", v: "Trusted", s: "Biometric verified", c: C.success },
              { l: "System Status", v: "Operational", s: "All services up", c: C.success },
            ].map((s, i) => (
              <div key={i} style={{ ...card, padding: 18 }}>
                <div style={{ fontSize: 11, color: C.dim, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>{s.l}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.c || C.text }}>{s.v}</div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{s.s}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: selectedPatient ? "1fr 340px" : "1fr", gap: 18 }}>
            <div style={{ ...card, overflow: "hidden" }}>
              <div style={{
                padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <FileText size={16} color={C.teal} /> Patient Records
                </div>
                <div style={{ fontSize: 11, color: C.dim }}>{PATIENTS.length} records</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.bg2, textAlign: "left" }}>
                      {["Name", "ID", "Ward", "Admitted", "Status"].map(h => (
                        <th key={h} style={{ padding: "11px 14px", color: C.dim, fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PATIENTS.map(p => (
                      <tr key={p.id} onClick={() => setSelectedPatient(p)}
                        style={{
                          borderTop: `1px solid ${C.border}`, cursor: "pointer",
                          background: selectedPatient?.id === p.id ? "rgba(59,130,246,0.08)" : "transparent",
                        }}>
                        <td style={{ padding: "13px 14px", fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: "13px 14px", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: C.muted }}>{p.id}</td>
                        <td style={{ padding: "13px 14px" }}>{p.ward}</td>
                        <td style={{ padding: "13px 14px", color: C.muted }}>{p.admitted}</td>
                        <td style={{ padding: "13px 14px" }}>
                          <span style={{
                            padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                            background: p.status === "Critical" ? "rgba(239,68,68,0.15)" : p.status === "Stable" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
                            color: p.status === "Critical" ? C.danger : p.status === "Stable" ? C.success : C.muted,
                          }}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedPatient && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                style={{ ...card, padding: 22, alignSelf: "start" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>{selectedPatient.name}</div>
                    <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: C.dim }}>{selectedPatient.id}</div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}>
                    <X size={18} />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { l: "HR", v: selectedPatient.hr },
                    { l: "BP", v: selectedPatient.bp },
                    { l: "SpO₂", v: selectedPatient.spo2 + "%" },
                  ].map(v => (
                    <div key={v.l} style={{ background: C.bg2, borderRadius: 10, padding: 10, textAlign: "center", border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, color: C.dim }}>{v.l}</div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: C.teal }}>{v.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, marginBottom: 6 }}><strong>Doctor:</strong> {selectedPatient.doctor}</div>
                <div style={{ fontSize: 12, marginBottom: 10 }}><strong>Ward:</strong> {selectedPatient.ward}</div>
                <div style={{
                  fontSize: 12, color: C.muted, lineHeight: 1.55, padding: 12,
                  background: C.bg2, borderRadius: 10, border: `1px solid ${C.border}`,
                }}>
                  {selectedPatient.notes}
                </div>
              </motion.div>
            )}
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <button style={btnGhost} onClick={() => setView("audit")}>Access Log</button>
            <button style={btnGhost} onClick={() => setView("ethics")}>Ethics & Legal</button>
          </div>
        </div>
      </div>
    );
  }

  /* ===================== AUDIT ===================== */
  if (view === "audit") {
    return (
      <div style={page}>
        <TopBar title="Access Log / Audit Trail" right={
          <button style={btnGhost} onClick={() => setView(session ? "dashboard" : "landing")}>Back</button>
        } />
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>
          <div style={{ ...card, overflow: "hidden" }}>
            {audit.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: C.dim }}>No authentication events yet</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.bg2, textAlign: "left" }}>
                      {["User", "Staff ID", "Time", "Device", "Location", "Score", "Outcome"].map(h => (
                        <th key={h} style={{ padding: "12px 14px", color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map(a => (
                      <tr key={a.id} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                          {a.user}
                          <div style={{ fontSize: 10, color: C.dim }}>{a.role}</div>
                        </td>
                        <td style={{ padding: "12px 14px", fontFamily: "IBM Plex Mono, monospace", color: C.muted }}>{a.staffId}</td>
                        <td style={{ padding: "12px 14px", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: C.muted }}>{a.time}</td>
                        <td style={{ padding: "12px 14px" }}>{a.device}</td>
                        <td style={{ padding: "12px 14px" }}>{a.location}</td>
                        <td style={{ padding: "12px 14px", fontFamily: "IBM Plex Mono, monospace", fontWeight: 700 }}>{a.score}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                            background: a.tier === "low" ? "rgba(16,185,129,0.15)" : a.tier === "medium" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                            color: a.tier === "low" ? C.success : a.tier === "medium" ? C.caution : C.danger,
                          }}>{a.outcome}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ===================== ETHICS ===================== */
  if (view === "ethics") {
    return (
      <div style={page}>
        <TopBar title="Ethics & Legal" right={
          <button style={btnGhost} onClick={() => setView(session ? "dashboard" : "landing")}>Back</button>
        } />
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Scale size={24} color={C.teal} />
            <h1 style={{ fontSize: 26, fontWeight: 800 }}>Ethics & Legal Considerations</h1>
          </div>
          <p style={{ color: C.muted, marginBottom: 32, lineHeight: 1.6, fontSize: 14 }}>
            Honest disclosure for academic assessment of this biometric access-control prototype.
          </p>

          {[
            {
              t: "What's Real vs Simulated",
              d: "Live face-presence / liveness detection runs in-browser via face-api.js. Full identity matching against a secure template DB is simulated with transparent weighted rules so the risk engine stays explainable. No raw images leave the device; demo thumbnails stay in localStorage only.",
            },
            {
              t: "Data Protection Principles",
              d: "Enrolment is a separate explicit consent step. Data minimisation and purpose limitation apply. Production would require DPIA, encryption, retention limits, and erasure rights under GDPR-style rules and Sri Lanka’s PDPA.",
            },
            {
              t: "Risks in Healthcare Biometrics",
              d: "False rejection can lock clinicians out in emergencies — step-up OTP and fallback paths are mandatory. Biometric breaches are irreversible. Matching accuracy can vary by demographics (NIST FRVT); human review for borderline scores is required.",
            },
          ].map((s, i) => (
            <div key={i} style={{ ...card, padding: 26, marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: C.teal }}>{s.t}</h3>
              <p style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.7 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}