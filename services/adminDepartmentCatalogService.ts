/**
 * 管理控制台 — 单位/部门名称库（本地持久化，供下拉选择与批量维护）
 */
const STORAGE_KEY = 'HEALTH_ADMIN_DEPARTMENTS_V1';

export const DEPARTMENT_COLUMN_KEYS = [
  '部门',
  '单位',
  '单位/部门',
  '单位部门',
  '所属部门',
  '院系',
  '学院',
] as const;

const normalizeName = (raw: string): string => raw.replace(/\s+/g, ' ').trim();

export function parseDepartmentLines(text: string): string[] {
  const set = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    for (const part of line.split(/[,，;；|、\t]+/)) {
      const name = normalizeName(part);
      if (name) set.add(name);
    }
  }
  return [...set];
}

export function mergeUniqueDepartments(existing: string[], incoming: string[]): string[] {
  const set = new Set<string>();
  for (const x of existing) {
    const n = normalizeName(x);
    if (n) set.add(n);
  }
  for (const x of incoming) {
    const n = normalizeName(x);
    if (n) set.add(n);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export function loadAdminDepartments(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return mergeUniqueDepartments([], parsed.map((x) => String(x ?? '')));
  } catch {
    return [];
  }
}

export function saveAdminDepartments(departments: string[]): void {
  const cleaned = mergeUniqueDepartments([], departments);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
}

export function extractDepartmentsFromExcelRow(row: Record<string, unknown>): string[] {
  const found: string[] = [];
  for (const key of DEPARTMENT_COLUMN_KEYS) {
    const val = row[key];
    if (val != null && String(val).trim()) {
      found.push(normalizeName(String(val)));
    }
  }
  if (found.length) return found;
  for (const [k, v] of Object.entries(row)) {
    if (/部门|单位|院系|学院/.test(k) && v != null && String(v).trim()) {
      found.push(normalizeName(String(v)));
    }
  }
  return found;
}

export function collectDepartmentsFromArchives(
  archives: { department?: string | null }[],
): string[] {
  const names = archives.map((a) => normalizeName(a.department || '')).filter(Boolean);
  return mergeUniqueDepartments([], names);
}

/** 编辑档案时可选部门 = 名称库 + 档案中已出现过的部门 */
export function buildDepartmentOptions(
  catalog: string[],
  archives: { department?: string | null }[],
): string[] {
  return mergeUniqueDepartments(catalog, collectDepartmentsFromArchives(archives));
}
