// supabaseClient.js
// Zentrale Supabase-Instanz. Env-Variablen setzen (z. B. in Replit Secrets / .env):
//   VITE_SUPABASE_URL=https://<projekt>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<anon-key>
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.warn("[Terminblocker] Supabase-Env fehlt: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY setzen.");
}

export const supabase = createClient(URL, ANON);
export const FUNKTION_URL = `${URL}/functions/v1/termin`;
export const ANON_KEY = ANON;
