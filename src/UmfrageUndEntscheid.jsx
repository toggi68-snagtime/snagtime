import { useState, useMemo } from "react";
import { Check, X, Minus, Users, Send, Sparkles, CalendarCheck, ShieldCheck, ChevronRight, CalendarPlus } from "lucide-react";

// ---------------------------------------------------------------------------
// Umfrage-Seite (Teilnehmer)  +  Entscheid-Seite (Organisator)
// Teilen sich das Design der WochenplanAuswahl-Komponente.
//   - TeilnehmerUmfrage:  externe Person stimmt ab  -> teilnehmer + antworten
//   - OrganisatorEntscheid: Gewinner festlegen -> löst entscheiden() aus
//     (Cancel der Verlierer + Confirm des Gewinners über die holds-Tabelle)
// ---------------------------------------------------------------------------

const T = {
  ink: "#1c1b18", sub: "#6f6d64", line: "#e6e4db", surface: "#ffffff",
  canvas: "#faf9f4", accent: "#0d8c7f", accentDark: "#0a6b61", tint: "#e6f4f2",
  amber: "#c98a1e", amberTint: "#fbf1dd", nein: "#9a988f", neinTint: "#f0eee7",
};
const DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const p2 = (n) => String(n).padStart(2, "0");

function fmtSlot(startIso, endIso) {
  const s = new Date(startIso), e = new Date(endIso);
  return {
    tag: DAYS[s.getDay()],
    datum: `${p2(s.getDate())}.${p2(s.getMonth() + 1)}`,
    zeit: `${p2(s.getHours())}:${p2(s.getMinutes())}–${p2(e.getHours())}:${p2(e.getMinutes())}`,
  };
}

// --- Beispieldaten (käme aus der DB) ---------------------------------------
const POLL = {
  id: "kickoff-2026",
  titel: "Projekt-Kickoff zb Rollmaterial",
  beschreibung: "Abstimmung der Beteiligten aus drei Firmen. Dauer 60 Min.",
  ort: "Online / Teams",
  organisator: "Jay (zb)",
  slots: [
    { id: "s1", start_utc: "2026-06-02T06:00:00.000Z", ende_utc: "2026-06-02T07:00:00.000Z" },
    { id: "s2", start_utc: "2026-06-03T11:00:00.000Z", ende_utc: "2026-06-03T12:00:00.000Z" },
    { id: "s3", start_utc: "2026-06-04T05:30:00.000Z", ende_utc: "2026-06-04T06:30:00.000Z" },
    { id: "s4", start_utc: "2026-06-05T13:00:00.000Z", ende_utc: "2026-06-05T14:00:00.000Z" },
  ],
};
const SAMPLE_TN = [
  { name: "M. Müller", antworten: { s1: "nein", s2: "ja", s3: "ja", s4: "vielleicht" } },
  { name: "S. Keller", antworten: { s1: "vielleicht", s2: "ja", s3: "nein", s4: "ja" } },
  { name: "R. Brun", antworten: { s1: "nein", s2: "ja", s3: "vielleicht", s4: "nein" } },
];

// --- Client-seitiger ICS-Generator (kompakt, RFC-5545-konform) -------------
const _enc = new TextEncoder();
const _esc = (v) => String(v).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const _utc = (iso) => { const d = new Date(iso); return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + "T" + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + "Z"; };
function _fold(line) {
  const max = 75, out = []; let buf = "", b = 0;
  for (const ch of line) { const n = _enc.encode(ch).length, lim = out.length === 0 ? max : max - 1; if (b + n > lim) { out.push(buf); buf = ch; b = n; } else { buf += ch; b += n; } }
  out.push(buf); return out.join("\r\n ");
}
function blockerICS(poll, person, slots) {
  const stamp = _utc(new Date().toISOString());
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Terminblocker//DE", "CALSCALE:GREGORIAN", "METHOD:REQUEST"];
  for (const s of slots) L.push(
    "BEGIN:VEVENT",
    `UID:hold-${poll.id}-${s.id}@terminblocker.ch`, "SEQUENCE:0", "DTSTAMP:" + stamp,
    "DTSTART:" + _utc(s.start_utc), "DTEND:" + _utc(s.ende_utc), "STATUS:TENTATIVE", "TRANSP:OPAQUE",
    "SUMMARY:" + _esc("[Vorläufig] " + poll.titel),
    "DESCRIPTION:" + _esc("Bitte vorläufig freihalten. Finaler Termin folgt nach der Abstimmung."),
    "LOCATION:" + _esc(poll.ort || ""),
    "ORGANIZER;CN=" + (poll.organisator || "Organisator") + ":mailto:termine@terminblocker.ch",
    `ATTENDEE;PARTSTAT=TENTATIVE;RSVP=FALSE;CN=${person.name}:mailto:${person.email}`,
    "END:VEVENT");
  L.push("END:VCALENDAR");
  return L.map(_fold).join("\r\n") + "\r\n";
}
function download(filename, text) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

