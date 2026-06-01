// auth.jsx
// Schlanker Auth-Kontext für den Organisator (Magic Link). Teilnehmer brauchen
// KEINEN Login – deren Seite ist öffentlich. Nur Organisator-Routen sind geschützt.
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLaedt(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const wert = {
    session,
    laedt,
    user: session?.user ?? null,
    async loginMitMail(email) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + "/app" },
      });
      if (error) throw error;
    },
    async logout() { await supabase.auth.signOut(); },
  };
  return <AuthCtx.Provider value={wert}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

// Schützt Organisator-Routen. Ohne Session -> Login-Formular.
export function GeschuetzteRoute({ children }) {
  const { session, laedt } = useAuth();
  if (laedt) return <Zentriert text="Lädt…" />;
  if (!session) return <Login />;
  return children;
}

export function Login() {
  const { loginMitMail } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | senden | gesendet | fehler
  const [fehler, setFehler] = useState(null);
  const gueltig = /\S+@\S+\.\S+/.test(email);

  if (status === "gesendet") return (
    <Zentriert>
      <div style={{ ...karte, textAlign: "center" }}>
        <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Mail unterwegs</div>
        <div style={{ color: "#6f6d64", fontSize: 14 }}>Wir haben dir einen Anmeldelink an <b>{email}</b> geschickt. Öffne ihn auf diesem Gerät.</div>
      </div>
    </Zentriert>
  );

  return (
    <Zentriert>
      <div style={karte}>
        <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "#6f6d64", fontWeight: 600 }}>Organisator-Login</div>
        <div style={{ fontSize: 21, fontWeight: 600, marginBottom: 16 }}>Anmelden</div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="deine@firma.ch" type="email"
          style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", border: "1px solid #e6e4db", borderRadius: 10, fontSize: 14, marginBottom: 12 }} />
        <button disabled={!gueltig || status === "senden"}
          onClick={async () => {
            setStatus("senden"); setFehler(null);
            try { await loginMitMail(email); setStatus("gesendet"); }
            catch (e) { setFehler(e.message); setStatus("fehler"); }
          }}
          style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", color: "#fff", fontSize: 14, fontWeight: 600,
            background: (gueltig && status !== "senden") ? "#1c1b18" : "#cfcdc4", cursor: gueltig ? "pointer" : "not-allowed" }}>
          {status === "senden" ? "Wird gesendet…" : "Anmeldelink senden"}
        </button>
        {fehler && <div style={{ marginTop: 10, fontSize: 13, color: "#a32d2d" }}>{fehler}</div>}
        <div style={{ marginTop: 14, fontSize: 12, color: "#9a988f" }}>Kein Passwort nötig – du erhältst einen einmaligen Anmeldelink per E-Mail.</div>
      </div>
    </Zentriert>
  );
}

function Zentriert({ children, text }) {
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "ui-sans-serif, system-ui, sans-serif", padding: 20 }}>
      {text ? <span style={{ color: "#6f6d64" }}>{text}</span> : children}
    </div>
  );
}
const karte = { background: "#fff", border: "1px solid #e6e4db", borderRadius: 14, padding: 24, width: 360, maxWidth: "100%", fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "#1c1b18" };
