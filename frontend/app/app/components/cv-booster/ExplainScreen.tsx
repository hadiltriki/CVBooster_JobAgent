"use client";
// ExplainScreen.jsx — xAI: GPT explains every ATS point with surgical precision

import {
  ArrowLeft, AlertTriangle, CheckCircle, XCircle,
  LayoutList, Wrench, Briefcase, AlignJustify, Mail, ScanSearch,
  Globe, BookOpen, ChevronDown, ChevronUp,
  Check, X, Zap, TrendingUp, Sparkles,
} from "lucide-react";
import { useState } from "react";
import React from "react";

// ─── Criteria metadata ────────────────────────────────────────────────────────
type CriteriaMeta = { label: string; max: number; Icon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }>; iconColor: string; iconBg: string; };
const CRITERIA_META: Record<string, CriteriaMeta> = {
  sections:   { label: "Key Sections",         max: 20, Icon: LayoutList,   iconColor: "#7B2FBE", iconBg: "rgba(123,47,190,.1)"  },
  skills:     { label: "Technical Skills",     max: 18, Icon: Wrench,       iconColor: "#E91E8C", iconBg: "rgba(233,30,140,.1)"  },
  experience: { label: "Work Experience",      max: 18, Icon: Briefcase,    iconColor: "#0EA5E9", iconBg: "rgba(14,165,233,.1)"   },
  length:     { label: "CV Length",            max: 12, Icon: AlignJustify, iconColor: "#F59E0B", iconBg: "rgba(245,158,11,.1)"   },
  contact:    { label: "Contact Information",  max:  8, Icon: Mail,         iconColor: "#10B981", iconBg: "rgba(16,185,129,.1)"   },
  keywords:   { label: "ATS Keywords",         max:  8, Icon: ScanSearch,   iconColor: "#8B5CF6", iconBg: "rgba(139,92,246,.1)"   },
  summary:    { label: "Professional Summary", max: 10, Icon: BookOpen,     iconColor: "#E91E8C", iconBg: "rgba(233,30,140,.1)"   },
  languages:  { label: "Languages",            max:  6, Icon: Globe,        iconColor: "#0EA5E9", iconBg: "rgba(14,165,233,.1)"   },
};

function getStatus(score: number, max: number) {
  const p = score / max;
  if (p >= 0.8) return "good";
  if (p >= 0.5) return "medium";
  return "bad";
}

function getGrade(total: number) {
  if (total >= 80) return { label: "Excellent",  color: "#10B981", bg: "rgba(16,185,129,.07)", border: "rgba(16,185,129,.3)" };
  if (total >= 65) return { label: "Good",        color: "#F59E0B", bg: "rgba(245,158,11,.07)", border: "rgba(245,158,11,.3)"  };
  if (total >= 45) return { label: "Needs Work",  color: "#E91E8C", bg: "rgba(233,30,140,.06)", border: "rgba(233,30,140,.3)"  };
  return               { label: "Critical",   color: "#EF4444", bg: "rgba(239,68,68,.06)",   border: "rgba(239,68,68,.3)"   };
}

