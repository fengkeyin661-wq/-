import { createClient } from '@supabase/supabase-js';

// 获取配置
const getEnvConfig = () => {
  // @ts-ignore
  if (typeof window !== 'undefined' && window.process && window.process.env) {
    // @ts-ignore
    return window.process.env;
  }
  return process.env;
};

const config = getEnvConfig();

const supabaseUrl = config.SUPABASE_URL || '';
const supabaseKey = config.SUPABASE_KEY || '';

// 如果没有配置，这里会创建一个无法工作的客户端，但在 App 中会进行检查
export const supabase = createClient(supabaseUrl, supabaseKey);

export const isSupabaseConfigured = () => {
    return supabaseUrl && supabaseKey && supabaseUrl !== "https://your-project-id.supabase.co";
};