// ===========================================================================
// UMFRAGE-SEITE (Teilnehmer)
// ===========================================================================
export function TeilnehmerUmfrage({ poll, onSubmit }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ds, setDs] = useState(false);
  const [antworten, setAntworten] = useState({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState(null);

  const optionen = [
    { v: "ja", label: "Ja", farbe: T.accent, tint: T.tint, dark: T.accentDark },
    { v: "vielleicht", label: "Evtl.", farbe: T.amber, tint: T.amberTint, dark: T.amber },
    { v: "nein", label: "Nein", farbe: T.nein, tint: T.neinTint, dark: T.sub },
  ];
  const gueltig = name.trim() && /\S+@\S+\.\S+/.test(email) && ds;

  if (done) {
    const verfuegbar = poll.slots.filter((s) => antworten[s.id] === "ja" || antworten[s.id] === "vielleicht");
    return (
      <Karte>
        <div style={{ textAlign: "center", padding: "18px 10px 6px" }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, background: T.tint, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Check size={26} color={T.accentDark} strokeWidth={3} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Danke, {name.split(" ")[0] || "dir"}!</div>
          <div style={{ color: T.sub, marginTop: 6, fontSize: 14 }}>Deine Verfügbarkeit ist gespeichert.</div>
        </div>

        {verfuegbar.length > 0 ? (
          <div style={{ marginTop: 8, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, background: T.canvas }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: T.accentDark, marginBottom: 10 }}>
              <CalendarPlus size={16} /> Vorläufige Blocker für deine freien Zeiten
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {verfuegbar.map((s) => {
                const f = fmtSlot(s.start_utc, s.ende_utc);
                return <span key={s.id} style={{ background: T.surface, border: `1.5px dashed ${T.accent}`, color: T.accentDark, borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600 }}>{f.tag} {f.datum} · {f.zeit}</span>;
              })}
            </div>
            <button onClick={() => download("terminblocker.ics", blockerICS(poll, { name: name || "Teilnehmer", email: email || "teilnehmer@example.ch" }, verfuegbar))}
              style={{ ...cta, background: T.accent }}>
              <CalendarPlus size={16} /> Zum Kalender hinzufügen
            </button>
            <div style={{ fontSize: 12, color: T.sub, textAlign: "center", marginTop: 9, lineHeight: 1.5 }}>
              Erscheinen als „vorläufig". Sobald der finale Termin feststeht, werden die übrigen automatisch entfernt.
            </div>
          </div>
        ) : (
          <div style={{ color: T.sub, fontSize: 14, textAlign: "center", padding: "4px 0 16px" }}>Keine Zeiten als verfügbar markiert – daher kein Blocker.</div>
        )}
      </Karte>
    );
  }

  return (
    <Karte>
      <Kopf vorzeile="Terminabstimmung" titel={poll.titel} />
      <div style={{ color: T.sub, fontSize: 14, marginBottom: 16 }}>{poll.beschreibung} · {poll.ort}</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={inputStil} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" style={inputStil} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {poll.slots.map((s) => {
          const f = fmtSlot(s.start_utc, s.ende_utc);
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, padding: "10px 14px", border: `1px solid ${T.line}`, borderRadius: 11, background: T.surface, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontWeight: 700 }}>{f.tag} {f.datum}</span>
                <span style={{ color: T.sub, marginLeft: 8 }}>{f.zeit}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {optionen.map((o) => {
                  const aktiv = antworten[s.id] === o.v;
                  return (
                    <button key={o.v} onClick={() => setAntworten((p) => ({ ...p, [s.id]: o.v }))}
                      style={{ padding: "7px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${aktiv ? o.dark : T.line}`, background: aktiv ? o.farbe : T.surface,
                        color: aktiv ? "#fff" : T.sub, transition: "all .12s ease" }}>{o.label}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 18, fontSize: 13, color: T.sub, cursor: "pointer" }}>
        <input type="checkbox" checked={ds} onChange={(e) => setDs(e.target.checked)} style={{ width: 16, height: 16, accentColor: T.accent }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <ShieldCheck size={15} color={T.accent} /> Ich habe die <span style={{ color: T.accentDark, textDecoration: "underline" }}>Datenschutzerklärung</span> gelesen (revDSG).
        </span>
      </label>

      <button disabled={!gueltig || busy}
        onClick={async () => {
          setFehler(null); setBusy(true);
          try {
            await onSubmit?.({ name, email, antworten });
            setDone(true);
          } catch (e) {
            setFehler(e?.message || "Senden fehlgeschlagen. Bitte erneut versuchen.");
          } finally {
            setBusy(false);
          }
        }}
        style={{ ...cta, marginTop: 16, background: (gueltig && !busy) ? T.ink : "#cfcdc4", cursor: (gueltig && !busy) ? "pointer" : "not-allowed" }}>
        <Send size={16} /> {busy ? "Wird gesendet…" : "Verfügbarkeit absenden"}
      </button>

      {fehler && (
        <div style={{ marginTop: 10, fontSize: 13, color: "#a32d2d", background: "#fcebeb", border: "1px solid #f0a0a0", borderRadius: 9, padding: "9px 12px" }}>
          {fehler}
        </div>
      )}
    </Karte>
  );
}

// ===========================================================================
// ENTSCHEID-SEITE (Organisator)
// ===========================================================================
export function OrganisatorEntscheid({ poll, teilnehmer, onEntscheid }) {
  const stats = useMemo(() => poll.slots.map((s) => {
    let ja = 0, vl = 0, nein = 0;
    teilnehmer.forEach((t) => {
      const a = t.antworten[s.id];
      if (a === "ja") ja++; else if (a === "vielleicht") vl++; else if (a === "nein") nein++;
    });
    return { id: s.id, ja, vl, nein, score: ja * 2 + vl };
  }), [poll, teilnehmer]);

  const bestId = useMemo(() => stats.reduce((b, x) => (x.score > (b?.score ?? -1) ? x : b), null)?.id, [stats]);
  const [gewaehlt, setGewaehlt] = useState(bestId);
  const [fix, setFix] = useState(null);

  const ikon = (a) => a === "ja" ? <Check size={16} color={T.accentDark} strokeWidth={3} />
    : a === "vielleicht" ? <Minus size={16} color={T.amber} strokeWidth={3} />
    : a === "nein" ? <X size={15} color={T.nein} strokeWidth={2.5} /> : <span style={{ color: "#cfcdc4" }}>·</span>;
  const zellBg = (a) => a === "ja" ? T.tint : a === "vielleicht" ? T.amberTint : a === "nein" ? T.neinTint : T.surface;

  const cols = `minmax(150px,1.2fr) repeat(${teilnehmer.length}, 56px) 78px`;

  if (fix) {
    const f = fmtSlot(poll.slots.find((s) => s.id === fix).start_utc, poll.slots.find((s) => s.id === fix).ende_utc);
    return (
      <Karte>
        <div style={{ textAlign: "center", padding: "20px 10px 10px" }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, background: T.tint, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <CalendarCheck size={26} color={T.accentDark} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Termin festgelegt</div>
          <div style={{ fontSize: 15, color: T.accentDark, fontWeight: 600, marginTop: 4 }}>{f.tag} {f.datum} · {f.zeit}</div>
        </div>
        <div style={{ background: "#1c1b18", color: "#d8f3ee", padding: 14, borderRadius: 10, fontSize: 13, lineHeight: 1.7, marginTop: 8 }}>
          <div>→ Gewinner-Slot: <b>CONFIRMED</b> (gleiche UID, SEQUENCE+1)</div>
          <div>→ {poll.slots.length - 1} Verlierer-Slots: <b>CANCEL</b> versendet</div>
          <div>→ Antworten der Verlierer gelöscht (Datensparsamkeit)</div>
        </div>
        <pre style={{ marginTop: 12, background: T.neinTint, color: T.ink, padding: 12, borderRadius: 10, fontSize: 12, overflowX: "auto" }}>
{JSON.stringify({ aktion: "entscheiden", umfrage_id: poll.id, slot_id: fix }, null, 2)}
        </pre>
        <button onClick={() => setFix(null)} style={{ ...cta, marginTop: 12, background: T.surface, color: T.sub, border: `1px solid ${T.line}` }}>Zurück</button>
      </Karte>
    );
  }

  return (
    <Karte>
      <Kopf vorzeile="Auswertung & Entscheid" titel={poll.titel} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.sub, fontSize: 14, marginBottom: 16 }}>
        <Users size={15} /> {teilnehmer.length} Teilnehmer haben abgestimmt
      </div>

      <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, minWidth: 420 }}>
          <div style={{ ...headZelle, borderLeft: "none" }} />
          {teilnehmer.map((t, i) => (
            <div key={i} title={t.name} style={{ ...headZelle, textAlign: "center", fontWeight: 700 }}>
              {t.name.split(" ").map((w) => w[0]).join("")}
            </div>
          ))}
          <div style={{ ...headZelle, textAlign: "center", fontWeight: 700 }}>Resultat</div>

          {poll.slots.map((s) => {
            const f = fmtSlot(s.start_utc, s.ende_utc);
            const st = stats.find((x) => x.id === s.id);
            const sel = gewaehlt === s.id;
            const best = bestId === s.id;
            return (
              <Slotzeile key={s.id} onClick={() => setGewaehlt(s.id)} sel={sel}>
                <div style={{ ...zelle, justifyContent: "space-between", paddingLeft: 14, background: sel ? T.tint : T.surface }}>
                  <span><b>{f.tag} {f.datum}</b> <span style={{ color: T.sub }}>{f.zeit}</span></span>
                  {best && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: T.accentDark, background: T.tint, padding: "2px 7px", borderRadius: 999, marginRight: 6 }}><Sparkles size={11} /> Top</span>}
                </div>
                {teilnehmer.map((t, i) => (
                  <div key={i} style={{ ...zelle, justifyContent: "center", background: sel ? "#eef8f6" : zellBg(t.antworten[s.id]) }}>{ikon(t.antworten[s.id])}</div>
                ))}
                <div style={{ ...zelle, justifyContent: "center", background: sel ? T.tint : T.surface, fontWeight: 700, fontSize: 13 }}>
                  <span style={{ color: T.accentDark }}>{st.ja}</span>
                  <span style={{ color: T.sub, fontWeight: 500 }}>&nbsp;/&nbsp;{st.vl}</span>
                </div>
              </Slotzeile>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: T.sub, flexWrap: "wrap" }}>
        <Lg ik={<Check size={13} color={T.accentDark} strokeWidth={3} />} t="Ja" />
        <Lg ik={<Minus size={13} color={T.amber} strokeWidth={3} />} t="Evtl." />
        <Lg ik={<X size={12} color={T.nein} strokeWidth={2.5} />} t="Nein" />
        <span style={{ marginLeft: "auto" }}>Resultat = Ja / Evtl.</span>
      </div>

      <button onClick={() => { onEntscheid?.({ aktion: "entscheiden", umfrage_id: poll.id, slot_id: gewaehlt }); setFix(gewaehlt); }}
        style={{ ...cta, marginTop: 18, background: T.ink }}>
        <CalendarCheck size={16} /> Termin festlegen & versenden
      </button>
    </Karte>
  );
}

