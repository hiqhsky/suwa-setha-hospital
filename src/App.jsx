import React, { useState, useRef, useCallback, useEffect } from "react";
import * as faceapi from "@vladmandic/face-api";
import { ShieldCheck, ShieldAlert, ShieldX, LogOut, Stethoscope, Users, ClipboardList, Lock, Camera } from "lucide-react";
import Chart from "chart.js/auto";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

const FACE_MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/";

const ROLES = [
  { id: "admin", label: "Administrator", Icon: Lock },
  { id: "doctor", label: "Doctor", Icon: Stethoscope },
  { id: "nurse", label: "Nurse", Icon: Users },
  { id: "receptionist", label: "Receptionist", Icon: ClipboardList },
];

const FACTORS = [
  { key: "device", label: "Device Fingerprint", weight: 22 },
  { key: "location", label: "Network Location", weight: 18 },
  { key: "time", label: "Time-of-Day Pattern", weight: 8 },
  { key: "biometric", label: "Facial Liveness & Match", weight: 30 },
  { key: "behavioral", label: "Behavioral Baseline", weight: 12 },
  { key: "frequency", label: "Access Frequency", weight: 10 },
];

function computeScan(anomalous, attempts) {
  if (anomalous) {
    return {
      device: { pass: false, detail: "Unrecognized device" },
      location: { pass: false, detail: "External network" },
      time: { pass: true, detail: "03:14 — outside normal hours", warn: true },
      biometric: { pass: true, detail: `${92 - attempts * 4}% match`, value: 92 - attempts * 4 },
      behavioral: { pass: false, detail: "Rhythm deviation detected" },
      frequency: { pass: true, detail: "3 attempts in 4 minutes", warn: true },
      failedAttempts: attempts,
    };
  }
  return {
    device: { pass: true, detail: "Registered hospital workstation" },
    location: { pass: true, detail: "Internal hospital network" },
    time: { pass: true, detail: "Within normal operating hours" },
    biometric: { pass: true, detail: "97.8% match • Live face confirmed", value: 97.8 },
    behavioral: { pass: true, detail: "Consistent with baseline" },
    frequency: { pass: true, detail: "Normal frequency" },
    failedAttempts: 0,
  };
}

function scoreFromScan(scan) {
  let risk = 0;
  if (!scan.device.pass) risk += 22;
  if (!scan.location.pass) risk += 18;
  if (scan.time.warn) risk += 8;
  if (scan.biometric.value < 95) risk += (95 - scan.biometric.value) * 0.65;
  if (!scan.behavioral.pass) risk += 12;
  if (scan.frequency.warn) risk += 6;
  risk += scan.failedAttempts * 7;
  return Math.min(100, Math.round(risk));
}

function verdictFromScore(score) {
  if (score <= 25) return { tier: "low", label: "Access Granted", color: "#00c4b4", Icon: ShieldCheck };
  if (score <= 60) return { tier: "medium", label: "Step-up Verification Required", color: "#d4af37", Icon: ShieldAlert };
  return { tier: "high", label: "Access Denied — Security Review Triggered", color: "#e63939", Icon: ShieldX };
}

const PIPELINE_STAGES = [
  { name: "Registration", count: 29, wait: "5 min", icon: "📋" },
  { name: "Triage", count: 44, wait: "17 min", icon: "🩺" },
  { name: "Consultation", count: 61, wait: "23 min", icon: "👨‍⚕️" },
  { name: "Diagnostics", count: 21, wait: "12 min", icon: "🔬" },
  { name: "Discharge", count: 17, wait: "4 min", icon: "🏠" },
];

const ALERTS = [
  { title: "Triage Bottleneck Forming", desc: "Average wait 4min above SLA. Model predicts continued pressure.", time: "2m ago" },
  { title: "Emergency Surge Forecast", desc: "+31% arrivals predicted 17:00–19:00 based on historical + weather data.", time: "27m ago" },
];

