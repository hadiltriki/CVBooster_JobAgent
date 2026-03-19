"use client";
// FormatScreen.jsx
// Let the user choose CV format before boosting — ATS, Basic, Modern only

import { ArrowLeft, Rocket, CheckCircle, Target, FileText, Palette, Type } from "lucide-react";
import React from "react";

type PreviewLine =
  | { type: "name" | "contact" | "section" | "body" | "bullet"; text: string }
  | { type: "job"; left: string; right: string }
  | { type: "basic-header"; name: string; domain: string; contact: string }
  | { type: "basic-2col" | "modern-full" };

interface FormatDef {
  id: string; name: string; tag: string; tagColor: string; tagBg: string; tagBorder: string;
  font: string; description: string; bestFor: string; features: string[];
  preview: PreviewLine[];
}

export const FORMATS: FormatDef[] = [
  {
    id: "ats",
    name: "ATS Optimized",
    tag: "Recommended",
    tagColor: "#10B981",
    tagBg: "rgba(16,185,129,0.1)",
    tagBorder: "rgba(16,185,129,0.3)",
    font: "Times New Roman · 10.5pt",
    description: "Maximizes your chances of passing automated HR filters. Pure structure — exactly what ATS robots need.",
    bestFor: "Online platforms · LinkedIn · Taleo · Workday · Large companies",
    features: [
      "Single column, no graphics",
      "Times New Roman — ATS-safe font",
      "Dates right-aligned with tab stops",
      "Section headings in caps",
      "No color, no borders",
    ],
    preview: [
      { type: "name",    text: "JOHN SMITH" },
      { type: "contact", text: "john@email.com  |  +212 6XX  |  LinkedIn" },
      { type: "section", text: "PROFILE" },
      { type: "body",    text: "Detail-oriented Data Scientist with 2+ years..." },
      { type: "section", text: "PROFESSIONAL EXPERIENCE" },
      { type: "job",     left: "Data Analyst | TechCorp", right: "2023 – Present" },
      { type: "bullet",  text: "Built dashboards reducing reporting time by 40%" },
      { type: "section", text: "SKILLS" },
      { type: "body",    text: "Programming: Python, SQL  |  ML: Scikit-learn..." },
    ],
  },
  {
    id: "basic",
    name: "Basic / Classic",
    tag: "Traditional",
    tagColor: "#6B7280",
    tagBg: "rgba(107,114,128,0.1)",
    tagBorder: "rgba(107,114,128,0.25)",
    font: "Georgia · 10.5pt",
    description: "Two-column layout with your bold name as header. Elegant and clean — perfect balance between modern and classic.",
    bestFor: "Traditional companies · Public sector · General applications",
    features: [
      "Large bold name header",
      "Two columns: Education+Skills left | Experience right",
      "Subtle vertical separator line",
      "Spaced uppercase section headers",
      "Calibri — clean universal font",
    ],
    preview: [
      { type: "basic-header", name: "John Smith", domain: "Data Science", contact: "john@email.com  |  +212 6XX  |  LinkedIn" },
      { type: "basic-2col" },
    ],
  },
  {
    id: "modern",
    name: "Modern / Creative",
    tag: "Creative",
    tagColor: "#F59E0B",
    tagBg: "rgba(245,158,11,0.08)",
    tagBorder: "rgba(245,158,11,0.3)",
    font: "Calibri · Two columns",
    description: "Bold navy sidebar on the left with your name and skills. Main content on the right. Striking first impression.",
    bestFor: "Direct email applications · Startups · Tech & Creative companies",
    features: [
      "Navy blue sidebar — name, contact, skills",
      "Clean white main area — experience",
      "Visually memorable to recruiters",
      "Best for direct or email applications",
      "Two-column creative layout",
    ],
    preview: [
      { type: "modern-full" },
    ],
  },
];

// ── Mini CV Preview — fixed height so all 3 are the same size ───────────────
const PREVIEW_H = 200;

