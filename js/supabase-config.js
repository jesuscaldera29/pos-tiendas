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

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
