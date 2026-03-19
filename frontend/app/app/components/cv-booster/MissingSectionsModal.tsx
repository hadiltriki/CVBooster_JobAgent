"use client";
// MissingSectionsModal.jsx
// Modal that appears when CV is missing Languages, Education, or Experience sections
// Shows form to fill missing data before boosting

import { useState, useEffect, useRef } from "react";
import React from "react";
import {
  X, Plus, Trash2, Globe, GraduationCap, Briefcase,
  AlertTriangle, ChevronRight, Check, Rocket,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LangRow { id: number; language: string; level: string; }
interface EduRow { id: number; degree: string; university: string; start: string; end: string; present: boolean; }
interface ExpRow { id: number; title: string; company: string; location: string; description: string; start: string; end: string; present: boolean; }

// ─── Language level options ───────────────────────────────────────────────────
const LANG_LEVELS = [
  "Native (C2+)",
  "Fluent (C2)",
  "Advanced (C1)",
  "Upper-Intermediate (B2)",
  "Intermediate (B1)",
  "Elementary (A2)",
  "Beginner (A1)",
];

// ─── Common languages quick-pick ─────────────────────────────────────────────
const QUICK_LANGS = ["Arabic", "French", "English", "Spanish", "German", "Italian", "Chinese"];

// ─── Empty row factories ─────────────────────────────────────────────────────
const emptyLang = () => ({ id: Date.now() + Math.random(), language: "", level: "" });
const emptyEdu  = () => ({ id: Date.now() + Math.random(), degree: "", university: "", start: "", end: "", present: false });
const emptyExp  = () => ({ id: Date.now() + Math.random(), title: "", company: "", location: "", description: "", start: "", end: "", present: false });

// ─── Animated step dot ────────────────────────────────────────────────────────
function StepDot({ active, done, n }: { active: boolean; done: boolean; n: number }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: 12,
      background: done ? "linear-gradient(135deg,#10B981,#059669)"
        : active ? "linear-gradient(135deg,#E91E8C,#7B2FBE)"
        : "rgba(123,47,190,.1)",
      color: done || active ? "#fff" : "var(--text-faint)",
      boxShadow: active ? "0 3px 12px rgba(233,30,140,.35)" : "none",
      transition: "all .3s",
    }}>
      {done ? <Check size={13} /> : n}
    </div>
  );
}

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  borderRadius: 10, border: "1.5px solid var(--border)",
  background: "var(--surface2)",
  fontFamily: "var(--font)", fontSize: 13,
  color: "var(--text)", outline: "none",
  transition: "border-color .18s",
  boxSizing: "border-box",
};

// ─── "Present" checkbox pill ──────────────────────────────────────────────────
function PresentToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 99,
        border: `1.5px solid ${checked ? "rgba(16,185,129,.4)" : "rgba(123,47,190,.2)"}`,
        background: checked ? "rgba(16,185,129,.1)" : "rgba(123,47,190,.04)",
        color: checked ? "#10B981" : "var(--text-faint)",
        fontFamily: "var(--font)", fontSize: 11, fontWeight: 700,
        cursor: "pointer", transition: "all .18s", whiteSpace: "nowrap",
      }}
    >
      {checked && <Check size={10} />}
      Present
    </button>
  );
}

