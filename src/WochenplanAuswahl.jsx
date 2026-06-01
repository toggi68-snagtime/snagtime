import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Check, Wand2, RotateCcw, CalendarCheck } from "lucide-react";

// ---------------------------------------------------------------------------
// WochenplanAuswahl
// Wochenraster, in dem freie Blöcke (aus dem Kalender des Organisators) bereits
// vorgeschlagen sind. Der Organisator wählt einzeln per Klick oder übernimmt
// alle Vorschläge auf einmal. Ergebnis: Slots mit start_utc / ende_utc für die
// slots-Tabelle.
//
// In der echten App kommen `belegt` und `vorgeschlagen` aus einem Free/Busy-
// Abruf (Microsoft Graph / Google Calendar). Hier deterministisch simuliert.
// ---------------------------------------------------------------------------

const T = {
  ink: "#1c1b18", sub: "#6f6d64", line: "#e6e4db", surface: "#ffffff",
  canvas: "#faf9f4", accent: "#0d8c7f", accentDark: "#0a6b61",
  tint: "#e6f4f2", busy: "#efece4",
};
const WORK_START = 8, WORK_END = 18;
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function montagDieserWoche(d) {
  const x = new Date(d);
  const wd = (x.getDay() + 6) % 7; // Mo=0
  x.setDate(x.getDate() - wd);
  x.setHours(0, 0, 0, 0);
  return x;
}
const addTage = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const ddMM = (d) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;

// Simulierte Belegung + Vorschläge je Woche (deterministisch über Wochen-Offset).
function wochenDaten(weekStart) {
  const wk = Math.floor(weekStart.getTime() / 6048e5);
  const r = wk % 3;
  const basis = [
    [[8, 9], [13, 14.5]],          // Mo
    [[10, 12], [15, 16]],          // Di
    [[9, 10], [14, 15]],           // Mi
    [[11, 12], [16, 18]],          // Do
    [[8, 9], [r ? 13 : 14, 15]],   // Fr (variiert)
    [[10, 11]],                    // Sa
    [],                            // So
  ];
  const belegt = {};
  basis.forEach((bl, day) => { belegt[day] = bl.map(([s, e]) => [s * 60, e * 60]); });
  // Vorschläge: „gute“ freie Stunden, sofern nicht belegt
  const guteStunden = [9, 10, 14, 15];
  const vorschlag = new Set();
  for (let day = 0; day < 5; day++) {
    for (const h of guteStunden) {
      const s = h * 60, e = s + 60;
      const frei = !belegt[day].some(([bs, be]) => s < be && e > bs);
      if (frei) vorschlag.add(`${day}_${s}`);
    }
  }
  return { belegt, vorschlag };
}