// ─── Criterion card ───────────────────────────────────────────────────────────
function CriterionCard({ meta, score, detail, xai, defaultOpen }: {
  meta: { label: string; max: number; Icon: React.ElementType; iconColor: string; iconBg: string };
  score: number; detail: string;
  xai: { why?: string; found?: string[]; missing?: string[]; fix?: string; impact?: string } | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || false);

  const status      = getStatus(score, meta.max);
  const pct         = Math.round((score / meta.max) * 100);
  const sc          = status === "good" ? "#10B981" : status === "medium" ? "#F59E0B" : "#EF4444";
  const sbg         = status === "good" ? "rgba(16,185,129,.06)" : status === "medium" ? "rgba(245,158,11,.06)" : "rgba(239,68,68,.05)";
  const sborder     = status === "good" ? "rgba(16,185,129,.25)" : status === "medium" ? "rgba(245,158,11,.25)" : "rgba(239,68,68,.22)";
  const StatusIcon  = status === "good" ? CheckCircle : status === "medium" ? AlertTriangle : XCircle;
  const CIcon       = meta.Icon;

  const why     = xai?.why     || "";
  const found   = Array.isArray(xai?.found)   ? xai.found   : [];
  const missing = Array.isArray(xai?.missing) ? xai.missing : [];
  const fix     = xai?.fix     || "";
  const impact  = xai?.impact  || `+${meta.max - score} pts possible`;

  const ptsMissed = meta.max - score;

  return (
    <div style={{
      background: "var(--surface)",
      border: `1.5px solid ${sborder}`,
      borderLeft: `5px solid ${sc}`,
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: open ? `0 4px 24px ${sc}18` : "var(--shadow-sm)",
      transition: "box-shadow .2s",
    }}>

      {/* ── Clickable header ─────────────────────────────────────── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px", cursor: "pointer", gap: 12,
          userSelect: "none",
        }}
      >
        {/* Icon + label + raw detail */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: meta.iconBg, color: meta.iconColor,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CIcon size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
              {meta.label}
            </div>
            <div style={{
              fontSize: 11, color: "var(--text-faint)", marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {detail}
            </div>
          </div>
        </div>

        {/* Score + badge + chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {ptsMissed > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
              background: `${sc}18`, color: sc, border: `1px solid ${sc}44`,
              whiteSpace: "nowrap",
            }}>
              {impact}
            </span>
          )}
          <StatusIcon size={14} color={sc} />
          <span style={{ fontSize: 22, fontWeight: 900, color: sc }}>{score}</span>
          <span style={{ fontSize: 11, color: "var(--text-faint)", marginRight: 4 }}>
            / {meta.max}
          </span>
          {open
            ? <ChevronUp   size={15} color="var(--text-faint)" />
            : <ChevronDown size={15} color="var(--text-faint)" />}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: "rgba(123,47,190,.07)", margin: "0 20px" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 99,
          background: status === "good"
            ? "linear-gradient(90deg,#10B981,#059669)"
            : status === "medium"
            ? "linear-gradient(90deg,#F59E0B,#D97706)"
            : "linear-gradient(90deg,#EF4444,#DC2626)",
          transition: "width 1.1s cubic-bezier(0.34,1.56,0.64,1)",
        }} />
      </div>

      {/* ── Expanded xAI content ─────────────────────────────────── */}
      {open && (
        <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* WHY THIS SCORE */}
          {why && (
            <div style={{
              padding: "14px 16px", borderRadius: 12,
              background: sbg, border: `1px solid ${sborder}`,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: ".1em",
                textTransform: "uppercase", color: sc, marginBottom: 8,
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <Sparkles size={11} />
                Why you scored {score}/{meta.max}
              </div>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
                {why}
              </div>
            </div>
          )}

          {/* FOUND ✓  +  MISSING ✗ */}
          {(found.length > 0 || missing.length > 0) && (
            <div style={{
              display: "grid",
              gridTemplateColumns: found.length > 0 && missing.length > 0 ? "1fr 1fr" : "1fr",
              gap: 12,
            }}>

              {/* FOUND */}
              {found.length > 0 && (
                <div style={{
                  padding: "13px 15px", borderRadius: 12,
                  background: "rgba(16,185,129,.05)",
                  border: "1.5px solid rgba(16,185,129,.2)",
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: ".1em",
                    textTransform: "uppercase", color: "#10B981",
                    marginBottom: 10, display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <Check size={11} /> Detected in your CV
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {found.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(16,185,129,.15)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          marginTop: 1,
                        }}>
                          <Check size={9} color="#10B981" />
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MISSING */}
              {missing.length > 0 && (
                <div style={{
                  padding: "13px 15px", borderRadius: 12,
                  background: "rgba(239,68,68,.05)",
                  border: "1.5px solid rgba(239,68,68,.2)",
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: ".1em",
                    textTransform: "uppercase", color: "#EF4444",
                    marginBottom: 10, display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <X size={11} /> Missing from your CV
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {missing.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(239,68,68,.12)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          marginTop: 1,
                        }}>
                          <X size={9} color="#EF4444" />
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HOW TO FIX + IMPACT */}
          {fix && (
            <div style={{
              padding: "13px 16px", borderRadius: 12,
              background: "rgba(123,47,190,.05)",
              border: "1.5px solid rgba(123,47,190,.18)",
              display: "flex", alignItems: "flex-start", gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: "rgba(123,47,190,.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Zap size={14} color="#7B2FBE" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: ".1em",
                  textTransform: "uppercase", color: "#7B2FBE", marginBottom: 6,
                }}>
                  Exact fix for your CV
                </div>
                <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
                  {fix}
                </div>
              </div>
              {ptsMissed > 0 && (
                <div style={{
                  flexShrink: 0, padding: "6px 12px", borderRadius: 10,
                  background: "linear-gradient(135deg,#E91E8C,#7B2FBE)",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  boxShadow: "0 3px 12px rgba(233,30,140,.3)",
                }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                    {impact}
                  </span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,.8)", marginTop: 1 }}>
                    if fixed
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ExplainScreen({ scoreBefore, bdBefore, explanation, domain, onBack }: { scoreBefore: number; bdBefore: Record<string, { score: number; max?: number; detail?: string }>; explanation: Record<string, any>; domain: string; onBack: () => void; }) {
  const grade = getGrade(scoreBefore || 0);
  const bd    = bdBefore   || {};
  const xai   = explanation || {};

  // Sort: worst criteria first (most points to gain at top)
  const sorted = Object.entries(CRITERIA_META).sort(([ka], [kb]) => {
    const pa = (bd[ka]?.score ?? 0) / CRITERIA_META[ka].max;
    const pb = (bd[kb]?.score ?? 0) / CRITERIA_META[kb].max;
    return pa - pb;
  });

  const totalMissed = Object.values(bd).reduce(
    (acc, v) => acc + ((v.max || 0) - (v.score || 0)), 0
  );

  const worstKey = sorted[0]?.[0];

  return (
    <div style={{
      minHeight: "calc(100vh - 57px)", background: "var(--bg)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "44px 24px 80px", animation: "fadeUp .35s ease both",
    }}>
      <div style={{ width: "100%", maxWidth: 820, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Page header ── */}
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "4px 14px", borderRadius: 99, marginBottom: 12,
            border: "1.5px solid rgba(233,30,140,.3)",
            fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--pink)",
          }}>
            <Sparkles size={11} />
            SUBUL ATS Audit
            {domain && <span style={{ opacity: .55, fontWeight: 400 }}>· {domain}</span>}
          </div>
          <h2 style={{
            fontSize: "clamp(24px,4vw,38px)", fontWeight: 900,
            letterSpacing: "-.03em", margin: "0 0 8px",
            color: "var(--text)", lineHeight: 1.1,
          }}>
            Why your CV scored{" "}
            <span style={{ background: "var(--grad)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {scoreBefore}/100
            </span>
          </h2>
        
        </div>

        {/* ── Grade banner ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
          background: grade.bg, border: `1.5px solid ${grade.border}`,
          borderRadius: 18, padding: "20px 26px",
        }}>
          {/* Ring */}
          <div style={{
            position: "relative", width: 80, height: 80, flexShrink: 0,
          }}>
            <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={40} cy={40} r={32} fill="none"
                stroke="rgba(123,47,190,.1)" strokeWidth={8} />
              <circle cx={40} cy={40} r={32} fill="none"
                stroke={grade.color} strokeWidth={8}
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - (scoreBefore || 0) / 100)}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: grade.color, lineHeight: 1 }}>
                {scoreBefore}
              </span>
              <span style={{ fontSize: 9, color: grade.color, opacity: .7 }}>/100</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: grade.color, marginBottom: 5 }}>
              {grade.label}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {scoreBefore >= 80
                ? "Your CV is ATS-ready. Targeted improvements can push it to 90+."
                : scoreBefore >= 65
                ? "Solid base — specific gaps are costing you points with ATS filters."
                : scoreBefore >= 45
                ? "Significant issues — most ATS systems will filter this CV out automatically."
                : "Critical problems — this CV will be rejected before any human reads it."}
            </div>
          </div>

          {/* Points available */}
          {totalMissed > 0 && (
            <div style={{
              textAlign: "center", padding: "12px 18px", borderRadius: 14,
              background: "var(--surface)", border: "1px solid var(--border)",
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 28, fontWeight: 900, lineHeight: 1,
                background: "var(--grad)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                +{totalMissed}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3 }}>
                pts available
              </div>
              <div style={{ fontSize: 9, color: "var(--text-faint)" }}>
                if all fixed
              </div>
            </div>
          )}
        </div>

        {/* ── Mini score grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(80px,1fr))", gap: 8 }}>
          {Object.entries(CRITERIA_META).map(([key, meta]) => {
            const s      = bd[key]?.score ?? 0;
            const status = getStatus(s, meta.max);
            const color  = status === "good" ? "#10B981" : status === "medium" ? "#F59E0B" : "#EF4444";
            const CIcon  = meta.Icon;
            const missed = meta.max - s;
            return (
              <div key={key} style={{
                padding: "10px 6px", borderRadius: 11, textAlign: "center",
                background: "var(--surface)",
                border: `1.5px solid ${color}33`,
                boxShadow: "var(--shadow-sm)",
                position: "relative",
              }}>
                <CIcon size={13} color={color} style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1 }}>{s}</div>
                <div style={{ fontSize: 9, color: "var(--text-faint)" }}>/{meta.max}</div>
                {missed > 0 && (
                  <div style={{
                    fontSize: 8, color: color, fontWeight: 700, marginTop: 2,
                  }}>-{missed} pts</div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Criterion cards — worst first, worst auto-open ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: ".1em",
            textTransform: "uppercase", color: "var(--text-faint)", paddingLeft: 4,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <TrendingUp size={12} color="var(--pink)" />
            Sorted by most points to gain — click to expand
          </div>

          {sorted.map(([key, meta]) => (
            <CriterionCard
              key={key}
              meta={meta}
              score={bd[key]?.score ?? 0}
              detail={bd[key]?.detail ?? ""}
              xai={xai[key] ?? null}
              defaultOpen={key === worstKey}
            />
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <div style={{
          background: "linear-gradient(135deg,rgba(233,30,140,.05),rgba(123,47,190,.05))",
          border: "1.5px solid rgba(233,30,140,.22)",
          borderRadius: 18, padding: "24px 28px",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 20, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 5 }}>
              Fix all of this automatically?
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.65, maxWidth: 400 }}>
              Our rewrites your CV, fixes every issue identified above,
              integrates SUBUL data  and targets {totalMissed > 0 ? `+${totalMissed} pts` : "maximum score"}.
            </div>
          </div>
          <button
            onClick={onBack} type="button"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "13px 24px", borderRadius: 12,
              background: "var(--surface)", border: "1.5px solid rgba(123,47,190,.25)",
              color: "var(--violet)", fontFamily: "var(--font)",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "var(--shadow-sm)", transition: "all .2s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="var(--pink)"; e.currentTarget.style.color="var(--pink)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(123,47,190,.25)"; e.currentTarget.style.color="var(--violet)"; }}
          >
            <ArrowLeft size={14} /> Go Back
          </button>
        </div>

      </div>
    </div>
  );
}