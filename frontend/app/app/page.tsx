"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  app/app/page.tsx  —  DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { useState, useEffect, useRef, Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GRAD, FONT, MONO, C, S, GLOBAL_CSS,
  PIPE_STEPS, SOURCES, initPipeSteps,
  scoreColor, interpBadge, pipeColor, pipeBg, pipeBorder,
  type PipeState,
} from "@/app/lib/theme";

interface Job {
  url: string; source: string; title: string; industry: string;
  location: string; remote: string; salary: string; contract: string;
  education: string; experience: string; description: string;
  skills_req: string; skills_bon: string;
  cosine: number;
  cosine_score?: number;
  match_score: number;
  gap_missing: string[]; gap_matched?: string[];
  gap_coverage?: number; gap_total: number;
  xai?: {
    cosine_score: number; match_score: number;
    explanations: string[]; score_formula: string; interpretation: string;
    tip?: string;
    strength?: string;
  };
}

function normalizeScore(v: number | undefined | null): number {
  if (!v) return 0;
  return v > 1 ? v / 100 : v;
}

interface Message { role: "user" | "assistant"; content: string; }

type Tab = "matches" | "gap" | "roadmap" | "market" | "report";

// ─────────────────────────────────────────────────────────────────────────────
//  ScoreBars
// ─────────────────────────────────────────────────────────────────────────────