export default function WochenplanAuswahl({ onConfirm }) {
  const [weekStart, setWeekStart] = useState(montagDieserWoche(new Date()));
  const [dauer, setDauer] = useState(60);
  const [wochenende, setWochenende] = useState(false);
  const [selektiert, setSelektiert] = useState(() => new Set());
  const [uebernommen, setUebernommen] = useState(null);

  const { belegt, vorschlag } = useMemo(() => wochenDaten(weekStart), [weekStart]);
  const tageAnz = wochenende ? 7 : 5;
  const reihen = useMemo(() => {
    const out = [];
    for (let m = WORK_START * 60; m < WORK_END * 60; m += dauer) out.push(m);
    return out;
  }, [dauer]);

  const istBelegt = (day, start) =>
    (belegt[day] || []).some(([bs, be]) => start < be && start + dauer > bs);

  const key = (day, start) => `${day}_${start}`;
  const toggle = (day, start) => {
    if (istBelegt(day, start)) return;
    setUebernommen(null);
    setSelektiert((prev) => {
      const n = new Set(prev);
      const k = key(day, start);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  const vorschlaegeUebernehmen = () => {
    setUebernommen(null);
    setSelektiert((prev) => {
      const n = new Set(prev);
      // Vorschläge nur sinnvoll bei 60-min-Raster
      vorschlag.forEach((v) => n.add(v));
      return n;
    });
  };

  const slots = useMemo(() => {
    const arr = [];
    selektiert.forEach((k) => {
      const [day, start] = k.split("_").map(Number);
      const d = addTage(weekStart, day);
      const s = new Date(d); s.setHours(0, start / 60 | 0, start % 60, 0, 0);
      const e = new Date(s.getTime() + dauer * 6e4);
      arr.push({ day, start, datum: new Date(s), start_utc: s.toISOString(), ende_utc: e.toISOString() });
    });
    return arr.sort((a, b) => a.datum - b.datum);
  }, [selektiert, weekStart, dauer]);

  const minLabel = (m) => `${String(m / 60 | 0).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const gridCols = `52px repeat(${tageAnz}, 1fr)`;

  const zelleStil = (day, start) => {
    const belegtZ = istBelegt(day, start);
    const sel = selektiert.has(key(day, start));
    const vor = dauer === 60 && vorschlag.has(key(day, start)) && !belegtZ;
    if (belegtZ) return {
      background: `repeating-linear-gradient(45deg, ${T.busy}, ${T.busy} 6px, #e7e4db 6px, #e7e4db 12px)`,
      cursor: "not-allowed", border: `1px solid ${T.line}`,
    };
    if (sel) return { background: T.accent, border: `1px solid ${T.accentDark}`, cursor: "pointer" };
    if (vor) return { background: T.tint, border: `1.5px dashed ${T.accent}`, cursor: "pointer" };
    return { background: T.surface, border: `1px solid ${T.line}`, cursor: "pointer" };
  };

  const wochenLabel = `${ddMM(weekStart)} – ${ddMM(addTage(weekStart, tageAnz - 1))}.${addTage(weekStart, tageAnz - 1).getFullYear()}`;

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", color: T.ink, background: T.canvas, padding: 20, borderRadius: 16, maxWidth: 860 }}>
      <style>{`
        .wp-cell{transition:transform .08s ease, filter .12s ease;}
        .wp-cell:hover{filter:brightness(.97);}
        .wp-cell.clk:hover{transform:scale(1.04);}
        .wp-btn{transition:background .12s ease,border-color .12s ease;}
      `}</style>

      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: T.sub, fontWeight: 600 }}>Terminvorschläge</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.01em" }}>Wochenplan – freie Blöcke wählen</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="wp-btn" onClick={() => setWeekStart(addTage(weekStart, -7))} style={navStil}><ChevronLeft size={16} /></button>
          <div style={{ fontSize: 13, fontWeight: 600, minWidth: 130, textAlign: "center", color: T.ink }}>{wochenLabel}</div>
          <button className="wp-btn" onClick={() => setWeekStart(addTage(weekStart, 7))} style={navStil}><ChevronRight size={16} /></button>
          <button className="wp-btn" onClick={() => setWeekStart(montagDieserWoche(new Date()))} style={{ ...navStil, width: "auto", padding: "0 12px", fontSize: 13, fontWeight: 600 }}>Heute</button>
        </div>
      </div>

      {/* Werkzeugleiste */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, overflow: "hidden" }}>
          {[30, 60, 90].map((d) => (
            <button key={d} className="wp-btn" onClick={() => { setDauer(d); setSelektiert(new Set()); setUebernommen(null); }}
              style={{ padding: "7px 12px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                background: dauer === d ? T.ink : "transparent", color: dauer === d ? "#fff" : T.sub }}>{d} min</button>
          ))}
        </div>
        <button className="wp-btn" onClick={() => setWochenende((v) => !v)}
          style={{ ...pillStil, background: wochenende ? T.ink : T.surface, color: wochenende ? "#fff" : T.sub }}>
          Wochenende
        </button>
        <div style={{ flex: 1 }} />
        <button className="wp-btn" onClick={vorschlaegeUebernehmen} disabled={dauer !== 60}
          style={{ ...pillStil, display: "flex", alignItems: "center", gap: 6, background: dauer === 60 ? T.accent : "#cfd4d2",
            color: "#fff", border: "none", cursor: dauer === 60 ? "pointer" : "not-allowed", fontWeight: 600 }}>
          <Wand2 size={15} /> Vorschläge übernehmen
        </button>
        <button className="wp-btn" onClick={() => { setSelektiert(new Set()); setUebernommen(null); }}
          style={{ ...pillStil, display: "flex", alignItems: "center", gap: 6 }}>
          <RotateCcw size={14} /> Zurücksetzen
        </button>
      </div>

      {/* Raster */}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 4 }}>
          <div />
          {Array.from({ length: tageAnz }).map((_, i) => {
            const d = addTage(weekStart, i);
            const heute = d.toDateString() === new Date().toDateString();
            return (
              <div key={i} style={{ textAlign: "center", paddingBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: heute ? T.accent : T.ink }}>{DAYS[i]}</div>
                <div style={{ fontSize: 11, color: heute ? T.accent : T.sub }}>{ddMM(d)}</div>
              </div>
            );
          })}

          {reihen.map((m) => (
            <Reihe key={m} m={m} minLabel={minLabel} tageAnz={tageAnz}
              zelleStil={zelleStil} toggle={toggle} istBelegt={istBelegt} selektiert={selektiert} keyFn={key} dauer={dauer} />
          ))}
        </div>
      </div>

      {/* Legende */}
      <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", fontSize: 12, color: T.sub }}>
        <Leg farbe={T.tint} rand={`1.5px dashed ${T.accent}`} text="Vorgeschlagen" />
        <Leg farbe={T.accent} rand={`1px solid ${T.accentDark}`} text="Ausgewählt" />
        <Leg farbe={T.surface} rand={`1px solid ${T.line}`} text="Frei" />
        <Leg hatch text="Belegt" />
      </div>

      {/* Auswahl-Zusammenfassung */}
      <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {slots.length === 0 ? "Noch keine Termine gewählt" : `${slots.length} Termin${slots.length === 1 ? "" : "e"} gewählt`}
        </div>
        <button className="wp-btn" disabled={slots.length === 0}
          onClick={() => { const payload = slots.map(({ start_utc, ende_utc }) => ({ start_utc, ende_utc })); setUebernommen(payload); onConfirm?.(payload); }}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: "none",
            fontSize: 14, fontWeight: 600, color: "#fff", cursor: slots.length ? "pointer" : "not-allowed",
            background: slots.length ? T.ink : "#cfcdc4" }}>
          <CalendarCheck size={16} /> Als Umfrage-Slots übernehmen
        </button>
      </div>

      {slots.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {slots.map((s) => (
            <span key={`${s.day}_${s.start}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.tint,
              color: T.accentDark, border: `1px solid ${T.accent}`, borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600 }}>
              {DAYS[s.day]} {ddMM(s.datum)} · {minLabel(s.start)}–{minLabel(s.start + dauer)}
              <button onClick={() => toggle(s.day, s.start)} style={{ border: "none", background: "transparent", cursor: "pointer", color: T.accentDark, lineHeight: 1, fontSize: 15 }}>×</button>
            </span>
          ))}
        </div>
      )}

      {uebernommen && (
        <pre style={{ marginTop: 14, background: "#1c1b18", color: "#d8f3ee", padding: 14, borderRadius: 10, fontSize: 12, overflowX: "auto" }}>
{JSON.stringify(uebernommen, null, 2)}
        </pre>
      )}
    </div>
  );
}

function Reihe({ m, minLabel, tageAnz, zelleStil, toggle, istBelegt, selektiert, keyFn, dauer }) {
  return (
    <>
      <div style={{ fontSize: 11, color: "#9a988f", textAlign: "right", paddingRight: 6, alignSelf: "center" }}>{minLabel(m)}</div>
      {Array.from({ length: tageAnz }).map((_, day) => {
        const belegtZ = istBelegt(day, m);
        const sel = selektiert.has(keyFn(day, m));
        return (
          <div key={day} className={`wp-cell ${belegtZ ? "" : "clk"}`} onClick={() => toggle(day, m)}
            style={{ height: dauer === 30 ? 26 : dauer === 90 ? 58 : 40, borderRadius: 7, display: "flex",
              alignItems: "center", justifyContent: "center", ...zelleStil(day, m) }}>
            {sel && <Check size={16} color="#fff" strokeWidth={3} />}
          </div>
        );
      })}
    </>
  );
}

function Leg({ farbe, rand, hatch, text }) {
  const bg = hatch ? "repeating-linear-gradient(45deg, #efece4, #efece4 4px, #e7e4db 4px, #e7e4db 8px)" : farbe;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 16, height: 16, borderRadius: 5, background: bg, border: rand || "1px solid #e6e4db", display: "inline-block" }} />
      {text}
    </span>
  );
}

const navStil = { width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: 9, border: "1px solid #e6e4db", background: "#fff", cursor: "pointer", color: "#1c1b18" };
const pillStil = { padding: "8px 13px", borderRadius: 999, border: "1px solid #e6e4db", background: "#fff",
  color: "#6f6d64", fontSize: 13, fontWeight: 600, cursor: "pointer" };
