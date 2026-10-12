import type { ContentItem } from './contentService';
import { isHealthManagerContent } from './contentService';

/** 用户端「健康管理团队」四类角色（与运营台 healthTeamRole 对应） */
export type HealthTeamRoleId = 'health_manager' | 'nutritionist' | 'sport_coach' | 'clinical';

export const HEALTH_TEAM_ROLE_OPTIONS: { id: HealthTeamRoleId; label: string }[] = [
  { id: 'health_manager', label: '健康管家' },
  { id: 'nutritionist', label: '营养师' },
  { id: 'sport_coach', label: '运动教练' },
  { id: 'clinical', label: '临床医生' },
];

const textBlob = (d: ContentItem) =>
  `${d.title}${d.description || ''}${d.details?.title || ''}${d.details?.dept || ''}${(d.tags || []).join('')}`;

function legacyRoleFromText(d: ContentItem): HealthTeamRoleId {
  const t = textBlob(d);
  if (/营养|营养师|营养科/.test(t)) return 'nutritionist';
  if (/运动|康复|教练|体适能/.test(t)) return 'sport_coach';
  return 'clinical';
}

/** 解析医生在健康管理团队中的角色（优先运营台显式配置） */
export function resolveDoctorTeamRoleId(d: ContentItem): HealthTeamRoleId {
  if (d.type !== 'doctor') return 'clinical';
  if (isHealthManagerContent(d)) return 'health_manager';
  const explicit = String(d.details?.healthTeamRole || '').trim();
  if (explicit === 'nutritionist' || explicit === 'sport_coach' || explicit === 'clinical') {
    return explicit;
  }
  return legacyRoleFromText(d);
}

export function doctorsMatchingTeamRole(
  doctors: ContentItem[],
  roleId: HealthTeamRoleId,
): ContentItem[] {
  return doctors.filter((d) => d.type === 'doctor' && resolveDoctorTeamRoleId(d) === roleId);
}

export function primaryDoctorForTeamRole(
  doctors: ContentItem[],
  roleId: HealthTeamRoleId,
): ContentItem | null {
  const list = doctorsMatchingTeamRole(doctors, roleId);
  return list[0] ?? null;
}
