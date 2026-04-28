import {
  authenticateUserByPhone,
  type HealthArchive,
  type UserLoginFailureReason,
} from './dataService';

export type DualLoginFailureReason = UserLoginFailureReason;

export type DualLoginResult =
  | { success: true; archive: HealthArchive; channel: 'legacy' }
  | { success: false; reason: DualLoginFailureReason; message: string };

/**
 * 用户使用体检档案登记手机号 + 密码登录（无自助注册）。
 */
export const loginUserDualPath = async (
  phone: string,
  password: string
): Promise<DualLoginResult> => {
  const legacy = await authenticateUserByPhone(phone, password);
  if (legacy.success) {
    return { success: true, archive: legacy.archive, channel: 'legacy' };
  }
  return {
    success: false,
    reason: legacy.reason,
    message:
      legacy.reason === 'archive_not_found'
        ? '未找到与该手机号关联的体检档案，请核对手机号或联系健康管理中心'
        : legacy.message,
  };
};
