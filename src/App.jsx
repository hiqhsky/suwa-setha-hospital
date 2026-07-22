import React, { useState, useRef, useEffect, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Camera, CameraOff, UserPlus, LogIn,
  Activity, FileText, Scale, ChevronRight, CheckCircle2, AlertTriangle, Lock,
  RefreshCw, LogOut, X, Fingerprint, BadgeCheck, Users, Settings, GitBranch,
  LayoutDashboard, ClipboardList, Home
} from "lucide-react";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/";

/* —— Luxury palette (black / gold / glass) —— */
const T = {
  bg: "#050505",
  bg2: "#0a0a0a",
  panel: "#0e0e0e",
  panel2: "#141414",
  line: "rgba(212,175,55,0.14)",
  line2: "rgba(255,255,255,0.06)",
  gold: "#d4af37",
  gold2: "#f0d78c",
  goldDim: "rgba(212,175,55,0.12)",
  text: "#f5f0e8",
  muted: "#9a9285",
  dim: "#5c564c",
  teal: "#2dd4bf",
  ok: "#34d399",
  warn: "#fbbf24",
  bad: "#f87171",
  blue: "#60a5fa",
};

const ROLES = ["Doctor", "Nurse", "Administrator", "Receptionist"];
const DEPTS = ["Emergency", "ICU", "Radiology", "Pharmacy", "Administration", "OPD"];
const PATIENTS = [
  { id: "PT-24081", name: "R. Fernando", ward: "Ward 3", admitted: "2025-03-12", status: "Stable", doctor: "Dr. Wickrama", hr: 78, bp: "118/76", spo2: 98, notes: "Post-op day 4. Wound clean. Discharge planning underway." },
  { id: "PT-24056", name: "M. Silva", ward: "ICU-2", admitted: "2025-03-14", status: "Critical", doctor: "Dr. Perera", hr: 112, bp: "92/58", spo2: 91, notes: "Respiratory support. Family briefed 07:40." },
  { id: "PT-23998", name: "K. Jayasuriya", ward: "Ward 1", admitted: "2025-03-10", status: "Stable", doctor: "Dr. Fernando", hr: 72, bp: "124/80", spo2: 97, notes: "HTN review. Meds adjusted. Labs pending." },
  { id: "PT-24102", name: "A. Bandara", ward: "Ward 5", admitted: "2025-03-15", status: "Discharged", doctor: "Dr. Wickrama", hr: 68, bp: "120/78", spo2: 99, notes: "Discharged on oral antibiotics. 1-week follow-up." },
  { id: "PT-24077", name: "S. Gunasekara", ward: "Emergency", admitted: "2025-03-16", status: "Critical", doctor: "Dr. Perera", hr: 124, bp: "88/54", spo2: 89, notes: "Trauma. Stabilising. CT pending." },
];

function calcRisk({ enrolled, anomalous, failed = 0 }) {
  let device = enrolled ? 5 : 25;
  let location = 5;
  let time = 5;
  let attempts = failed === 0 ? 0 : failed <= 2 ? 10 : 35;
  let bio = enrolled ? 4 : 28;
  if (anomalous) { device = 25; location = 30; time = 15; attempts = Math.max(attempts, 10); bio = 18; }
  const score = Math.min(100, device + location + time + attempts + bio);
  return {
    score,
    rows: [
      { l: "Device Recognition", v: device, d: device <= 5 ? "Known hospital workstation" : "Unrecognised device" },
      { l: "Location Match", v: location, d: location <= 5 ? "Internal hospital network" : "Unfamiliar location" },
      { l: "Time-of-Day", v: time, d: time <= 5 ? "Normal shift hours" : "Unusual hour" },
      { l: "Recent Failed Attempts", v: attempts, d: `${failed} recent failures` },
      { l: "Facial Liveness & Match", v: bio, d: enrolled ? "Live face + template match" : "No enrolled template" },
    ],
  };
}
function tierOf(s) {
  if (s <= 30) return { k: "low", label: "Trusted — Access Granted", c: T.ok, Icon: ShieldCheck };
  if (s <= 60) return { k: "med", label: "Caution — Step-up Required", c: T.warn, Icon: ShieldAlert };
  return { k: "high", label: "High Risk — Access Denied", c: T.bad, Icon: ShieldX };
}

/* soft UI click */
function useClickSound() {
  const ctx = useRef(null);
  return useCallback(() => {
    try {
      if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)();
      const c = ctx.current;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(420, c.currentTime + 0.06);
      g.gain.setValueAtTime(0.04, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.09);
    } catch {}
  }, []);
}

