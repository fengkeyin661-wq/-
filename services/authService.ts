import { supabase } from './supabaseClient';

const normalizePhone = (phone: string) => phone.replace(/[\s\-]/g, '').trim();

export type AuthLoginResult =
  | { success: true; checkupId: string; role?: string }
  | { success: false; message: string };

export const signInWithPhonePassword = async (
  phone: string,
  password: string
): Promise<AuthLoginResult> => {
  const p = normalizePhone(phone);
  if (!p || !password) return { success: false, message: '请输入手机号与密码' };

  const { data, error } = await supabase.auth.signInWithPassword({
    phone: p,
    password,
  });
  if (error) return { success: false, message: error.message || '登录失败' };

  const appMeta = data.user?.app_metadata || {};
  const checkupId = String(appMeta.checkup_id || '').trim();
  const role = String(appMeta.role || '').trim();
  if (!checkupId) {
    return {
      success: false,
      message: '登录成功但未绑定 checkup_id，请联系管理员完善 Auth 用户 app_metadata。',
    };
  }
  return { success: true, checkupId, role };
};

export const signOutAuth = async () => {
  await supabase.auth.signOut();
};

export const getAuthSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session || null;
};

export const getCurrentUserCheckupId = async (): Promise<string | null> => {
  const session = await getAuthSession();
  const checkupId = String(session?.user?.app_metadata?.checkup_id || '').trim();
  return checkupId || null;
};

export const onAuthChanged = (
  cb: (event: string, session: any | null) => void
) => supabase.auth.onAuthStateChange((event, session) => cb(event, session));

