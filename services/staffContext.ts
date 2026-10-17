import type { ContentItem } from './contentService';

export type StaffRole = 'admin' | 'health_manager' | 'doctor';

export interface StaffIdentity {
  id: string;
  name: string;
  role: StaffRole;
  staffNo?: string;
}

const SESSION_KEY = 'HEALTH_STAFF_SESSION_V1';

let currentStaff: StaffIdentity | null = null;

export const setCurrentStaff = (staff: StaffIdentity | null): void => {
  currentStaff = staff;
  try {
    if (staff) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(staff));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
};

export const getCurrentStaff = (): StaffIdentity | null => currentStaff;

export const restoreStaffFromStorage = (): StaffIdentity | null => {
  if (currentStaff) return currentStaff;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaffIdentity;
    if (parsed?.id && parsed?.name && parsed?.role) {
      currentStaff = parsed;
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
};

export const staffFromAdminLogin = (): StaffIdentity => ({
  id: 'admin',
  name: '超级管理员',
  role: 'admin',
});

export const staffFromManager = (manager: ContentItem): StaffIdentity => ({
  id: manager.id,
  name: manager.title || manager.details?.name || '健康管理师',
  role: 'health_manager',
  staffNo: manager.details?.staff_no,
});

export const staffFromDoctor = (doctor: ContentItem): StaffIdentity => ({
  id: doctor.id,
  name: doctor.title || '签约医生',
  role: 'doctor',
});

export const MANAGER_SESSION_KEY = 'HEALTH_MANAGER_SESSION_V1';

export const persistManagerSession = (manager: ContentItem | null): void => {
  try {
    if (manager) {
      localStorage.setItem(MANAGER_SESSION_KEY, JSON.stringify(manager));
    } else {
      localStorage.removeItem(MANAGER_SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
};

export const restoreManagerSession = (): ContentItem | null => {
  try {
    const raw = localStorage.getItem(MANAGER_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ContentItem;
  } catch {
    return null;
  }
};