const DEPTS = [
  { name: "Emergency", load: 89, patients: 24 },
  { name: "OPD", load: 67, patients: 39 },
  { name: "Radiology", load: 54, patients: 12 },
  { name: "Laboratory", load: 41, patients: 8 },
  { name: "Pharmacy", load: 76, patients: 19 },
];

export default function App() {
  const [view, setView] = useState("login");
  const [role, setRole] = useState("doctor");
  const [anomalous, setAnomalous] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [scan, setScan] = useState(null);
  const [score, setScore] = useState(0);
  const [revealCount, setRevealCount] = useState(0);
  const [highRiskStreak, setHighRiskStreak] = useState(0);

  const [patients, setPatients] = useState(164);
  const [waitTime, setWaitTime] = useState(27);
  const [capacity, setCapacity] = useState(78);
  const [surgeRisk, setSurgeRisk] = useState("HIGH");
  const [aiInsight, setAiInsight] = useState("Activate second triage station immediately. Projected wait reduction: 11 minutes. Confidence: 89%.");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Camera access failed. Please use the Vercel HTTPS link on your phone or laptop.");
    }
  }, []);

  const startScan = async () => {
    setPhase("scanning");
    await startCamera();
    const scanData = computeScan(anomalous, highRiskStreak + 1);
    setScan(scanData);
    setRevealCount(0);

    FACTORS.forEach((_, i) => setTimeout(() => setRevealCount(i + 1), 300 * (i + 1)));

    const finalScore = scoreFromScan(scanData);
    setTimeout(() => {
      setScore(finalScore);
      const v = verdictFromScore(finalScore);
      if (v.tier === "high") {
        const streak = highRiskStreak + 1;
        setHighRiskStreak(streak);
        if (streak >= 3) {
          alert("Account locked due to multiple high-risk attempts (simulated for demo).");
          setPhase("idle");
          return;
        }
      }
      setPhase("result");
    }, 2800);
  };

  const loginSuccess = (selectedRole) => {
    setRole(selectedRole);
    setView("dashboard");
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  useEffect(() => {
    if (view !== "dashboard") return;
    const interval = setInterval(() => {
      setPatients(p => Math.max(130, Math.min(195, p + Math.floor(Math.random() * 11) - 5)));
      setWaitTime(w => Math.max(15, Math.min(38, w + Math.floor(Math.random() * 7) - 3)));
      setCapacity(c => Math.max(65, Math.min(92, c + Math.floor(Math.random() * 6) - 2)));
      setSurgeRisk(c => c === "HIGH" ? "MODERATE" : "HIGH");
    }, 4500);
    return () => clearInterval(interval);
  }, [view]);

  const applyAI = () => {
    setAiInsight("Recommendation applied. Second triage station activated. New projected average wait: 16 minutes.");
  };

  useEffect(() => {
    if (view !== "dashboard" || !chartRef.current) return;
    const ctx = document.getElementById("waitChart");
    if (ctx) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'],
          datasets: [
            { label: 'Predicted', data: [15,21,28,33,30,25,19,17,23,31], borderColor: '#00c4b4', tension: 0.4, borderWidth: 3 },
            { label: 'Actual', data: [14,19,26,35,32,23,18,16,22,29], borderColor: '#d4af37', borderDash: [3,2], tension: 0.4, borderWidth: 3 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#888' } } },
          scales: {
            y: { grid: { color: '#222' }, ticks: { color: '#666' } },
            x: { grid: { color: '#222' }, ticks: { color: '#666' } }
          }
        }
      });
    }
  }, [view]);

  if (view === "login") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e8e8e8", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONT_IMPORT}</style>
        <div style={{ width: "100%", maxWidth: "520px", background: "#111", border: "1px solid #d4af37", borderRadius: "16px", padding: "40px" }}>
          <h1 style={{ color: "#d4af37", textAlign: "center", fontFamily: "Space Grotesk, sans-serif", fontSize: "28px" }}>Suwa Setha Hospital</h1>
          <p style={{ textAlign: "center", color: "#888", marginBottom: "30px" }}>AI-Driven Biometric Cybersecurity Platform</p>

          <div style={{ textAlign: "center", margin: "30px 0" }}>
            <div onClick={startScan} style={{ width: "180px", height: "180px", margin: "0 auto", border: "4px solid #d4af37", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <video ref={videoRef} muted playsInline style={{ width: "160px", height: "160px", borderRadius: "50%", objectFit: "cover", transform: "scaleX(-1)" }} />
            </div>
            <p style={{ marginTop: "20px", color: phase === "scanning" ? "#00c4b4" : "#888", fontFamily: "IBM Plex Mono, monospace" }}>
              {phase === "scanning" ? "LIVE BIOMETRIC SCAN ACTIVE" : "TAP TO START SECURE BIOMETRIC AUTHENTICATION"}
            </p>
          </div>

          {phase === "scanning" && scan && (
            <div style={{ background: "#1a1a1a", padding: "20px", borderRadius: "12px", marginTop: "20px" }}>
              {FACTORS.map((f, i) => (
                <div key={f.key} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #222", opacity: revealCount > i ? 1 : 0.4 }}>
                  <span>{f.label}</span>
                  <span style={{ color: scan[f.key].pass ? "#00c4b4" : "#e63939", fontFamily: "IBM Plex Mono, monospace" }}>
                    {scan[f.key].detail}
                  </span>
                </div>
              ))}
              <div style={{ textAlign: "center", marginTop: "20px", fontSize: "28px", fontWeight: 700, color: "#d4af37" }}>
                RISK SCORE: {score}
              </div>
            </div>
          )}

          {phase === "result" && (
            <button onClick={() => loginSuccess(role)} style={{ width: "100%", padding: "16px", background: "#d4af37", color: "#0a0a0a", border: "none", borderRadius: "8px", fontWeight: 700, marginTop: "20px" }}>
              ACCESS GRANTED — ENTER PLATFORM
            </button>
          )}

          <div style={{ marginTop: "30px", textAlign: "center" }}>
            <label style={{ color: "#666" }}>
              <input type="checkbox" checked={anomalous} onChange={e => setAnomalous(e.target.checked)} /> Simulate suspicious login
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0a0a", color: "#e8e8e8", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <style>{FONT_IMPORT}</style>

      <header style={{ background: "#111", padding: "20px 40px", borderBottom: "1px solid #d4af37", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "26px", fontWeight: 700, color: "#d4af37" }}>SUWA SETHA HOSPITAL</div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ color: "#00c4b4" }}>● AI PLATFORM LIVE</div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace" }}>{role.toUpperCase()} CONSOLE</div>
          <button onClick={() => setView("login")} style={{ background: "transparent", border: "1px solid #444", color: "#aaa", padding: "8px 20px", borderRadius: "6px" }}>LOGOUT</button>
        </div>
      </header>

      <div style={{ maxWidth: "1480px", margin: "0 auto", padding: "40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px", marginBottom: "40px" }}>
          <div style={{ background: "#111", padding: "24px", borderRadius: "12px", border: "1px solid #222" }}>
            <div style={{ color: "#888", fontSize: "12px" }}>PATIENTS IN SYSTEM</div>
            <div style={{ fontSize: "46px", fontFamily: "IBM Plex Mono, monospace", margin: "12px 0" }}>{patients}</div>
            <div style={{ color: "#00c4b4" }}>↑ 11 vs last hour</div>
          </div>
          <div style={{ background: "#111", padding: "24px", borderRadius: "12px", border: "1px solid #222" }}>
            <div style={{ color: "#888", fontSize: "12px" }}>PREDICTED AVG WAIT</div>
            <div style={{ fontSize: "46px", fontFamily: "IBM Plex Mono, monospace", margin: "12px 0", color: "#e63939" }}>{waitTime} min</div>
            <div style={{ color: "#d4af37" }}>Surge risk elevated</div>
          </div>
          <div style={{ background: "#111", padding: "24px", borderRadius: "12px", border: "1px solid #222" }}>
            <div style={{ color: "#888", fontSize: "12px" }}>CAPACITY LOAD</div>
            <div style={{ fontSize: "46px", fontFamily: "IBM Plex Mono, monospace", margin: "12px 0" }}>{capacity}%</div>
            <div style={{ color: "#00c4b4" }}>Within safe threshold</div>
          </div>
          <div style={{ background: "#111", padding: "24px", borderRadius: "12px", border: "1px solid #222" }}>
            <div style={{ color: "#888", fontSize: "12px" }}>2H SURGE RISK</div>
            <div style={{ fontSize: "46px", fontFamily: "IBM Plex Mono, monospace", margin: "12px 0", color: "#e63939" }}>{surgeRisk}</div>
            <div style={{ color: "#aaa" }}>ER + OPD overlap predicted</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", marginBottom: "30px" }}>
          <div style={{ background: "#111", padding: "28px", borderRadius: "16px", border: "1px solid #222" }}>
            <div style={{ color: "#d4af37", fontWeight: 600, marginBottom: "20px" }}>LIVE PATIENT FLOW PIPELINE</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {PIPELINE_STAGES.map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px" }}>{s.icon}</div>
                  <div style={{ fontSize: "13px" }}>{s.name}</div>
                  <div style={{ fontSize: "28px", color: "#00c4b4", fontFamily: "IBM Plex Mono, monospace" }}>{s.count}</div>
                  <div style={{ fontSize: "12px", color: "#666" }}>{s.wait}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#111", padding: "28px", borderRadius: "16px", border: "1px solid #d4af37" }}>
            <div style={{ color: "#d4af37", fontWeight: 600, marginBottom: "16px" }}>AETHER AI RECOMMENDATION</div>
            <p style={{ lineHeight: 1.6 }}>{aiInsight}</p>
            <button onClick={applyAI} style={{ marginTop: "24px", background: "#d4af37", color: "#0a0a0a", border: "none", padding: "14px 32px", borderRadius: "8px", fontWeight: 700 }}>
              EXECUTE RECOMMENDATION
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "24px" }}>
          <div style={{ background: "#111", padding: "28px", borderRadius: "16px", border: "1px solid #222" }}>
            <div style={{ color: "#d4af37", fontWeight: 600, marginBottom: "20px" }}>PREDICTED vs ACTUAL WAIT TIME</div>
            <div style={{ height: "280px" }}>
              <canvas id="waitChart"></canvas>
            </div>
          </div>

          <div style={{ background: "#111", padding: "28px", borderRadius: "16px", border: "1px solid #222" }}>
            <div style={{ color: "#d4af37", fontWeight: 600, marginBottom: "20px" }}>PREDICTIVE ALERTS</div>
            {ALERTS.map((a, i) => (
              <div key={i} style={{ padding: "16px", background: "rgba(230,57,57,0.08)", borderLeft: "4px solid #e63939", marginBottom: "12px" }}>
                <strong>{a.title}</strong>
                <p style={{ fontSize: "13px", color: "#aaa", marginTop: "6px" }}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#111", padding: "28px", borderRadius: "16px", border: "1px solid #222", marginTop: "30px" }}>
          <div style={{ color: "#d4af37", fontWeight: 600, marginBottom: "20px" }}>DEPARTMENT QUEUE LOAD</div>
          {DEPTS.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "20px", padding: "16px 0", borderBottom: i < DEPTS.length - 1 ? "1px solid #222" : "none" }}>
              <div style={{ width: "160px" }}>{d.name}</div>
              <div style={{ flex: 1, height: "10px", background: "#1f1f1f", borderRadius: "999px" }}>
                <div style={{ width: `${d.load}%`, height: "100%", background: "linear-gradient(90deg, #00c4b4, #d4af37)" }} />
              </div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", color: "#00c4b4", width: "60px" }}>{d.load}%</div>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", color: "#666" }}>{d.patients} patients</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "60px", color: "#555", fontSize: "13px" }}>
          Securing Healthcare Operations: An AI-Driven Biometric Cybersecurity Platform for Suwa Setha Hospital
        </div>
      </div>
    </div>
  );
}