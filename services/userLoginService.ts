import {
  authenticateUserByPhone,
  type HealthArchive,
  type UserLoginFailureReason,
} from './dataService';

export type DualLoginFailureReason =
  | UserLoginFailureReason
  | 'auth_failed';

export type DualLoginResult =
  | { success: true; archive: HealthArchive; channel: 'legacy' | 'auth' }
  | { success: true; archive: null; channel: 'auth'; needsArchiveBinding: true; username: string }
  | { success: false; reason: DualLoginFailureReason; message: string };

export type PortalRegisterResult =
  | { success: true; message: string }
  | { success: false; message: string };

type PortalUserAccount = {
  username: string;
  password: string;
  createdAt: string;
};

const USER_PORTAL_ACCOUNTS_KEY = 'USER_PORTAL_ACCOUNTS_V1';

const normalizeUsername = (username: string) => username.trim();

const loadPortalAccounts = (): PortalUserAccount[] => {
  try {
    const raw = localStorage.getItem(USER_PORTAL_ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as PortalUserAccount[]) : [];
  } catch {
    return [];
  }
};

const savePortalAccounts = (accounts: PortalUserAccount[]) => {
  localStorage.setItem(USER_PORTAL_ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const registerPortalUser = async (
  username: string,
  password: string
): Promise<PortalRegisterResult> => {
  const u = normalizeUsername(username);
  if (!u) return { success: false, message: '请输入用户名' };
  if (!password || password.length < 6) return { success: false, message: '密码至少 6 位' };

  const all = loadPortalAccounts();
  const exists = all.some((x) => x.username.toLowerCase() === u.toLowerCase());
  if (exists) return { success: false, message: '该用户名已被注册，请直接登录' };

  all.push({
    username: u,
    password,
    createdAt: new Date().toISOString(),
  });
  savePortalAccounts(all);
  return { success: true, message: '注册成功，可直接登录并浏览资源' };
};

/**
 * Dual-path login:
 * 1) Username local account -> visitor mode (no archive required)
 * 2) Legacy path (phone -> health_archives + password check) for existing users
 */
export const loginUserDualPath = async (
  usernameOrPhone: string,
  password: string
): Promise<DualLoginResult> => {
  const username = normalizeUsername(usernameOrPhone);
  const localAccounts = loadPortalAccounts();
  const localUser = localAccounts.find(
    (x) => x.username.toLowerCase() === username.toLowerCase() && x.password === password
  );
  if (localUser) {
    return {
      success: true,
      archive: null,
      channel: 'auth',
      needsArchiveBinding: true,
      username: localUser.username,
    };
  }

  const legacy = await authenticateUserByPhone(usernameOrPhone, password);
  if (legacy.success) {
    return { success: true, archive: legacy.archive, channel: 'legacy' };
  }

  // Legacy path fail -> provide friendly auth_failed for non-legacy users
  if (legacy.reason === 'archive_not_found') {
    return {
      success: false,
      reason: 'auth_failed',
      message: '未找到该用户，请先注册（用户名 + 密码）后登录',
    };
  }
  return {
    success: false,
    reason: legacy.reason,
    message: legacy.message,
  };
};

