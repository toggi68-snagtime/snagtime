// Container.jsx
// Dünne Container, die die (reinen) Präsentations-Komponenten mit der Datenbank
// verbinden. Voraussetzung: die inneren Komponenten exportieren, d. h. in
// UmfrageUndEntscheid.jsx aus `function TeilnehmerUmfrage` / `function
// OrganisatorEntscheid` jeweils `export function ...` machen.
import { useState, useEffect } from "react";
import WochenplanAuswahl from "./WochenplanAuswahl";
import { TeilnehmerUmfrage, OrganisatorEntscheid } from "./UmfrageUndEntscheid";
import * as api from "./terminApi";

// 1) Organisator legt eine Umfrage an: Wochenplan -> Slots -> Umfrage in DB.
export function NeueUmfrage({ meta, onErstellt }) {
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState(null);
  return (
    <div>
      {fehler && <Hinweis text={"Fehler: " + fehler} ton="fehler" />}
      <WochenplanAuswahl
        onConfirm={async (slots) => {
          setBusy(true); setFehler(null);
          try {
            const id = await api.erstelleUmfrage({ ...meta, slots });
            onErstellt?.(id); // z. B. weiterleiten auf die Teilen-/Entscheid-Seite
          } catch (e) {
            setFehler(e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && <Hinweis text="Umfrage wird angelegt…" />}
    </div>
  );
}

// 2) Teilnehmer-Seite (öffentlicher Link, umfrageId aus der URL).
export function UmfrageSeite({ umfrageId }) {
  const [poll, setPoll] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    let aktiv = true;
    api.ladeUmfrageOeffentlich(umfrageId)
      .then((p) => aktiv && setPoll(p))
      .catch((e) => aktiv && setFehler(e.message));
    return () => { aktiv = false; };
  }, [umfrageId]);

  if (fehler) return <Hinweis text={"Umfrage konnte nicht geladen werden: " + fehler} ton="fehler" />;
  if (!poll) return <Hinweis text="Lädt…" />;

  return (
    <TeilnehmerUmfrage
      poll={poll}
      onSubmit={async ({ name, email, antworten }) => {
        await api.sendeVerfuegbarkeit({ umfrageId, name, email, antworten });
      }}
    />
  );
}

// 3) Entscheid-Seite (Organisator, eingeloggt).
export function EntscheidSeite({ umfrageId }) {
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState(null);

  useEffect(() => {
    let aktiv = true;
    api.ladeErgebnisse(umfrageId)
      .then((d) => aktiv && setDaten(d))
      .catch((e) => aktiv && setFehler(e.message));
    return () => { aktiv = false; };
  }, [umfrageId]);

  if (fehler) return <Hinweis text={"Fehler: " + fehler} ton="fehler" />;
  if (!daten) return <Hinweis text="Lädt…" />;

  return (
    <OrganisatorEntscheid
      poll={daten.poll}
      teilnehmer={daten.teilnehmer}
      onEntscheid={async ({ slot_id }) => {
        await api.entscheide(umfrageId, slot_id);
      }}
    />
  );
}

function Hinweis({ text, ton }) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", padding: 18, fontSize: 14,
      color: ton === "fehler" ? "#a32d2d" : "#6f6d64" }}>{text}</div>
  );
}
