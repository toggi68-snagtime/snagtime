// terminApi.js
// Datenzugriff für den Terminblocker. Trennt zwei Zugriffswege gemäss Schema/RLS:
//   - Organisator (eingeloggt): direkter Supabase-Zugriff, RLS schützt fremde Daten.
//   - Teilnehmer (kein Login):  ausschliesslich über die Edge Function.
import { supabase, FUNKTION_URL, ANON_KEY } from "./supabaseClient";

async function rufeFunktion(body) {
  const res = await fetch(FUNKTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify(body),
  });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  if (!res.ok || json.ok === false) throw new Error(json.fehler || `Funktionsfehler ${res.status}`);
  return json;
}

// ===========================================================================
// ORGANISATOR (eingeloggt – direkter Client, RLS greift)
// ===========================================================================

// Aus dem Wochenplan: Umfrage anlegen und die gewählten Slots speichern.
// slots: [{ start_utc, ende_utc }]  (genau das, was WochenplanAuswahl liefert)
export async function erstelleUmfrage({ titel, beschreibung, ort, domain = "deineapp.ch", slots }) {
  const { data: umfrage, error } = await supabase
    .from("umfragen")
    .insert({ titel, beschreibung, ort, domain })
    .select("id").single();
  if (error) throw error;

  if (slots?.length) {
    const rows = slots.map((s) => ({ umfrage_id: umfrage.id, start_utc: s.start_utc, ende_utc: s.ende_utc }));
    const { error: e2 } = await supabase.from("slots").insert(rows);
    if (e2) throw e2;
  }
  return umfrage.id;
}

// Für die Entscheid-Seite: Slots + Teilnehmer + Antworten laden und in die Form
// { poll, teilnehmer } bringen, die OrganisatorEntscheid erwartet.
export async function ladeErgebnisse(umfrageId) {
  const { data: umfrage, error } = await supabase
    .from("umfragen").select("id, titel, beschreibung, ort").eq("id", umfrageId).single();
  if (error) throw error;

  const { data: slots } = await supabase
    .from("slots").select("id, start_utc, ende_utc").eq("umfrage_id", umfrageId).order("start_utc");

  // Eingebettete Antworten über die FK-Beziehung antworten.teilnehmer_id -> teilnehmer.id
  const { data: tn } = await supabase
    .from("teilnehmer")
    .select("id, name, antworten(slot_id, verfuegbar)")
    .eq("umfrage_id", umfrageId);

  const teilnehmer = (tn ?? []).map((t) => ({
    name: t.name ?? "—",
    antworten: Object.fromEntries((t.antworten ?? []).map((a) => [a.slot_id, a.verfuegbar])),
  }));

  return { poll: { ...umfrage, slots: slots ?? [] }, teilnehmer };
}

// Entscheid: Gewinner fixieren, Verlierer canceln (Edge Function).
export async function entscheide(umfrageId, slotId) {
  return rufeFunktion({ aktion: "entscheiden", umfrage_id: umfrageId, slot_id: slotId });
}

// ===========================================================================
// TEILNEHMER (kein Login – nur über die Edge Function)
// ===========================================================================

// Öffentliche Sicht: nur unbedenkliche Felder + Slots (keine Teilnehmerdaten).
export async function ladeUmfrageOeffentlich(umfrageId) {
  const { umfrage } = await rufeFunktion({ aktion: "umfrage-laden", umfrage_id: umfrageId });
  return umfrage; // { id, titel, beschreibung, ort, slots: [...] }
}

// Verfügbarkeit absenden -> legt Teilnehmer + Antworten an und versendet die
// vorläufigen Blocker (TENTATIVE) für alle mit Ja/Evtl. markierten Slots.
// antworten: { slotId: 'ja'|'vielleicht'|'nein' }
export async function sendeVerfuegbarkeit({ umfrageId, name, email, antworten }) {
  const arr = Object.entries(antworten).map(([slot_id, verfuegbar]) => ({ slot_id, verfuegbar }));
  return rufeFunktion({
    aktion: "hold-teilnehmer",
    umfrage_id: umfrageId,
    person: { name, email },
    antworten: arr,
  });
}