// ─── Languages form ───────────────────────────────────────────────────────────
function LanguagesForm({ rows, setRows, errors = {} }: { rows: LangRow[]; setRows: React.Dispatch<React.SetStateAction<LangRow[]>>; errors?: Record<number, string>; }) {
  const addRow = () => setRows(r => [...r, emptyLang()]);
  const del    = (id: number) => setRows(r => r.filter(x => x.id !== id));
  const upd    = (id: number, field: string, val: string | boolean) => setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Quick-pick chips */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", marginBottom: 8, letterSpacing: ".06em", textTransform: "uppercase" }}>
          Quick add
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {QUICK_LANGS.map(l => {
            const already = rows.some(r => r.language.toLowerCase() === l.toLowerCase());
            return (
              <button
                key={l} type="button"
                onClick={() => !already && setRows(r => [...r, { ...emptyLang(), language: l }])}
                style={{
                  padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                  cursor: already ? "default" : "pointer", border: "1.5px solid",
                  borderColor: already ? "rgba(16,185,129,.4)" : "rgba(123,47,190,.2)",
                  background: already ? "rgba(16,185,129,.08)" : "rgba(123,47,190,.04)",
                  color: already ? "#10B981" : "var(--violet)",
                  transition: "all .18s",
                  display: "flex", alignItems: "center", gap: 4,
                }}
                onMouseEnter={e => { if (!already) { e.currentTarget.style.borderColor = "var(--pink)"; e.currentTarget.style.color = "var(--pink)"; } }}
                onMouseLeave={e => { if (!already) { e.currentTarget.style.borderColor = "rgba(123,47,190,.2)"; e.currentTarget.style.color = "var(--violet)"; } }}
              >
                {already && <Check size={10} />}{l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 32px",
        gap: 10, paddingBottom: 6,
        borderBottom: "1px solid var(--border-soft)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".08em", display: "flex", alignItems: "center", gap: 5 }}>
          <Globe size={11} color="var(--violet)" /> Language
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".08em" }}>
          Level
        </div>
        <div />
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div key={row.id} style={{
          display: "flex", flexDirection: "column", gap: 4,
          animation: "chipIn .22s ease both",
          animationDelay: `${i * 40}ms`,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              placeholder="e.g. English"
              value={row.language}
              onChange={e => upd(row.id, "language", e.target.value)}
              style={{ ...inputStyle, borderColor: errors[row.id] ? "#EF4444" : "var(--border)" }}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = errors[row.id] ? "#EF4444" : "var(--border)"}
            />
            <select
              value={row.level}
              onChange={e => upd(row.id, "level", e.target.value)}
              style={{ ...inputStyle, cursor: "pointer", borderColor: errors[row.id] ? "#EF4444" : "var(--border)" }}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = errors[row.id] ? "#EF4444" : "var(--border)"}
            >
              <option value="">Select level…</option>
              {LANG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button
              type="button" onClick={() => del(row.id)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: "1px solid rgba(239,68,68,.2)",
                background: "rgba(239,68,68,.04)",
                color: "#EF4444", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .18s", flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,.04)"; }}
            >
              <Trash2 size={13} />
            </button>
          </div>
          {errors[row.id] && (
            <div style={{
              fontSize: 11, color: "#EF4444", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
              paddingLeft: 2, animation: "chipIn .18s ease both",
            }}>
              <span style={{ fontSize: 13 }}>⚠</span> {errors[row.id]}
            </div>
          )}
        </div>
      ))}

      {/* Add row button */}
      {(() => {
        const lastRow = rows[rows.length - 1];
        const canAdd = !lastRow || (lastRow.language.trim() !== "" && lastRow.level !== "");
        return (
          <button
            type="button" onClick={canAdd ? addRow : undefined}
            disabled={!canAdd}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "9px 0", borderRadius: 10,
              border: `1.5px dashed ${canAdd ? "rgba(123,47,190,.25)" : "rgba(123,47,190,.1)"}`,
              background: canAdd ? "rgba(123,47,190,.03)" : "rgba(123,47,190,.01)",
              color: canAdd ? "var(--violet)" : "var(--text-faint)",
              fontFamily: "var(--font)", fontSize: 13, fontWeight: 600,
              cursor: canAdd ? "pointer" : "not-allowed",
              transition: "all .18s", opacity: canAdd ? 1 : 0.5,
            }}
            onMouseEnter={e => { if (canAdd) { e.currentTarget.style.borderColor = "var(--pink)"; e.currentTarget.style.color = "var(--pink)"; e.currentTarget.style.background = "rgba(233,30,140,.04)"; } }}
            onMouseLeave={e => { if (canAdd) { e.currentTarget.style.borderColor = "rgba(123,47,190,.25)"; e.currentTarget.style.color = "var(--violet)"; e.currentTarget.style.background = "rgba(123,47,190,.03)"; } }}
          >
            <Plus size={14} /> Add another language
          </button>
        );
      })()}
    </div>
  );
}

