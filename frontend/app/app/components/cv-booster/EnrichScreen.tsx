"use client";

import { useState } from "react";
import React from "react";
import {
  Save, ArrowLeft, Brain, FlaskConical, Award,
  CheckCircle2, BookOpen, Globe, GraduationCap, Briefcase,
  AlertTriangle, Plus, Trash2, Check, Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lab  { id: string; title: string; date: string; score: number; }
interface Cert { id: string; title: string; org: string; date: string; }
interface Quiz { domain: string; score: number; level: string; description: string; }
interface Selections { quiz: boolean; labs: string[]; certs: string[]; }

// ─── Language / Education / Experience row types ──────────────────────────────
interface LangRow { id: number; language: string; level: string; }
interface EduRow  { id: number; degree: string; university: string; start: string; end: string; present: boolean; }
interface ExpRow  { id: number; title: string; company: string; location: string; description: string; start: string; end: string; present: boolean; }

// ─── Empty defaults — real data always comes from /platform-data API ─────────
// No hardcoded demo data: if the API returns nothing, show nothing.
export const PLATFORM_LABS:  Lab[]  = [];
export const PLATFORM_CERTS: Cert[] = [];
export const PLATFORM_QUIZ: Quiz    = { domain: "", score: 0, level: "", description: "" };
export const DEFAULT_SELECTIONS: Selections = { quiz: false, labs: [], certs: [] };

// ─── Shared styles ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 20, padding: "20px 22px", boxShadow: "var(--shadow-sm)",
};
const itemRow: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border-soft)",
};
const iconBox = (color: string, bg: string): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
  background: bg, display: "flex", alignItems: "center", justifyContent: "center", color,
});
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1.5px solid var(--border)", background: "var(--surface2)",
  fontFamily: "var(--font)", fontSize: 13, color: "var(--text)",
  outline: "none", transition: "border-color .18s", boxSizing: "border-box",
};

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} aria-pressed={checked}
      style={{
        position: "relative", flexShrink: 0, width: 46, height: 26, borderRadius: 99,
        border: "none", cursor: "pointer",
        background: checked ? "linear-gradient(135deg,#E91E8C,#7B2FBE)" : "rgba(123,47,190,.15)",
        boxShadow: checked ? "0 2px 12px rgba(233,30,140,.35)" : "none",
        transition: "background .25s, box-shadow .25s", outline: "none",
      }}>
      <span style={{
        position: "absolute", top: 3, left: 3, width: 20, height: 20, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.2)",
        transform: checked ? "translateX(20px)" : "translateX(0)",
        transition: "transform .25s cubic-bezier(0.34,1.56,0.64,1)", display: "block",
      }} />
    </button>
  );
}

// ─── Present toggle ───────────────────────────────────────────────────────────
function PresentToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={{
      display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 99,
      border: `1.5px solid ${checked ? "rgba(16,185,129,.4)" : "rgba(123,47,190,.2)"}`,
      background: checked ? "rgba(16,185,129,.1)" : "rgba(123,47,190,.04)",
      color: checked ? "#10B981" : "var(--text-faint)",
      fontFamily: "var(--font)", fontSize: 11, fontWeight: 700,
      cursor: "pointer", transition: "all .18s", whiteSpace: "nowrap",
    }}>
      {checked && <Check size={10} />} Present
    </button>
  );
}

// ─── Languages mini-form ──────────────────────────────────────────────────────
const LANG_LEVELS = ["Native (C2+)", "Fluent (C2)", "Advanced (C1)", "Upper-Intermediate (B2)", "Intermediate (B1)", "Elementary (A2)", "Beginner (A1)"];
const QUICK_LANGS = ["Arabic", "French", "English", "Spanish", "German", "Italian", "Chinese"];

