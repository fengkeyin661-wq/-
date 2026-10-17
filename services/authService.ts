import { supabase } from './supabaseClient';

const normalizePhone = (phone: string) => phone.replace(/[\s\-]/g, '').trim();

const mapAuthErrorMessage = (message?: string): string => {
  const msg = String(message || '').trim();
  const lower = msg.toLowerCase();
  if (!msg) return '认证失败，请稍后重试';
  if (lower.includes('phone signups are disabled')) {
    return '系统未开启手机号注册（Phone signups are disabled）。请联系管理员在 Supabase Auth > Providers 中启用 Phone。';
  }
  if (lower.includes('signups not allowed')) {
    return '当前环境未开放注册，请联系管理员开启注册功能。';
  }
  if (lower.includes('invalid phone')) {
    return '手机号格式不正确，请检查后重试。';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return '该手机号已注册，请直接登录。';
  }
  return msg;
};

export type AuthLoginResult =
  | { success: true; checkupId: string; role?: string }
  | { success: true; checkupId: ''; role?: string; needsArchiveBinding: true }
  | { success: false; message: string };

export type AuthSignUpResult =
  | { success: true; needsConfirmation: boolean; message?: string }
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
  if (error) return { success: false, message: mapAuthErrorMessage(error.message) };

  const appMeta = data.user?.app_metadata || {};
  const checkupId = String(appMeta.checkup_id || '').trim();
  const role = String(appMeta.role || '').trim();
  if (!checkupId) {
    return { success: true, checkupId: '', role, needsArchiveBinding: true };
  }
  return { success: true, checkupId, role };
};

export const signUpWithPhonePassword = async (
  phone: string,
  password: string
): Promise<AuthSignUpResult> => {
  const p = normalizePhone(phone);
  if (!p || !password) return { success: false, message: '请输入手机号与密码' };
  if (password.length < 6) return { success: false, message: '密码至少 6 位' };

  const { data, error } = await supabase.auth.signUp({
    phone: p,
    password,
    options: {
      data: {
        role: 'user',
      },
    },
  });
  if (error) return { success: false, message: mapAuthErrorMessage(error.message) };

  const needsConfirmation = !data.session;
  return {
    success: true,
    needsConfirmation,
    message: needsConfirmation
      ? '注册成功，请按提示完成手机验证后登录'
      : '注册成功，您现在可以登录并浏览医疗资源',
  };
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

