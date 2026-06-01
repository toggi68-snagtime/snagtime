// App.jsx
// Routing-Gerüst. Drei Bereiche:
//   /u/:id            öffentlich  – Teilnehmer stimmt ab (kein Login)
//   /app              geschützt   – Organisator: neue Umfrage anlegen
//   /app/entscheid/:id geschützt  – Organisator: Auswertung & Entscheid
//
// Benötigt: npm i react-router-dom @supabase/supabase-js
import { BrowserRouter, Routes, Route, Link, useParams, Navigate } from "react-router-dom";
import { AuthProvider, GeschuetzteRoute, useAuth } from "./auth";
import { UmfrageSeite, EntscheidSeite } from "./Container";
import UmfrageAnlegen from "./UmfrageAnlegen";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Öffentlich: Teilnehmer */}
          <Route path="/u/:id" element={<TeilnehmerRoute />} />

          {/* Geschützt: Organisator */}
          <Route path="/app" element={<GeschuetzteRoute><Rahmen><UmfrageAnlegen /></Rahmen></GeschuetzteRoute>} />
          <Route path="/app/entscheid/:id" element={<GeschuetzteRoute><Rahmen><EntscheidRoute /></Rahmen></GeschuetzteRoute>} />

          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Zentriert text="Seite nicht gefunden" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function TeilnehmerRoute() {
  const { id } = useParams();
  return (
    <div style={{ background: "#faf9f4", minHeight: "100vh", padding: "24px 14px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <UmfrageSeite umfrageId={id} />
      </div>
    </div>
  );
}

function EntscheidRoute() {
  const { id } = useParams();
  return <EntscheidSeite umfrageId={id} />;
}

// Rahmen mit Kopfzeile + Logout für die Organisator-Ansichten.
function Rahmen({ children }) {
  const { user, logout } = useAuth();
  return (
    <div style={{ background: "#faf9f4", minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", borderBottom: "1px solid #e6e4db", background: "#fff" }}>
        <Link to="/app" style={{ fontWeight: 700, fontSize: 16, color: "#1c1b18", textDecoration: "none" }}>
          Terminblocker <span style={{ color: "#0d8c7f" }}>Light</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#6f6d64" }}>
          <span>{user?.email}</span>
          <button onClick={logout} style={{ border: "1px solid #e6e4db", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#1c1b18" }}>Abmelden</button>
        </div>
      </header>
      <main style={{ padding: "20px 0" }}>{children}</main>
    </div>
  );
}

function Zentriert({ text }) {
  return <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "#6f6d64" }}>{text}</div>;
}