// ─── Education form ───────────────────────────────────────────────────────────
function EducationForm({ rows, setRows, errors = {} }: { rows: EduRow[]; setRows: React.Dispatch<React.SetStateAction<EduRow[]>>; errors?: Record<number, string>; }) {
  const addRow = () => setRows(r => [...r, emptyEdu()]);
  const del    = (id: number) => setRows(r => r.filter(x => x.id !== id));
  const upd    = (id: number, field: string, val: string | boolean) => setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1.4fr 0.8fr 0.9fr 32px",
        gap: 8, paddingBottom: 6,
        borderBottom: "1px solid var(--border-soft)",
      }}>
        {["Degree / Program", "University / School", "Start", "End", ""].map((h, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".07em" }}>
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div key={row.id} style={{
          display: "flex", flexDirection: "column", gap: 4,
          animation: "chipIn .22s ease both",
          animationDelay: `${i * 50}ms`,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 0.8fr 0.9fr 32px", gap: 8, alignItems: "center" }}>
            <input
              type="text" placeholder="e.g. Master Data Science"
              value={row.degree}
              onChange={e => upd(row.id, "degree", e.target.value)}
              style={{ ...inputStyle, borderColor: errors[row.id] ? "#EF4444" : "var(--border)" }}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = errors[row.id] ? "#EF4444" : "var(--border)"}
            />
            <input
              type="text" placeholder="e.g. MIT, Harvard, Oxford"
              value={row.university}
              onChange={e => upd(row.id, "university", e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
            <input
              type="text" placeholder="2022"
              value={row.start}
              onChange={e => upd(row.id, "start", e.target.value)}
              style={{ ...inputStyle, textAlign: "center" }}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
            {/* End date OR Present toggle */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              {row.present ? (
                <PresentToggle checked={true} onChange={v => upd(row.id, "present", v)} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%" }}>
                  <input
                    type="text" placeholder="2025"
                    value={row.end}
                    onChange={e => upd(row.id, "end", e.target.value)}
                    style={{ ...inputStyle, textAlign: "center" }}
                    onFocus={e => e.target.style.borderColor = "var(--pink)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"}
                  />
                  <PresentToggle checked={false} onChange={v => { upd(row.id, "present", v); upd(row.id, "end", ""); }} />
                </div>
              )}
            </div>
            <button
              type="button" onClick={() => del(row.id)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: "1px solid rgba(239,68,68,.2)",
                background: "rgba(239,68,68,.04)",
                color: "#EF4444", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .18s", flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,.04)"; }}
            >
              <Trash2 size={13} />
            </button>
          </div>
          {errors[row.id] && (
            <div style={{
              fontSize: 11, color: "#EF4444", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4,
              paddingLeft: 2, animation: "chipIn .18s ease both",
            }}>
              <span style={{ fontSize: 13 }}>⚠</span> {errors[row.id]}
            </div>
          )}
        </div>
      ))}

      {/* Add row */}
      {(() => {
        const lastRow = rows[rows.length - 1];
        const canAdd = !lastRow || (lastRow.degree.trim() !== "" && lastRow.university.trim() !== "");
        return (
          <button
            type="button" onClick={canAdd ? addRow : undefined}
            disabled={!canAdd}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "9px 0", borderRadius: 10,
              border: `1.5px dashed ${canAdd ? "rgba(123,47,190,.25)" : "rgba(123,47,190,.1)"}`,
              background: canAdd ? "rgba(123,47,190,.03)" : "rgba(123,47,190,.01)",
              color: canAdd ? "var(--violet)" : "var(--text-faint)",
              fontFamily: "var(--font)", fontSize: 13, fontWeight: 600,
              cursor: canAdd ? "pointer" : "not-allowed",
              transition: "all .18s", opacity: canAdd ? 1 : 0.5,
            }}
            onMouseEnter={e => { if (canAdd) { e.currentTarget.style.borderColor = "var(--pink)"; e.currentTarget.style.color = "var(--pink)"; e.currentTarget.style.background = "rgba(233,30,140,.04)"; } }}
            onMouseLeave={e => { if (canAdd) { e.currentTarget.style.borderColor = "rgba(123,47,190,.25)"; e.currentTarget.style.color = "var(--violet)"; e.currentTarget.style.background = "rgba(123,47,190,.03)"; } }}
          >
            <Plus size={14} /> Add another education
          </button>
        );
      })()}
    </div>
  );
}

