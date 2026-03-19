"use client";
import { useState, useEffect, useCallback } from "react";
import React from "react";
import {
  Zap, Briefcase, MapPin, TrendingUp, Wand2, Download,
  CheckCircle, AlertCircle, RefreshCw, RotateCcw,
  FileText, Target, Palette,
} from "lucide-react";
import FormatScreen, { FORMATS } from "./FormatScreen";
import { deriveImprovements, deriveCompliance, WhatWasImproved, ATSCompliance,
         ImprovementItem, ComplianceItem, ParsedCV } from "../app/components/cv-booster/ResultInsights";

// ─────────────────────────────────────────────────────────────────────────────
// SCORE RING
// ─────────────────────────────────────────────────────────────────────────────
function ScoreRing({ score, label, size = 108, animate = false }: {
  score: number; label: string; size?: number; animate?: boolean;
}) {
  const r = size * 0.38, circ = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;
  const color = score >= 75 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      <div style={{ position:"relative", width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="rgba(123,47,190,0.1)" strokeWidth={size*0.075} />
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={size*0.075}
            strokeDasharray={circ} strokeDashoffset={circ - dash}
            strokeLinecap="round"
            style={{ transition: animate ? "stroke-dashoffset 1.3s cubic-bezier(0.34,1.56,0.64,1)" : "none" }} />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:size*0.23, fontWeight:900, color, lineHeight:1 }}>{score}</span>
          <span style={{ fontSize:size*0.1, color:"var(--text-faint)" }}>/100</span>
        </div>
      </div>
      <span style={{ fontSize:12, color:"var(--text-muted)", fontWeight:600 }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CRITERIA BAR
// ─────────────────────────────────────────────────────────────────────────────
function CriteriaBar({ label, before, after, max }: {
  label: string; before: number; after: number; max: number;
}) {
  const improved = after > before;
  return (
    <div className="crit-row">
      <div className="crit-row-head">
        <span className="crit-row-label">{label}</span>
        <div className="crit-row-scores">
          <span className="score-before">{before}/{max}</span>
          {improved && <span className="score-after">→ {after}/{max}</span>}
        </div>
      </div>
      <div className="bar-track">
        <div className="bar-seg bar-before" style={{ width:`${(before/max)*100}%` }} />
        <div className="bar-seg bar-after" style={{
          width:`${(after/max)*100}%`,
          background: improved ? "linear-gradient(90deg,#E91E8C,#7B2FBE)" : "rgba(123,47,190,0.15)",
          transition: "width 1s cubic-bezier(0.34,1.56,0.64,1) 0.3s",
        }} />
      </div>
    </div>
  );
}

const CRITERIA_META = {
  sections:   { label: "Key Sections",         max: 20 },
  skills:     { label: "Technical Skills",     max: 18 },
  experience: { label: "Work Experience",      max: 18 },
  length:     { label: "CV Length",            max: 12 },
  contact:    { label: "Contact Info",         max:  8 },
  keywords:   { label: "ATS Keywords",         max:  8 },
  summary:    { label: "Professional Summary", max: 10 },
  languages:  { label: "Languages",            max:  6 },
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function JobBoosterApp() {
  // URL params + job fetch — all in one useEffect to avoid timing issues
  const [userId, setUserId] = useState("");
  const [jobId,  setJobId]  = useState("32e610bd-3b5c-4835-8582-2a135368e74e");

  // State
  const [phase,          setPhase]          = useState<"job"|"loading"|"done"|"error">("job");
  const [job,            setJob]            = useState<Record<string,string> | null>(null);
  const [jobLoading,     setJobLoading]     = useState(true);
  const [errorMsg,       setErrorMsg]       = useState("");
  const [selectedFormat, setSelectedFormat] = useState("ats");
  const [applyingFormat, setApplyingFormat] = useState(false);
  const [docxUrl,        setDocxUrl]        = useState<string | null>(null);
  const [docxName,       setDocxName]       = useState("");
  const [scoreBefore,    setScoreBefore]    = useState<number | null>(null);
  const [scoreAfter,     setScoreAfter]     = useState<number | null>(null);
  const [bdBefore,       setBdBefore]       = useState<Record<string,any> | null>(null);
  const [bdAfter,        setBdAfter]        = useState<Record<string,any> | null>(null);
  const [parsedCV,       setParsedCV]       = useState<ParsedCV | null>(null);
  const [domain,         setDomain]         = useState("");
  const [improvementItems, setImprovementItems] = useState<ImprovementItem[] | null>(null);
  const [complianceItems,  setComplianceItems]  = useState<ComplianceItem[] | null>(null);
  const [cvLanguage,       setCvLanguage]       = useState<"auto"|"fr"|"en">("auto");
  const API_URL = "";
  // Read URL params + fetch job in one shot to avoid timing race
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const uid     = params.get("user_id") || "";
    const jid     = params.get("job_id")  || "32e610bd-3b5c-4835-8582-2a135368e74e";
    setUserId(uid);
    setJobId(jid);

    fetch(`/job-data/${encodeURIComponent(jid)}`)
      .then(r => r.json())
      .then(data => { setJob(data); setJobLoading(false); })
      .catch(() => { setJob(null); setJobLoading(false); });
  }, []);

  // Enhance CV for this job
  const handleEnhance = useCallback(async () => {
    if (!userId) {
      setErrorMsg("No user ID found. Please access this page from your SUBUL account.");
      setPhase("error");
      return;
    }
    setPhase("loading");
    try {
      const fd = new FormData();
      fd.append("user_id",     userId);
      fd.append("job_id",      jobId);
      fd.append("cv_format",   selectedFormat);

      const res = await fetch(`${API_URL}/enhance-cv-for-job`, { method: "POST", body: fd });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const sBefore   = parseInt(res.headers.get("X-ATS-Score-Before") || "0");
      const sAfter    = parseInt(res.headers.get("X-ATS-Score-After")  || "0");
      const bbRaw     = res.headers.get("X-ATS-Breakdown-Before");
      const baRaw     = res.headers.get("X-ATS-Breakdown-After");
      const pcRaw     = res.headers.get("X-Parsed-CV");
      const domainRaw = res.headers.get("X-Domain") || "";
      const jobTitle  = res.headers.get("X-Job-Title") || "Job";

      setScoreBefore(sBefore);
      setScoreAfter(sAfter);
      if (bbRaw) setBdBefore(JSON.parse(bbRaw));
      if (baRaw) setBdAfter(JSON.parse(baRaw));
      if (pcRaw) setParsedCV(JSON.parse(pcRaw));
      if (domainRaw) setDomain(domainRaw);

      const newBdBefore = bbRaw ? JSON.parse(bbRaw) : null;
      const newBdAfter  = baRaw ? JSON.parse(baRaw) : null;
      const newParsedCV = pcRaw ? JSON.parse(pcRaw) : null;

      if (newBdBefore && newBdAfter) {
        setImprovementItems(deriveImprovements({
          parsedCV: newParsedCV, bdBefore: newBdBefore, bdAfter: newBdAfter,
          selections: { quiz: false, labs: [], certs: [] },
          domain: domainRaw,
        }));
        setComplianceItems(deriveCompliance({
          parsedCV: newParsedCV, bdAfter: newBdAfter, selectedFormat,
        }));
      }

      const blob = await res.blob();
      setDocxUrl(URL.createObjectURL(blob));
      const safeJob = jobTitle.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 30);
      setDocxName(`CV_${safeJob}.docx`);
      setPhase("done");
    } catch (e: unknown) {
      setErrorMsg((e instanceof Error ? e.message : String(e)) || "Unknown error");
      setPhase("error");
    }
  }, [userId, jobId, selectedFormat]);

  // Apply different format instantly
  const handleApplyFormat = useCallback(async (fmt: string) => {
    if (!parsedCV) return;
    setApplyingFormat(true);
    setSelectedFormat(fmt);
    if (bdAfter) {
      setComplianceItems(deriveCompliance({ parsedCV, bdAfter, selectedFormat: fmt }));
    }
    try {
      const fd = new FormData();
      fd.append("parsed_cv", JSON.stringify(parsedCV));
      fd.append("cv_format",  fmt);
      const res = await fetch(`${API_URL}/apply-format`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Format error");
      const blob = await res.blob();
      if (docxUrl) URL.revokeObjectURL(docxUrl);
      setDocxUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("Format switch failed:", e);
    } finally {
      setApplyingFormat(false);
    }
  }, [parsedCV, docxUrl, bdAfter]);

  const downloadFile = () => {
    if (!docxUrl) return;
    const a = document.createElement("a"); a.href = docxUrl; a.download = docxName; a.click();
  };

  const delta = scoreBefore !== null && scoreAfter !== null ? scoreAfter - scoreBefore : 0;

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
        <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600 }}>
          CV Enhancer for Job Offer
        </div>
      </header>

      <main className="main-content">

        {/* ══ JOB DISPLAY + ENHANCE BUTTON ══════════════════════ */}
        {phase === "job" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"44px 24px 72px", gap:24, animation:"fadeUp .35s ease both" }}>
            <div style={{ width:"100%", maxWidth:760 }}>

              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display:"inline-block", padding:"4px 14px", borderRadius:99, border:"1.5px solid rgba(233,30,140,.35)", fontSize:11, fontWeight:700, letterSpacing:".1em", color:"var(--pink)", marginBottom:12 }}>
                  JOB OFFER
                </div>
                <h2 style={{ fontSize:"clamp(24px,4vw,38px)", fontWeight:900, letterSpacing:"-.03em", margin:"0 0 8px", color:"var(--text)" }}>
                  Enhance your CV for this job
                </h2>
                <p style={{ fontSize:14, color:"var(--text-muted)", margin:0 }}>
                  Your saved CV will be rewritten to match this specific job offer
                </p>
              </div>

              {/* Job Card */}
              {jobLoading ? (
                <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:20, padding:"32px", textAlign:"center" }}>
                  <RefreshCw size={24} color="#7B2FBE" style={{ animation:"spin 1.5s linear infinite" }} />
                  <div style={{ marginTop:12, color:"var(--text-muted)", fontSize:14 }}>Loading job details…</div>
                </div>
              ) : job && !job.error ? (
                <div style={{ background:"var(--surface)", border:"1.5px solid rgba(123,47,190,.2)", borderRadius:20, padding:"28px 32px", boxShadow:"0 4px 24px rgba(123,47,190,.08)", marginBottom:24 }}>
                  {/* Job title + meta */}
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:20, flexWrap:"wrap" }}>
                    <div>
                      <h3 style={{ fontSize:24, fontWeight:900, color:"var(--text)", margin:"0 0 8px", letterSpacing:"-.02em" }}>
                        {job.title}
                      </h3>
                      <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                        {job.location && (
                          <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, color:"var(--text-muted)", fontWeight:600 }}>
                            <MapPin size={13} color="var(--violet)" /> {job.location}
                          </div>
                        )}
                        {job.seniority && (
                          <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, color:"var(--text-muted)", fontWeight:600 }}>
                            <Briefcase size={13} color="var(--violet)" /> {job.seniority}
                          </div>
                        )}
                        {job.source && (
                          <span style={{ padding:"2px 10px", borderRadius:99, background:"rgba(123,47,190,.08)", border:"1px solid rgba(123,47,190,.2)", fontSize:11, fontWeight:700, color:"var(--violet)" }}>
                            {job.source}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {job.description && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--text-faint)", marginBottom:6 }}>Description</div>
                      <p style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.65, margin:0 }}>{job.description}</p>
                    </div>
                  )}

                  {/* Requirements */}
                  {job.requirements && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--text-faint)", marginBottom:6 }}>Requirements</div>
                      <p style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.65, margin:0 }}>{job.requirements}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background:"var(--surface)", border:"1.5px solid rgba(239,68,68,.3)", borderRadius:20, padding:"24px", textAlign:"center", marginBottom:24 }}>
                  <AlertCircle size={24} color="#EF4444" />
                  <div style={{ marginTop:8, color:"var(--text-muted)", fontSize:14 }}>Job not found. Using demo job.</div>
                </div>
              )}

              {/* No user warning */}
              {!userId && (
                <div style={{ padding:"14px 20px", borderRadius:14, background:"rgba(245,158,11,.07)", border:"1.5px solid rgba(245,158,11,.3)", fontSize:13, color:"#92400e", marginBottom:16, fontWeight:600 }}>
                  ⚠️ No user ID detected. Access this page via <code>?user_id=YOUR_ID&job_id=JOB_ID</code>
                </div>
              )}

              {/* Enhance button */}
              <div style={{ display:"flex", justifyContent:"center" }}>
                <button
                  type="button"
                  onClick={handleEnhance}
                  disabled={!userId}
                  style={{
                    display:"flex", alignItems:"center", gap:10,
                    padding:"16px 40px", borderRadius:16,
                    background: userId ? "var(--grad)" : "rgba(123,47,190,.2)",
                    border:"none", color:"#fff",
                    fontFamily:"var(--font)", fontSize:16, fontWeight:800,
                    cursor: userId ? "pointer" : "not-allowed",
                    boxShadow: userId ? "0 6px 28px rgba(233,30,140,.38)" : "none",
                    transition:"all .2s",
                  }}
                  onMouseEnter={e => { if (userId) { e.currentTarget.style.boxShadow = "0 8px 36px rgba(233,30,140,.55)"; e.currentTarget.style.transform = "translateY(-2px)"; }}}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = userId ? "0 6px 28px rgba(233,30,140,.38)" : "none"; e.currentTarget.style.transform = "none"; }}
                >
                  <Wand2 size={18} /> Enhance CV for this Job
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ LOADING ════════════════════════════════════════════ */}
        {phase === "loading" && (
          <div className="screen screen-loading">
            <div className="loader-ring-wrap">
              <div className="loader-ring-outer" />
              <RefreshCw size={26} color="#7B2FBE" style={{ animation:"spin 2s linear infinite reverse" }} />
            </div>
            <div className="loading-title">Enhancing your CV…</div>
            <div style={{ fontSize:13, color:"var(--text-muted)", maxWidth:360, textAlign:"center", lineHeight:1.6 }}>
              Rewriting your CV to match<br />
              <strong style={{ color:"var(--violet)" }}>{job?.title || "this job offer"}</strong>
            </div>
          </div>
        )}

        {/* ══ DONE — RESULT PAGE ═════════════════════════════════ */}
        {phase === "done" && (
          <div className="screen screen-done">

            {/* What was improved + Compliance */}
            <div className="result-two-col">
              <div className="card">
                <div className="section-micro-label" style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
                  What was improved for this job
                </div>
                <WhatWasImproved items={improvementItems} />
              </div>
              <div className="card">
                <div className="section-micro-label" style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
                  <CheckCircle size={12} color="#10B981" style={{ flexShrink:0 }} />
                  ATS Compliance — {FORMATS.find(f => f.id === selectedFormat)?.name || "ATS Classic"}
                </div>
                <ATSCompliance items={complianceItems} />
              </div>
            </div>

            {/* Download card with format switcher */}
            <div className="card result-card-wide card-download">
              <div className="dl-icon-wrap"><CheckCircle size={24} color="#E91E8C" /></div>
              <div className="dl-title">Your CV is ready!</div>
              <p className="dl-sub">Optimized for <strong>{job?.title}</strong>. Switch format instantly.</p>

              {/* Format picker */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--text-faint)", marginBottom:10 }}>Choose format</div>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {FORMATS.map(fmt => {
                    const isActive = selectedFormat === fmt.id;
                    const IconCmp  = fmt.id === "ats" ? Target : fmt.id === "basic" ? FileText : Palette;
                    return (
                      <button key={fmt.id} type="button"
                        onClick={() => handleApplyFormat(fmt.id)}
                        disabled={applyingFormat}
                        style={{
                          display:"flex", alignItems:"center", gap:8,
                          padding:"10px 16px", borderRadius:12,
                          background: isActive ? "var(--grad)" : "var(--surface)",
                          border: isActive ? "none" : "1.5px solid var(--border)",
                          color: isActive ? "#fff" : "var(--text-muted)",
                          fontFamily:"var(--font)", fontSize:13, fontWeight:700,
                          cursor: applyingFormat ? "wait" : "pointer",
                          boxShadow: isActive ? "0 4px 18px rgba(233,30,140,.35)" : "var(--shadow-sm)",
                          transition:"all .18s", opacity: applyingFormat && !isActive ? 0.5 : 1,
                        }}>
                        <IconCmp size={14} />{fmt.name}
                        {isActive && applyingFormat && <span style={{ fontSize:10, opacity:.8 }}>…</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="dl-file-row">
                <FileText size={20} color="#7B2FBE" />
                <div>
                  <div className="dl-file-name">{docxName}</div>
                  <div className="dl-file-meta">Optimized for {job?.title} · {FORMATS.find(f => f.id === selectedFormat)?.name}</div>
                </div>
              </div>
              <div className="dl-actions">
                <button className="btn-download" onClick={downloadFile} type="button" disabled={applyingFormat}>
                  <Download size={15} />{applyingFormat ? "Generating…" : "Download Enhanced CV (.docx)"}
                </button>
                <button className="btn-reset btn-reset-inline" onClick={() => setPhase("job")} type="button">
                  <RotateCcw size={11} /> Back to Job
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ══ ERROR ══════════════════════════════════════════════ */}
        {phase === "error" && (
          <div className="screen screen-error">
            <div className="error-icon-wrap"><AlertCircle size={28} color="#EF4444" /></div>
            <div className="error-title">An error occurred</div>
            <div className="error-msg">{errorMsg}</div>
            <button className="btn-reset" onClick={() => setPhase("job")} type="button">Try again</button>
          </div>
        )}

      </main>
    </div>
  );
}