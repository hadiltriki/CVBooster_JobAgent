"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import React from "react";
import {
  Upload, FileText, CheckCircle, RotateCcw,
  Zap, RefreshCw, AlertCircle, Sparkles,
  BookOpen, Save, Search,
} from "lucide-react";
import "./CVBoosterApp.css";
import EnrichScreen, { PLATFORM_LABS, PLATFORM_CERTS, PLATFORM_QUIZ, DEFAULT_SELECTIONS } from "./EnrichScreen";

const API_URL = "http://localhost:8000";

// ─────────────────────────────────────────────────────────────────────────────
// STEPPER  (3 steps only)
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ["Import", "Enrich", "Done"];
function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="stepper-steps">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done   = currentStep > n;
        const active = currentStep === n;
        return (
          <div key={n} className="stepper-item">
            <div className={`st ${done ? "done" : active ? "active" : ""}`}>
              <div className="st-n">{done ? <CheckCircle size={11} /> : n}</div>
              <span className="st-lbl">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="st-ln" />}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function CVBoosterApp() {
  const [phase,          setPhase]          = useState("idle");
  const [fileName,       setFileName]       = useState("");
  const [pendingFile,    setPendingFile]     = useState<File | null>(null);
  const [errorMsg,       setErrorMsg]       = useState("");
  const [dragging,       setDragging]       = useState(false);
  const [selections,     setSelections]     = useState(DEFAULT_SELECTIONS);
  const [missingSections, setMissingSections] = useState<string[]>([]);
  const [rawText,        setRawText]        = useState("");
  const [saving,         setSaving]         = useState(false);

  // Platform data
  const [platformLabs,   setPlatformLabs]   = useState(PLATFORM_LABS);
  const [platformCerts,  setPlatformCerts]  = useState(PLATFORM_CERTS);
  const [platformQuiz,   setPlatformQuiz]   = useState(PLATFORM_QUIZ);
  const [platformStatus, setPlatformStatus] = useState("ok");

 const [userId, setUserId] = useState("user_default");

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("user_id") || "user_default";
  setUserId(id);
}, []);

  // Load real platform data
  useEffect(() => {
    if (!userId || userId === "user_default") return;
    fetch(`${API_URL}/platform-data/${userId}`)
      .then(r => r.json())
      .then(data => {
        setPlatformStatus(data.status || "ok");
        // Hard errors: block platform section entirely
        if (["invalid_user", "db_error", "no_user_id"].includes(data.status)) {
          setPlatformLabs([]);
          setPlatformCerts([]);
          setPlatformQuiz({ domain: "", score: 0, level: "", description: "" });
          setSelections({ quiz: false, labs: [], certs: [] });
          return;
        }
        // no_data: user exists but has no activity yet — still let them save CV
        if (data.status === "no_data") {
          setPlatformLabs([]);
          setPlatformCerts([]);
          setPlatformQuiz({ domain: "", score: 0, level: "", description: "" });
          setSelections({ quiz: false, labs: [], certs: [] });
          // Don't return — fall through so status is set and enrich screen shows
          return;
        }
        if (data.labs)           setPlatformLabs(data.labs);
        if (data.certifications) setPlatformCerts(data.certifications);
        if (data.quiz)           setPlatformQuiz({ description: "", ...data.quiz });
        setSelections({
          quiz:  true,
          labs:  (data.labs  || []).map((l: { id: string }) => l.id),
          certs: (data.certifications || []).map((c: { id: string }) => c.id),
        });
      })
      .catch(err => {
        console.warn("Platform fetch failed:", err);
        // Keep everything empty — never show fake data
        setPlatformLabs([]);
        setPlatformCerts([]);
        setPlatformQuiz({ domain: "", score: 0, level: "", description: "" });
        setSelections({ quiz: false, labs: [], certs: [] });
        setPlatformStatus("db_error");
      });
  }, [userId]);

  const fileRef = useRef<HTMLInputElement>(null);

  const stepperStep =
    phase === "idle"     ? 1 :
    phase === "scanning" ? 1 :
    phase === "enrich"   ? 2 :
    phase === "saving"   ? 2 :
    phase === "done"     ? 3 : 1;

  // ── Step 1: Upload + extract text ──────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setPendingFile(file);
    setPhase("scanning");

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_URL}/extract-cv`, { method: "POST", body: fd });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      setRawText(data.text || "");
      setMissingSections(data.missing_sections || []);
      setPhase("enrich");
    } catch (e: unknown) {
      setErrorMsg((e instanceof Error ? e.message : String(e)) || "Unknown error");
      setPhase("error");
    }
  }, []);

  // ── Step 2: Save CV to Cosmos DB ──────────────────────────────────────────
  const handleSave = useCallback(async (extraData: Record<string, unknown> = {}) => {
    if (!pendingFile) return;
    setSaving(true);
    setPhase("saving");

    try {
      const selectedLabObjs  = platformLabs.filter(l => selections.labs.includes(l.id));
      const selectedCertObjs = platformCerts.filter(c => selections.certs.includes(c.id));

      const fd = new FormData();
      fd.append("file",        pendingFile);
      fd.append("user_id",     userId);
      fd.append("quiz_data",   JSON.stringify(selections.quiz && platformQuiz ? platformQuiz : null));
      fd.append("labs_data",   JSON.stringify(selectedLabObjs));
      fd.append("certs_data",  JSON.stringify(selectedCertObjs));
      fd.append("extra_data",  JSON.stringify({
        languages:  Array.isArray(extraData.languages)  ? extraData.languages  : [],
        education:  Array.isArray(extraData.education)  ? extraData.education  : [],
        experience: Array.isArray(extraData.experience) ? extraData.experience : [],
      }));

      const res = await fetch(`${API_URL}/save-cv`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      setPhase("done");
    } catch (e: unknown) {
      setErrorMsg((e instanceof Error ? e.message : String(e)) || "Unknown error");
      setPhase("error");
    } finally {
      setSaving(false);
    }
  }, [pendingFile, selections, platformLabs, platformCerts, platformQuiz, userId]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const reset = () => {
    setPhase("idle"); setFileName(""); setPendingFile(null);
    setErrorMsg(""); setRawText(""); setMissingSections([]);
    setSelections(DEFAULT_SELECTIONS); setSaving(false);
  };

  return (
    <div className="app">
      <div className="blobs" aria-hidden="true">
        <div className="blob blob-1" /><div className="blob blob-2" />
      </div>

      <header className="topbar">
        <div className="logo">
          <div className="logo-icon"><Zap size={14} color="#fff" /></div>
          <span className="logo-text"> <em>SUBUL</em></span>
        </div>
        <Stepper currentStep={stepperStep} />
      </header>

      <main className="main-content">

        {/* ══ IDLE ══════════════════════════════════════════════ */}
        {phase === "idle" && (
          <div className="screen screen-idle">
            <div className="hero">
              <div className="hero-badge"><Sparkles size={11} /><span>POWERED BY SUBUL</span></div>
              <h1>Complete your<br /><span className="hero-gradient">job profile</span></h1>
              <p className="hero-sub">
                Upload your CV, enrich it with your certifications and labs from SUBUL,
                then save it to your profile and search for jobs.
              </p>
            </div>
            <div
              className={`dropzone${dragging ? " dragging" : ""}`}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileRef.current?.click()}
            >
              <div className="drop-icon-wrap"><Upload size={26} color="#E91E8C" /></div>
              <div className="drop-title">{dragging ? "Drop it here!" : "Drag your CV here"}</div>
              <button className="btn-browse" type="button">Browse files</button>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }}
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            </div>
          </div>
        )}

        {/* ══ SCANNING ══════════════════════════════════════════ */}
        {phase === "scanning" && (
          <div className="screen screen-loading">
            <div className="loader-ring-wrap">
              <div className="loader-ring-outer" />
              <RefreshCw size={26} color="#7B2FBE" style={{ animation: "spin 2s linear infinite reverse" }} />
            </div>
            <div className="loading-title">Reading your CV…</div>
            <div className="loading-file">{fileName}</div>
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>Extracting your information</div>
          </div>
        )}

        {/* ══ ENRICH ════════════════════════════════════════════ */}
        {phase === "enrich" && (
          <EnrichScreen
            fileName={fileName}
            selections={selections}
            setSelections={setSelections}
            onSave={handleSave}
            onBack={reset}
            missingSections={missingSections}
            platformLabs={platformLabs}
            platformCerts={platformCerts}
            platformQuiz={platformQuiz}
            platformStatus={platformStatus}
          />
        )}

        {/* ══ SAVING ════════════════════════════════════════════ */}
        {phase === "saving" && (
          <div className="screen screen-loading">
            <div className="loader-ring-wrap">
              <div className="loader-ring-outer" />
              <Save size={26} color="#7B2FBE" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
            <div className="loading-title">Saving your profile…</div>
            <div className="loading-file">{fileName}</div>
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>Storing your enriched CV data</div>
          </div>
        )}

        {/* ══ DONE ══════════════════════════════════════════════ */}
        {phase === "done" && (
          <div className="screen screen-idle" style={{ justifyContent: "center", alignItems: "center", gap: 32 }}>
            <div style={{
              background: "var(--surface)",
              border: "1.5px solid rgba(16,185,129,.3)",
              borderRadius: 24,
              padding: "48px 56px",
              textAlign: "center",
              maxWidth: 520,
              boxShadow: "0 8px 40px rgba(16,185,129,.12)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            }}>
              {/* Success icon */}
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "linear-gradient(135deg,rgba(16,185,129,.15),rgba(16,185,129,.05))",
                border: "2px solid rgba(16,185,129,.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 24px rgba(16,185,129,.2)",
              }}>
                <CheckCircle size={34} color="#10B981" />
              </div>

              <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", letterSpacing: "-.02em", marginBottom: 8 }}>
                  Your CV is saved!
                </div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, maxWidth: 380 }}>
                  Your profile has been enriched with your SUBUL certifications and labs,
                  and saved to your account. You're ready to search for jobs!
                </div>
              </div>

              {/* File tag */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 18px", borderRadius: 12,
                background: "rgba(16,185,129,.06)", border: "1.5px solid rgba(16,185,129,.2)",
              }}>
                <FileText size={16} color="#10B981" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>{fileName}</span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => window.location.href = `/jobs-search?user_id=${userId}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "14px 32px", borderRadius: 14,
                    background: "var(--grad)", border: "none",
                    color: "#fff", fontFamily: "var(--font)",
                    fontSize: 15, fontWeight: 800, cursor: "pointer",
                    boxShadow: "0 6px 28px rgba(233,30,140,.38)",
                    transition: "all .2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 36px rgba(233,30,140,.55)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 6px 28px rgba(233,30,140,.38)"; e.currentTarget.style.transform = "none"; }}
                >
                  <Search size={15} /> Search Jobs
                </button>
                <button
                  type="button"
                  onClick={reset}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "14px 24px", borderRadius: 14,
                    background: "var(--surface)", border: "1.5px solid var(--border)",
                    color: "var(--text-muted)", fontFamily: "var(--font)",
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                    transition: "all .2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(123,47,190,.3)"; e.currentTarget.style.color = "var(--violet)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  <RotateCcw size={13} /> Import another CV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ ERROR ═════════════════════════════════════════════ */}
        {phase === "error" && (
          <div className="screen screen-error">
            <div className="error-icon-wrap"><AlertCircle size={28} color="#EF4444" /></div>
            <div className="error-title">An error occurred</div>
            <div className="error-msg">{errorMsg}</div>
            <div className="error-hint">
              Make sure the backend is running:<br />
              <code>uvicorn main:app --reload --port 8000</code>
            </div>
            <button className="btn-reset" onClick={reset} type="button">Try again</button>
          </div>
        )}

      </main>
    </div>
  );
}