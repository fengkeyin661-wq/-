import { createClient } from '@supabase/supabase-js';

// Helper to safely access environment variables in different environments (Vite, Webpack, etc.)
const getEnvVar = (key: string): string => {
  // 1. Try Vite's import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {}

  // 2. Try process.env (Standard Node/Webpack)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}

  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_KEY');

// 创建 Supabase 客户端
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseKey || 'placeholder'
);

export const isSupabaseConfigured = () => {
    // 检查是否包含有效配置
    return !!supabaseUrl && 
           !!supabaseKey && 
           supabaseUrl !== "YOUR_SUPABASE_URL" &&
           !supabaseUrl.includes("placeholder");
};