// ============================================
// SUPABASE CONFIGURATION
// ============================================
// INSTRUCCIONES:
// 1. Ve a https://supabase.com y crea un nuevo proyecto (o usa uno existente)
// 2. Ve a Settings > API
// 3. Copia tu Project URL y tu anon/public key
// 4. Pégalos aquí abajo

const SUPABASE_URL = 'https://zsguuroeboycudxdzmtm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BQdnGotGMpJ5twOGgedUAw_1AAjmrlA';

// Keep reference to the library object
window.supabaseLib = window.supabase;

// Instanciamos el cliente y sobrescribimos la variable global para que todos los módulos la usen
window.supabase = window.supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