// ===========================================================================
// DEMO-WRAPPER mit Umschalter (geteilter Teilnehmer-State)
// ===========================================================================
export default function Demo() {
  const [tab, setTab] = useState("umfrage");
  const [teilnehmer, setTeilnehmer] = useState(SAMPLE_TN);

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", background: T.canvas, padding: 18, borderRadius: 18, maxWidth: 720 }}>
      <div style={{ display: "flex", gap: 6, background: "#efece4", padding: 4, borderRadius: 12, marginBottom: 16 }}>
        {[["umfrage", "Umfrage (Teilnehmer)"], ["entscheid", `Entscheid (Organisator)`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: tab === k ? T.surface : "transparent", color: tab === k ? T.ink : T.sub,
              boxShadow: tab === k ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
            {l} {k === "entscheid" && <span style={{ background: T.tint, color: T.accentDark, borderRadius: 999, padding: "1px 7px", fontSize: 11 }}>{teilnehmer.length}</span>}
          </button>
        ))}
      </div>

      {tab === "umfrage"
        ? <TeilnehmerUmfrage poll={POLL} onSubmit={({ name, antworten }) => { setTeilnehmer((p) => [...p, { name: name || "Neu", antworten }]); }} />
        : <OrganisatorEntscheid poll={POLL} teilnehmer={teilnehmer} onEntscheid={() => {}} />}

      {tab === "umfrage" && (
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 12.5, color: T.sub, display: "inline-flex", gap: 5, alignItems: "center", width: "100%", justifyContent: "center" }}>
          Stimme abgeben, dann oben zu „Entscheid" wechseln <ChevronRight size={13} />
        </div>
      )}
    </div>
  );
}

// --- kleine UI-Bausteine ----------------------------------------------------
function Karte({ children }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>{children}</div>;
}
function Kopf({ vorzeile, titel }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: T.sub, fontWeight: 600 }}>{vorzeile}</div>
      <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.01em", color: T.ink }}>{titel}</div>
    </div>
  );
}
function Slotzeile({ children, onClick, sel }) {
  return <div onClick={onClick} style={{ display: "contents" }}>
    <div style={{ display: "contents", cursor: "pointer" }}>{children}</div>
  </div>;
}
function Lg({ ik, t }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{ik}{t}</span>;
}
const inputStil = { flex: 1, minWidth: 160, padding: "10px 13px", border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 14, outline: "none", color: T.ink, background: T.surface };
const cta = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", borderRadius: 11, border: "none", color: "#fff", fontSize: 14, fontWeight: 600 };
const headZelle = { padding: "10px 6px", fontSize: 12, color: T.sub, borderBottom: `1px solid ${T.line}`, borderLeft: `1px solid ${T.line}`, background: T.canvas };
const zelle = { display: "flex", alignItems: "center", height: 46, borderBottom: `1px solid ${T.line}`, borderLeft: `1px solid ${T.line}`, fontSize: 13.5 };
