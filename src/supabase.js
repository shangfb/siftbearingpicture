import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
// Reject known server credentials before a client is created. Never put them in VITE_*.
function isServerKey(value) {
  if (value.startsWith('sb_secret_')) return true;
  try { return JSON.parse(atob(value.split('.')[1])).role === 'service_role'; } catch { return false; }
}
export const configured = Boolean(url && key);
export const configurationError = configured && (!/^https:\/\//.test(url) || isServerKey(key))
  ? '配置无效：仅使用 HTTPS 项目 URL 和 Publishable / anon key，禁止服务端密钥。' : '';
export const supabase = configured && !configurationError
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;

// Separate client: never loads the administrator session or stores a login.
// Public pages and security probes must use this client, not `supabase` above.
export const visitorClient = configured && !configurationError
  ? createClient(url, key, { auth: {
      storageKey: 'sift-anonymous-only', persistSession: false,
      autoRefreshToken: false, detectSessionInUrl: false,
    } }) : null;