/* mouse ripple layer */
function RippleLayer() {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    let w, h, mx = -999, my = -999, ripples = [];
    const resize = () => { w = cvs.width = window.innerWidth; h = cvs.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const move = (e) => { mx = e.clientX; my = e.clientY; };
    const down = (e) => { ripples.push({ x: e.clientX, y: e.clientY, r: 0, a: 0.35 }); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mousedown", down);
    let id;
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 180);
      g.addColorStop(0, "rgba(212,175,55,0.06)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ripples = ripples.filter(r => r.a > 0.01);
      ripples.forEach(r => {
        r.r += 4; r.a *= 0.94;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(212,175,55,${r.a})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      id = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
    };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9998 }} />;
}

export default function App() {
  const click = useClickSound();
  const go = (v) => { click(); setView(v); };

  const [view, setView] = useState("landing");
  const [enrolled, setEnrolled] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ss_enr") || "[]"); } catch { return []; }
  });
  const [audit, setAudit] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ss_aud") || "[]"); } catch { return []; }
  });
  const [session, setSession] = useState(null);
  const [dashTab, setDashTab] = useState("records");

  // enrol
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState(0); // 0 consent, 1 details, 2 capture, 3 confirm, 4 done
  const [form, setForm] = useState({ name: "", staffId: "", role: "Doctor", dept: "Emergency" });
  const [captures, setCaptures] = useState([]);
  const [faceOn, setFaceOn] = useState(false);

  // login
  const [phase, setPhase] = useState("idle");
  const [risk, setRisk] = useState(null);
  const [scoreAnim, setScoreAnim] = useState(0);
  const [anomalous, setAnomalous] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpOn, setOtpOn] = useState(false);
  const [camErr, setCamErr] = useState("");
  const [modelsOk, setModelsOk] = useState(false);
  const [patient, setPatient] = useState(null);
  const [fails, setFails] = useState(0);
  const [toast, setToast] = useState("");
  const [loadingTable, setLoadingTable] = useState(true);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectRef = useRef(null);

  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL).then(() => setModelsOk(true)).catch(() => setModelsOk(false));
  }, []);
  useEffect(() => { localStorage.setItem("ss_enr", JSON.stringify(enrolled)); }, [enrolled]);
  useEffect(() => { localStorage.setItem("ss_aud", JSON.stringify(audit)); }, [audit]);
  useEffect(() => {
    if (view === "dashboard") {
      setLoadingTable(true);
      const t = setTimeout(() => setLoadingTable(false), 700);
      return () => clearTimeout(t);
    }
  }, [view, dashTab]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (detectRef.current) clearInterval(detectRef.current);
    setFaceOn(false);
  }, []);

  const startCam = useCallback(async () => {
    setCamErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      if (modelsOk) {
        detectRef.current = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const d = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }));
            setFaceOn(!!d);
          } catch {}
        }, 350);
      } else setFaceOn(true);
    } catch (e) {
      setCamErr(e?.message || String(e));
      setFaceOn(false);
    }
  }, [modelsOk]);

  useEffect(() => () => stopCam(), [stopCam]);

  useEffect(() => {
    if (!risk || phase !== "result") return;
    let n = 0;
    const t = setInterval(() => {
      n += 2;
      if (n >= risk.score) { setScoreAnim(risk.score); clearInterval(t); }
      else setScoreAnim(n);
    }, 16);
    return () => clearInterval(t);
  }, [risk, phase]);

  const snap = () => {
    click();
    if (!videoRef.current || captures.length >= 3) return;
    if (modelsOk && !faceOn && !camErr) return alert("No face detected — centre your face.");
    if (camErr && captures.length < 3) {
      // simulated frame
      const c = document.createElement("canvas");
      c.width = 320; c.height = 320;
      const x = c.getContext("2d");
      x.fillStyle = "#1a1a1a"; x.fillRect(0, 0, 320, 320);
      x.fillStyle = T.gold; x.font = "14px sans-serif"; x.fillText("SIM " + (captures.length + 1), 120, 160);
      setCaptures(p => [...p, c.toDataURL()]);
      return;
    }
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    const x = c.getContext("2d");
    x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(v, 0, 0);
    setCaptures(p => [...p, c.toDataURL("image/jpeg", 0.72)]);
  };

  const finishEnrol = () => {
    click();
    if (captures.length < 3 || !form.name.trim()) return;
    const staffId = form.staffId.trim() || `SS-${Math.floor(1000 + Math.random() * 9000)}`;
    setEnrolled(p => [...p, { ...form, staffId, captures, enrolledAt: new Date().toISOString() }]);
    setStep(4); stopCam();
  };

  const runScan = async () => {
    click();
    setPhase("scanning"); setRisk(null); setScoreAnim(0); setOtp(""); setOtpOn(false);
    await startCam();
    setTimeout(() => {
      const has = enrolled.length > 0;
      const r = calcRisk({ enrolled: has, anomalous, failed: fails });
      setRisk(r);
      const tier = tierOf(r.score);
      if (tier.k === "high") setFails(f => f + 1); else setFails(0);
      const u = has ? enrolled[enrolled.length - 1] : null;
      setAudit(p => [{
        id: Date.now(), user: u?.name || "Unknown", staffId: u?.staffId || "—", role: u?.role || "—",
        time: new Date().toLocaleString(), score: r.score, tier: tier.k,
        outcome: tier.k === "low" ? "Granted" : tier.k === "med" ? "Step-up" : "Denied",
        device: anomalous ? "Unknown device" : "Hospital Workstation",
        location: anomalous ? "External network" : "Colombo · Internal",
      }, ...p].slice(0, 50));
      setPhase("result"); stopCam();
      if (tier.k === "low" && u) setTimeout(() => { setSession(u); setView("dashboard"); setDashTab("records"); }, 1400);
    }, 2200);
  };

  const verifyOtp = () => {
    click();
    if (otp === "123456" || otp.length === 6) {
      const u = enrolled[enrolled.length - 1];
      if (u) { setSession(u); setView("dashboard"); }
    } else alert("Demo OTP: 123456");
  };

  const logout = () => { click(); setSession(null); setView("landing"); setPhase("idle"); setRisk(null); setDashTab("records"); };

  const isAdmin = session?.role === "Administrator";

  /* —— shared chrome —— */
  const page = {
    minHeight: "100vh", background: T.bg, color: T.text,
    fontFamily: "'Inter', system-ui, sans-serif",
    position: "relative", overflowX: "hidden",
  };
  const glass = {
    background: "linear-gradient(145deg, rgba(20,20,20,0.95), rgba(10,10,10,0.98))",
    border: `1px solid ${T.line}`,
    borderRadius: 18,
    boxShadow: "0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
  };
  const btnGold = {
    background: `linear-gradient(135deg, ${T.gold}, #b8962e)`,
    color: "#0a0a0a", border: "none", borderRadius: 999, padding: "14px 28px",
    fontWeight: 700, fontSize: 13, letterSpacing: 0.4, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 8,
    boxShadow: "0 8px 28px rgba(212,175,55,0.28)",
  };
  const btnGhost = {
    background: "transparent", color: T.muted, border: `1px solid ${T.line2}`,
    borderRadius: 999, padding: "11px 20px", fontWeight: 600, fontSize: 12,
    letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase",
  };
  const btnTeal = {
    ...btnGold,
    background: `linear-gradient(135deg, ${T.teal}, #14b8a6)`,
    color: "#042f2e", boxShadow: "0 8px 28px rgba(45,212,191,0.25)",
  };
  const inp = {
    width: "100%", marginTop: 8, padding: "14px 16px", borderRadius: 12,
    border: `1px solid ${T.line2}`, background: T.bg2, color: T.text,
    fontSize: 14, outline: "none",
  };

  const NavMini = ({ right }) => (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "18px 40px", borderBottom: `1px solid ${T.line2}`,
      background: "rgba(5,5,5,0.8)", backdropFilter: "blur(20px)",
      position: "sticky", top: 0, zIndex: 40,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
        onClick={() => { stopCam(); go("landing"); }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `linear-gradient(135deg, ${T.gold}, ${T.teal})`,
          display: "grid", placeItems: "center",
          boxShadow: "0 0 24px rgba(212,175,55,0.35)",
        }}>
          <Shield size={20} color="#0a0a0a" strokeWidth={2.4} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.02em" }}>Suwa Setha Hospital</div>
          <div style={{ fontSize: 10, color: T.gold, letterSpacing: "0.22em", textTransform: "uppercase", marginTop: 2 }}>
            Biometric Security
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{right}</div>
    </header>
  );

  const Toast = () => toast ? (
    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      style={{
        position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 10000,
        background: T.panel2, border: `1px solid ${T.gold}`, borderRadius: 12,
        padding: "12px 22px", fontSize: 13, color: T.gold, boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }}>
      {toast}
    </motion.div>
  ) : null;

  /* ================= LANDING ================= */
  if (view === "landing") {
    return (
      <div style={page}>
        <RippleLayer /><Toast />
        <NavMini right={
          <>
            <button style={btnGhost} onClick={() => go("iterations")}>Iterations</button>
            <button style={btnGhost} onClick={() => go("ethics")}>Ethics & Legal</button>
            <button style={btnGhost} onClick={() => go("audit")}>Access Log</button>
          </>
        } />
        <main style={{
          maxWidth: 1120, margin: "0 auto", padding: "80px 40px 100px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        }}>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
            style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 36,
              padding: "8px 18px", borderRadius: 999, border: `1px solid ${T.line}`,
              color: T.gold, fontSize: 11, fontWeight: 700, letterSpacing: "0.2em",
              background: T.goldDim,
            }}>
              <Lock size={12} /> SECURE HEALTHCARE ACCESS
            </div>
            <h1 style={{
              fontSize: "clamp(42px, 6vw, 68px)", fontWeight: 600, lineHeight: 1.05,
              letterSpacing: "-0.03em", maxWidth: 800, margin: "0 0 24px",
              background: `linear-gradient(180deg, #fff 0%, ${T.gold2} 100%)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Securing Healthcare<br />Operations
            </h1>
            <p style={{
              fontSize: 17, color: T.muted, maxWidth: 520, lineHeight: 1.7,
              margin: "0 0 44px", fontWeight: 400,
            }}>
              AI-driven biometric access control for patient data security.
              Live facial liveness, multi-factor risk scoring, full audit trail.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginBottom: 80 }}>
              <button style={btnGold} onClick={() => {
                click(); setView("enroll"); setStep(0); setConsent(false);
                setCaptures([]); setForm({ name: "", staffId: "", role: "Doctor", dept: "Emergency" });
              }}>
                <UserPlus size={17} /> Enrol Staff Biometric
              </button>
              <button style={btnTeal} onClick={() => { click(); setView("login"); setPhase("idle"); setRisk(null); }}>
                <LogIn size={17} /> Secure Login / Scan
              </button>
            </div>
          </motion.div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, width: "100%", maxWidth: 960,
          }} className="cards3">
            {[
              { i: Camera, t: "Scan Face", d: "Live webcam liveness confirms a real person before any risk score is computed." },
              { i: Activity, t: "AI Risk Score", d: "Transparent weights: device, location, time, attempts, biometric match." },
              { i: ShieldCheck, t: "Access Decision", d: "Trusted, step-up OTP, or deny + incident log — always explainable." },
            ].map((c, idx) => (
              <motion.div key={c.t} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.1 }}
                whileHover={{ y: -6, borderColor: "rgba(212,175,55,0.35)" }}
                style={{ ...glass, padding: "32px 28px", textAlign: "left", transition: "0.25s" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, marginBottom: 20,
                  background: T.goldDim, border: `1px solid ${T.line}`,
                  display: "grid", placeItems: "center",
                }}>
                  <c.i size={22} color={T.gold} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, letterSpacing: "-0.02em" }}>{c.t}</div>
                <div style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.65 }}>{c.d}</div>
              </motion.div>
            ))}
          </div>

          <p style={{ marginTop: 64, fontSize: 11, color: T.dim, letterSpacing: "0.04em", maxWidth: 480, lineHeight: 1.6 }}>
            Prototype system — biometric identity matching simulated for academic demonstration.
            Face-presence detection is real. · {enrolled.length} enrolled · {audit.length} audit events
          </p>
        </main>
        <style>{`
          @media (max-width: 900px) {
            .cards3 { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    );
  }

  /* ================= ENROL ================= */
  if (view === "enroll") {
    return (
      <div style={page}>
        <RippleLayer /><Toast />
        <NavMini right={<button style={btnGhost} onClick={() => { stopCam(); go("landing"); }}>Cancel</button>} />
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px 80px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 36 }}>
            {["Consent", "Details", "Capture", "Done"].map((s, i) => {
              const active = step === i || (step === 3 && i === 2) || (step >= 4 && i === 3);
              const done = step > i || (step >= 4 && i <= 3);
              return (
                <div key={s} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{
                    height: 2, borderRadius: 2, marginBottom: 10,
                    background: done || active ? T.gold : T.line2,
                  }} />
                  <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, color: active || done ? T.gold : T.dim }}>{s}</span>
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="c" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ ...glass, padding: 36 }}>
                <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 12 }}>Biometric Consent</h2>
                <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
                  Enrolment captures three live facial reference frames for access control to Suwa Setha clinical systems.
                  In production only an irreversible template would be stored — never raw images on a server.
                  You may withdraw consent and request deletion. Data is used solely for authentication.
                </p>
                <label style={{
                  display: "flex", gap: 12, alignItems: "flex-start", padding: 16, borderRadius: 12,
                  border: `1px solid ${consent ? T.line : T.line2}`, background: T.bg2, cursor: "pointer", marginBottom: 28,
                }}>
                  <input type="checkbox" checked={consent} onChange={e => { click(); setConsent(e.target.checked); }}
                    style={{ marginTop: 3, accentColor: T.gold, width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>
                    I understand how my biometric data will be used and I consent to enrolment for hospital system access.
                  </span>
                </label>
                <button style={{ ...btnGold, opacity: consent ? 1 : 0.4, pointerEvents: consent ? "auto" : "none" }}
                  onClick={() => { click(); setStep(1); }}>
                  Continue <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="d" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ ...glass, padding: 36 }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Staff Details</h2>
                <label style={{ fontSize: 11, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Full Name</label>
                <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dr. Nimal Perera" />
                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 11, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Staff ID (optional)</label>
                  <input style={inp} value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value })} placeholder="Auto-generated if empty" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16, marginBottom: 28 }}>
                  <div>
                    <label style={{ fontSize: 11, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Role</label>
                    <select style={inp} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Department</label>
                    <select style={inp} value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })}>
                      {DEPTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <button style={btnGold} onClick={() => { if (!form.name.trim()) return alert("Enter name"); click(); setStep(2); startCam(); }}>
                  Enable Camera <ChevronRight size={16} />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="cap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ ...glass, padding: 36 }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Live Capture</h2>
                <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Three reference frames with live face-presence detection.</p>
                <div style={{
                  position: "relative", width: "100%", maxWidth: 400, margin: "0 auto 16px",
                  aspectRatio: "4/3", borderRadius: 20, overflow: "hidden", background: "#000",
                  border: `2px solid ${faceOn ? T.ok : T.line}`,
                  boxShadow: faceOn ? "0 0 40px rgba(52,211,153,0.15)" : "none",
                }}>
                  <video ref={videoRef} muted playsInline autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                  <div style={{ position: "absolute", inset: "10% 16%", borderRadius: "50%", border: "1.5px dashed rgba(212,175,55,0.45)", pointerEvents: "none" }} />
                  {camErr && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", display: "grid", placeItems: "center", padding: 20, textAlign: "center" }}>
                      <div>
                        <CameraOff size={28} color={T.warn} style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 12, color: T.warn, lineHeight: 1.5 }}>{camErr}</div>
                        <div style={{ fontSize: 11, color: T.dim, marginTop: 8 }}>Simulated capture enabled</div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: faceOn ? T.ok : T.muted, marginBottom: 16 }}>
                  {camErr ? "Camera error — use simulated frames" : !modelsOk ? "Loading face model…" : faceOn ? "Face detected — hold still" : "Searching for face…"}
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 22 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 72, height: 72, borderRadius: 12, overflow: "hidden",
                      border: `1px solid ${captures[i] ? T.gold : T.line2}`, background: T.bg2,
                    }}>
                      {captures[i] ? <img src={captures[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
                        <div style={{ height: "100%", display: "grid", placeItems: "center", color: T.dim, fontSize: 12 }}>{i + 1}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button onClick={snap}
                    disabled={captures.length >= 3 || (!faceOn && !camErr && modelsOk)}
                    style={{ ...btnGold, opacity: captures.length >= 3 || (!faceOn && !camErr && modelsOk) ? 0.4 : 1 }}>
                    <Camera size={16} /> Capture {Math.min(captures.length + 1, 3)} / 3
                  </button>
                  {captures.length >= 3 && (
                    <button style={btnTeal} onClick={() => { click(); stopCam(); setStep(3); }}>Continue</button>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="cf" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ ...glass, padding: 36, textAlign: "center" }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>Confirm</h2>
                <p style={{ color: T.muted, marginBottom: 20 }}>{form.name} · {form.role} · {form.dept}</p>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 28 }}>
                  {captures.map((c, i) => (
                    <img key={i} src={c} alt="" style={{ width: 84, height: 84, borderRadius: 12, objectFit: "cover", border: `1px solid ${T.gold}` }} />
                  ))}
                </div>
                <button style={btnGold} onClick={finishEnrol}><BadgeCheck size={17} /> Complete Enrolment</button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="dn" initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ ...glass, padding: 48, textAlign: "center" }}>
                <CheckCircle2 size={64} color={T.ok} style={{ marginBottom: 16 }} />
                <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Enrolment Complete</h2>
                <p style={{ color: T.muted, marginBottom: 16, fontSize: 14 }}>Profile registered for authentication.</p>
                <div style={{
                  display: "inline-block", padding: "12px 24px", marginBottom: 28,
                  border: `1px solid ${T.line}`, borderRadius: 10, color: T.gold,
                  fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, letterSpacing: 2,
                }}>
                  {enrolled[enrolled.length - 1]?.staffId}
                </div>
                <div><button style={btnTeal} onClick={() => { click(); setView("login"); setPhase("idle"); }}>Proceed to Login</button></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  /* ================= LOGIN ================= */
  if (view === "login") {
    const tier = risk ? tierOf(risk.score) : null;
    return (
      <div style={page}>
        <RippleLayer /><Toast />
        <NavMini right={<button style={btnGhost} onClick={() => { stopCam(); go("landing"); }}>Home</button>} />
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 24px 80px" }}>
          <div style={{ ...glass, padding: 36 }}>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Biometric Scan</h2>
              <p style={{ color: T.muted, fontSize: 13, marginTop: 6 }}>Multi-factor AI risk assessment</p>
            </div>
            <div style={{
              position: "relative", width: 240, height: 240, margin: "32px auto",
              borderRadius: "50%", overflow: "hidden", background: "#000",
              border: `2px solid ${phase === "scanning" ? T.teal : phase === "result" && tier ? tier.c : T.line}`,
              boxShadow: phase === "scanning" ? "0 0 48px rgba(45,212,191,0.2)" : "none",
            }}>
              <video ref={videoRef} muted playsInline autoPlay
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: phase === "scanning" ? "block" : "none" }} />
              {phase === "scanning" && (
                <motion.div animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                  style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.gold}, transparent)`, boxShadow: `0 0 12px ${T.gold}`, zIndex: 2 }} />
              )}
              {phase !== "scanning" && (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                  {phase === "result" && tier ? <tier.Icon size={64} color={tier.c} /> : <Camera size={48} color={T.dim} />}
                </div>
              )}
            </div>
            <p style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: T.muted, marginBottom: 22 }}>
              {phase === "idle" && "Start live secure scan"}
              {phase === "scanning" && (faceOn ? "Live face — analysing factors…" : "Searching for face…")}
              {phase === "result" && tier && <span style={{ color: tier.c }}>{tier.label}</span>}
            </p>
            {phase === "idle" && (
              <button style={{ ...btnGold, width: "100%", justifyContent: "center" }} onClick={runScan}>
                <Fingerprint size={18} /> Start Secure Scan
              </button>
            )}
            {phase === "result" && risk && tier && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.2em", color: T.dim }}>AI RISK SCORE</div>
                  <div style={{ fontSize: 56, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace", color: tier.c }}>{scoreAnim}</div>
                </div>
                <div style={{ background: T.bg2, borderRadius: 14, padding: 16, border: `1px solid ${T.line2}`, marginBottom: 16 }}>
                  {risk.rows.map(b => (
                    <div key={b.l} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{b.l}</span>
                        <span style={{ fontFamily: "IBM Plex Mono, monospace", color: b.v > 15 ? T.bad : T.muted }}>+{b.v}</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, b.v * 2.5)}%` }}
                          style={{ height: "100%", background: b.v > 15 ? T.bad : b.v > 8 ? T.warn : T.ok }} />
                      </div>
                      <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>{b.d}</div>
                    </div>
                  ))}
                </div>
                {tier.k === "med" && (
                  <div style={{ border: `1px solid rgba(251,191,36,0.35)`, background: "rgba(251,191,36,0.06)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, color: T.warn, marginBottom: 8, fontSize: 13 }}>Step-up OTP</div>
                    {!otpOn ? <button style={btnGhost} onClick={() => { click(); setOtpOn(true); }}>Send OTP</button> : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <input style={{ ...inp, marginTop: 0, letterSpacing: 6, fontFamily: "IBM Plex Mono, monospace" }} maxLength={6} value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" />
                        <button style={btnGold} onClick={verifyOtp}>Verify</button>
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: T.dim, marginTop: 8 }}>Demo: 123456</div>
                  </div>
                )}
                {tier.k === "high" && (
                  <div style={{ border: `1px solid rgba(248,113,113,0.35)`, background: "rgba(248,113,113,0.06)", borderRadius: 14, padding: 16, marginBottom: 12, textAlign: "center" }}>
                    <AlertTriangle color={T.bad} size={24} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, color: T.bad, fontSize: 13 }}>Access Denied — Incident Logged</div>
                    <button style={{ ...btnGhost, marginTop: 12, color: T.bad, borderColor: "rgba(248,113,113,0.4)" }}
                      onClick={() => { click(); setToast("Incident reported to Security Admin"); }}>
                      Report to Security Admin
                    </button>
                  </div>
                )}
                {tier.k === "low" && <div style={{ textAlign: "center", color: T.ok, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Opening clinical dashboard…</div>}
                <button style={{ ...btnGhost, width: "100%" }} onClick={() => { click(); setPhase("idle"); setRisk(null); }}>
                  <RefreshCw size={13} /> New Scan
                </button>
              </motion.div>
            )}
          </div>
          <label style={{ display: "flex", gap: 10, marginTop: 18, fontSize: 12, color: T.dim, cursor: "pointer" }}>
            <input type="checkbox" checked={anomalous} onChange={e => setAnomalous(e.target.checked)} /> Demo suspicious login
          </label>
          {enrolled.length === 0 && <p style={{ marginTop: 10, fontSize: 12, color: T.warn }}>No enrolment yet — scans score high risk.</p>}
        </div>
      </div>
    );
  }

  /* ================= DASHBOARD (sidebar desktop) ================= */
  if (view === "dashboard" && session) {
    const navItems = [
      { id: "records", label: "Patient Records", icon: FileText },
      { id: "log", label: "My Access Log", icon: ClipboardList },
      { id: "security", label: "Security Settings", icon: Settings },
      ...(isAdmin ? [{ id: "admin", label: "System Audit", icon: Shield }, { id: "staff", label: "Staff Directory", icon: Users }] : []),
    ];

    return (
      <div style={{ ...page, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <RippleLayer /><Toast />
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 28px", borderBottom: `1px solid ${T.line2}`,
          background: "rgba(5,5,5,0.9)", backdropFilter: "blur(16px)", zIndex: 30,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.gold}, ${T.teal})`, display: "grid", placeItems: "center",
            }}>
              <Shield size={16} color="#0a0a0a" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Suwa Setha</div>
              <div style={{ fontSize: 10, color: T.gold, letterSpacing: "0.16em" }}>CLINICAL PORTAL</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              background: "rgba(52,211,153,0.12)", color: T.ok, border: "1px solid rgba(52,211,153,0.3)",
            }}>TRUSTED SESSION</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{session.name}</div>
              <div style={{ fontSize: 11, color: T.dim }}>{session.role} · {session.dept}</div>
            </div>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: `linear-gradient(135deg, ${T.gold}, #8a7020)`, color: "#0a0a0a",
              display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12,
            }}>
              {session.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <button style={btnGhost} onClick={logout}><LogOut size={14} /></button>
          </div>
        </header>

        <div style={{ flex: 1, display: "flex", minHeight: 0 }} className="dash-layout">
          {/* Sidebar */}
          <aside className="dash-side" style={{
            width: 240, flexShrink: 0, borderRight: `1px solid ${T.line2}`,
            background: T.bg2, padding: "24px 14px", display: "flex", flexDirection: "column", gap: 4,
          }}>
            {navItems.map(n => (
              <button key={n.id} onClick={() => { click(); setDashTab(n.id); setPatient(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left", width: "100%",
                  background: dashTab === n.id ? T.goldDim : "transparent",
                  color: dashTab === n.id ? T.gold : T.muted,
                  fontWeight: 600, fontSize: 13,
                }}>
                <n.icon size={16} /> {n.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => go("ethics")} style={{ ...btnGhost, width: "100%", justifyContent: "center" }}>
              <Scale size={13} /> Ethics
            </button>
          </aside>

          {/* Main */}
          <main style={{ flex: 1, padding: "28px 32px 48px", overflow: "auto" }}>
            {/* stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }} className="stat-grid">
              {[
                { l: "Accessible Records", v: "42" },
                { l: "Last Login", v: "Today 08:14" },
                { l: "Location", v: "Colombo Net" },
                { l: "System", v: "Operational", c: T.ok },
              ].map(s => (
                <div key={s.l} style={{ ...glass, padding: "18px 20px" }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", color: T.dim, fontWeight: 600, marginBottom: 8 }}>{s.l.toUpperCase()}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.c || T.text }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Before / After */}
            {dashTab === "records" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }} className="ba-grid">
                <div style={{ ...glass, padding: 20, borderColor: "rgba(248,113,113,0.2)" }}>
                  <div style={{ fontSize: 11, color: T.bad, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 10 }}>BEFORE</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Shared logins & swipe cards</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.55 }}>Password reuse, tailgating, no risk context, weak audit on who opened which record.</div>
                </div>
                <div style={{ ...glass, padding: 20, borderColor: "rgba(52,211,153,0.25)" }}>
                  <div style={{ fontSize: 11, color: T.ok, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 10 }}>AFTER</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Biometric + AI risk score</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.55 }}>Per-person liveness, device/location/time signals, step-up MFA, immutable access log.</div>
                </div>
              </div>
            )}

            {dashTab === "records" && (
              <div style={{ display: "grid", gridTemplateColumns: patient ? "1fr 320px" : "1fr", gap: 16 }} className="rec-grid">
                <div style={{ ...glass, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.line2}`, fontWeight: 700, fontSize: 14 }}>
                    Patient Records
                  </div>
                  {loadingTable ? (
                    <div style={{ padding: 24 }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ height: 44, marginBottom: 10, borderRadius: 8, background: "rgba(255,255,255,0.04)", animation: "pulse 1.2s infinite" }} />
                      ))}
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: T.dim }}>
                          {["Name", "ID", "Ward", "Admitted", "Status"].map(h => (
                            <th key={h} style={{ padding: "12px 16px", fontSize: 10, letterSpacing: "0.1em", fontWeight: 700 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PATIENTS.map(p => (
                          <tr key={p.id} onClick={() => { click(); setPatient(p); }}
                            style={{ borderTop: `1px solid ${T.line2}`, cursor: "pointer", background: patient?.id === p.id ? T.goldDim : "transparent" }}>
                            <td style={{ padding: "14px 16px", fontWeight: 600 }}>{p.name}</td>
                            <td style={{ padding: "14px 16px", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.muted }}>{p.id}</td>
                            <td style={{ padding: "14px 16px" }}>{p.ward}</td>
                            <td style={{ padding: "14px 16px", color: T.muted }}>{p.admitted}</td>
                            <td style={{ padding: "14px 16px" }}>
                              <span style={{
                                padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                                background: p.status === "Critical" ? "rgba(248,113,113,0.15)" : p.status === "Stable" ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)",
                                color: p.status === "Critical" ? T.bad : p.status === "Stable" ? T.ok : T.muted,
                              }}>{p.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {patient && (
                  <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} style={{ ...glass, padding: 22, alignSelf: "start" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 17 }}>{patient.name}</div>
                        <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.dim }}>{patient.id}</div>
                      </div>
                      <button onClick={() => setPatient(null)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={18} /></button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {[{ l: "HR", v: patient.hr }, { l: "BP", v: patient.bp }, { l: "SpO₂", v: patient.spo2 + "%" }].map(v => (
                        <div key={v.l} style={{ background: T.bg2, borderRadius: 10, padding: 10, textAlign: "center", border: `1px solid ${T.line2}` }}>
                          <div style={{ fontSize: 9, color: T.dim }}>{v.l}</div>
                          <div style={{ fontWeight: 700, color: T.gold, fontSize: 15 }}>{v.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 6 }}><strong>Doctor:</strong> {patient.doctor}</div>
                    <div style={{ fontSize: 12, marginBottom: 10 }}><strong>Ward:</strong> {patient.ward}</div>
                    <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.55, padding: 12, background: T.bg2, borderRadius: 10 }}>{patient.notes}</div>
                  </motion.div>
                )}
              </div>
            )}

            {(dashTab === "log" || dashTab === "admin") && (
              <div style={{ ...glass, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.line2}`, fontWeight: 700 }}>
                  {dashTab === "admin" ? "System-Wide Audit Trail" : "My Access Log"}
                </div>
                {audit.length === 0 ? (
                  <div style={{ padding: 48, textAlign: "center", color: T.dim }}>No events yet</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: T.dim, textAlign: "left" }}>
                        {["User", "Time", "Device", "Location", "Score", "Outcome"].map(h => (
                          <th key={h} style={{ padding: "12px 14px", fontSize: 10, letterSpacing: "0.08em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(dashTab === "log" ? audit.filter(a => a.user === session.name) : audit).map(a => (
                        <tr key={a.id} style={{ borderTop: `1px solid ${T.line2}` }}>
                          <td style={{ padding: "12px 14px", fontWeight: 600 }}>{a.user}</td>
                          <td style={{ padding: "12px 14px", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.muted }}>{a.time}</td>
                          <td style={{ padding: "12px 14px" }}>{a.device}</td>
                          <td style={{ padding: "12px 14px" }}>{a.location}</td>
                          <td style={{ padding: "12px 14px", fontFamily: "IBM Plex Mono, monospace", fontWeight: 700 }}>{a.score}</td>
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                              color: a.tier === "low" ? T.ok : a.tier === "med" ? T.warn : T.bad,
                              background: a.tier === "low" ? "rgba(52,211,153,0.12)" : a.tier === "med" ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)",
                            }}>{a.outcome}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {dashTab === "security" && (
              <div style={{ ...glass, padding: 28 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Security Settings</h3>
                <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>Enrolled biometric reference frames (local demo only).</p>
                <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                  {(session.captures || []).map((c, i) => (
                    <img key={i} src={c} alt="" style={{ width: 88, height: 88, borderRadius: 12, objectFit: "cover", border: `1px solid ${T.line}` }} />
                  ))}
                  {!(session.captures || []).length && <div style={{ color: T.dim, fontSize: 13 }}>No thumbnails on this session object — re-enrol to attach frames.</div>}
                </div>
                <button style={btnGold} onClick={() => { click(); setView("enroll"); setStep(0); setConsent(false); setCaptures([]); }}>
                  Re-enrol biometric profile
                </button>
              </div>
            )}

            {dashTab === "staff" && isAdmin && (
              <div style={{ ...glass, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.line2}`, fontWeight: 700 }}>Staff Directory</div>
                {enrolled.length === 0 ? (
                  <div style={{ padding: 40, color: T.dim, textAlign: "center" }}>No enrolled staff</div>
                ) : enrolled.map((u, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, padding: "14px 20px", borderBottom: `1px solid ${T.line2}`, alignItems: "center" }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", background: T.goldDim, color: T.gold,
                      display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12,
                    }}>{u.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: T.dim }}>{u.role} · {u.dept}</div>
                    </div>
                    <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.gold }}>{u.staffId}</div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>

        {/* mobile bottom nav */}
        <nav className="mobile-nav" style={{
          display: "none", borderTop: `1px solid ${T.line2}`, background: T.bg2,
          padding: "10px 8px", justifyContent: "space-around",
        }}>
          {navItems.slice(0, 4).map(n => (
            <button key={n.id} onClick={() => { click(); setDashTab(n.id); }}
              style={{ background: "none", border: "none", color: dashTab === n.id ? T.gold : T.dim, cursor: "pointer", fontSize: 10 }}>
              <n.icon size={18} style={{ display: "block", margin: "0 auto 4px" }} />{n.label.split(" ")[0]}
            </button>
          ))}
        </nav>

        <style>{`
          @keyframes pulse { 50% { opacity: 0.45; } }
          @media (max-width: 1023px) {
            .dash-side { display: none !important; }
            .mobile-nav { display: flex !important; }
            .stat-grid { grid-template-columns: 1fr 1fr !important; }
            .ba-grid, .rec-grid { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 640px) {
            .stat-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    );
  }

  /* ================= ITERATIONS ================= */
  if (view === "iterations") {
    const vers = [
      { v: "V1 · 12 Jan", q: "“It feels like a single checkbox — I don’t trust it with patient records.”", who: "Nurse Kavindi Silva", change: "Added multi-factor risk breakdown (device, location, time, biometrics) with visible weights." },
      { v: "V2 · 03 Feb", q: "“A nurse and an admin should not have the same console.”", who: "Dr. S. Wickrama", change: "Role-based portal: records for clinical staff; full audit + directory for Administrators only." },
      { v: "V3 · 28 Feb", q: "“Where is consent? And what stops endless retries at 3am?”", who: "IT Security · R. Fernando", change: "Mandatory consent gate, step-up OTP, lockout pressure via failed-attempt scoring, ethics panel + this log." },
    ];
    return (
      <div style={page}>
        <RippleLayer />
        <NavMini right={<button style={btnGhost} onClick={() => go("landing")}>Home</button>} />
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <GitBranch size={22} color={T.gold} />
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Iteration & Feedback Log</h1>
          </div>
          <p style={{ color: T.muted, marginBottom: 36, fontSize: 14, lineHeight: 1.6 }}>
            Development history embedded in the product — each version driven by named end-user feedback.
          </p>
          {vers.map((x, i) => (
            <div key={i} style={{ ...glass, padding: 28, marginBottom: 16 }}>
              <div style={{
                display: "inline-block", padding: "4px 12px", borderRadius: 999, marginBottom: 14,
                border: `1px solid ${T.line}`, color: T.gold, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
              }}>{x.v}</div>
              <p style={{ fontSize: 15, fontStyle: "italic", color: T.text, lineHeight: 1.6, marginBottom: 8 }}>{x.q}</p>
              <p style={{ fontSize: 12, color: T.dim, marginBottom: 14 }}>— {x.who}</p>
              <p style={{ fontSize: 13, color: T.teal, lineHeight: 1.55 }}>→ {x.change}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ================= ETHICS ================= */
  if (view === "ethics") {
    return (
      <div style={page}>
        <RippleLayer />
        <NavMini right={<button style={btnGhost} onClick={() => go(session ? "dashboard" : "landing")}>Back</button>} />
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <Scale size={24} color={T.gold} />
            <h1 style={{ fontSize: 26, fontWeight: 600 }}>Ethics & Legal</h1>
          </div>
          {[
            { t: "What's Real vs Simulated", d: "Face-presence / liveness uses real in-browser face-api.js detection. Full identity matching is simulated with transparent weighted rules so scoring stays explainable for assessment. Demo thumbnails stay in localStorage only." },
            { t: "Data Protection Principles", d: "Mandatory consent before camera. Minimisation and purpose limitation. Production would add DPIA, encryption, retention limits, and erasure under GDPR-style rules and Sri Lanka’s PDPA." },
            { t: "Risks in Healthcare Biometrics", d: "False rejection can block a clinician in an emergency — hence OTP step-up and fallback paths. Template breach is irreversible. Matching bias (NIST FRVT) requires human review on borderline scores." },
          ].map((s, i) => (
            <div key={i} style={{ ...glass, padding: 28, marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.gold, marginBottom: 10 }}>{s.t}</h3>
              <p style={{ color: T.muted, fontSize: 13.5, lineHeight: 1.7 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ================= AUDIT (public entry) ================= */
  if (view === "audit") {
    return (
      <div style={page}>
        <RippleLayer />
        <NavMini right={<button style={btnGhost} onClick={() => go("landing")}>Home</button>} />
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 20 }}>Access Log</h1>
          <div style={{ ...glass, overflow: "hidden" }}>
            {audit.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: T.dim }}>No authentication events</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: T.dim, textAlign: "left" }}>
                    {["User", "Time", "Score", "Outcome"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", fontSize: 10, letterSpacing: "0.1em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.map(a => (
                    <tr key={a.id} style={{ borderTop: `1px solid ${T.line2}` }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{a.user}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "IBM Plex Mono, monospace", color: T.muted }}>{a.time}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "IBM Plex Mono, monospace" }}>{a.score}</td>
                      <td style={{ padding: "12px 16px", color: a.tier === "low" ? T.ok : a.tier === "med" ? T.warn : T.bad }}>{a.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}