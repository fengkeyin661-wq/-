import { createClient } from '@supabase/supabase-js';

// 使用 Vite 标准方式读取环境变量
// 在 Vercel 中配置的 VITE_ 前缀变量会自动注入到这里
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || '';

// 如果没有配置，这里会创建一个无法工作的客户端，但在 App 中会进行检查
export const supabase = createClient(supabaseUrl, supabaseKey);

export const isSupabaseConfigured = () => {
    // 检查是否包含有效配置
    return !!supabaseUrl && !!supabaseKey && supabaseUrl !== "YOUR_SUPABASE_URL";
};