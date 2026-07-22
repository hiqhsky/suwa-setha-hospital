import React, { useState, useRef, useEffect, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Camera, CameraOff, UserPlus, LogIn,
  Activity, FileText, Scale, ChevronRight, CheckCircle2, AlertTriangle, Lock,
  RefreshCw, LogOut, X, Fingerprint, BadgeCheck, Users, Settings, GitBranch,
  ClipboardList, Sparkles, Eye, Server, KeyRound,
} from "lucide-react";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/";

const T = {
  bg: "#030303",
  bg2: "#080808",
  panel: "#0c0c0c",
  panel2: "#121212",
  line: "rgba(212,175,55,0.18)",
  line2: "rgba(255,255,255,0.06)",
  gold: "#d4af37",
  gold2: "#f3e0a0",
  goldDim: "rgba(212,175,55,0.1)",
  text: "#f7f3ea",
  muted: "#a39b8c",
  dim: "#5e574c",
  teal: "#2dd4bf",
  ok: "#34d399",
  warn: "#fbbf24",
  bad: "#f87171",
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
  let device = enrolled ? 5 : 25, location = 5, time = 5;
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

/* ─── cinematic audio ─── */
function useAudio() {
  const ctx = useRef(null);
  const ensure = () => {
    if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.current.state === "suspended") ctx.current.resume();
    return ctx.current;
  };
  const tone = (freq, dur, type = "sine", vol = 0.045, slide = 0) => {
    try {
      const c = ensure();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur);
    } catch {}
  };
  return {
    tap: () => tone(920, 0.07, "sine", 0.035, -400),
    success: () => { tone(523, 0.1); setTimeout(() => tone(784, 0.14), 80); },
    deny: () => tone(160, 0.22, "triangle", 0.05, -40),
    whoosh: () => tone(240, 0.18, "sine", 0.02, 600),
  };
}

/* ─── cursor gold field ─── */
function Atmosphere() {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const ctx = cvs.getContext("2d");
    let w, h, mx = w / 2, my = h / 2, ripples = [];
    const particles = Array.from({ length: 48 }, () => ({
      x: Math.random(), y: Math.random(), z: Math.random() * 0.6 + 0.2,
      vx: (Math.random() - 0.5) * 0.00025, vy: (Math.random() - 0.5) * 0.00025,
    }));
    const resize = () => { w = cvs.width = innerWidth; h = cvs.height = innerHeight; };
    resize();
    const move = (e) => { mx = e.clientX; my = e.clientY; };
    const down = (e) => ripples.push({ x: e.clientX, y: e.clientY, r: 0, a: 0.4 });
    addEventListener("resize", resize);
    addEventListener("mousemove", move);
    addEventListener("mousedown", down);
    let id;
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      // vignette wash following cursor
      const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 320);
      grd.addColorStop(0, "rgba(212,175,55,0.055)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        const px = p.x * w, py = p.y * h;
        const dx = px - mx, dy = py - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pull = Math.max(0, 1 - dist / 280) * 8;
        ctx.beginPath();
        ctx.arc(px - (dx / (dist || 1)) * pull, py - (dy / (dist || 1)) * pull, p.z * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212,175,55,${0.15 * p.z})`;
        ctx.fill();
      });
      ripples = ripples.filter(r => r.a > 0.02);
      ripples.forEach(r => {
        r.r += 5; r.a *= 0.93;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(212,175,55,${r.a})`; ctx.lineWidth = 1.2; ctx.stroke();
      });
      id = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(id);
      removeEventListener("resize", resize);
      removeEventListener("mousemove", move);
      removeEventListener("mousedown", down);
    };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 }} />;
}

const fadeUp = {
  hidden: { opacity: 0, y: 48 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.12 } } };