function MiniPreview({ format, selected }: { format: FormatDef; selected: boolean }) {
  const borderAccent = selected ? "rgba(233,30,140,0.25)" : "rgba(0,0,0,0.10)";

  if (format.id === "basic") return (
    <div style={{
      background: "#fff", borderRadius: 8, overflow: "hidden",
      boxShadow: `0 2px 12px ${borderAccent}`,
      height: PREVIEW_H, userSelect: "none",
      fontFamily: "Calibri,sans-serif", fontSize: 6,
      border: `1px solid ${borderAccent}`,
    }}>
      <div style={{ padding: "8px 10px 5px", borderBottom: "2px solid #aaa" }}>
        <div style={{ fontWeight: 900, fontSize: 11, color: "#0D0D0D", lineHeight: 1 }}>John Smith</div>
        <div style={{ fontSize: 6, color: "#555", marginTop: 2 }}>Data Science</div>
        <div style={{ fontSize: 5, color: "#777", marginTop: 2 }}>john@email.com  |  +212 6XX  |  LinkedIn</div>
        <div style={{ borderBottom: "1px solid #ddd", marginTop: 3 }} />
      </div>
      <div style={{ display: "flex" }}>
        <div style={{ width: "36%", padding: "5px 7px", borderRight: "1px solid #DDD" }}>
          <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: 1, color: "#0D0D0D", borderBottom: "0.5px solid #CCC", paddingBottom: 1, marginBottom: 3, marginTop: 3 }}>EDUCATION</div>
          <div style={{ fontSize: 5, fontWeight: 700, color: "#2B2B2B" }}>BSc Computer Science</div>
          <div style={{ fontSize: 4.5, color: "#777" }}>University · 2020–2023</div>
          <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: 1, color: "#0D0D0D", borderBottom: "0.5px solid #CCC", paddingBottom: 1, marginBottom: 3, marginTop: 5 }}>SKILLS</div>
          <div style={{ fontSize: 5, color: "#444" }}>• Python, SQL</div>
          <div style={{ fontSize: 5, color: "#444" }}>• Machine Learning</div>
          <div style={{ fontSize: 5, color: "#444" }}>• Power BI</div>
          <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: 1, color: "#0D0D0D", borderBottom: "0.5px solid #CCC", paddingBottom: 1, marginBottom: 3, marginTop: 5 }}>LANGUAGES</div>
          <div style={{ fontSize: 5, color: "#444" }}>• English — Fluent</div>
          <div style={{ fontSize: 5, color: "#444" }}>• French — B2</div>
        </div>
        <div style={{ flex: 1, padding: "5px 7px 5px 9px" }}>
          <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: 1, color: "#0D0D0D", borderBottom: "0.5px solid #CCC", paddingBottom: 1, marginBottom: 3, marginTop: 3 }}>SUMMARY</div>
          <div style={{ fontSize: 5, color: "#444", lineHeight: 1.5 }}>Detail-oriented Data Scientist with 2+ years of experience in analytics and ML.</div>
          <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: 1, color: "#0D0D0D", borderBottom: "0.5px solid #CCC", paddingBottom: 1, marginBottom: 3, marginTop: 5 }}>EXPERIENCE</div>
          <div style={{ fontSize: 5.5, fontWeight: 700, color: "#2B2B2B" }}>Data Analyst | TechCorp</div>
          <div style={{ fontSize: 4.5, color: "#888" }}>2023 – Present</div>
          <div style={{ fontSize: 5, color: "#444" }}>• Built dashboards reducing reporting time by 40%</div>
          <div style={{ fontSize: 5, color: "#444" }}>• Automated data pipeline with Python & SQL</div>
        </div>
      </div>
    </div>
  );

  if (format.id === "modern") return (
    <div style={{
      background: "#fff", borderRadius: 8, overflow: "hidden",
      boxShadow: `0 2px 12px ${borderAccent}`,
      height: PREVIEW_H, userSelect: "none",
      fontFamily: "Calibri,sans-serif", fontSize: 6,
      display: "flex",
      border: `1px solid ${borderAccent}`,
    }}>
      <div style={{ width: "34%", background: "#1A3C72", padding: "9px 6px", display: "flex", flexDirection: "column" }}>
        <div style={{ fontWeight: 900, fontSize: 8.5, color: "#fff", lineHeight: 1.1, marginBottom: 5, letterSpacing: 0.5 }}>JOHN SMITH</div>
        <div style={{ fontSize: 5, fontWeight: 700, color: "#fff", borderBottom: "0.5px solid rgba(255,255,255,0.5)", paddingBottom: 1.5, marginBottom: 3, letterSpacing: 0.5 }}>CONTACT</div>
        <div style={{ fontSize: 4.5, color: "#BBCCEE", marginBottom: 1.5 }}>+212 6XX XXX</div>
        <div style={{ fontSize: 4.5, color: "#BBCCEE", marginBottom: 1.5 }}>john@email.com</div>
        <div style={{ fontSize: 4.5, color: "#BBCCEE", marginBottom: 5 }}>LinkedIn</div>
        <div style={{ fontSize: 5, fontWeight: 700, color: "#fff", borderBottom: "0.5px solid rgba(255,255,255,0.5)", paddingBottom: 1.5, marginBottom: 3, letterSpacing: 0.5, marginTop: 3 }}>SKILLS</div>
        <div style={{ fontSize: 4.5, color: "#fff", opacity: 0.9 }}>• Python, SQL</div>
        <div style={{ fontSize: 4.5, color: "#fff", opacity: 0.9 }}>• Machine Learning</div>
        <div style={{ fontSize: 4.5, color: "#fff", opacity: 0.9 }}>• Power BI</div>
      </div>
      <div style={{ flex: 1, padding: "9px 7px" }}>
        <div style={{ fontSize: 6, fontWeight: 700, color: "#111", letterSpacing: 1, borderBottom: "0.5px solid #CCC", paddingBottom: 1.5, marginBottom: 3 }}>EXPERIENCE</div>
        <div style={{ fontSize: 5, color: "#888", marginBottom: 1 }}>2023 – Present</div>
        <div style={{ fontSize: 5.5, fontWeight: 700, color: "#111" }}>Data Analyst</div>
        <div style={{ fontSize: 5, color: "#444", marginBottom: 2 }}>TechCorp, Agadir</div>
        <div style={{ fontSize: 5, color: "#444" }}>• Built dashboards reducing time by 40%</div>
        <div style={{ fontSize: 5, color: "#444" }}>• Automated pipeline with Python & SQL</div>
        <div style={{ fontSize: 6, fontWeight: 700, color: "#111", letterSpacing: 1, borderBottom: "0.5px solid #CCC", paddingBottom: 1.5, marginBottom: 3, marginTop: 5 }}>EDUCATION</div>
        <div style={{ fontSize: 4.5, color: "#888" }}>2020 – 2023</div>
        <div style={{ fontSize: 5, color: "#555" }}>University of Agadir</div>
        <div style={{ fontSize: 5.5, fontWeight: 700, color: "#111" }}>BSc Computer Science</div>
      </div>
    </div>
  );

  // ATS (default)
  return (
    <div style={{
      background: "#fff", borderRadius: 8, overflow: "hidden",
      padding: "9px 11px", fontSize: 6, lineHeight: 1.5, color: "#111",
      fontFamily: "'Times New Roman',serif",
      boxShadow: `0 2px 12px ${borderAccent}`,
      height: PREVIEW_H, userSelect: "none",
      border: `1px solid ${borderAccent}`,
      overflowY: "hidden",
    }}>
      {format.preview.map((line, i) => {
        if (line.type === "name") return (
          <div key={i} style={{ fontSize: 10, fontWeight: 900, textAlign: "center", marginBottom: 2, letterSpacing: 1 }}>{line.text}</div>
        );
        if (line.type === "contact") return (
          <div key={i} style={{ fontSize: 5, textAlign: "center", color: "#555", marginBottom: 4 }}>{line.text}</div>
        );
        if (line.type === "section") return (
          <div key={i} style={{ fontSize: 6.5, fontWeight: 700, textTransform: "uppercase", borderBottom: "1px solid #000", marginTop: 5, marginBottom: 2, paddingBottom: 1 }}>{line.text}</div>
        );
        if (line.type === "body") return (
          <div key={i} style={{ fontSize: 5, color: "#333", marginBottom: 2 }}>{line.text}</div>
        );
        if (line.type === "job") return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 5.5, fontWeight: 700, marginBottom: 1 }}>
            <span>{line.left}</span><span style={{ color: "#555" }}>{line.right}</span>
          </div>
        );
        if (line.type === "bullet") return (
          <div key={i} style={{ fontSize: 5, color: "#444", marginLeft: 7, marginBottom: 1 }}>• {line.text}</div>
        );
        return null;
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FormatScreen({ selectedFormat, setSelectedFormat, onNext, onBack }: { selectedFormat: string; setSelectedFormat: (f: string) => void; onNext: () => void; onBack: () => void; }) {
  return (
    <div style={{
      minHeight: "calc(100vh - 57px)",
      display: "flex", flexDirection: "column",
      alignItems: "center",
      padding: "44px 24px 72px",
      animation: "fadeUp .35s ease both",
    }}>
      <div style={{ width: "100%", maxWidth: 960, display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Header */}
        <div>
          <div style={{
            display: "inline-block", padding: "4px 14px", borderRadius: 99,
            border: "1.5px solid rgba(233,30,140,.35)",
            fontSize: 11, fontWeight: 700, letterSpacing: ".1em",
            color: "var(--pink)", marginBottom: 12,
          }}>Step 05 — Format</div>
          <h2 style={{
            fontSize: "clamp(26px,4vw,42px)", fontWeight: 900,
            letterSpacing: "-.03em", margin: "0 0 8px", color: "var(--text)", lineHeight: 1.1,
          }}>Choose your CV format</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
            Each format is optimized for a different context. Pick the one that matches your situation.
          </p>
        </div>

        {/* Format cards — 3 columns, same row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
          className="format-grid">
          {FORMATS.map(fmt => {
            const selected = selectedFormat === fmt.id;
            const IconCmp = fmt.id === "ats" ? Target : fmt.id === "basic" ? FileText : Palette;
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setSelectedFormat(fmt.id)}
                style={{
                  all: "unset",
                  display: "flex", flexDirection: "column",
                  background: selected
                    ? "linear-gradient(135deg,rgba(233,30,140,0.06),rgba(123,47,190,0.06))"
                    : "var(--surface)",
                  border: selected
                    ? "2px solid rgba(233,30,140,0.5)"
                    : "1.5px solid var(--border)",
                  borderRadius: 20, padding: "22px 20px",
                  cursor: "pointer",
                  transition: "all .2s",
                  boxShadow: selected ? "0 4px 28px rgba(233,30,140,0.15)" : "var(--shadow-sm)",
                  gap: 0, position: "relative",
                }}
                onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = "rgba(123,47,190,.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}}
                onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; }}}
              >
                {/* Selected checkmark */}
                {selected && (
                  <div style={{
                    position: "absolute", top: 14, right: 14,
                    width: 22, height: 22, borderRadius: "50%",
                    background: "var(--grad)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <CheckCircle size={13} color="#fff" />
                  </div>
                )}

                {/* Icon + name + tag */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: selected ? "rgba(233,30,140,.12)" : "rgba(123,47,190,.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: selected ? "var(--pink)" : "var(--violet)",
                    transition: "all .2s",
                  }}>
                    <IconCmp size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginBottom: 3 }}>
                      {fmt.name}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px",
                      borderRadius: 99, color: fmt.tagColor,
                      background: fmt.tagBg, border: `1px solid ${fmt.tagBorder}`,
                    }}>{fmt.tag}</span>
                  </div>
                </div>

                {/* Description */}
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px", lineHeight: 1.6 }}>
                  {fmt.description}
                </p>

                {/* Best for */}
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 12 }}>
                  <span style={{ color: "var(--violet)", fontWeight: 600 }}>Best for: </span>
                  {fmt.bestFor}
                </div>

                {/* Font badge */}
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 10, fontWeight: 600,
                  padding: "3px 10px", borderRadius: 99,
                  background: "rgba(123,47,190,0.07)",
                  border: "1px solid rgba(123,47,190,0.15)",
                  color: "var(--violet)", marginBottom: 14,
                }}>
                  <Type size={10} /> {fmt.font}
                </div>

                {/* Features */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
                  {fmt.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: selected ? "var(--pink)" : "rgba(123,47,190,0.4)", flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* Preview label */}
                <div style={{
                  fontSize: 9, fontWeight: 600, color: "var(--text-faint)",
                  textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8,
                }}>
                  Preview
                </div>

                {/* Mini preview — fixed height so all 3 align */}
                <MiniPreview format={fmt} selected={selected} />

              </button>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div style={{
          background: "var(--surface)",
          border: "1.5px solid rgba(233,30,140,.2)",
          borderRadius: 20, padding: "22px 28px",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 24, flexWrap: "wrap",
          boxShadow: "0 4px 24px rgba(233,30,140,.08)",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>
              Selected:{" "}
              <span style={{ background: "var(--grad)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {FORMATS.find(f => f.id === selectedFormat)?.name}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {FORMATS.find(f => f.id === selectedFormat)?.font} · {FORMATS.find(f => f.id === selectedFormat)?.tag}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            <button
              type="button"
              onClick={onNext}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "15px 36px", borderRadius: 14,
                background: "var(--grad)", border: "none",
                color: "#fff", fontFamily: "var(--font)",
                fontSize: 15, fontWeight: 800, cursor: "pointer",
                boxShadow: "0 6px 28px rgba(233,30,140,.38)",
                transition: "all .2s", whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 36px rgba(233,30,140,.55)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 6px 28px rgba(233,30,140,.38)"; e.currentTarget.style.transform = "none"; }}
            >
              <Rocket size={15} />
              Boost My CV
            </button>

            <button
              type="button"
              onClick={onBack}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 18px", borderRadius: 10,
                background: "transparent", border: "1px solid var(--border)",
                color: "var(--text-faint)", fontFamily: "var(--font)",
                fontSize: 12, cursor: "pointer", transition: "all .2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(123,47,190,.3)"; e.currentTarget.style.color = "var(--violet)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-faint)"; }}
            >
              <ArrowLeft size={11} />
              Go Back
            </button>
          </div>
        </div>

      </div>

      <style>{`
        @media (max-width: 860px) {
          .format-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 520px) {
          .format-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}