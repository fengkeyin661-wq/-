
import { createClient } from '@supabase/supabase-js';

// Helper to safely access environment variables
const getEnvVar = (key: string): string => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}

  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (key === 'VITE_SUPABASE_URL') {
          // @ts-ignore
          return import.meta.env.VITE_SUPABASE_URL || '';
      }
      if (key === 'VITE_SUPABASE_KEY') {
          // @ts-ignore
          return import.meta.env.VITE_SUPABASE_KEY || '';
      }
      // @ts-ignore
      return import.meta.env[key] || '';
    }
  } catch (e) {}

  return '';
};

const isNonPlaceholder = (v: string) =>
  v.length > 10 && !v.toLowerCase().includes('placeholder');

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
// 常见：Vite 模板使用 VITE_SUPABASE_ANON_KEY；与 VITE_SUPABASE_KEY 二选一即可
const supabaseKey = (() => {
  const primary = getEnvVar('VITE_SUPABASE_KEY');
  if (primary && isNonPlaceholder(primary)) return primary;
  const anon = getEnvVar('VITE_SUPABASE_ANON_KEY');
  if (anon && isNonPlaceholder(anon)) return anon;
  return primary || anon || '';
})();

// Log config status for debugging（不打印密钥内容）
console.log(
  `[Supabase Config] URL ok: ${!!(supabaseUrl && isNonPlaceholder(supabaseUrl))}, Key ok: ${!!(supabaseKey && isNonPlaceholder(supabaseKey))}`
);

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseKey || 'placeholder'
);

export const isSupabaseConfigured = () => {
    const isUrlValid = !!(supabaseUrl && isNonPlaceholder(supabaseUrl));
    const isKeyValid = !!(supabaseKey && isNonPlaceholder(supabaseKey));
    return isUrlValid && isKeyValid;
};

/** 仅布尔与变量名，用于界面排查（不含密钥） */
export const getSupabaseEnvDiagnostics = () => {
    const rawUrl = getEnvVar('VITE_SUPABASE_URL');
    const rawKey = getEnvVar('VITE_SUPABASE_KEY');
    const rawAnon = getEnvVar('VITE_SUPABASE_ANON_KEY');
    const urlConfigured = !!(rawUrl && isNonPlaceholder(rawUrl));
    const keyFromPrimary = !!(rawKey && isNonPlaceholder(rawKey));
    const keyFromAnon = !!(rawAnon && isNonPlaceholder(rawAnon));
    const keyConfigured = keyFromPrimary || keyFromAnon;
    return {
        urlConfigured,
        keyConfigured,
        /** 当前实际采用的 key 来源，未配置则为 null */
        keyEnvName: keyFromPrimary ? 'VITE_SUPABASE_KEY' : keyFromAnon ? 'VITE_SUPABASE_ANON_KEY' : null,
        clientConfigured: isSupabaseConfigured(),
    };
};