function LanguagesForm({ rows, setRows }: { rows: LangRow[]; setRows: React.Dispatch<React.SetStateAction<LangRow[]>>; }) {
  const add = () => setRows(r => [...r, { id: Date.now(), language: "", level: "" }]);
  const del = (id: number) => setRows(r => r.filter(x => x.id !== id));
  const upd = (id: number, field: string, val: string) => setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
        {QUICK_LANGS.map(l => {
          const already = rows.some(r => r.language.toLowerCase() === l.toLowerCase());
          return (
            <button key={l} type="button"
              onClick={() => !already && setRows(r => [...r, { id: Date.now(), language: l, level: "" }])}
              style={{
                padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                cursor: already ? "default" : "pointer", border: "1.5px solid",
                borderColor: already ? "rgba(16,185,129,.4)" : "rgba(123,47,190,.2)",
                background: already ? "rgba(16,185,129,.08)" : "rgba(123,47,190,.04)",
                color: already ? "#10B981" : "var(--violet)",
                display: "flex", alignItems: "center", gap: 4,
              }}>
              {already && <Check size={10} />}{l}
            </button>
          );
        })}
      </div>
      {rows.map(row => (
        <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 10, alignItems: "center" }}>
          <input type="text" placeholder="e.g. English" value={row.language}
            onChange={e => upd(row.id, "language", e.target.value)} style={inputStyle}
            onFocus={e => e.target.style.borderColor = "var(--pink)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"} />
          <select value={row.level} onChange={e => upd(row.id, "level", e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
            onFocus={e => e.target.style.borderColor = "var(--pink)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}>
            <option value="">Select level…</option>
            {LANG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button type="button" onClick={() => del(row.id)} style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(239,68,68,.2)",
            background: "rgba(239,68,68,.04)", color: "#EF4444", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><Trash2 size={13} /></button>
        </div>
      ))}
      <button type="button" onClick={add} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: "9px 0", borderRadius: 10, border: "1.5px dashed rgba(123,47,190,.25)",
        background: "rgba(123,47,190,.03)", color: "var(--violet)",
        fontFamily: "var(--font)", fontSize: 13, fontWeight: 600, cursor: "pointer",
      }}>
        <Plus size={14} /> Add language
      </button>
    </div>
  );
}