function ScoreBars({ job }: { job: Job }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0" }}>
      {[
        { label: "Title Match", sub: "cosine",    value: normalizeScore(job.cosine ?? job.cosine_score) },
        { label: "AI Match",    sub: "biencoder",  value: normalizeScore(job.match_score) },
      ].map(({ label, sub, value }) =>
        value > 0 ? (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 68, flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: C.muted, fontFamily: MONO, textTransform: "uppercase", fontWeight: 700, lineHeight: 1.2 }}>{label}</div>
              <div style={{ fontSize: 8, color: "#b8aece", fontFamily: MONO, lineHeight: 1.2 }}>{sub}</div>
            </div>
            <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${value * 100}%`, height: "100%", background: scoreColor(value), borderRadius: 2, transition: "width .5s" }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(value), minWidth: 42, textAlign: "right", fontFamily: MONO }}>
              {(value * 100).toFixed(1)}%
            </span>
          </div>
        ) : null
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ATSModal — ✅ NOUVEAU COMPOSANT
// ─────────────────────────────────────────────────────────────────────────────

function ATSModal({
  job,
  data,
  loading,
  error,
  onClose,
  userId,
}: {
  job: Job;
  data: any;
  loading: boolean;
  error: string;
  onClose: () => void;
  userId: number;
}): React.ReactElement{
  const score = data?.total_score ?? 0;
  const color = score >= 75 ? "#28A745" : score >= 50 ? "#FFC107" : "#DC3545";
  const label = score >= 75 ? "Excellent 🟢" : score >= 50 ? "Average 🟡" : "Weak 🔴";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleEnhanceCV = () => {
    if (!userId || !job?.url) return;
    const atsBefore = Number(data?.total_score);
    const atsParam = Number.isFinite(atsBefore) ? `&ats_before=${encodeURIComponent(String(atsBefore))}` : "";
    // Open enhance UI flow on /cv-boost page in a new tab.
    window.open(`/cv-boost?user_id=${userId}&job_id=${encodeURIComponent(job.url)}${atsParam}`, "_blank");
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,10,35,.65)", backdropFilter: "blur(8px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(20,10,35,.35)", animation: "modalIn .25s cubic-bezier(.34,1.56,.64,1)" }}>

        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.white, zIndex: 1, borderRadius: "20px 20px 0 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>📊 ATS Score</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{job.title}{job.industry ? ` @ ${job.industry}` : ""}</div>
            </div>
            <button onClick={onClose} style={{ background: C.light, border: "none", borderRadius: 8, width: 28, height: 28, fontSize: 14, cursor: "pointer", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        <div style={{ padding: "20px 22px" }}>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
                {[0, 120, 240].map(d => <div key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: C.p1, animation: `bounce 0.8s ${d}ms ease-in-out infinite` }} />)}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>ATS analysis in progress…</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>GPT-4o structuring · MiniLM semantic matching</div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ padding: "16px 18px", background: "#fff5f5", borderRadius: 10, color: "#DC3545", border: "1px solid rgba(220,38,38,.2)", fontSize: 13, lineHeight: 1.5 }}>⚠️ {error}</div>
          )}

          {/* Results */}
          {!loading && !error && data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Score global */}
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <div style={{ width: 110, height: 110, borderRadius: "50%", border: `6px solid ${color}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `${color}11`, flexShrink: 0 }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color, fontFamily: MONO, lineHeight: 1 }}>{score}</div>
                  <div style={{ fontSize: 9, color, fontWeight: 700, marginTop: 2 }}>/ 100</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{label}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Multi-dimensional ATS score</div>
                </div>
              </div>

              {/* Breakdown */}
              <div style={{ background: C.light, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12 }}>Score breakdown by dimension</div>
                {Object.entries({
                  "✅ Required skills":   data.breakdown?.required_skills  ?? 0,
                  "⭐ Preferred skills":  data.breakdown?.preferred_skills ?? 0,
                  "📅 Experience":        data.breakdown?.experience       ?? 0,
                  "🎯 Job title":         data.breakdown?.designation      ?? 0,
                  "🎓 Degree":            data.breakdown?.degree           ?? 0,
                  "🌐 Languages":         data.breakdown?.languages        ?? 0,
                }).map(([dim, val]) => {
                  const v = Number(val);
                  const dCol = v >= 70 ? "#28A745" : v >= 40 ? "#FFC107" : "#DC3545";
                  return (
                    <div key={dim} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 155, fontSize: 10, color: C.muted, flexShrink: 0 }}>{dim}</div>
                      <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${v}%`, height: "100%", background: dCol, borderRadius: 3, transition: "width .55s ease" }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, minWidth: 40, textAlign: "right", color: dCol, fontFamily: MONO }}>{v}%</div>
                    </div>
                  );
                })}
              </div>

              {/* Matched skills */}
              {data.skills_matched?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>✅ Matched skills ({data.skills_matched.length})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {data.skills_matched.map((m: any, i: number) => (
                      <span key={i} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "rgba(22,163,74,.08)", color: "#16a34a", border: "1px solid rgba(22,163,74,.2)" }}>
                        ✓ {m.jd_skill}<span style={{ opacity: 0.55, marginLeft: 4, fontFamily: MONO }}>{(m.score * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing skills */}
              {data.missing_required?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>❌ Missing skills ({data.missing_required.length})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {data.missing_required.map((s: string) => (
                      <span key={s} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "rgba(220,38,38,.07)", color: "#dc2626", border: "1px solid rgba(220,38,38,.2)" }}>✗ {s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {data.suggestions?.length > 0 && (
                <div style={{ background: "rgba(250,204,21,.07)", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(250,204,21,.3)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 10 }}>💡 Personalized suggestions</div>
                  {data.suggestions.map((tip: string, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: "#4a3f60", lineHeight: 1.6, marginBottom: 7, paddingLeft: 10, borderLeft: "2px solid #FFC107" }}>{tip}</div>
                  ))}
                </div>
              )}

              {/* Enhance CV Button */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
                <button
                  style={{ width: "100%", padding: "13px 20px", background: "linear-gradient(135deg, #FF2D7A 0%, #C3379B 50%, #7A3FB0 100%)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(122,63,176,.35)", transition: "opacity .18s, transform .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
                  onClick={handleEnhanceCV}
                >
                  <span style={{ fontSize: 16 }}>✨</span>
                  Enhance my CV for this job
                </button>
                <div style={{ textAlign: "center", marginTop: 7, fontSize: 10, color: "#9f8fb0", fontFamily: MONO }}>
                  AI will rewrite your CV to match this specific job
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
//  JobCard — ✅ MODIFIÉ : prop onAtsScore + bouton ATS Score
// ─────────────────────────────────────────────────────────────────────────────

function scoreToInterp(score: number): string {
  if (score >= 0.75) return "excellent";
  if (score >= 0.55) return "good";
  if (score >= 0.40) return "moderate";
  return "low";
}

function JobCard({ job, onAtsScore }: {
  job: Job;
  onAtsScore?: (job: Job) => void; // ✅ NOUVEAU prop
}) {
  const [expanded,   setExpanded]   = useState(false);
  const [showXAI,    setShowXAI]    = useState(false);
  const [showAllGap, setShowAllGap] = useState(false);

  const score  = normalizeScore(job.match_score) || normalizeScore(job.cosine ?? job.cosine_score) || 0;
  const col    = scoreColor(score);
  const interp = job.xai?.interpretation ?? scoreToInterp(score);
  const b      = interpBadge(interp);

const _clean = (s: string) => s && s.trim() && s.trim().toLowerCase() !== "empty string" && s.trim().toLowerCase() !== "not specified";
const missingAll = Array.isArray(job.gap_missing) ? job.gap_missing.filter(_clean) : [];
const matchedAll = Array.isArray(job.gap_matched) ? job.gap_matched.filter(_clean) : [];
  const PREVIEW_MISS   = 3;
  const PREVIEW_MATCH  = 2;
  const extraMissing   = missingAll.length - PREVIEW_MISS;
  const visibleMissing = showAllGap ? missingAll : missingAll.slice(0, PREVIEW_MISS);
  const visibleMatched = showAllGap ? matchedAll : matchedAll.slice(0, PREVIEW_MATCH);

  return (
    <div style={{
      background: C.white,
      border: `1px solid ${col}33`, borderTop: `3px solid ${col}`,
      borderRadius: 12, padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 7,
    }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: GRAD, display: "flex", alignItems: "center",
          justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#fff",
        }}>
          {(job.industry || job.title || "?").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{job.title}</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{job.industry || "—"}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: col, fontFamily: MONO, lineHeight: 1 }}>
            {(score * 100).toFixed(1)}%
          </div>
          {b && (
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: b.bg, color: b.color, fontWeight: 700 }}>
              {b.label}
            </span>
          )}
          <div style={{ fontSize: 9, color: "#9f8fb0", fontFamily: MONO, marginTop: 2 }}>{job.source}</div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 10, color: C.muted, display: "flex", flexWrap: "wrap", gap: 5 }}>
        {job.location && <span>📍 {job.location}</span>}
        {job.remote   && <span style={{ color: C.p2, fontWeight: 600 }}>{job.remote}</span>}
        {job.salary && job.salary !== "Not specified" && (
          <span style={{ color: C.amber }}>💰 {job.salary}</span>
        )}
      </div>

      {/* Score bars */}
      <ScoreBars job={job} />

      {/* Skills gap */}
      {job.gap_total > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 7 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Skills Gap</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: missingAll.length === 0 ? C.green : C.amber }}>
              {job.gap_total - missingAll.length}/{job.gap_total} covered
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {visibleMissing.map(s => (
              <span key={s} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(220,38,38,.07)", color: C.red, border: "1px solid rgba(220,38,38,.2)" }}>{s}</span>
            ))}
            {visibleMatched.map(s => (
              <span key={s} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(22,163,74,.07)", color: C.green, border: "1px solid rgba(22,163,74,.2)" }}>✓ {s}</span>
            ))}
            {!showAllGap && extraMissing > 0 && (
              <button onClick={() => setShowAllGap(true)} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(217,119,6,.10)", color: C.amber, border: "1px solid rgba(217,119,6,.3)", fontFamily: MONO, fontWeight: 700, cursor: "pointer" }}>
                +{extraMissing}
              </button>
            )}
            {showAllGap && extraMissing > 0 && (
              <button onClick={() => setShowAllGap(false)} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: C.light, color: C.muted, border: `1px solid ${C.border}`, fontFamily: MONO, fontWeight: 700, cursor: "pointer" }}>
                ▲ less
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── ✅ BOUTON ATS SCORE — juste après Skills Gap, avant XAI ── */}
      {onAtsScore && (
        <button
          onClick={() => onAtsScore(job)}
          style={{
            background: "linear-gradient(135deg, #FF2D7A 0%, #7A3FB0 100%)",
            border: "none", borderRadius: 7,
            color: "#fff", fontSize: 10,
            padding: "6px 10px", cursor: "pointer",
            fontFamily: MONO, fontWeight: 700,
            width: "100%", textAlign: "center",
            boxShadow: "0 2px 8px rgba(122,63,176,.25)",
            transition: "opacity .2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          📊 Calculer le Score ATS
        </button>
      )}

      {/* XAI */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
        <button onClick={() => setShowXAI(!showXAI)} style={{ background: showXAI ? `${col}0d` : "transparent", border: `1px solid ${col}44`, borderRadius: 6, color: col, fontSize: 10, padding: "4px 10px", cursor: "pointer", fontFamily: MONO, textAlign: "left", width: "100%", transition: "background .2s" }}>
          {showXAI ? "▲ Hide explanation" : "🔍 Explain scores (XAI)"}
        </button>
        {showXAI && (
          <div style={{ marginTop: 8, background: C.light, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Score Explanation</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: b.bg, color: b.color, fontWeight: 700 }}>{b.label}</span>
            </div>
            {(() => {
              const cosP   = normalizeScore(job.xai?.cosine_score ?? job.cosine ?? job.cosine_score);
              const cosCol = scoreColor(cosP);
              return (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 10px", background: C.white, borderRadius: 8, marginBottom: 6, border: `1px solid ${C.border}` }}>
                  <div style={{ minWidth: 130 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: MONO, marginBottom: 4 }}>🎯 Cosine Similarity</div>
                    <div style={{ height: 4, borderRadius: 99, background: C.border, overflow: "hidden", marginBottom: 3 }}>
                      <div style={{ height: "100%", width: `${cosP * 100}%`, background: cosCol, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: cosCol, fontFamily: MONO }}>{(cosP * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#4a3f60", lineHeight: 1.55, paddingTop: 2 }}>
                    <strong style={{ color: C.text }}>Title Match</strong> —{" "}
                    {cosP >= 0.75 ? "Your job title strongly aligns with this role." : cosP >= 0.55 ? "Your profile partially matches the job title." : "Limited title overlap — consider tailoring your headline."}
                  </div>
                </div>
              );
            })()}
            {(() => {
              const aiP   = normalizeScore(job.xai?.match_score ?? job.match_score);
              const aiCol = scoreColor(aiP);
              return (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 10px", background: C.white, borderRadius: 8, marginBottom: 6, border: `1px solid ${C.border}` }}>
                  <div style={{ minWidth: 130 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: MONO, marginBottom: 4 }}>🤖 AI Match</div>
                    <div style={{ height: 4, borderRadius: 99, background: C.border, overflow: "hidden", marginBottom: 3 }}>
                      <div style={{ height: "100%", width: `${aiP * 100}%`, background: aiCol, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: aiCol, fontFamily: MONO }}>{(aiP * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#4a3f60", lineHeight: 1.55, paddingTop: 2 }}>
                    <strong style={{ color: C.text }}>BiEncoder Score</strong> —{" "}
                    {job.xai?.explanations?.[0] ? job.xai.explanations[0] : aiP >= 0.75 ? "Excellent overall fit." : aiP >= 0.55 ? "Good fit — a few gaps exist." : "Moderate fit — key requirements may be missing."}
                  </div>
                </div>
              );
            })()}
            {job.gap_total > 0 && (() => {
              const covered = job.gap_total - missingAll.length;
              const pct     = Math.round(covered / job.gap_total * 100);
              const covCol  = pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red;
              return (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 10px", background: C.white, borderRadius: 8, marginBottom: 4, border: `1px solid ${C.border}` }}>
                  <div style={{ minWidth: 130 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: MONO, marginBottom: 4 }}>📊 Skills Coverage</div>
                    <div style={{ height: 4, borderRadius: 99, background: C.border, overflow: "hidden", marginBottom: 3 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: covCol, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: covCol, fontFamily: MONO }}>{covered}/{job.gap_total}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#4a3f60", lineHeight: 1.55, paddingTop: 2 }}>
                    <strong style={{ color: C.text }}>{pct}% covered</strong> —{" "}
                    {missingAll.length === 0 ? "You meet all required skills! 🎉" : `Missing: ${missingAll.slice(0, 4).join(", ")}${missingAll.length > 4 ? ` +${missingAll.length - 4} more` : ""}.`}
                  </div>
                </div>
              );
            })()}
            {job.xai?.explanations?.slice(1).map((e, i) => (
              <div key={i} style={{ fontSize: 10, color: C.muted, lineHeight: 1.5, padding: "4px 8px", background: C.bg, borderRadius: 6, marginTop: 4, fontFamily: MONO, fontStyle: "italic" }}>{e}</div>
            ))}
            {job.xai?.tip && job.xai.tip.trim() && (
              <div style={{ marginTop: 8, padding: "10px 12px", background: "linear-gradient(135deg, rgba(250,204,21,.12) 0%, rgba(250,204,21,.04) 100%)", borderRadius: 8, border: "1px solid rgba(250,204,21,.25)" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: C.amber, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>💡 Tip for this role</div>
                <div style={{ fontSize: 11, color: "#4a3f60", lineHeight: 1.5 }}>{job.xai.tip}</div>
              </div>
            )}
            {job.xai?.strength && job.xai.strength.trim() && (
              <div style={{ marginTop: 6, padding: "10px 12px", background: "linear-gradient(135deg, rgba(22,163,74,.08) 0%, rgba(22,163,74,.03) 100%)", borderRadius: 8, border: "1px solid rgba(22,163,74,.2)" }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: C.green, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>✓ Your strength to highlight</div>
                <div style={{ fontSize: 11, color: "#4a3f60", lineHeight: 1.5 }}>{job.xai.strength}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {job.skills_req && (
            <div>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Required Skills</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {job.skills_req.split(",").slice(0, 6).map(s => s.trim()).filter(Boolean).map(s => (
                  <span key={s} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(122,63,176,.07)", color: C.p2, border: "1px solid rgba(122,63,176,.2)" }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {job.description && (
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, maxHeight: 100, overflowY: "auto", background: C.bg, borderRadius: 6, padding: 8, fontFamily: MONO }}>
              {job.description.slice(0, 300)}…
            </div>
          )}
          <a href={job.url} target="_blank" rel="noopener" style={{ display: "block", textAlign: "center", padding: "8px", background: GRAD, borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#fff", textDecoration: "none" }}>
            Apply →
          </a>
        </div>
      )}
      <button onClick={() => setExpanded(!expanded)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 10, padding: "4px 8px", cursor: "pointer", fontFamily: MONO, width: "100%" }}>
        {expanded ? "▲ Show less" : "▼ More details"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Charts
// ─────────────────────────────────────────────────────────────────────────────

function VerticalChart({ data, title, valueKey, labelKey, barColor = C.p2, height = 220 }: {
  data: any[]; title: string; valueKey: string; labelKey: string; barColor?: string; height?: number;
}) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map(d => d[valueKey]));
  const BW = 44, GAP = 10, M = { top: 20, right: 16, bottom: 64, left: 36 };
  const cH = height - M.top - M.bottom;
  const cW = data.length * (BW + GAP) - GAP;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>{title}</div>
      <div style={{ overflowX: "auto" }}>
        <svg width={cW + M.left + M.right} height={height} style={{ display: "block" }}>
          {[0, Math.round(maxVal / 2), maxVal].map(t => {
            const y = M.top + cH - (t / maxVal) * cH;
            return (
              <g key={t}>
                <line x1={M.left} x2={M.left + cW} y1={y} y2={y} stroke={C.border} strokeWidth={1} strokeDasharray={t === 0 ? "0" : "4 3"} />
                <text x={M.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill={C.muted}>{t}</text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const x  = M.left + i * (BW + GAP);
            const bH = Math.max(2, (d[valueKey] / maxVal) * cH);
            const y  = M.top + cH - bH;
            const lbl: string = d[labelKey] || "";
            const tr = lbl.length > 9 ? lbl.slice(0, 8) + "…" : lbl;
            return (
              <g key={lbl}>
                <rect x={x} y={M.top} width={BW} height={cH} fill={C.light} rx={4} />
                <rect x={x} y={y} width={BW} height={bH} fill={barColor} rx={4} opacity={0.9}><title>{lbl}: {d[valueKey]}</title></rect>
                <text x={x + BW / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight="700" fill={barColor}>{d[valueKey]}</text>
                <text x={x + BW / 2} y={M.top + cH + 14} textAnchor="end" fontSize={9} fill={C.muted} transform={`rotate(-35,${x + BW / 2},${M.top + cH + 14})`}>{tr}</text>
              </g>
            );
          })}
          <line x1={M.left} x2={M.left} y1={M.top} y2={M.top + cH} stroke={C.border} strokeWidth={1} />
        </svg>
      </div>
    </div>
  );
}

function HorizontalChart({ data, title, valueKey, labelKey, barColor = C.p1 }: {
  data: any[]; title: string; valueKey: string; labelKey: string; barColor?: string;
}) {
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map(d => d[valueKey]));
  const RH = 30, GAP = 6, LW = 130, BA = 260;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>{title}</div>
      <svg width={LW + BA + 50} height={data.length * (RH + GAP) + 10} style={{ display: "block", width: "100%" }}>
        {data.map((d, i) => {
          const y   = i * (RH + GAP);
          const bW  = Math.max(4, (d[valueKey] / maxVal) * BA);
          const lbl: string = d[labelKey] || "";
          const tr  = lbl.length > 18 ? lbl.slice(0, 17) + "…" : lbl;
          return (
            <g key={lbl}>
              <text x={LW - 8} y={y + RH / 2 + 4} textAnchor="end" fontSize={10} fill={C.muted}>{tr}</text>
              <rect x={LW} y={y + 4} width={BA} height={RH - 8} fill={C.light} rx={4} />
              <rect x={LW} y={y + 4} width={bW} height={RH - 8} fill={barColor} rx={4} opacity={0.85}><title>{lbl}: {d[valueKey]}</title></rect>
              <text x={LW + bW + 6} y={y + RH / 2 + 4} fontSize={10} fontWeight="700" fill={barColor}>{d[valueKey]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ScanningBanner
// ─────────────────────────────────────────────────────────────────────────────

function ScanningBanner({ pipeSteps, pipeRole, enrichN }: {
  pipeSteps: Record<string, PipeState>; pipeRole: string; enrichN: number;
}) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 22px", marginBottom: 20, boxShadow: "0 2px 12px rgba(122,63,176,.08)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: GRAD }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 120, 240].map(d => (
              <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: C.p1, animation: `bounce 0.9s ${d}ms ease-in-out infinite` }} />
            ))}
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Analyzing CV{pipeRole ? ` — ${pipeRole}` : "…"}</span>
        </div>
        {enrichN > 0 && <span style={{ fontSize: 12, color: C.muted, fontFamily: MONO }}>Enriched: <b style={{ color: C.p1 }}>{enrichN}</b></span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {PIPE_STEPS.map(step => (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, fontSize: 10, fontWeight: 600, border: `1px solid ${pipeBorder(pipeSteps[step.id])}`, background: pipeBg(pipeSteps[step.id]), color: pipeColor(pipeSteps[step.id]), transition: "all .3s", fontFamily: MONO }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block", flexShrink: 0, animation: pipeSteps[step.id] === "active" ? "pulse 1.1s infinite" : "none" }} />
            {step.icon} {step.label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {SOURCES.map(src => (
          <div key={src} style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 5, fontSize: 9, fontWeight: 600, border: `1px solid ${pipeBorder(pipeSteps[src])}`, background: pipeBg(pipeSteps[src]), color: pipeColor(pipeSteps[src]), transition: "all .3s", fontFamily: MONO }}>
            {pipeSteps[src] === "done" ? "✓" : <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: "pulse 1.1s infinite" }} />}
            {" "}{src}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ChatSidebar
// ─────────────────────────────────────────────────────────────────────────────

function ChatSidebar({ userId, jobs = [] }: { userId: number; jobs?: Job[] }) {
  const [msgs,    setMsgs]    = useState<Message[]>([]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [chatErr, setChatErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const [activeLang] = useState<"fr" | "en">("fr");
  const cancelSpeech = useCallback(() => {}, []);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/chat/history?user_id=${userId}`)
      .then(r => r.json())
      .then(d => { if (d.messages?.length) setMsgs(d.messages); })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    const handleLogout = () => { setMsgs([]); cancelSpeech(); };
    window.addEventListener("jobscan:logout", handleLogout);
    return () => window.removeEventListener("jobscan:logout", handleLogout);
  }, [cancelSpeech]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function _sendMessage(msg: string) {
    if (!msg.trim() || loading) return;
    setInput("");
    setChatErr("");
    setMsgs(p => [...p, { role: "user", content: msg }]);
    setLoading(true);
    const jobsContext = jobs.slice(0, 30).map(j => ({
      title: j.title, industry: j.industry, location: j.location,
      salary: j.salary, remote: j.remote, contract: j.contract,
      experience: j.experience,
      match_score: normalizeScore(j.match_score),
      cosine: normalizeScore(j.cosine ?? j.cosine_score),
      missing: j.gap_missing || [], url: j.url, source: j.source,
    }));
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: String(userId), message: msg, jobs_context: jobsContext }),
      });
      if (!r.ok) { setChatErr(`Server error ${r.status}`); return; }
      const d = await r.json();
      if (d.response) setMsgs(p => [...p, { role: "assistant", content: d.response }]);
      else setChatErr("Empty response from server.");
    } catch {
      setChatErr("Connection error — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  const send = useCallback(() => {
    const msg = input.trim();
    if (!msg) return;
    _sendMessage(msg);
  }, [input, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ width: 340, flexShrink: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, padding: "18px 20px", display: "flex", flexDirection: "column", height: "calc(100vh - 112px)", position: "sticky", top: 72, boxShadow: "0 4px 24px rgba(122,63,176,.11)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: C.p1, letterSpacing: -0.3 }}>💬 Career Assistant</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {msgs.length === 0 && (
          <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 32, lineHeight: 1.9, padding: "0 10px" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🤖</div>
            Ask me about your job matches, skills gap, roadmap or score explanations.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.65, ...(m.role === "user" ? { background: `linear-gradient(135deg, rgba(122,63,176,.13), rgba(122,63,176,.07))`, borderRight: `3px solid ${C.p1}`, alignSelf: "flex-end", maxWidth: "88%", borderBottomRightRadius: 4 } : { background: C.bg, border: `1px solid ${C.border}`, alignSelf: "flex-start", maxWidth: "95%", borderBottomLeftRadius: 4 }) }}>
            {m.content.split("\n").map((l, j) => <div key={j}>{l || " "}</div>)}
          </div>
        ))}
        {loading && (
          <div style={{ fontSize: 11, color: "#9f8fb0", padding: "6px 12px", display: "flex", gap: 4, alignItems: "center" }}>
            <span>Thinking</span>
            {[0, 150, 300].map(d => <div key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: "#9f8fb0", animation: `bounce 0.9s ${d}ms ease-in-out infinite` }} />)}
          </div>
        )}
        {chatErr && <div style={{ fontSize: 11, color: C.red, padding: "4px 12px" }}>⚠ {chatErr}</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <input style={{ ...S.input, fontSize: 12, flex: 1 }} placeholder="Ask anything…" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && send()} />
        <button style={{ ...S.btn, padding: "8px 14px", fontSize: 12 }} onClick={send} disabled={loading}>→</button>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  GapTab
