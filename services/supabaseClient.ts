
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

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_KEY');

// Log config status for debugging
console.log(`[Supabase Config] URL found: ${!!supabaseUrl}, Key found: ${!!supabaseKey}`);

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseKey || 'placeholder'
);

export const isSupabaseConfigured = () => {
    // Strict check: Ensure variables exist, are long enough, AND are not placeholders
    const isUrlValid = supabaseUrl && supabaseUrl.length > 10 && !supabaseUrl.includes('placeholder');
    const isKeyValid = supabaseKey && supabaseKey.length > 10 && !supabaseKey.includes('placeholder');
    
    return !!(isUrlValid && isKeyValid);
};
