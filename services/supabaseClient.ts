import { createClient } from '@supabase/supabase-js';

// process.env usage instead of import.meta.env
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_KEY || '';

// 创建 Supabase 客户端
// 使用 fallback 防止初始化报错，但 isSupabaseConfigured 会拦截无效配置
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
