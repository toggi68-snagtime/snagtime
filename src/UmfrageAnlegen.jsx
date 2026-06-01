// UmfrageAnlegen.jsx
// Schritt 1: Metadaten (Titel, Beschreibung, Ort).  Schritt 2: Slots im
// Wochenplan wählen -> Umfrage + Slots in der DB anlegen -> Teilen-Ansicht.
import { useState } from "react";
import WochenplanAuswahl from "./WochenplanAuswahl";
import * as api from "./terminApi";
import { Check, Copy, Share2, ArrowLeft } from "lucide-react";

const T = { ink: "#1c1b18", sub: "#6f6d64", line: "#e6e4db", surface: "#fff", canvas: "#faf9f4", accent: "#0d8c7f", accentDark: "#0a6b61", tint: "#e6f4f2" };

export default function UmfrageAnlegen() {
  const [schritt, setSchritt] = useState(1);
  const [meta, setMeta] = useState({ titel: "", beschreibung: "", ort: "", domain: "deineapp.ch" });
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState(null);
  const [erstellt, setErstellt] = useState(null); // { id }

  const titelOk = meta.titel.trim().length > 1;

  if (erstellt) return <TeilenAnsicht umfrageId={erstellt} titel={meta.titel} />;

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", maxWidth: 860, margin: "0 auto", padding: 18 }}>
      <Schritte aktiv={schritt} />

      {schritt === 1 && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 22, marginTop: 16 }}>
          <div style={{ fontSize: 21, fontWeight: 600, marginBottom: 4 }}>Worum geht es?</div>
          <div style={{ color: T.sub, fontSize: 14, marginBottom: 18 }}>Diese Angaben sehen die Teilnehmer in der Einladung.</div>

          <Feld label="Titel *">
            <input value={meta.titel} onChange={(e) => setMeta({ ...meta, titel: e.target.value })}
              placeholder="z. B. Projekt-Kickoff zb Rollmaterial" style={inp} />
          </Feld>
          <Feld label="Beschreibung">
            <textarea value={meta.beschreibung} onChange={(e) => setMeta({ ...meta, beschreibung: e.target.value })}
              placeholder="Kurzer Hinweis für die Teilnehmer" rows={2} style={{ ...inp, resize: "vertical" }} />
          </Feld>
          <Feld label="Ort / Link">
            <input value={meta.ort} onChange={(e) => setMeta({ ...meta, ort: e.target.value })}
              placeholder="Online / Teams · oder Raum / Adresse" style={inp} />
          </Feld>

          <button disabled={!titelOk} onClick={() => setSchritt(2)}
            style={{ ...cta, marginTop: 8, background: titelOk ? T.ink : "#cfcdc4", cursor: titelOk ? "pointer" : "not-allowed" }}>
            Weiter zur Terminauswahl
          </button>
        </div>
      )}

      {schritt === 2 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setSchritt(1)} style={{ ...zurueck }}>
            <ArrowLeft size={15} /> Zurück zu den Angaben
          </button>
          {fehler && <div style={{ margin: "10px 0", fontSize: 13, color: "#a32d2d", background: "#fcebeb", border: "1px solid #f0a0a0", borderRadius: 9, padding: "9px 12px" }}>{fehler}</div>}
          <WochenplanAuswahl
            onConfirm={async (slots) => {
              if (!slots?.length) return;
              setBusy(true); setFehler(null);
              try {
                const id = await api.erstelleUmfrage({ ...meta, slots });
                setErstellt(id);
              } catch (e) { setFehler(e.message); }
              finally { setBusy(false); }
            }}
          />
          {busy && <div style={{ marginTop: 12, color: T.sub, fontSize: 14 }}>Umfrage wird angelegt…</div>}
        </div>
      )}
    </div>
  );
}

function TeilenAnsicht({ umfrageId, titel }) {
  const link = `${window.location.origin}/u/${umfrageId}`;
  const [kopiert, setKopiert] = useState(false);
  const kopieren = async () => {
    try { await navigator.clipboard.writeText(link); setKopiert(true); setTimeout(() => setKopiert(false), 1800); } catch {}
  };
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", maxWidth: 560, margin: "0 auto", padding: 18 }}>
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: T.tint, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Check size={26} color={T.accentDark} strokeWidth={3} />
        </div>
        <div style={{ fontSize: 21, fontWeight: 600 }}>Umfrage steht!</div>
        <div style={{ color: T.sub, fontSize: 14, margin: "6px 0 20px" }}>Teile diesen Link mit den Teilnehmern – auch firmenübergreifend, ganz ohne Login.</div>

        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input readOnly value={link} onFocus={(e) => e.target.select()} style={{ ...inp, marginBottom: 0, flex: 1, fontSize: 13, color: T.sub }} />
          <button onClick={kopieren} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRadius: 10, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {kopiert ? <Check size={16} /> : <Copy size={16} />} {kopiert ? "Kopiert" : "Kopieren"}
          </button>
        </div>

        {navigator.share && (
          <button onClick={() => navigator.share({ title: titel, url: link })}
            style={{ ...cta, marginTop: 12, background: T.ink }}>
            <Share2 size={16} /> Teilen
          </button>
        )}
        <a href={`/app/entscheid/${umfrageId}`} style={{ display: "inline-block", marginTop: 16, fontSize: 14, color: T.accentDark, fontWeight: 600, textDecoration: "none" }}>
          Zur Auswertung & Entscheidung →
        </a>
      </div>
    </div>
  );
}

function Schritte({ aktiv }) {
  const items = [[1, "Angaben"], [2, "Termine wählen"], [3, "Teilen"]];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {items.map(([n, l], i) => (
        <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600,
            color: aktiv >= n ? T.ink : "#bbb" }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, background: aktiv >= n ? T.accent : "#eceae2", color: aktiv >= n ? "#fff" : "#9a988f" }}>{n}</span>
            {l}
          </span>
          {i < items.length - 1 && <span style={{ width: 24, height: 1, background: T.line }} />}
        </span>
      ))}
    </div>
  );
}

function Feld({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.sub, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
const inp = { width: "100%", boxSizing: "border-box", padding: "10px 13px", border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 14, outline: "none", color: T.ink, marginBottom: 0 };
const cta = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", borderRadius: 11, border: "none", color: "#fff", fontSize: 14, fontWeight: 600 };
const zurueck = { display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.sub, fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: 0 };