// ─────────────────────────────────────────────────────────────────────────────

type GapDataNormalized = {
  top_missing_skills: { skill: string; frequency: number }[];
  top_matched_skills: { skill: string; frequency: number }[];
  missing_enriched?: { skill: string; frequency: number; difficulty?: string; tip?: string; impact_pct?: number }[];
  coverage: number;
  total_market_skills: number;
  total_jobs?: number;
  cv_skills_preview?: string;
};

function normalizeGapResponse(api: any): GapDataNormalized | null {
  if (!api || typeof api !== "object") return null;
  const missing = api.missing || [];
  const matched = api.matched || [];
  const toPairs = (arr: any[]): { skill: string; frequency: number }[] =>
    arr.map((item: any) => Array.isArray(item)
      ? { skill: String(item[0] ?? ""), frequency: Number(item[1] ?? 0) }
      : { skill: String(item?.skill ?? item), frequency: Number(item?.frequency ?? item?.count ?? 0) }
    ).filter((d: { skill: string; frequency: number }) => d.skill);
  const enriched = (api.missing_enriched || []).map((e: any) => ({
    skill: String(e?.skill ?? ""), frequency: Number(e?.count ?? e?.frequency ?? 0),
    difficulty: e?.difficulty, tip: e?.tip,
    impact_pct: e?.impact_pct != null ? Number(e.impact_pct) : undefined,
  })).filter((d: { skill: string }) => d.skill);
  return {
    top_missing_skills: enriched.length ? enriched.map((e: any) => ({ skill: e.skill, frequency: e.frequency })) : toPairs(api.top_missing_skills || missing).slice(0, 25),
    top_matched_skills: toPairs(api.top_missing_skills ? [] : matched).slice(0, 25),
    missing_enriched: enriched.length ? enriched : undefined,
    coverage: Number(api.coverage) || 0,
    total_market_skills: Number(api.total_market_skills) || 0,
    total_jobs: api.total_jobs != null ? Number(api.total_jobs) : undefined,
    cv_skills_preview: typeof api.cv_skills === "string" ? api.cv_skills : undefined,
  };
}