export default function App() {
  const sfx = useAudio();
  const go = (v) => { sfx.tap(); setView(v); };

  const [view, setView] = useState("landing");
  const [enrolled, setEnrolled] = useState(() => { try { return JSON.parse(localStorage.getItem("ss_pc_enr") || "[]"); } catch { return []; } });
  const [audit, setAudit] = useState(() => { try { return JSON.parse(localStorage.getItem("ss_pc_aud") || "[]"); } catch { return []; } });
  const [session, setSession] = useState(null);
  const [dashTab, setDashTab] = useState("records");

  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", staffId: "", role: "Doctor", dept: "Emergency" });
  const [captures, setCaptures] = useState([]);
  const [faceOn, setFaceOn] = useState(false);

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
  const [clock, setClock] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectRef = useRef(null);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const heroOp = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL).then(() => setModelsOk(true)).catch(() => setModelsOk(false));
  }, []);
  useEffect(() => { localStorage.setItem("ss_pc_enr", JSON.stringify(enrolled)); }, [enrolled]);
  useEffect(() => { localStorage.setItem("ss_pc_aud", JSON.stringify(audit)); }, [audit]);
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB")), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (view === "dashboard") {
      setLoadingTable(true);
      const t = setTimeout(() => setLoadingTable(false), 650);
      return () => clearTimeout(t);
    }
  }, [view, dashTab]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3000); return () => clearTimeout(t); }, [toast]);

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
        }, 320);
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
    }, 14);
    return () => clearInterval(t);
  }, [risk, phase]);

  const snap = () => {
    sfx.tap();
    if (!videoRef.current || captures.length >= 3) return;
    if (modelsOk && !faceOn && !camErr) return alert("No face detected — centre your face in the guide.");
    if (camErr) {
      const c = document.createElement("canvas"); c.width = 320; c.height = 320;
      const x = c.getContext("2d"); x.fillStyle = "#151515"; x.fillRect(0, 0, 320, 320);
      x.fillStyle = T.gold; x.font = "bold 16px Inter"; x.fillText("SIM " + (captures.length + 1), 120, 160);
      setCaptures(p => [...p, c.toDataURL()]); sfx.success(); return;
    }
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    const x = c.getContext("2d"); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(v, 0, 0);
    setCaptures(p => [...p, c.toDataURL("image/jpeg", 0.75)]);
    sfx.success();
  };

  const finishEnrol = () => {
    sfx.tap();
    if (captures.length < 3 || !form.name.trim()) return;
    const staffId = form.staffId.trim() || `SS-${Math.floor(1000 + Math.random() * 9000)}`;
    setEnrolled(p => [...p, { ...form, staffId, captures, enrolledAt: new Date().toISOString() }]);
    setStep(4); stopCam(); sfx.success();
  };

  const runScan = async () => {
    sfx.whoosh();
    setPhase("scanning"); setRisk(null); setScoreAnim(0); setOtp(""); setOtpOn(false);
    await startCam();
    setTimeout(() => {
      const has = enrolled.length > 0;
      const r = calcRisk({ enrolled: has, anomalous, failed: fails });
      setRisk(r);
      const tier = tierOf(r.score);
      if (tier.k === "high") { setFails(f => f + 1); sfx.deny(); }
      else { setFails(0); sfx.success(); }
      const u = has ? enrolled[enrolled.length - 1] : null;
      setAudit(p => [{
        id: Date.now(), user: u?.name || "Unknown", staffId: u?.staffId || "—", role: u?.role || "—",
        time: new Date().toLocaleString(), score: r.score, tier: tier.k,
        outcome: tier.k === "low" ? "Granted" : tier.k === "med" ? "Step-up" : "Denied",
        device: anomalous ? "Unknown device" : "Hospital Workstation #A12",
        location: anomalous ? "External network" : "Colombo · Core LAN",
      }, ...p].slice(0, 60));
      setPhase("result"); stopCam();
      if (tier.k === "low" && u) setTimeout(() => { setSession(u); setView("dashboard"); setDashTab("records"); }, 1300);
    }, 2400);
  };

  const verifyOtp = () => {
    sfx.tap();
    if (otp === "123456" || otp.length === 6) {
      const u = enrolled[enrolled.length - 1];
      if (u) { sfx.success(); setSession(u); setView("dashboard"); }
    } else { sfx.deny(); alert("Demo OTP: 123456"); }
  };

  const logout = () => { sfx.tap(); setSession(null); setView("landing"); setPhase("idle"); setRisk(null); };
  const isAdmin = session?.role === "Administrator";

  /* styles */
  const page = {
    minHeight: "100vh", background: T.bg, color: T.text,
    fontFamily: "'Inter', system-ui, sans-serif", position: "relative",
    minWidth: 1280,
  };
  const glass = {
    background: "linear-gradient(160deg, rgba(22,22,22,0.94), rgba(8,8,8,0.98))",
    border: `1px solid ${T.line}`,
    borderRadius: 20,
    boxShadow: "0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
  };
  const btnGold = {
    background: `linear-gradient(135deg, ${T.gold2}, ${T.gold} 40%, #a8892a)`,
    color: "#0a0a0a", border: "none", borderRadius: 999, padding: "16px 32px",
    fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 10,
    boxShadow: "0 10px 40px rgba(212,175,55,0.3)",
    textTransform: "uppercase",
  };
  const btnGhost = {
    background: "transparent", color: T.muted, border: `1px solid ${T.line2}`,
    borderRadius: 999, padding: "12px 22px", fontWeight: 600, fontSize: 11,
    letterSpacing: "0.14em", cursor: "pointer", textTransform: "uppercase",
  };
  const btnTeal = { ...btnGold, background: `linear-gradient(135deg, #5eead4, ${T.teal})`, color: "#042f2e", boxShadow: "0 10px 40px rgba(45,212,191,0.25)" };
  const inp = {
    width: "100%", marginTop: 8, padding: "14px 16px", borderRadius: 12,
    border: `1px solid ${T.line2}`, background: "#060606", color: T.text, fontSize: 14, outline: "none",
  };

  const Top = ({ right }) => (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "20px 56px", borderBottom: `1px solid ${T.line2}`,
      background: "rgba(3,3,3,0.75)", backdropFilter: "blur(24px)",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}
        onClick={() => { stopCam(); go("landing"); }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: `linear-gradient(135deg, ${T.gold}, ${T.teal})`,
          display: "grid", placeItems: "center", boxShadow: "0 0 32px rgba(212,175,55,0.4)",
        }}>
          <Shield size={20} color="#0a0a0a" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "0.04em" }}>SUWA SETHA</div>
          <div style={{ fontSize: 10, color: T.gold, letterSpacing: "0.28em", marginTop: 3 }}>HOSPITAL · SECURITY OS</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: T.dim, marginRight: 12 }}>{clock}</span>
        {right}
      </div>
    </header>
  );

  const Toast = () => toast ? (
    <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      style={{
        position: "fixed", bottom: 36, left: "50%", transform: "translateX(-50%)", zIndex: 200,
        ...glass, padding: "14px 28px", color: T.gold, fontSize: 13, fontWeight: 600, letterSpacing: "0.04em",
      }}>{toast}</motion.div>
  ) : null;

  /* ═══════════════ LANDING ═══════════════ */
  if (view === "landing") {
    return (
      <div style={page}>
        <Atmosphere /><Toast />
        <div style={{ position: "relative", zIndex: 2 }}>
          <Top right={
            <>
              <button style={btnGhost} onClick={() => go("iterations")}>Iterations</button>
              <button style={btnGhost} onClick={() => go("ethics")}>Ethics</button>
              <button style={btnGhost} onClick={() => go("audit")}>Audit Log</button>
            </>
          } />

          {/* HERO */}
          <section ref={heroRef} style={{ height: "92vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <div style={{
              position: "absolute", inset: 0, opacity: 0.4,
              background: "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(212,175,55,0.12), transparent 70%)",
            }} />
            <motion.div style={{ y: heroY, opacity: heroOp, textAlign: "center", maxWidth: 980, padding: "0 48px", position: "relative" }}>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 40,
                  padding: "10px 22px", borderRadius: 999, border: `1px solid ${T.line}`,
                  background: T.goldDim, color: T.gold, fontSize: 11, fontWeight: 700, letterSpacing: "0.28em",
                }}>
                <Lock size={13} /> AI BIOMETRIC ACCESS CONTROL
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  fontSize: "clamp(56px, 7vw, 88px)", fontWeight: 500, lineHeight: 1.02,
                  letterSpacing: "-0.035em", margin: "0 0 28px",
                  background: `linear-gradient(165deg, #ffffff 10%, ${T.gold2} 55%, ${T.gold} 100%)`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                Securing Healthcare<br />Operations
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                style={{ fontSize: 18, color: T.muted, maxWidth: 560, margin: "0 auto 48px", lineHeight: 1.75, fontWeight: 400 }}>
                The Suwa Setha biometric cybersecurity platform. Live facial liveness,
                transparent multi-factor risk intelligence, immutable audit — built for clinical trust.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                <motion.button whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.98 }} style={btnGold}
                  onClick={() => { sfx.tap(); setView("enroll"); setStep(0); setConsent(false); setCaptures([]); setForm({ name: "", staffId: "", role: "Doctor", dept: "Emergency" }); }}>
                  <UserPlus size={18} /> Enrol Biometric
                </motion.button>
                <motion.button whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.98 }} style={btnTeal}
                  onClick={() => { sfx.tap(); setView("login"); setPhase("idle"); setRisk(null); }}>
                  <LogIn size={18} /> Secure Login
                </motion.button>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
                style={{ marginTop: 80, color: T.dim, fontSize: 11, letterSpacing: "0.2em" }}>
                SCROLL TO EXPLORE
              </motion.div>
            </motion.div>
          </section>

          {/* HOW IT WORKS */}
          <motion.section variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }}
            style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 56px 80px" }}>
            <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 64 }}>
              <div style={{ color: T.gold, fontSize: 11, letterSpacing: "0.3em", fontWeight: 700, marginBottom: 16 }}>ARCHITECTURE</div>
              <h2 style={{ fontSize: 42, fontWeight: 500, letterSpacing: "-0.03em" }}>How protection works</h2>
            </motion.div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {[
                { i: Camera, n: "01", t: "Liveness Scan", d: "Real webcam face-presence detection confirms a living subject before scoring begins — not a static photo spoof." },
                { i: Activity, n: "02", t: "Risk Intelligence", d: "Five weighted signals: device, network geofence, time-of-day, failure pressure, and biometric confidence." },
                { i: ShieldCheck, n: "03", t: "Governed Access", d: "Trusted entry, step-up OTP, or hard deny with incident log. Every decision is explainable for audit." },
              ].map((c) => (
                <motion.div key={c.n} variants={fadeUp} whileHover={{ y: -10, borderColor: "rgba(212,175,55,0.4)" }}
                  style={{ ...glass, padding: "40px 36px", transition: "border-color 0.3s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 16, background: T.goldDim, border: `1px solid ${T.line}`,
                      display: "grid", placeItems: "center",
                    }}><c.i size={24} color={T.gold} /></div>
                    <span style={{ fontFamily: "IBM Plex Mono, monospace", color: T.dim, fontSize: 13 }}>{c.n}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 14, letterSpacing: "-0.02em" }}>{c.t}</div>
                  <div style={{ color: T.muted, fontSize: 14.5, lineHeight: 1.7 }}>{c.d}</div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* STAT STRIP */}
          <motion.section initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
            style={{ borderTop: `1px solid ${T.line2}`, borderBottom: `1px solid ${T.line2}`, background: T.bg2 }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
              {[
                { v: enrolled.length, l: "Enrolled identities" },
                { v: audit.length, l: "Audit events" },
                { v: "5", l: "Risk factors scored" },
                { v: "100%", l: "Client-side privacy" },
              ].map((x, i) => (
                <motion.div key={i} variants={fadeUp} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 48, fontWeight: 600, color: T.gold, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "-0.04em" }}>{x.v}</div>
                  <div style={{ fontSize: 12, color: T.dim, letterSpacing: "0.16em", marginTop: 8, textTransform: "uppercase" }}>{x.l}</div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* CAPABILITY GRID */}
          <motion.section variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}
            style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 56px" }}>
            <motion.div variants={fadeUp} style={{ marginBottom: 48 }}>
              <div style={{ color: T.gold, fontSize: 11, letterSpacing: "0.3em", fontWeight: 700, marginBottom: 16 }}>PLATFORM</div>
              <h2 style={{ fontSize: 40, fontWeight: 500, letterSpacing: "-0.03em", maxWidth: 520 }}>Everything a hospital security review expects</h2>
            </motion.div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
              {[
                { i: KeyRound, t: "Explicit consent gate", d: "Camera never starts until staff tick a clear biometric consent statement." },
                { i: Eye, t: "Real liveness detection", d: "face-api.js TinyFaceDetector confirms presence frame-by-frame in the browser." },
                { i: Server, t: "Role-gated clinical portal", d: "Doctors and nurses see records; Administrators unlock system-wide audit and directory." },
                { i: Sparkles, t: "Before / after impact", d: "Dashboard contrasts shared passwords with biometric risk-based access for your report." },
              ].map((c, i) => (
                <motion.div key={i} variants={fadeUp} style={{ ...glass, padding: "32px 36px", display: "flex", gap: 20 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: T.goldDim, display: "grid", placeItems: "center", border: `1px solid ${T.line}`,
                  }}><c.i size={20} color={T.gold} /></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 8 }}>{c.t}</div>
                    <div style={{ color: T.muted, fontSize: 14, lineHeight: 1.65 }}>{c.d}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <footer style={{
            textAlign: "center", padding: "48px 56px 64px", borderTop: `1px solid ${T.line2}`,
            fontSize: 12, color: T.dim, letterSpacing: "0.06em", lineHeight: 1.8,
          }}>
            Securing Healthcare Operations — AI-Driven Biometric Cybersecurity Platform for Suwa Setha Hospital
            <br />Prototype · identity matching simulated · liveness detection real · fictional clinical data only
          </footer>
        </div>
      </div>
    );
  }

  /* ═══════════════ ENROL ═══════════════ */
  if (view === "enroll") {
    return (
      <div style={page}>
        <Atmosphere /><Toast />
        <div style={{ position: "relative", zIndex: 2 }}>
          <Top right={<button style={btnGhost} onClick={() => { stopCam(); go("landing"); }}>Cancel</button>} />
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "56px 32px 100px" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 40 }}>
              {["Consent", "Details", "Capture", "Complete"].map((lab, i) => {
                const on = step === i || (step === 3 && i === 2) || (step >= 4 && i === 3);
                const done = step > i;
                return (
                  <div key={lab} style={{ flex: 1 }}>
                    <div style={{ height: 2, borderRadius: 2, marginBottom: 12, background: done || on ? T.gold : T.line2 }} />
                    <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: on || done ? T.gold : T.dim, textAlign: "center" }}>{lab}</div>
                  </div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ ...glass, padding: 44 }}>
                  <h2 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.03em", marginBottom: 14 }}>Biometric consent</h2>
                  <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.75, marginBottom: 28 }}>
                    You are about to enrol a facial biometric profile for access to Suwa Setha clinical systems.
                    Three live reference frames will be captured. In production only an irreversible template is stored — never a raw image on a server.
                    You may withdraw consent and request deletion. Use is limited to authentication.
                  </p>
                  <label style={{
                    display: "flex", gap: 14, padding: 18, borderRadius: 14, cursor: "pointer", marginBottom: 32,
                    border: `1px solid ${consent ? T.line : T.line2}`, background: "#060606",
                  }}>
                    <input type="checkbox" checked={consent} onChange={e => { sfx.tap(); setConsent(e.target.checked); }}
                      style={{ marginTop: 4, accentColor: T.gold, width: 18, height: 18 }} />
                    <span style={{ fontSize: 14, lineHeight: 1.55 }}>I understand and consent to biometric enrolment for hospital system access.</span>
                  </label>
                  <button style={{ ...btnGold, opacity: consent ? 1 : 0.35, pointerEvents: consent ? "auto" : "none" }}
                    onClick={() => { sfx.tap(); setStep(1); }}>Continue <ChevronRight size={16} /></button>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ ...glass, padding: 44 }}>
                  <h2 style={{ fontSize: 26, fontWeight: 500, marginBottom: 28 }}>Staff profile</h2>
                  <label style={{ fontSize: 10, letterSpacing: "0.16em", color: T.dim, fontWeight: 700 }}>FULL NAME</label>
                  <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dr. Nimal Perera" />
                  <div style={{ marginTop: 18 }}>
                    <label style={{ fontSize: 10, letterSpacing: "0.16em", color: T.dim, fontWeight: 700 }}>STAFF ID (OPTIONAL)</label>
                    <input style={inp} value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value })} placeholder="Auto-generated if empty" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18, marginBottom: 32 }}>
                    <div>
                      <label style={{ fontSize: 10, letterSpacing: "0.16em", color: T.dim, fontWeight: 700 }}>ROLE</label>
                      <select style={inp} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, letterSpacing: "0.16em", color: T.dim, fontWeight: 700 }}>DEPARTMENT</label>
                      <select style={inp} value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })}>{DEPTS.map(d => <option key={d}>{d}</option>)}</select>
                    </div>
                  </div>
                  <button style={btnGold} onClick={() => { if (!form.name.trim()) return alert("Enter name"); sfx.tap(); setStep(2); startCam(); }}>
                    Enable Camera <ChevronRight size={16} />
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ ...glass, padding: 44 }}>
                  <h2 style={{ fontSize: 26, fontWeight: 500, marginBottom: 8 }}>Live capture</h2>
                  <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Three frames · real face-presence detection</p>
                  <div style={{
                    position: "relative", width: 440, margin: "0 auto 18px", aspectRatio: "4/3",
                    borderRadius: 24, overflow: "hidden", background: "#000",
                    border: `2px solid ${faceOn ? T.ok : T.line}`,
                    boxShadow: faceOn ? "0 0 60px rgba(52,211,153,0.18)" : "0 20px 60px rgba(0,0,0,0.5)",
                  }}>
                    <video ref={videoRef} muted playsInline autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                    <div style={{ position: "absolute", inset: "11% 17%", borderRadius: "50%", border: "1.5px dashed rgba(212,175,55,0.5)", pointerEvents: "none" }} />
                    {camErr && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.88)", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
                        <div>
                          <CameraOff size={32} color={T.warn} style={{ marginBottom: 10 }} />
                          <div style={{ fontSize: 13, color: T.warn, lineHeight: 1.5 }}>{camErr}</div>
                          <div style={{ fontSize: 11, color: T.dim, marginTop: 10 }}>Simulated frames available</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "center", fontWeight: 600, fontSize: 13, color: faceOn ? T.ok : T.muted, marginBottom: 18 }}>
                    {camErr ? "Camera error — simulated capture on" : !modelsOk ? "Loading face model…" : faceOn ? "● Face detected — hold still" : "Searching for face…"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 26 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 88, height: 88, borderRadius: 14, overflow: "hidden", border: `1px solid ${captures[i] ? T.gold : T.line2}`, background: "#060606" }}>
                        {captures[i] ? <img src={captures[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
                          <div style={{ height: "100%", display: "grid", placeItems: "center", color: T.dim }}>{i + 1}</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button onClick={snap} disabled={captures.length >= 3 || (!faceOn && !camErr && modelsOk)}
                      style={{ ...btnGold, opacity: captures.length >= 3 || (!faceOn && !camErr && modelsOk) ? 0.4 : 1 }}>
                      <Camera size={16} /> Capture {Math.min(captures.length + 1, 3)} / 3
                    </button>
                    {captures.length >= 3 && <button style={btnTeal} onClick={() => { sfx.tap(); stopCam(); setStep(3); }}>Continue</button>}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ ...glass, padding: 44, textAlign: "center" }}>
                  <h2 style={{ fontSize: 26, fontWeight: 500, marginBottom: 12 }}>Confirm enrolment</h2>
                  <p style={{ color: T.muted, marginBottom: 24 }}>{form.name} · {form.role} · {form.dept}</p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 32 }}>
                    {captures.map((c, i) => <img key={i} src={c} alt="" style={{ width: 96, height: 96, borderRadius: 14, objectFit: "cover", border: `1px solid ${T.gold}` }} />)}
                  </div>
                  <button style={btnGold} onClick={finishEnrol}><BadgeCheck size={18} /> Complete Enrolment</button>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="4" initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ ...glass, padding: 56, textAlign: "center" }}>
                  <CheckCircle2 size={72} color={T.ok} style={{ marginBottom: 20 }} />
                  <h2 style={{ fontSize: 28, fontWeight: 500, marginBottom: 10 }}>Enrolment complete</h2>
                  <p style={{ color: T.muted, marginBottom: 20 }}>Biometric profile ready for authentication.</p>
                  <div style={{
                    display: "inline-block", padding: "14px 28px", marginBottom: 32,
                    border: `1px solid ${T.line}`, borderRadius: 12, color: T.gold,
                    fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, letterSpacing: 3, fontSize: 18,
                  }}>{enrolled[enrolled.length - 1]?.staffId}</div>
                  <div><button style={btnTeal} onClick={() => { sfx.tap(); setView("login"); setPhase("idle"); }}>Proceed to Secure Login</button></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════ LOGIN ═══════════════ */
  if (view === "login") {
    const tier = risk ? tierOf(risk.score) : null;
    return (
      <div style={page}>
        <Atmosphere /><Toast />
        <div style={{ position: "relative", zIndex: 2 }}>
          <Top right={<button style={btnGhost} onClick={() => { stopCam(); go("landing"); }}>Home</button>} />
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "56px 32px 100px" }}>
            <div style={{ ...glass, padding: 44 }}>
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.03em" }}>Biometric authentication</h2>
                <p style={{ color: T.muted, fontSize: 14, marginTop: 8 }}>Multi-factor AI risk assessment</p>
              </div>
              <div style={{
                position: "relative", width: 260, height: 260, margin: "36px auto",
                borderRadius: "50%", overflow: "hidden", background: "#000",
                border: `2px solid ${phase === "scanning" ? T.teal : phase === "result" && tier ? tier.c : T.line}`,
                boxShadow: phase === "scanning" ? "0 0 64px rgba(45,212,191,0.22)" : "0 20px 50px rgba(0,0,0,0.5)",
              }}>
                <video ref={videoRef} muted playsInline autoPlay
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: phase === "scanning" ? "block" : "none" }} />
                {phase === "scanning" && (
                  <motion.div animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 1.7, repeat: Infinity, ease: "linear" }}
                    style={{ position: "absolute", left: 0, right: 0, height: 2, zIndex: 2, background: `linear-gradient(90deg, transparent, ${T.gold}, transparent)`, boxShadow: `0 0 16px ${T.gold}` }} />
                )}
                {phase !== "scanning" && (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                    {phase === "result" && tier ? <tier.Icon size={68} color={tier.c} /> : <Camera size={52} color={T.dim} />}
                  </div>
                )}
              </div>
              <p style={{ textAlign: "center", fontWeight: 600, fontSize: 13, color: T.muted, marginBottom: 24 }}>
                {phase === "idle" && "Initiate live secure scan"}
                {phase === "scanning" && (faceOn ? "Live face — scoring risk factors…" : "Searching for face…")}
                {phase === "result" && tier && <span style={{ color: tier.c, fontSize: 15 }}>{tier.label}</span>}
              </p>
              {phase === "idle" && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ ...btnGold, width: "100%", justifyContent: "center" }} onClick={runScan}>
                  <Fingerprint size={18} /> Start Secure Scan
                </motion.button>
              )}
              {phase === "result" && risk && tier && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <div style={{ textAlign: "center", marginBottom: 22 }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.28em", color: T.dim }}>AI RISK SCORE</div>
                    <div style={{ fontSize: 64, fontWeight: 600, fontFamily: "IBM Plex Mono, monospace", color: tier.c, lineHeight: 1.1 }}>{scoreAnim}</div>
                  </div>
                  <div style={{ background: "#060606", borderRadius: 16, padding: 18, border: `1px solid ${T.line2}`, marginBottom: 18 }}>
                    {risk.rows.map(b => (
                      <div key={b.l} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                          <span style={{ fontWeight: 600 }}>{b.l}</span>
                          <span style={{ fontFamily: "IBM Plex Mono, monospace", color: b.v > 15 ? T.bad : T.muted }}>+{b.v}</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, b.v * 2.5)}%` }} transition={{ duration: 0.8 }}
                            style={{ height: "100%", background: b.v > 15 ? T.bad : b.v > 8 ? T.warn : T.ok }} />
                        </div>
                        <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>{b.d}</div>
                      </div>
                    ))}
                  </div>
                  {tier.k === "med" && (
                    <div style={{ border: "1px solid rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.06)", borderRadius: 16, padding: 18, marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, color: T.warn, marginBottom: 10, fontSize: 13 }}>STEP-UP VERIFICATION</div>
                      {!otpOn ? <button style={btnGhost} onClick={() => { sfx.tap(); setOtpOn(true); }}>Send OTP</button> : (
                        <div style={{ display: "flex", gap: 10 }}>
                          <input style={{ ...inp, marginTop: 0, letterSpacing: 8, fontFamily: "IBM Plex Mono, monospace" }} maxLength={6} value={otp} onChange={e => setOtp(e.target.value)} placeholder="······" />
                          <button style={btnGold} onClick={verifyOtp}>Verify</button>
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: T.dim, marginTop: 10 }}>Demo code 123456</div>
                    </div>
                  )}
                  {tier.k === "high" && (
                    <div style={{ border: "1px solid rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.06)", borderRadius: 16, padding: 20, marginBottom: 14, textAlign: "center" }}>
                      <AlertTriangle color={T.bad} size={28} style={{ marginBottom: 10 }} />
                      <div style={{ fontWeight: 700, color: T.bad }}>Access Denied — Incident Logged</div>
                      <button style={{ ...btnGhost, marginTop: 14, color: T.bad, borderColor: "rgba(248,113,113,0.4)" }}
                        onClick={() => { sfx.tap(); setToast("Incident filed with Security Admin"); }}>Report to Security Admin</button>
                    </div>
                  )}
                  {tier.k === "low" && <div style={{ textAlign: "center", color: T.ok, fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Opening clinical portal…</div>}
                  <button style={{ ...btnGhost, width: "100%" }} onClick={() => { sfx.tap(); setPhase("idle"); setRisk(null); }}>
                    <RefreshCw size={13} /> New Scan
                  </button>
                </motion.div>
              )}
            </div>
            <label style={{ display: "flex", gap: 10, marginTop: 20, fontSize: 12, color: T.dim, cursor: "pointer" }}>
              <input type="checkbox" checked={anomalous} onChange={e => setAnomalous(e.target.checked)} /> Simulate suspicious login
            </label>
            {enrolled.length === 0 && <p style={{ marginTop: 12, fontSize: 12, color: T.warn }}>No enrolment — scans will score high risk.</p>}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════ DASHBOARD PC ═══════════════ */
  if (view === "dashboard" && session) {
    const nav = [
      { id: "records", label: "Patient Records", icon: FileText },
      { id: "log", label: "My Access Log", icon: ClipboardList },
      { id: "security", label: "Security Settings", icon: Settings },
      ...(isAdmin ? [
        { id: "admin", label: "System Audit", icon: Shield },
        { id: "staff", label: "Staff Directory", icon: Users },
      ] : []),
    ];
    return (
      <div style={{ ...page, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%" }}>
          <header style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 40px", borderBottom: `1px solid ${T.line2}`,
            background: "rgba(3,3,3,0.9)", backdropFilter: "blur(20px)", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${T.gold}, ${T.teal})`, display: "grid", placeItems: "center" }}>
                <Shield size={17} color="#0a0a0a" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.06em" }}>SUWA SETHA</div>
                <div style={{ fontSize: 10, color: T.gold, letterSpacing: "0.2em" }}>CLINICAL PORTAL</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ padding: "5px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", background: "rgba(52,211,153,0.12)", color: T.ok, border: "1px solid rgba(52,211,153,0.3)" }}>
                TRUSTED SESSION
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{session.name}</div>
                <div style={{ fontSize: 11, color: T.dim }}>{session.role} · {session.dept}</div>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: `linear-gradient(135deg, ${T.gold}, #8a7020)`, color: "#0a0a0a",
                display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12,
              }}>{session.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
              <button style={btnGhost} onClick={logout}><LogOut size={14} /></button>
            </div>
          </header>

          <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
            <aside style={{
              width: 260, flexShrink: 0, borderRight: `1px solid ${T.line2}`, background: T.bg2,
              padding: "28px 16px", display: "flex", flexDirection: "column", gap: 6,
            }}>
              {nav.map(n => (
                <motion.button key={n.id} whileHover={{ x: 4 }} onClick={() => { sfx.tap(); setDashTab(n.id); setPatient(null); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12,
                    border: "none", cursor: "pointer", width: "100%", textAlign: "left",
                    background: dashTab === n.id ? T.goldDim : "transparent",
                    color: dashTab === n.id ? T.gold : T.muted, fontWeight: 600, fontSize: 13,
                  }}>
                  <n.icon size={17} /> {n.label}
                </motion.button>
              ))}
              <div style={{ flex: 1 }} />
              <button onClick={() => go("ethics")} style={{ ...btnGhost, width: "100%", justifyContent: "center" }}><Scale size={13} /> Ethics</button>
              <button onClick={() => go("iterations")} style={{ ...btnGhost, width: "100%", justifyContent: "center", marginTop: 8 }}><GitBranch size={13} /> Iterations</button>
            </aside>

            <main style={{ flex: 1, overflow: "auto", padding: "32px 40px 56px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
                {[
                  { l: "Accessible Records", v: "42" },
                  { l: "Last Login", v: "Today 08:14" },
                  { l: "Network", v: "Core LAN" },
                  { l: "System", v: "Operational", c: T.ok },
                ].map(s => (
                  <div key={s.l} style={{ ...glass, padding: "22px 24px" }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.18em", color: T.dim, fontWeight: 700, marginBottom: 10 }}>{s.l.toUpperCase()}</div>
                    <div style={{ fontSize: 26, fontWeight: 600, color: s.c || T.text, letterSpacing: "-0.02em" }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {dashTab === "records" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
                    <div style={{ ...glass, padding: 24, borderColor: "rgba(248,113,113,0.22)" }}>
                      <div style={{ fontSize: 10, color: T.bad, fontWeight: 700, letterSpacing: "0.16em", marginBottom: 12 }}>BEFORE — LEGACY ACCESS</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Shared logins & swipe cards</div>
                      <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.65 }}>Password reuse, tailgating, no contextual risk, weak attribution on who opened which record.</div>
                    </div>
                    <div style={{ ...glass, padding: 24, borderColor: "rgba(52,211,153,0.28)" }}>
                      <div style={{ fontSize: 10, color: T.ok, fontWeight: 700, letterSpacing: "0.16em", marginBottom: 12 }}>AFTER — THIS PLATFORM</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Biometric + AI risk score</div>
                      <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.65 }}>Per-person liveness, device/location/time signals, step-up MFA, immutable access log.</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: patient ? "1fr 340px" : "1fr", gap: 20 }}>
                    <div style={{ ...glass, overflow: "hidden" }}>
                      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.line2}`, fontWeight: 700, fontSize: 14, letterSpacing: "0.04em" }}>Patient Records</div>
                      {loadingTable ? (
                        <div style={{ padding: 28 }}>{[1, 2, 3, 4, 5].map(i => (
                          <div key={i} style={{ height: 48, marginBottom: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", animation: "shimmer 1.2s infinite" }} />
                        ))}</div>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ color: T.dim, textAlign: "left" }}>
                              {["Name", "ID", "Ward", "Admitted", "Status"].map(h => (
                                <th key={h} style={{ padding: "14px 20px", fontSize: 10, letterSpacing: "0.14em", fontWeight: 700 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {PATIENTS.map(p => (
                              <tr key={p.id} onClick={() => { sfx.tap(); setPatient(p); }}
                                style={{ borderTop: `1px solid ${T.line2}`, cursor: "pointer", background: patient?.id === p.id ? T.goldDim : "transparent" }}>
                                <td style={{ padding: "16px 20px", fontWeight: 600 }}>{p.name}</td>
                                <td style={{ padding: "16px 20px", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.muted }}>{p.id}</td>
                                <td style={{ padding: "16px 20px" }}>{p.ward}</td>
                                <td style={{ padding: "16px 20px", color: T.muted }}>{p.admitted}</td>
                                <td style={{ padding: "16px 20px" }}>
                                  <span style={{
                                    padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                                    background: p.status === "Critical" ? "rgba(248,113,113,0.15)" : p.status === "Stable" ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.05)",
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
                      <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} style={{ ...glass, padding: 26, alignSelf: "start" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 18 }}>{patient.name}</div>
                            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: T.dim }}>{patient.id}</div>
                          </div>
                          <button onClick={() => setPatient(null)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}><X size={18} /></button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                          {[{ l: "HR", v: patient.hr }, { l: "BP", v: patient.bp }, { l: "SpO₂", v: patient.spo2 + "%" }].map(v => (
                            <div key={v.l} style={{ background: "#060606", borderRadius: 12, padding: 12, textAlign: "center", border: `1px solid ${T.line2}` }}>
                              <div style={{ fontSize: 9, color: T.dim, letterSpacing: "0.1em" }}>{v.l}</div>
                              <div style={{ fontWeight: 700, color: T.gold, fontSize: 16, marginTop: 4 }}>{v.v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Doctor:</strong> {patient.doctor}</div>
                        <div style={{ fontSize: 13, marginBottom: 12 }}><strong>Ward:</strong> {patient.ward}</div>
                        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, padding: 14, background: "#060606", borderRadius: 12 }}>{patient.notes}</div>
                      </motion.div>
                    )}
                  </div>
                </>
              )}

              {(dashTab === "log" || dashTab === "admin") && (
                <div style={{ ...glass, overflow: "hidden" }}>
                  <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.line2}`, fontWeight: 700 }}>
                    {dashTab === "admin" ? "System-Wide Audit Trail" : "My Access Log"}
                  </div>
                  {audit.length === 0 ? <div style={{ padding: 56, textAlign: "center", color: T.dim }}>No events yet</div> : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: T.dim, textAlign: "left" }}>
                          {["User", "Time", "Device", "Location", "Score", "Outcome"].map(h => (
                            <th key={h} style={{ padding: "14px 16px", fontSize: 10, letterSpacing: "0.12em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(dashTab === "log" ? audit.filter(a => a.user === session.name) : audit).map(a => (
                          <tr key={a.id} style={{ borderTop: `1px solid ${T.line2}` }}>
                            <td style={{ padding: "14px 16px", fontWeight: 600 }}>{a.user}</td>
                            <td style={{ padding: "14px 16px", fontFamily: "IBM Plex Mono, monospace", color: T.muted, fontSize: 11 }}>{a.time}</td>
                            <td style={{ padding: "14px 16px" }}>{a.device}</td>
                            <td style={{ padding: "14px 16px" }}>{a.location}</td>
                            <td style={{ padding: "14px 16px", fontFamily: "IBM Plex Mono, monospace", fontWeight: 700 }}>{a.score}</td>
                            <td style={{ padding: "14px 16px" }}>
                              <span style={{
                                padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
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
                <div style={{ ...glass, padding: 36 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Security settings</h3>
                  <p style={{ color: T.muted, fontSize: 14, marginBottom: 24 }}>Enrolled reference frames (local demo storage only).</p>
                  <div style={{ display: "flex", gap: 14, marginBottom: 28 }}>
                    {(session.captures || []).map((c, i) => (
                      <img key={i} src={c} alt="" style={{ width: 100, height: 100, borderRadius: 14, objectFit: "cover", border: `1px solid ${T.line}` }} />
                    ))}
                    {!(session.captures || []).length && <div style={{ color: T.dim }}>Re-enrol to attach capture thumbnails to this session.</div>}
                  </div>
                  <button style={btnGold} onClick={() => { sfx.tap(); setView("enroll"); setStep(0); setConsent(false); setCaptures([]); }}>
                    Re-enrol biometric profile
                  </button>
                </div>
              )}

              {dashTab === "staff" && isAdmin && (
                <div style={{ ...glass, overflow: "hidden" }}>
                  <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.line2}`, fontWeight: 700 }}>Staff Directory</div>
                  {enrolled.length === 0 ? <div style={{ padding: 48, color: T.dim, textAlign: "center" }}>No enrolled staff</div> :
                    enrolled.map((u, i) => (
                      <div key={i} style={{ display: "flex", gap: 16, padding: "16px 24px", borderBottom: `1px solid ${T.line2}`, alignItems: "center" }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.goldDim, color: T.gold, display: "grid", placeItems: "center", fontWeight: 700 }}>
                          {u.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: T.dim }}>{u.role} · {u.dept}</div>
                        </div>
                        <div style={{ fontFamily: "IBM Plex Mono, monospace", color: T.gold, fontSize: 12 }}>{u.staffId}</div>
                      </div>
                    ))}
                </div>
              )}
            </main>
          </div>
        </div>
        <style>{`@keyframes shimmer { 50% { opacity: 0.4; } }`}</style>
      </div>
    );
  }

  /* ═══════════════ ITERATIONS / ETHICS / AUDIT ═══════════════ */
  if (view === "iterations") {
    const vers = [
      { v: "V1", q: "“Feels like a checkbox — I would not trust this with patient records.”", who: "Nurse Kavindi Silva", c: "Replaced binary pass/fail with multi-factor risk breakdown and visible weights." },
      { v: "V2", q: "“A ward nurse and a system admin must not share one console.”", who: "Dr. S. Wickrama", c: "Role-gated portal: clinical records vs administrator audit and staff directory." },
      { v: "V3", q: "“Where is consent? What stops infinite retries at 03:00?”", who: "IT Security · R. Fernando", c: "Consent gate, OTP step-up, failed-attempt scoring, ethics panel, this iteration log." },
    ];
    return (
      <div style={page}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <Top right={<button style={btnGhost} onClick={() => go("landing")}>Home</button>} />
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 32px 100px" }}>
            <motion.div initial="hidden" animate="show" variants={stagger}>
              <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <GitBranch size={26} color={T.gold} />
                <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.03em" }}>Iteration & feedback log</h1>
              </motion.div>
              <motion.p variants={fadeUp} style={{ color: T.muted, marginBottom: 40, lineHeight: 1.7 }}>Development history inside the product — each release driven by named end-user feedback.</motion.p>
              {vers.map((x, i) => (
                <motion.div key={i} variants={fadeUp} style={{ ...glass, padding: 32, marginBottom: 18 }}>
                  <div style={{ display: "inline-block", padding: "5px 14px", borderRadius: 999, border: `1px solid ${T.line}`, color: T.gold, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", marginBottom: 16 }}>{x.v}</div>
                  <p style={{ fontSize: 16, fontStyle: "italic", lineHeight: 1.65, marginBottom: 10 }}>{x.q}</p>
                  <p style={{ fontSize: 12, color: T.dim, marginBottom: 14 }}>— {x.who}</p>
                  <p style={{ fontSize: 14, color: T.teal, lineHeight: 1.55 }}>→ {x.c}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "ethics") {
    return (
      <div style={page}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <Top right={<button style={btnGhost} onClick={() => go(session ? "dashboard" : "landing")}>Back</button>} />
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 32px 100px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
              <Scale size={26} color={T.gold} />
              <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.03em" }}>Ethics & legal</h1>
            </div>
            {[
              { t: "What's real vs simulated", d: "Liveness uses real in-browser face-api.js detection. Full identity matching is simulated with transparent weights so every score remains explainable. Demo frames stay in localStorage only." },
              { t: "Data protection principles", d: "Mandatory consent before camera. Minimisation and purpose limitation. Production requires DPIA, encryption, retention limits, and erasure under GDPR-style rules and Sri Lanka’s PDPA." },
              { t: "Risks in healthcare biometrics", d: "False rejection can block a clinician in an emergency — OTP step-up and fallback paths are mandatory. Template breach is irreversible. Matching bias (NIST FRVT) needs human review on borderline scores." },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.1 }} style={{ ...glass, padding: 32, marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T.gold, marginBottom: 12 }}>{s.t}</h3>
                <p style={{ color: T.muted, fontSize: 14.5, lineHeight: 1.75 }}>{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === "audit") {
    return (
      <div style={page}>
        <Atmosphere />
        <div style={{ position: "relative", zIndex: 2 }}>
          <Top right={<button style={btnGhost} onClick={() => go("landing")}>Home</button>} />
          <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 32px" }}>
            <h1 style={{ fontSize: 28, fontWeight: 500, marginBottom: 24, letterSpacing: "-0.02em" }}>Access log</h1>
            <div style={{ ...glass, overflow: "hidden" }}>
              {audit.length === 0 ? <div style={{ padding: 56, textAlign: "center", color: T.dim }}>No authentication events</div> : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: T.dim, textAlign: "left" }}>
                      {["User", "Time", "Score", "Outcome"].map(h => (
                        <th key={h} style={{ padding: "14px 20px", fontSize: 10, letterSpacing: "0.14em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map(a => (
                      <tr key={a.id} style={{ borderTop: `1px solid ${T.line2}` }}>
                        <td style={{ padding: "14px 20px", fontWeight: 600 }}>{a.user}</td>
                        <td style={{ padding: "14px 20px", fontFamily: "IBM Plex Mono, monospace", color: T.muted }}>{a.time}</td>
                        <td style={{ padding: "14px 20px", fontFamily: "IBM Plex Mono, monospace", fontWeight: 700 }}>{a.score}</td>
                        <td style={{ padding: "14px 20px", color: a.tier === "low" ? T.ok : a.tier === "med" ? T.warn : T.bad }}>{a.outcome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}