// ─── Education mini-form ──────────────────────────────────────────────────────
function EducationForm({ rows, setRows }: { rows: EduRow[]; setRows: React.Dispatch<React.SetStateAction<EduRow[]>>; }) {
  const add = () => setRows(r => [...r, { id: Date.now(), degree: "", university: "", start: "", end: "", present: false }]);
  const del = (id: number) => setRows(r => r.filter(x => x.id !== id));
  const upd = (id: number, field: string, val: string | boolean) => setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.map(row => (
        <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px", borderRadius: 12, background: "rgba(123,47,190,.03)", border: "1px solid var(--border-soft)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input type="text" placeholder="Degree / Program" value={row.degree}
              onChange={e => upd(row.id, "degree", e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
            <input type="text" placeholder="University / School" value={row.university}
              onChange={e => upd(row.id, "university", e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 10, alignItems: "center" }}>
            <input type="text" placeholder="Start year" value={row.start}
              onChange={e => upd(row.id, "start", e.target.value)} style={{ ...inputStyle, textAlign: "center" }}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
            {row.present
              ? <PresentToggle checked onChange={v => upd(row.id, "present", v)} />
              : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <input type="text" placeholder="End year" value={row.end}
                    onChange={e => upd(row.id, "end", e.target.value)} style={{ ...inputStyle, textAlign: "center" }}
                    onFocus={e => e.target.style.borderColor = "var(--pink)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"} />
                  <PresentToggle checked={false} onChange={v => { upd(row.id, "present", v); upd(row.id, "end", ""); }} />
                </div>}
            <button type="button" onClick={() => del(row.id)} style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(239,68,68,.2)",
              background: "rgba(239,68,68,.04)", color: "#EF4444", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: "9px 0", borderRadius: 10, border: "1.5px dashed rgba(123,47,190,.25)",
        background: "rgba(123,47,190,.03)", color: "var(--violet)",
        fontFamily: "var(--font)", fontSize: 13, fontWeight: 600, cursor: "pointer",
      }}>
        <Plus size={14} /> Add education
      </button>
    </div>
  );
}

// ─── Experience mini-form ──────────────────────────────────────────────────────
function ExperienceForm({ rows, setRows }: { rows: ExpRow[]; setRows: React.Dispatch<React.SetStateAction<ExpRow[]>>; }) {
  const add = () => setRows(r => [...r, { id: Date.now(), title: "", company: "", location: "", description: "", start: "", end: "", present: false }]);
  const del = (id: number) => setRows(r => r.filter(x => x.id !== id));
  const upd = (id: number, field: string, val: string | boolean) => setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.map(row => (
        <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px", borderRadius: 12, background: "rgba(233,30,140,.03)", border: "1px solid var(--border-soft)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <input type="text" placeholder="Job title" value={row.title}
              onChange={e => upd(row.id, "title", e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
            <input type="text" placeholder="Company" value={row.company}
              onChange={e => upd(row.id, "company", e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
            <input type="text" placeholder="Location" value={row.location}
              onChange={e => upd(row.id, "location", e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 32px", gap: 10, alignItems: "center" }}>
            <input type="text" placeholder="Start (e.g. Jan 2023)" value={row.start}
              onChange={e => upd(row.id, "start", e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = "var(--pink)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"} />
            {row.present
              ? <PresentToggle checked onChange={v => upd(row.id, "present", v)} />
              : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <input type="text" placeholder="End (e.g. Dec 2024)" value={row.end}
                    onChange={e => upd(row.id, "end", e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "var(--pink)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"} />
                  <PresentToggle checked={false} onChange={v => { upd(row.id, "present", v); upd(row.id, "end", ""); }} />
                </div>}
            <button type="button" onClick={() => del(row.id)} style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(239,68,68,.2)",
              background: "rgba(239,68,68,.04)", color: "#EF4444", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Trash2 size={13} /></button>
          </div>
          <textarea placeholder="Describe your responsibilities and achievements…" value={row.description}
            onChange={e => upd(row.id, "description", e.target.value)}
            style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
            onFocus={e => e.target.style.borderColor = "var(--pink)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"} />
        </div>
      ))}
      <button type="button" onClick={add} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: "9px 0", borderRadius: 10, border: "1.5px dashed rgba(233,30,140,.25)",
        background: "rgba(233,30,140,.03)", color: "var(--pink)",
        fontFamily: "var(--font)", fontSize: 13, fontWeight: 600, cursor: "pointer",
      }}>
        <Plus size={14} /> Add experience
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENRICH SCREEN
// ─────────────────────────────────────────────────────────────────────────────
interface EnrichScreenProps {
  fileName: string;
  selections: Selections;
  setSelections: React.Dispatch<React.SetStateAction<Selections>>;
  onSave: (extraData: Record<string, unknown>) => void;
  onBack: () => void;
  missingSections?: string[];
  platformLabs?:    Lab[];
  platformCerts?:   Cert[];
  platformQuiz?:    Quiz;
  platformStatus?:  string;
}

export default function EnrichScreen({
  fileName, selections, setSelections, onSave, onBack,
  missingSections = [],
  platformLabs   = PLATFORM_LABS,
  platformCerts  = PLATFORM_CERTS,
  platformQuiz   = PLATFORM_QUIZ,
  platformStatus = "ok",
}: EnrichScreenProps) {

  // ── Missing section local state ────────────────────────────────────────────
  const [langRows,   setLangRows]   = useState<LangRow[]>([{ id: Date.now(), language: "", level: "" }]);
  const [eduRows,    setEduRows]    = useState<EduRow[]>([{ id: Date.now(), degree: "", university: "", start: "", end: "", present: false }]);
  const [expRows,    setExpRows]    = useState<ExpRow[]>([{ id: Date.now(), title: "", company: "", location: "", description: "", start: "", end: "", present: false }]);

  const toggleItem = (key: "labs" | "certs", id: string) =>
    setSelections(prev => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter(x => x !== id) : [...prev[key], id],
    }));

  // ── Error status screens ────────────────────────────────────────────────────
  const errorStatuses: Record<string, { emoji: string; title: string; msg: string }> = {
    invalid_user: { emoji: "🚫", title: "User not found", msg: "This user ID doesn't exist in the SUBUL platform.\nPlease make sure you're logged in correctly." },
    db_error:     { emoji: "⚠️", title: "Platform connection issue", msg: "Could not connect to the SUBUL platform database.\nYour CV will still be saved — without platform data." },
    no_user_id:   { emoji: "🔐", title: "Not logged in", msg: "Access this tool from your SUBUL dashboard to automatically load your labs and certifications." },
    no_data:      { emoji: "🎯", title: "No platform data yet", msg: "You haven't completed any labs or certifications on SUBUL yet." },
  };

  // Only hard-block for truly unrecoverable states (invalid user, not logged in)
  // For db_error and no_data: fall through to the full form so user can still
  // fill missing sections and save — just without platform data shown
  const hardBlockStatuses = ["invalid_user", "no_user_id"];
  if (hardBlockStatuses.includes(platformStatus)) {
    const { emoji, title, msg } = errorStatuses[platformStatus];
    return (
      <div style={{ minHeight: "calc(100vh - 57px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "44px 24px" }}>
        <div style={{ ...card, textAlign: "center", maxWidth: 500, padding: "40px 48px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{emoji}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, marginBottom: 24, whiteSpace: "pre-line" }}>{msg}</div>
          <button type="button" onClick={onBack}
            style={{ padding: "12px 28px", borderRadius: 12, background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)", fontFamily: "var(--font)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  // For db_error / no_data: show a soft warning banner at the top but still render the full form
  const showNoPlatformBanner = ["db_error", "no_data"].includes(platformStatus);

  // ── Build extra data for save ────────────────────────────────────────────────
  const handleSave = () => {
    const extraData: Record<string, unknown> = {};
    if (missingSections.includes("languages"))
      extraData.languages = langRows.filter(r => r.language.trim());
    if (missingSections.includes("education"))
      extraData.education = eduRows.filter(r => r.degree.trim() || r.university.trim());
    if (missingSections.includes("experience"))
      extraData.experience = expRows.filter(r => r.title.trim() || r.company.trim());
    onSave(extraData);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 57px)", display: "flex", flexDirection: "column", alignItems: "center", padding: "44px 24px 72px", animation: "fadeUp .35s ease both" }}>
      <div style={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 99, border: "1.5px solid rgba(233,30,140,.35)", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--pink)", marginBottom: 12 }}>
            Step 02 — Enrich & Save
          </div>
          <h2 style={{ fontSize: "clamp(24px,4vw,38px)", fontWeight: 900, letterSpacing: "-.03em", margin: "0 0 8px", color: "var(--text)", lineHeight: 1.1 }}>
            Enrich your profile
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
            Select your SUBUL achievements to include, complete any missing info, then save to search for jobs.
          </p>
        </div>

        {/* ── No platform data banner ─────────────────────────────────────────── */}
        {showNoPlatformBanner && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 18px", borderRadius: 14, background: "rgba(245,158,11,.07)", border: "1.5px solid rgba(245,158,11,.25)" }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{platformStatus === "db_error" ? "⚠️" : "🎯"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#B45309", marginBottom: 2 }}>
                {platformStatus === "db_error" ? "Platform connection issue" : "No platform data yet"}
              </div>
              <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.55 }}>
                {platformStatus === "db_error"
                  ? "Could not load your SUBUL labs and certifications. You can still fill in any missing CV sections below and save."
                  : "You haven't completed any labs or certifications yet. Fill in any missing sections below and save your profile."}
              </div>
            </div>
          </div>
        )}

        {/* ── Quiz card ─────────────────────────────────────────────────────── */}
        {platformQuiz?.domain && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={iconBox("#7B2FBE", "rgba(123,47,190,.12)")}><Brain size={18} /></div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Initial Positioning Quiz</div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>Taken when you registered on the SUBUL platform</div>
                </div>
              </div>
              <Toggle checked={selections.quiz} onChange={v => setSelections(p => ({ ...p, quiz: v }))} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pink)", marginBottom: 12 }}>
              Domain: <strong>{platformQuiz.domain}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, background: "var(--grad)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", flexShrink: 0 }}>{platformQuiz.score}%</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Level: <strong>{platformQuiz.level}</strong></div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>{platformQuiz.description}</div>
              </div>
            </div>
            <div style={{ marginTop: 14, height: 6, borderRadius: 99, background: "rgba(123,47,190,.1)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 99, width: `${platformQuiz.score}%`, background: "linear-gradient(90deg,#E91E8C,#7B2FBE)", transition: "width .8s ease" }} />
            </div>
          </div>
        )}

        {/* ── Labs + Certs grid ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="enr-panels-grid">

          {/* Labs → Projects */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-soft)" }}>
              <FlaskConical size={15} color="var(--violet)" /> Completed Labs
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)", fontWeight: 500 }}>Added as Projects</span>
            </div>
            {platformLabs.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-faint)", padding: "12px 0", textAlign: "center" }}>No labs completed yet</div>
            )}
            {platformLabs.map((lab, idx) => (
              <div key={lab.id} style={{ ...itemRow, ...(idx === platformLabs.length - 1 ? { borderBottom: "none", paddingBottom: 0 } : {}) }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={iconBox("#7B2FBE", "rgba(123,47,190,.08)")}><BookOpen size={14} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{lab.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      Completed · {lab.date}
                      <span style={{ padding: "1px 7px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.25)", color: "#059669" }}>Score {lab.score}/100</span>
                    </div>
                  </div>
                </div>
                <Toggle checked={selections.labs.includes(lab.id)} onChange={() => toggleItem("labs", lab.id)} />
              </div>
            ))}
          </div>

          {/* Certifications — merged: original CV certs (always shown, not toggleable) + platform certs (toggleable) */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-soft)" }}>
              <Award size={15} color="var(--violet)" /> Certifications
            </div>

            {/* Platform certifications (toggleable) */}
            {platformCerts.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-faint)", padding: "12px 0", textAlign: "center" }}>No platform certifications yet</div>
            )}
            {platformCerts.map((cert, idx) => (
              <div key={cert.id} style={{ ...itemRow, ...(idx === platformCerts.length - 1 ? { borderBottom: "none", paddingBottom: 0 } : {}) }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={iconBox("#E91E8C", "rgba(233,30,140,.08)")}><CheckCircle2 size={14} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {cert.title}
                      <span style={{ padding: "1px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)", color: "#059669" }}>SUBUL Validated</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{cert.org} · {cert.date}</div>
                  </div>
                </div>
                <Toggle checked={selections.certs.includes(cert.id)} onChange={() => toggleItem("certs", cert.id)} />
              </div>
            ))}

            {/* Note: certs already in the CV are always kept */}
            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(16,185,129,.05)", border: "1px solid rgba(16,185,129,.15)", fontSize: 11, color: "#059669", fontWeight: 500 }}>
              ✓ Certifications already in your CV are always included
            </div>
          </div>
        </div>

        {/* ── Missing sections — only shown when detected as missing ────────── */}
        {missingSections.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, background: "rgba(245,158,11,.07)", border: "1.5px solid rgba(245,158,11,.25)" }}>
              <AlertTriangle size={14} color="#F59E0B" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#B45309" }}>
                {missingSections.length} section{missingSections.length > 1 ? "s" : ""} missing from your CV — fill them in below (optional)
              </span>
            </div>

            {missingSections.includes("languages") && (
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                  <div style={iconBox("var(--violet)", "rgba(123,47,190,.08)")}><Globe size={14} /></div>
                  Languages
                </div>
                <LanguagesForm rows={langRows} setRows={setLangRows} />
              </div>
            )}

            {missingSections.includes("education") && (
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                  <div style={iconBox("var(--pink)", "rgba(233,30,140,.08)")}><GraduationCap size={14} /></div>
                  Education
                </div>
                <EducationForm rows={eduRows} setRows={setEduRows} />
              </div>
            )}

            {missingSections.includes("experience") && (
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
                  <div style={iconBox("#7B2FBE", "rgba(123,47,190,.08)")}><Briefcase size={14} /></div>
                  Work Experience
                </div>
                <ExperienceForm rows={expRows} setRows={setExpRows} />
              </div>
            )}
          </div>
        )}

        {/* ── Save CTA ──────────────────────────────────────────────────────── */}
        <div style={{ background: "var(--surface)", border: "1.5px solid rgba(233,30,140,.2)", borderRadius: 20, padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, boxShadow: "0 4px 24px rgba(233,30,140,.08)", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
              Ready to save your profile?
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {selections.labs.length + selections.certs.length} platform element{selections.labs.length + selections.certs.length !== 1 ? "s" : ""} selected
              {selections.quiz ? " · quiz included" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={onBack}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, background: "transparent", border: "1px solid var(--border)", color: "var(--text-faint)", fontFamily: "var(--font)", fontSize: 12, cursor: "pointer" }}>
              <ArrowLeft size={11} /> Go Back
            </button>
            <button type="button" onClick={handleSave}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "15px 36px", borderRadius: 14, background: "var(--grad)", border: "none", color: "#fff", fontFamily: "var(--font)", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 28px rgba(233,30,140,.38)", transition: "all .2s", whiteSpace: "nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 36px rgba(233,30,140,.55)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 6px 28px rgba(233,30,140,.38)"; e.currentTarget.style.transform = "none"; }}>
              <Save size={15} /> Save &amp; Search Job
              <Search size={13} style={{ opacity: 0.8 }} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}