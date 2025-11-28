import { createClient } from '@supabase/supabase-js';

// 使用 process.env 读取环境变量
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

// 如果没有配置，这里会创建一个无法工作的客户端，但在 App 中会进行检查
// 我们使用 fallback 来防止 createClient 抛出 "supabaseUrl is required" 错误
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

export const isSupabaseConfigured = () => {
    // 检查是否包含有效配置
    return !!supabaseUrl && !!supabaseKey && supabaseUrl !== "YOUR_SUPABASE_URL";
};
