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

// Log config status for debugging (don't log the actual key in production ideally, but helpful here)
console.log(`[Supabase Config] URL found: ${!!supabaseUrl}, Key found: ${!!supabaseKey}`);

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseKey || 'placeholder'
);

export const isSupabaseConfigured = () => {
    // More lenient check: just ensure variables exist and have some length
    return !!supabaseUrl && 
           !!supabaseKey && 
           supabaseUrl.length > 10 && 
           supabaseKey.length > 10;
};