// ─── Experience form ──────────────────────────────────────────────────────────
function ExperienceForm({ rows, setRows, errors = {} }: { rows: ExpRow[]; setRows: React.Dispatch<React.SetStateAction<ExpRow[]>>; errors?: Record<number, string>; }) {
  const addRow = () => setRows(r => [...r, emptyExp()]);
  const del    = (id: number) => setRows(r => r.filter(x => x.id !== id));
  const upd    = (id: number, field: string, val: string | boolean) => setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {rows.map((row, i) => {
        const hasError = !!errors[row.id];

        // A row is "complete" when all required fields are filled
        const isComplete =
          row.title.trim() !== "" &&
          row.company.trim() !== "" &&
          row.start.trim() !== "" &&
          (row.present || row.end.trim() !== "");

        return (
          <div key={row.id} style={{
            display: "flex", flexDirection: "column", gap: 10,
            padding: "16px", borderRadius: 14,
            border: `1.5px solid ${hasError ? "#EF4444" : isComplete ? "rgba(16,185,129,.3)" : "var(--border)"}`,
            background: isComplete ? "rgba(16,185,129,.03)" : "var(--surface2)",
            animation: "chipIn .22s ease both",
            animationDelay: `${i * 60}ms`,
            transition: "border-color .2s, background .2s",
          }}>

            {/* Row header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                Experience #{i + 1}
                {isComplete && <span style={{ marginLeft: 8, color: "#10B981" }}>✓ Complete</span>}
              </div>
              <button
                type="button" onClick={() => del(row.id)}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: "1px solid rgba(239,68,68,.2)",
                  background: "rgba(239,68,68,.04)",
                  color: "#EF4444", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .18s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,.04)"; }}
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Row 1: Job title + Company */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".07em" }}>
                  Job Title *
                </label>
                <input
                  type="text" placeholder="e.g. Data Analyst"
                  value={row.title}
                  onChange={e => upd(row.id, "title", e.target.value)}
                  style={{ ...inputStyle, borderColor: hasError && !row.title.trim() ? "#EF4444" : "var(--border)" }}
                  onFocus={e => e.target.style.borderColor = "var(--pink)"}
                  onBlur={e => e.target.style.borderColor = hasError && !row.title.trim() ? "#EF4444" : "var(--border)"}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".07em" }}>
                  Company *
                </label>
                <input
                  type="text" placeholder="e.g. Google, Microsoft"
                  value={row.company}
                  onChange={e => upd(row.id, "company", e.target.value)}
                  style={{ ...inputStyle, borderColor: hasError && !row.company.trim() ? "#EF4444" : "var(--border)" }}
                  onFocus={e => e.target.style.borderColor = "var(--pink)"}
                  onBlur={e => e.target.style.borderColor = hasError && !row.company.trim() ? "#EF4444" : "var(--border)"}
                />
              </div>
            </div>

            {/* Row 2: Location + Start + End */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 0.9fr", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".07em" }}>
                  Location
                </label>
                <input
                  type="text" placeholder="e.g. Paris, France / Remote"
                  value={row.location}
                  onChange={e => upd(row.id, "location", e.target.value)}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "var(--pink)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".07em" }}>
                  Start *
                </label>
                <input
                  type="text" placeholder="e.g. 2022"
                  value={row.start}
                  onChange={e => upd(row.id, "start", e.target.value)}
                  style={{ ...inputStyle, textAlign: "center", borderColor: hasError && !row.start.trim() ? "#EF4444" : "var(--border)" }}
                  onFocus={e => e.target.style.borderColor = "var(--pink)"}
                  onBlur={e => e.target.style.borderColor = hasError && !row.start.trim() ? "#EF4444" : "var(--border)"}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".07em" }}>
                  End *
                </label>
                {row.present ? (
                  <PresentToggle checked={true} onChange={v => upd(row.id, "present", v)} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <input
                      type="text" placeholder="2025"
                      value={row.end}
                      onChange={e => upd(row.id, "end", e.target.value)}
                      style={{ ...inputStyle, textAlign: "center", borderColor: hasError && !row.end.trim() ? "#EF4444" : "var(--border)" }}
                      onFocus={e => e.target.style.borderColor = "var(--pink)"}
                      onBlur={e => e.target.style.borderColor = hasError && !row.end.trim() ? "#EF4444" : "var(--border)"}
                    />
                    <PresentToggle checked={false} onChange={v => { upd(row.id, "present", v); upd(row.id, "end", ""); }} />
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Description */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".07em" }}>
                Description
                <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 6, color: "var(--text-faint)", letterSpacing: 0 }}>
                  — key achievements & responsibilities
                </span>
              </label>
              <textarea
                placeholder="e.g. Built dashboards reducing reporting time by 40%. Automated data pipelines with Python & SQL."
                value={row.description}
                onChange={e => upd(row.id, "description", e.target.value)}
                rows={3}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: 72,
                  lineHeight: 1.55,
                }}
                onFocus={e => e.target.style.borderColor = "var(--pink)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
            </div>

            {errors[row.id] && (
              <div style={{
                fontSize: 11, color: "#EF4444", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 4,
                animation: "chipIn .18s ease both",
              }}>
                <span style={{ fontSize: 13 }}>⚠</span> {errors[row.id]}
              </div>
            )}
          </div>
        );
      })}

      {/* Add experience button */}
      {(() => {
        const lastRow = rows[rows.length - 1];
        const canAdd = !lastRow || (
          lastRow.title.trim() !== "" &&
          lastRow.company.trim() !== "" &&
          lastRow.start.trim() !== "" &&
          (lastRow.present || lastRow.end.trim() !== "")
        );
        return (
          <button
            type="button" onClick={canAdd ? addRow : undefined}
            disabled={!canAdd}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "9px 0", borderRadius: 10,
              border: `1.5px dashed ${canAdd ? "rgba(123,47,190,.25)" : "rgba(123,47,190,.1)"}`,
              background: canAdd ? "rgba(123,47,190,.03)" : "rgba(123,47,190,.01)",
              color: canAdd ? "var(--violet)" : "var(--text-faint)",
              fontFamily: "var(--font)", fontSize: 13, fontWeight: 600,
              cursor: canAdd ? "pointer" : "not-allowed",
              transition: "all .18s", opacity: canAdd ? 1 : 0.5,
            }}
            onMouseEnter={e => { if (canAdd) { e.currentTarget.style.borderColor = "var(--pink)"; e.currentTarget.style.color = "var(--pink)"; e.currentTarget.style.background = "rgba(233,30,140,.04)"; } }}
            onMouseLeave={e => { if (canAdd) { e.currentTarget.style.borderColor = "rgba(123,47,190,.25)"; e.currentTarget.style.color = "var(--violet)"; e.currentTarget.style.background = "rgba(123,47,190,.03)"; } }}
          >
            <Plus size={14} /> Add another experience
          </button>
        );
      })()}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function MissingSectionsModal({ missingSections, onSubmit, onSkip, onClose }: { missingSections: string[]; onSubmit: (data: { extraData: Record<string, any>; skippedSections: string[] }) => void; onSkip: (sections: string[]) => void; onClose: () => void; }) {
  const needsLanguages  = missingSections.includes("languages");
  const needsEducation  = missingSections.includes("education");
  const needsExperience = missingSections.includes("experience");

  const steps = [
    ...(needsLanguages  ? ["languages"]  : []),
    ...(needsEducation  ? ["education"]  : []),
    ...(needsExperience ? ["experience"] : []),
  ];

  const [stepIdx,          setStepIdx]          = useState(0);
  const [langRows,         setLangRows]         = useState([emptyLang()]);
  const [eduRows,          setEduRows]          = useState([emptyEdu()]);
  const [expRows,          setExpRows]          = useState([emptyExp()]);
  const [animDir,          setAnimDir]          = useState("in");
  const [errors,           setErrors]           = useState<Record<number, string>>({});
  const [skipWarning,      setSkipWarning]      = useState(false);
  // Tracks which section keys the user explicitly chose to skip
  const [skippedSections,  setSkippedSections]  = useState<string[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[stepIdx];
  const isLast      = stepIdx === steps.length - 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSkipWarning(true); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSkip]);

  // ── Check if current step is fully filled (for submit button) ─────────────
  const isCurrentStepReady = () => {
    if (currentStep === "languages") {
      const filled = langRows.filter(r => r.language.trim());
      return filled.length > 0 && filled.every(r => r.level !== "");
    }
    if (currentStep === "education") {
      const filled = eduRows.filter(r => r.degree.trim() || r.university.trim());
      return filled.length > 0 && filled.every(r => r.degree.trim() && r.university.trim());
    }
    if (currentStep === "experience") {
      const filled = expRows.filter(r => r.title.trim() || r.company.trim());
      return filled.length > 0 && filled.every(r =>
        r.title.trim() !== "" &&
        r.company.trim() !== "" &&
        r.start.trim() !== "" &&
        (r.present || r.end.trim() !== "")
      );
    }
    return false;
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs: Record<number, string> = {};

    if (currentStep === "languages") {
      langRows.forEach(row => {
        if (row.language.trim() && !row.level)
          errs[row.id] = "Level required";
        if (!row.language.trim() && row.level)
          errs[row.id] = "Language name required";
      });
    }

    if (currentStep === "education") {
      eduRows.forEach(row => {
        const hasAny = row.degree.trim() || row.university.trim() || row.start.trim() || row.end.trim();
        if (hasAny && !row.degree.trim())
          errs[row.id] = "Degree / Program required";
      });
    }

    if (currentStep === "experience") {
      expRows.forEach(row => {
        const hasAny = row.title.trim() || row.company.trim() || row.start.trim();
        if (hasAny) {
          if (!row.title.trim())   errs[row.id] = "Job title required";
          else if (!row.company.trim()) errs[row.id] = "Company required";
          else if (!row.start.trim())   errs[row.id] = "Start date required";
          else if (!row.present && !row.end.trim()) errs[row.id] = "End date required (or toggle Present)";
        }
      });
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Collect everything filled across ALL steps (not just current)
  const collectResult = () => {
    const result: { languages?: LangRow[]; education?: EduRow[]; experience?: ExpRow[] } = {};
    if (needsLanguages) {
      const filled = langRows.filter(r => r.language.trim() && r.level);
      if (filled.length > 0) result.languages = filled;
    }
    if (needsEducation) {
      const filled = eduRows.filter(r => r.degree.trim() || r.university.trim());
      if (filled.length > 0) result.education = filled;
    }
    if (needsExperience) {
      const filled = expRows
        .filter(r => r.title.trim() && r.company.trim())
        .map(r => ({ ...r, end: r.present ? "Present" : r.end }));
      if (filled.length > 0) result.experience = filled;
    }
    return result;
  };

  const advanceStep = () => {
    setAnimDir("out");
    setTimeout(() => {
      setStepIdx(s => s + 1);
      setErrors({});
      setSkipWarning(false);
      setAnimDir("in");
    }, 200);
  };

  const goNext = () => {
    if (!validate()) return;
    if (stepIdx < steps.length - 1) {
      advanceStep();
    } else {
      // User filled this last step — submit with whatever was skipped before
      onSubmit({ extraData: collectResult(), skippedSections });
    }
  };

  // 1st click → show warning. 2nd click → confirmed skip
  const handleSkip = () => {
    if (!skipWarning) { setSkipWarning(true); return; }
    setSkipWarning(false);
    // Record that the user skipped this section
    const nowSkipped = [...skippedSections, currentStep];
    setSkippedSections(nowSkipped);
    if (stepIdx < steps.length - 1) {
      advanceStep();
    } else {
      // Last step skipped — submit with filled data from previous steps
      // and the full list of skipped section keys
      onSubmit({ extraData: collectResult(), skippedSections: nowSkipped });
    }
  };

  const cancelSkip = () => setSkipWarning(false);

  type SectionCfg = { icon: React.ReactNode; iconBg: string; shadow: string; label: string; sub: string; desc: string; pts: string; };
  const config: Record<string, SectionCfg> = {
    languages: {
      icon:   <Globe size={22} color="#fff" />,
      iconBg: "linear-gradient(135deg,#7B2FBE,#E91E8C)",
      shadow: "rgba(123,47,190,.35)",
      label:  "Languages",
      sub:    "LANGUAGES section not found in your CV",
      desc:   "Add the languages you speak — recruiters and ATS systems check this systematically.",
      pts:    "+6 pts ATS",
    },
    education: {
      icon:   <GraduationCap size={22} color="#fff" />,
      iconBg: "linear-gradient(135deg,#7B2FBE,#E91E8C)",
      shadow: "rgba(123,47,190,.35)",
      label:  "Education",
      sub:    "EDUCATION section not found in your CV",
      desc:   "Add your degrees and programs — one of the most checked sections by ATS systems.",
      pts:    "+8 pts ATS",
    },
    experience: {
      icon:   <Briefcase size={22} color="#fff" />,
      iconBg: "linear-gradient(135deg,#E91E8C,#7B2FBE)",
      shadow: "rgba(233,30,140,.35)",
      label:  "Work Experience",
      sub:    "EXPERIENCE section not found in your CV",
      desc:   "Add your work experiences — the most important section for ATS scoring and recruiter review.",
      pts:    "+15 pts ATS",
    },
  };

  const cfg      = config[currentStep];
  const canBoost = isCurrentStepReady();

  // Width by step
  const modalWidth = currentStep === "experience" ? 860
    : currentStep === "education" ? 760 : 560;

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────── */}
      <div
        ref={overlayRef}
        onClick={e => { if (e.target === overlayRef.current) setSkipWarning(true); }}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(10,6,25,.55)",
          backdropFilter: "blur(16px) saturate(0.7)",
          WebkitBackdropFilter: "blur(16px) saturate(0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
          animation: "fadeUp .3s ease both",
        }}
      >
        {/* ── Modal card ───────────────────────────────────────── */}
        <div style={{
          width: "100%",
          maxWidth: modalWidth,
          maxHeight: "92vh",
          background: "var(--surface)",
          borderRadius: 24,
          boxShadow: "0 32px 80px rgba(0,0,0,.25), 0 0 0 1px rgba(123,47,190,.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: animDir === "in"
            ? "slideIn .28s cubic-bezier(0.34,1.56,0.64,1) both"
            : "slideOut .18s ease both",
          position: "relative",
        }}>

          {/* ── Header gradient bar ─────────────────────────── */}
          <div style={{
            background: cfg.iconBg,
            padding: "22px 28px 20px",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Pattern overlay */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "radial-gradient(circle at 80% 50%, rgba(255,255,255,.12) 0%, transparent 60%)",
            }} />

            {/* Close button */}
            <button
              type="button" onClick={onClose}
              style={{
                position: "absolute", top: 14, right: 16,
                width: 30, height: 30, borderRadius: "50%",
                border: "none", background: "rgba(255,255,255,.2)",
                color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background .18s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.35)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.2)"}
            >
              <X size={15} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
              {/* Icon */}
              <div style={{
                width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                background: "rgba(255,255,255,.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 4px 20px ${cfg.shadow}`,
              }}>
                {cfg.icon}
              </div>

              <div>
                {/* Warning badge */}
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 99, marginBottom: 6,
                  background: "rgba(255,255,255,.2)",
                  fontSize: 11, fontWeight: 700, color: "#fff",
                  letterSpacing: ".06em",
                }}>
                  <AlertTriangle size={11} />
                  MISSING SECTION
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
                  {cfg.label}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 3 }}>
                  {cfg.sub}
                </div>
              </div>

              {/* Points badge */}
              <div style={{
                marginLeft: "auto", flexShrink: 0,
                padding: "8px 14px", borderRadius: 12,
                background: "rgba(255,255,255,.2)",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                  {cfg.pts}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)", marginTop: 2 }}>
                  if filled
                </div>
              </div>
            </div>

            {/* Progress dots */}
            {steps.length > 1 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginTop: 16, position: "relative", zIndex: 1,
              }}>
                {steps.map((s, i) => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StepDot active={i === stepIdx} done={i < stepIdx} n={i + 1} />
                    <span style={{ fontSize: 11, color: i <= stepIdx ? "#fff" : "rgba(255,255,255,.5)", fontWeight: 600 }}>
                      {s === "languages" ? "Languages" : s === "education" ? "Education" : "Experience"}
                    </span>
                    {i < steps.length - 1 && (
                      <ChevronRight size={13} color="rgba(255,255,255,.4)" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Body ─────────────────────────────────────────── */}
          <div style={{ padding: "24px 28px 0", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <p style={{
              fontSize: 13, color: "var(--text-muted)",
              lineHeight: 1.65, margin: "0 0 20px",
            }}>
              {cfg.desc}
            </p>

            {currentStep === "languages" && (
              <LanguagesForm rows={langRows} setRows={r => { setLangRows(r); setErrors({}); }} errors={errors} />
            )}
            {currentStep === "education" && (
              <EducationForm rows={eduRows} setRows={r => { setEduRows(r); setErrors({}); }} errors={errors} />
            )}
            {currentStep === "experience" && (
              <ExperienceForm rows={expRows} setRows={r => { setExpRows(r); setErrors({}); }} errors={errors} />
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────── */}
          <div style={{
            padding: "16px 28px 20px",
            display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 12,
            flexShrink: 0,
            borderTop: "1px solid var(--border-soft)",
            background: "var(--surface)",
          }}>
            {/* Skip / Warning */}
            {skipWarning ? (
              <div style={{
                background: "rgba(239,68,68,.06)",
                border: "1.5px solid rgba(239,68,68,.25)",
                borderRadius: 12, padding: "12px 16px",
                display: "flex", flexDirection: "column", gap: 8,
                maxWidth: 300, animation: "fadeUp .2s ease both",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#EF4444", fontWeight: 700, fontSize: 12 }}>
                  <AlertTriangle size={13} />
                  Skipping will cost you {cfg.pts.replace("+", "")}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>
                  This section is missing from your CV. Without it, your ATS score stays lower and recruiters may skip your application.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <button type="button" onClick={handleSkip} style={{
                    padding: "7px 14px", borderRadius: 8,
                    border: "1.5px solid rgba(239,68,68,.4)",
                    background: "transparent", color: "#EF4444",
                    fontFamily: "var(--font)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>
                    Skip anyway
                  </button>
                  <button type="button" onClick={cancelSkip} style={{
                    padding: "7px 14px", borderRadius: 8,
                    border: "1.5px solid var(--border)",
                    background: "var(--surface-raised)", color: "var(--text)",
                    fontFamily: "var(--font)", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>
                    Fill it in
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button" onClick={handleSkip}
                style={{
                  padding: "10px 18px", borderRadius: 10,
                  border: "1.5px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-faint)", fontFamily: "var(--font)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all .18s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,.35)"; e.currentTarget.style.color = "#EF4444"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-faint)"; }}
              >
                Skip this section
              </button>
            )}

            {/* Submit / Next — only active when form is complete */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              {!canBoost && (
                <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 500 }}>
                  Fill all required fields (*) to continue
                </div>
              )}
              <button
                type="button"
                onClick={canBoost ? goNext : undefined}
                disabled={!canBoost}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "11px 28px", borderRadius: 12,
                  background: canBoost ? cfg.iconBg : "rgba(123,47,190,.15)",
                  border: "none", color: canBoost ? "#fff" : "var(--text-faint)",
                  fontFamily: "var(--font)", fontSize: 14,
                  fontWeight: 800,
                  cursor: canBoost ? "pointer" : "not-allowed",
                  boxShadow: canBoost ? `0 6px 24px ${cfg.shadow}` : "none",
                  transition: "all .2s",
                  opacity: canBoost ? 1 : 0.6,
                }}
                onMouseEnter={e => { if (canBoost) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 10px 32px ${cfg.shadow}`; } }}
                onMouseLeave={e => { if (canBoost) { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 6px 24px ${cfg.shadow}`; } }}
              >
                {isLast
                  ? <><Rocket size={14} /> Boost my CV</>
                  : <>Next <ChevronRight size={14} /></>}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: scale(.94) translateY(16px); }
          to   { opacity: 1; transform: scale(1)  translateY(0); }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: scale(1)   translateY(0); }
          to   { opacity: 0; transform: scale(.96) translateY(-8px); }
        }
        @keyframes chipIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}