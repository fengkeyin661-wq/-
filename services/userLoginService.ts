import {
  authenticateUserByPhone,
  findArchiveByCheckupId,
  type HealthArchive,
  type UserLoginFailureReason,
} from './dataService';
import { signInWithPhonePassword } from './authService';

export type DualLoginFailureReason =
  | UserLoginFailureReason
  | 'auth_failed'
  | 'auth_archive_missing';

export type DualLoginResult =
  | { success: true; archive: HealthArchive; channel: 'legacy' | 'auth' }
  | { success: true; archive: null; channel: 'auth'; needsArchiveBinding: true }
  | { success: false; reason: DualLoginFailureReason; message: string };

/**
 * Dual-path login:
 * 1) Legacy path (phone -> health_archives + password check)
 * 2) Fallback to Supabase Auth when RLS/query issues occur on legacy path
 */
export const loginUserDualPath = async (
  phone: string,
  password: string
): Promise<DualLoginResult> => {
  const legacy = await authenticateUserByPhone(phone, password);
  if (legacy.success) {
    return { success: true, archive: legacy.archive, channel: 'legacy' };
  }

  // Only fallback to Auth when legacy path is blocked by policy/network query issues
  if (!['permission_denied', 'query_error'].includes(legacy.reason)) {
    return {
      success: false,
      reason: legacy.reason,
      message: legacy.message,
    };
  }

  const auth = await signInWithPhonePassword(phone, password);
  if (!auth.success) {
    return {
      success: false,
      reason: 'auth_failed',
      message: `旧通道受限（${legacy.message}），Auth 通道失败：${auth.message}`,
    };
  }

  if (('needsArchiveBinding' in auth && auth.needsArchiveBinding) || !auth.checkupId) {
    return { success: true, archive: null, channel: 'auth', needsArchiveBinding: true };
  }

  const archive = await findArchiveByCheckupId(auth.checkupId);
  if (!archive) {
    return {
      success: false,
      reason: 'auth_archive_missing',
      message: 'Auth 登录成功，但未找到 checkup_id 对应健康档案。',
    };
  }

  return { success: true, archive, channel: 'auth' };
};