function GapTab({ gapData, gapLoad, showLoadingPlaceholder, onAnalyze, onGoToRoadmap, onRefresh }: {
  gapData: any; gapLoad: boolean; showLoadingPlaceholder?: boolean;
  onAnalyze: () => void; onGoToRoadmap?: () => void; onRefresh?: () => void;
}) {
  const normalized = normalizeGapResponse(gapData);
  const hasData = normalized && (normalized.top_missing_skills.length > 0 || normalized.top_matched_skills.length > 0 || normalized.total_market_skills > 0);
  const showLoading = gapLoad || !!showLoadingPlaceholder;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 28px", boxShadow: "0 2px 16px rgba(122,63,176,.06)" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>📊 Skills Gap</h2>
        <p style={{ fontSize: 13, color: C.muted }}>Top missing skills across the market vs your profile.</p>
      </div>
      {showLoading && (
        <div style={{ textAlign: "center", padding: 48, color: C.muted }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
            {[0, 120, 240].map(d => <div key={d} style={{ width: 8, height: 8, borderRadius: "50%", background: C.p1, animation: `bounce 0.8s ${d}ms ease-in-out infinite` }} />)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Analyzing skills gap…</div>
        </div>
      )}
      {!showLoading && !hasData && (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 42, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Top missing skills across the market</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>Run a scan first so we have your skills, then analyze.</div>
          <button style={S.btn} onClick={onAnalyze}>Analyze Skills Gap</button>
        </div>
      )}
      {!showLoading && hasData && normalized && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ ...S.sec, flex: 1, minWidth: 140, marginBottom: 0, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.p1 }}>{Math.round(normalized.coverage * 100)}%</div>
                <div style={{ fontSize: 11, color: C.muted }}>Market coverage</div>
              </div>
              <div style={{ ...S.sec, flex: 1, minWidth: 140, marginBottom: 0, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{normalized.total_market_skills}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Skills in market</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {onGoToRoadmap && <button style={S.btn} onClick={onGoToRoadmap}>🗺️ Build learning roadmap</button>}
              {onRefresh && <button style={S.btnOut} onClick={onRefresh}>🔄 Refresh analysis</button>}
            </div>
          </div>
          <VerticalChart data={normalized.top_missing_skills} title="Missing skills (learn these to open more jobs)" valueKey="frequency" labelKey="skill" barColor={C.p0} height={260} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RoadmapTab
// ─────────────────────────────────────────────────────────────────────────────

type RoadmapPhaseItem = {
  skill: string; jobs_count: number; difficulty: string; weeks: number;
  tip: string; project_ideas?: string[]; prerequisites: string[];
  xai?: { rank: number; reason: string; market_impact_pct?: number; prereqs_met?: string[]; prereqs_missing?: string[]; llm_insight?: string };
};

function RoadmapPhaseCard({ item }: { item: RoadmapPhaseItem }) {
  const [expanded, setExpanded] = useState(false);
  const diff = (item.difficulty || "").toLowerCase();
  const diffColor = diff === "beginner" ? C.green : diff === "advanced" ? C.amber : C.p2;
  const xai = item.xai;
  return (
    <div style={{ ...S.sec, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{item.skill}</span>
        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: `${diffColor}22`, color: diffColor, border: `1px solid ${diffColor}44` }}>{item.difficulty}</span>
        <span style={{ fontSize: 10, color: C.muted, fontFamily: MONO }}>~{item.weeks}w</span>
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>📚 {item.tip}</div>
      {item.project_ideas && item.project_ideas.length > 0 && (
        <div style={{ fontSize: 11, color: C.p2, padding: "6px 8px", background: "rgba(122,63,176,.06)", borderRadius: 6, borderLeft: `3px solid ${C.p2}` }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>🛠️ Small project ideas</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>{item.project_ideas.map((idea, i) => <li key={i} style={{ marginBottom: 2 }}>{idea}</li>)}</ul>
        </div>
      )}
      {xai?.reason && (
        <>
          <button type="button" style={{ fontSize: 10, color: C.p2, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", fontWeight: 600 }} onClick={() => setExpanded(!expanded)}>
            {expanded ? "▼ Hide why this order" : "▶ Why this order?"}
          </button>
          {expanded && <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{xai.reason}</div>}
        </>
      )}
    </div>
  );
}

function RoadmapTab({ roadData, roadLoad, showLoadingPlaceholder, onGenerate, onRefresh }: {
  roadData: any; roadLoad: boolean; showLoadingPlaceholder?: boolean;
  onGenerate: () => void; onRefresh?: () => void;
}) {
  const showLoading = roadLoad || !!showLoadingPlaceholder;
  const phases = roadData?.phases || {};
  const beginner = (phases.beginner || []) as RoadmapPhaseItem[];
  const intermediate = (phases.intermediate || []) as RoadmapPhaseItem[];
  const advanced = (phases.advanced || []) as RoadmapPhaseItem[];
  const hasData = beginner.length > 0 || intermediate.length > 0 || advanced.length > 0;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 28px", boxShadow: "0 2px 16px rgba(122,63,176,.06)" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 4 }}>🗺️ Learning Roadmap</h2>
        <p style={{ fontSize: 13, color: C.muted }}>A phased plan from your skills gap.</p>
      </div>
      {showLoading && (
        <div style={{ textAlign: "center", padding: 48, color: C.muted }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
            {[0, 120, 240].map(d => <div key={d} style={{ width: 8, height: 8, borderRadius: "50%", background: C.p1, animation: `bounce 0.8s ${d}ms ease-in-out infinite` }} />)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Generating roadmap…</div>
        </div>
      )}
      {!showLoading && !hasData && (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 42, marginBottom: 16 }}>🗺️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Your personalized learning roadmap</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Run a scan first so we have your skills.</div>
          <button style={S.btn} onClick={onGenerate}>Generate Learning Roadmap</button>
        </div>
      )}
      {!showLoading && hasData && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: C.muted }}>{roadData?.message || ""}</div>
            {onRefresh && <button style={S.btnOut} onClick={onRefresh}>🔄 Refresh roadmap</button>}
          </div>
          {beginner.length > 0 && <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Beginner — foundations</div><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{beginner.map(item => <RoadmapPhaseCard key={item.skill} item={item} />)}</div></div>}
          {intermediate.length > 0 && <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Intermediate — core skills</div><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{intermediate.map(item => <RoadmapPhaseCard key={item.skill} item={item} />)}</div></div>}
          {advanced.length > 0 && <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Advanced — specialization</div><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{advanced.map(item => <RoadmapPhaseCard key={item.skill} item={item} />)}</div></div>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MatchesTab — ✅ MODIFIÉ : onAtsScore passé à JobCard
// ─────────────────────────────────────────────────────────────────────────────

function MatchesTab({ isScanning, scanJobs, jobs, jobsLoad, hasLoaded, roleFilter, setRoleFilter, locFilter, setLocFilter, minFit, setMinFit, onSearch, onAtsScore }: {
  isScanning: boolean; scanJobs: Job[]; jobs: Job[]; jobsLoad: boolean; hasLoaded: boolean;
  roleFilter: string; setRoleFilter: (v: string) => void;
  locFilter:  string; setLocFilter:  (v: string) => void;
  minFit: number; setMinFit: (v: number) => void;
  onSearch: () => void;
  onAtsScore: (job: Job) => void; // ✅ NOUVEAU prop
}) {
  const filteredAndSortedJobs = useMemo(() => {
    let list = [...jobs];
    if (roleFilter.trim()) {
      const words = roleFilter.trim().toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(j => {
        const text = `${j.title || ""} ${j.industry || ""} ${j.description || ""}`.toLowerCase();
        return words.some(w => text.includes(w));
      });
    }
    if (locFilter.trim()) {
      const loc = locFilter.trim().toLowerCase();
      list = list.filter(j => {
        const jLoc = (j.location || "").toLowerCase();
        const jRemote = (j.remote || "").toLowerCase();
        return jLoc.includes(loc) || (loc.includes("remote") && (jRemote.includes("remote") || jLoc.includes("remote")));
      });
    }
    if (minFit > 0) list = list.filter(j => normalizeScore(j.match_score) >= minFit);
    list.sort((a, b) => (normalizeScore(b.match_score) || 0) - (normalizeScore(a.match_score) || 0));
    return list;
  }, [jobs, roleFilter, locFilter, minFit]);

  return (
    <div>
      <div style={{ ...S.sec, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <input style={{ ...S.input, width: 175, fontSize: 12 }} placeholder="Filter by role" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} />
        <input style={{ ...S.input, width: 155, fontSize: 12 }} placeholder="Filter by location" value={locFilter} onChange={e => setLocFilter(e.target.value)} />
        <select style={{ ...S.input, width: 155, fontSize: 12 }} value={minFit} onChange={e => setMinFit(parseFloat(e.target.value))}>
          <option value={0}>All scores</option>
          <option value={0.4}>≥ 40% AI Match</option>
          <option value={0.55}>≥ 55% AI Match</option>
          <option value={0.75}>≥ 75% AI Match</option>
        </select>
        <button style={S.btn} onClick={onSearch} disabled={isScanning}>Search</button>
        <span style={{ fontSize: 11, color: C.muted }}>
          {isScanning ? `${scanJobs.length} matched so far…` : `${filteredAndSortedJobs.length} jobs · Cosine + AI Match`}
        </span>
      </div>
      {(jobsLoad || !hasLoaded) && !isScanning && (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
            {[0, 120, 240].map(d => <div key={d} style={{ width: 8, height: 8, borderRadius: "50%", background: C.p1, animation: `bounce 0.8s ${d}ms ease-in-out infinite` }} />)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>Finding your best opportunities…</div>
        </div>
      )}
      {isScanning && scanJobs.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 20 }}>
            {[0, 150, 300].map(d => <div key={d} style={{ width: 11, height: 11, borderRadius: "50%", background: C.p1, animation: `bounce 0.9s ${d}ms ease-in-out infinite` }} />)}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 10 }}>Search in progress…</div>
          <div style={{ fontSize: 13, color: C.muted }}>Scraping boards · AI scoring · Skills gap computation</div>
        </div>
      )}
      {isScanning && scanJobs.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 100, 200].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: C.p1, animation: `bounce 0.9s ${d}ms ease-in-out infinite` }} />)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{scanJobs.length} job{scanJobs.length > 1 ? "s" : ""} matched · still scanning…</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 14 }}>
            {/* Pas de bouton ATS pendant le scan (jobs pas encore en DB) */}
            {scanJobs.map((job, i) => <div key={job.url + i} style={{ animation: "cardIn .4s ease both" }}><JobCard job={job} /></div>)}
          </div>
        </div>
      )}
      {!isScanning && !jobsLoad && jobs.length === 0 && hasLoaded && (
        <div style={{ textAlign: "center", padding: "70px 20px", color: C.muted }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>No jobs yet</div>
          <div style={{ fontSize: 12 }}>Go back to the home page and run a scan to populate your matches.</div>
        </div>
      )}
      {!isScanning && jobs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 14 }}>
          {filteredAndSortedJobs.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px", color: C.muted }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>No jobs match your filters</div>
              <div style={{ fontSize: 12 }}>Try loosening the role, location or minimum score.</div>
            </div>
          ) : (
            // ✅ onAtsScore passé à chaque JobCard
            filteredAndSortedJobs.map((job, i) => <JobCard key={`${job.url}-${i}`} job={job} onAtsScore={onAtsScore} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Dashboard — ✅ MODIFIÉ : states ATS + fetchAtsScore + ATSModal render
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const userId       = parseInt(searchParams.get("user_id") || "0", 10);
  const shouldScan   = searchParams.get("scan") === "1";
  const bootedRef    = useRef(false);
  const scanInFlightRef = useRef(false);

  const [userName,   setUserName]   = useState(`User #${userId}`);
  const [isScanning, setIsScanning] = useState(false);
  const [pipeSteps,  setPipeSteps]  = useState<Record<string, PipeState>>(initPipeSteps());
  const [pipeRole,   setPipeRole]   = useState("");
  const [scanJobs,   setScanJobs]   = useState<Job[]>([]);
  const [enrichN,    setEnrichN]    = useState(0);
  const [activeTab,  setActiveTab]  = useState<Tab>("matches");
  const [jobs,       setJobs]       = useState<Job[]>([]);
  const [jobsLoad,   setJobsLoad]   = useState(false);
  const [hasLoaded,  setHasLoaded]  = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [locFilter,  setLocFilter]  = useState("");
  const [minFit,     setMinFit]     = useState(0);
  const [gapData,    setGapData]    = useState<any>(null);
  const [gapLoad,    setGapLoad]    = useState(false);
  const [roadData,   setRoadData]   = useState<any>(null);
  const [roadLoad,   setRoadLoad]   = useState(false);
  const [mktData,    setMktData]    = useState<any>(null);
  const [mktLoad,    setMktLoad]    = useState(false);
  const [repData,    setRepData]    = useState("");
  const [repLoad,    setRepLoad]    = useState(false);

  // ── ✅ NOUVEAUX STATES ATS ────────────────────────────────────────────────
  const [atsModal,   setAtsModal]   = useState<{ job: Job } | null>(null);
  const [atsData,    setAtsData]    = useState<any>(null);
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsError,   setAtsError]   = useState("");

  function scanJobKey(jobLike: Partial<Job> & { source?: string; title?: string; industry?: string; url?: string }) {
    const url = (jobLike.url || "").trim();
    if (url) return `url:${url}`;
    const source = (jobLike.source || "").trim().toLowerCase();
    const title = (jobLike.title || "").trim().toLowerCase();
    const industry = (jobLike.industry || "").trim().toLowerCase();
    return `fallback:${source}|${title}|${industry}`;
  }

  useEffect(() => {
    // In Next.js dev (React StrictMode), effects can run twice.
    // Guard boot logic to avoid starting two scans in parallel.
    if (bootedRef.current) return;
    bootedRef.current = true;

    if (!userId) { router.replace("/"); return; }
    if (shouldScan) {
      window.history.replaceState({}, "", `/jobs-search?user_id=${userId}&scan=1`);
      runScan();
    } else {
      window.history.replaceState({}, "", `/jobs-search?user_id=${userId}`);
      fetchUserAndJobs();
    }
  }, [userId, shouldScan, router]);

  useEffect(() => {
    if (activeTab === "gap"     && userId && !gapData)  { setGapLoad(true);  loadGap(); }
    if (activeTab === "roadmap" && userId && !roadData) { setRoadLoad(true); loadRoadmap(); }
    if (activeTab === "market"  && !mktData && userId)  loadMarket();
    if (activeTab === "report"  && !repData && userId)  loadReport();
  }, [activeTab]);

  async function fetchUserAndJobs() {
    try {
      const r = await fetch(`/api/user/${userId}`);
      if (r.ok) { const d = await r.json(); setUserName(d.name || `User #${userId}`); }
    } catch {}
    loadJobs();
  }

  async function loadJobs() {
    setJobsLoad(true);
    try {
      const resp = await fetch(`/jobs/${userId}`);
      if (!resp.ok || !resp.body) return;
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const loaded: Job[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() || "";
        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          let d: any;
          try { d = JSON.parse(chunk.slice(6)); } catch { continue; }
          if (d.event === "no_cache") { reader.cancel(); return; }  // ← sort vraiment
          if (d.event === "job")      loaded.push(d as Job);
          if (d.event === "done")     { reader.cancel(); break; } 
        }
      }
      const seen = new Set<string>();
      setJobs(loaded.filter(j => { if (seen.has(j.url)) return false; seen.add(j.url); return true; }));
    } finally { setJobsLoad(false); setHasLoaded(true); }
  }

  async function loadGap() {
    setGapLoad(true);
    try { const r = await fetch("/api/gap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: String(userId) }) }); setGapData(await r.json()); }
    finally { setGapLoad(false); }
  }

  async function loadRoadmap() {
    setRoadLoad(true);
    try { const r = await fetch("/api/roadmap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: String(userId) }) }); setRoadData(await r.json()); }
    finally { setRoadLoad(false); }
  }

  async function loadMarket() {
    setMktLoad(true);
    try { const r = await fetch(`/api/market?user_id=${userId}`); setMktData(await r.json()); }
    finally { setMktLoad(false); }
  }

  async function loadReport() {
    setRepLoad(true);
    try { const r = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId }) }); const d = await r.json(); setRepData(d.report || ""); }
    finally { setRepLoad(false); }
  }

  // ── ✅ FONCTION fetchAtsScore ─────────────────────────────────────────────
  async function fetchAtsScore(job: Job) {
    setAtsModal({ job });
    setAtsData(null);
    setAtsError("");
    setAtsLoading(true);
    try {
      // Construire la JD depuis les champs du job
      const jdText = [
      job.title ? `Job Title: ${job.title}` : "",
      job.industry ? `Company: ${job.industry}` : "",
      job.location ? `Location: ${job.location}` : "",
      job.experience ? `Experience required: ${job.experience}` : "",
      job.skills_req ? `Required skills: ${job.skills_req}` : "",
      job.skills_bon ? `Nice to have: ${job.skills_bon}` : "",
      job.description || "",
    ].filter(Boolean).join("\n");

    if (jdText.trim().length < 20) {
setAtsError("Job description is too short to compute the ATS score.");
      setAtsLoading(false);
      return;
    }

      const r = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id:         String(userId),
          job_description: jdText,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        setAtsError(err.detail || "Erreur serveur");
        return;
      }
      setAtsData(await r.json());
    } catch {
      setAtsError("Connexion impossible au backend.");
    } finally {
      setAtsLoading(false);
    }
  }

  async function downloadPDF() {
    const r    = await fetch("/api/report/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId }) });
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = `career_report_${userId}.pdf`; a.click(); URL.revokeObjectURL(url);
  }

  async function runScan() {
    if (scanInFlightRef.current) return;
    scanInFlightRef.current = true;
    setIsScanning(true);
    setPipeSteps({ ...initPipeSteps(), lang: "active" });
    setPipeRole(""); setScanJobs([]); setEnrichN(0);
    try {
      const resp = await fetch("/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id:     userId,
          cv_raw_text: sessionStorage.getItem("jobscan_cv_text") || "", // ✅ cv_raw_text envoyé
        }),
      });
      if (!resp.ok || !resp.body) {
        const errBody = await resp.text().catch(() => "");
        // Fallback immediately to cached jobs so UI doesn't stay blocked.
        setPipeSteps(p => ({ ...p, lang: "done", scrape: "done", enrich: "done" }));
        await loadJobs();
        throw new Error(`Scan request failed (${resp.status})${errBody ? `: ${errBody.slice(0, 180)}` : ""}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", enriched = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() || "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data: ")) continue;
          let d: any;
          try { d = JSON.parse(line.slice(6)); } catch { continue; }
          switch (d.event) {
            case "cv_title":
            case "cv_ready":
              setPipeSteps(p => ({ ...p, lang: "done", scrape: "active", enrich: "active" }));
              if (d.title) setPipeRole(d.title);
              break;
            case "job_found":
              // Do not render raw detected jobs as cards.
              // They may not pass cosine/matching filters and would show misleading 0.0% scores.
              break;
            case "source_done":
              setPipeSteps(p => ({ ...p, [d.source]: "done" }));
              break;
            case "job":
              enriched++;
              setEnrichN(enriched);
              setScanJobs(prev => {
                const enrichedJob = d as Job;
                const incomingKey = scanJobKey(enrichedJob);
                const idx = prev.findIndex(j => scanJobKey(j) === incomingKey);
                if (idx >= 0) {
                  // Replace preview card (0%) with enriched/scored card.
                  const next = [...prev];
                  next[idx] = { ...next[idx], ...enrichedJob };
                  return next;
                }
                return [...prev, enrichedJob];
              });
              break;
            case "done":
              setPipeSteps(p => ({ ...p, lang: "done", scrape: "done", enrich: "done" }));
              reader.cancel();
              setScanJobs(prev => { if (prev.length) setJobs([...prev]); return prev; });
              setHasLoaded(true);
              break;
            case "error":
              // Backend aborted scan (e.g. missing profile / transient source issue).
              // Stop waiting so UI doesn't stay indefinitely on "Search in progress...".
              console.error("Scan SSE error:", d.message || d);
              setPipeSteps(p => ({ ...p, lang: "done", scrape: "done", enrich: "done" }));
              reader.cancel();
              break;
          }
        }
      }
      // Always refresh from DB after scan so existing jobs (e.g. user 10) still appear
      // even when current scan yields few or zero streamed results.
      await loadJobs();
      const r = await fetch(`/api/user/${userId}`);
      if (r.ok) { const d = await r.json(); setUserName(d.name || `User #${userId}`); }
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      window.history.replaceState({}, "", `/jobs-search?user_id=${userId}`);
      scanInFlightRef.current = false;
      setIsScanning(false);
    }
  }

  function logout() {
    window.dispatchEvent(new Event("jobscan:logout"));
    sessionStorage.clear();
    router.push("/");
  }

  return (
    <div style={S.page}>
      <style>{GLOBAL_CSS}</style>

      {/* HEADER */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 8px rgba(122,63,176,.06)" }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: 20, background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>CareerAssistant</span>
          <span style={{ fontSize: 10, color: "#9f8fb0", marginLeft: 10, fontFamily: MONO }}>JobScan AI · Cosine · BiEncoder · XAI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: C.muted }}>👤 {userName}</span>
          <button style={{ ...S.btnOut, fontSize: 11 }} onClick={logout}>Logout</button>
        </div>
      </header>

      {/* BODY */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 24px", display: "flex", gap: 20 }}>
        <ChatSidebar userId={userId} jobs={jobs} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {isScanning && <ScanningBanner pipeSteps={pipeSteps} pipeRole={pipeRole} enrichN={enrichN} />}

          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {(["matches", "gap", "roadmap", "market", "report"] as Tab[]).map(tab => (
              <button key={tab} style={S.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
                {{ matches: "🏆 Matches", gap: "📊 Skills Gap", roadmap: "🗺️ Roadmap", market: "📈 Market", report: "📄 Report" }[tab]}
              </button>
            ))}
          </div>

          {activeTab === "matches" && (
            // ✅ onAtsScore={fetchAtsScore} passé à MatchesTab
            <MatchesTab
              isScanning={isScanning} scanJobs={scanJobs} jobs={jobs}
              jobsLoad={jobsLoad} hasLoaded={hasLoaded}
              roleFilter={roleFilter} setRoleFilter={setRoleFilter}
              locFilter={locFilter}  setLocFilter={setLocFilter}
              minFit={minFit} setMinFit={setMinFit}
              onSearch={loadJobs}
              onAtsScore={fetchAtsScore}
            />
          )}
          {activeTab === "gap" && (
            <GapTab gapData={gapData} gapLoad={gapLoad}
              showLoadingPlaceholder={activeTab === "gap" && !!userId && !gapData}
              onAnalyze={loadGap} onGoToRoadmap={() => setActiveTab("roadmap")}
              onRefresh={() => { setGapData(null); setGapLoad(true); loadGap(); }} />
          )}
          {activeTab === "roadmap" && (
            <RoadmapTab roadData={roadData} roadLoad={roadLoad}
              showLoadingPlaceholder={activeTab === "roadmap" && !!userId && !roadData}
              onGenerate={loadRoadmap}
              onRefresh={() => { setRoadData(null); setRoadLoad(true); loadRoadmap(); }} />
          )}
          {activeTab === "market" && (
            <div>
              {mktLoad ? <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Loading market data…</div>
               : !mktData ? <button style={S.btn} onClick={loadMarket}>Load Market Insights</button>
               : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {[
                      { label: "Total Jobs",   value: mktData.total_jobs ?? "—" },
                      { label: "Avg AI Score", value: mktData.avg_ai_score != null ? `${mktData.avg_ai_score}%` : "—" },
                      { label: "Excellent",    value: mktData.score_breakdown?.excellent ?? 0 },
                      { label: "Good",         value: mktData.score_breakdown?.good ?? 0 },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ ...S.sec, flex: 1, minWidth: 120, marginBottom: 0, textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.p1 }}>{value}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <VerticalChart   data={mktData.top_skills    || []} title="📊 Top Skills Demanded" valueKey="count" labelKey="skill"   barColor={C.p2} height={260} />
                  <HorizontalChart data={mktData.top_companies || []} title="🏢 Top Companies"       valueKey="count" labelKey="company" barColor={C.p1} />
                  <div style={S.sec}>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, color: C.text }}>📍 Top Locations</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(mktData.top_locations || []).map((item: any) => (
                        <span key={item.location} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(122,63,176,.07)", border: "1px solid rgba(122,63,176,.2)", color: C.p2 }}>
                          {item.location} ({item.count})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === "report" && (
            <div>
              {repLoad ? (
                <div style={{ textAlign: "center", padding: 48, color: C.muted }}>
                  <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
                    {[0, 120, 240].map(d => <div key={d} style={{ width: 8, height: 8, borderRadius: "50%", background: C.p1, animation: `bounce 0.8s ${d}ms ease-in-out infinite` }} />)}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Generating your report…</div>
                </div>
              ) : repData ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <p style={{ fontSize: 14, color: C.text, margin: 0 }}>Your career report is ready.</p>
                    <button style={{ ...S.btn, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "white", fontWeight: 700 }} onClick={downloadPDF}>📄 Download PDF</button>
                  </div>
                  <div style={{ ...S.sec, maxHeight: 520, overflowY: "auto" }}>
                    <pre style={{ fontSize: 11, lineHeight: 1.65, color: "#4a3f60", whiteSpace: "pre-wrap", fontFamily: MONO, margin: 0 }}>{repData}</pre>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={S.btn} onClick={loadReport} disabled={repLoad}>🔄 Regenerate report</button>
                    <button style={{ ...S.btn, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "white" }} onClick={downloadPDF}>📄 Download PDF</button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
                  <p style={{ marginBottom: 16 }}>Open the Report tab to generate your career report.</p>
                  <button style={S.btn} onClick={loadReport}>Generate report</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── ✅ RENDER DU MODAL ATS — en dehors du layout principal ── */}
  {atsModal && (
  <ATSModal
    job={atsModal.job}
    data={atsData}
    loading={atsLoading}
    error={atsError}
    userId={userId}
    onClose={() => {
      setAtsModal(null);
      setAtsData(null);
      setAtsError("");
    }}
  />
)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Export
// ─────────────────────────────────────────────────────────────────────────────

export default function AppPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color: C.muted }}>
        Loading…
      </div>
    }>
      <Dashboard />
    </Suspense>
  );
}