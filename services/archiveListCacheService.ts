import type { HealthArchive } from './dataService';

const ARCHIVE_LIST_CACHE_KEY = 'HEALTH_ADMIN_ARCHIVE_LIST_V1';
const ARCHIVE_LIST_CACHE_META_KEY = 'HEALTH_ADMIN_ARCHIVE_LIST_META_V1';

/** 人员名单属于定期查看的数据：先显示本地缓存，只有手动刷新才整表重取。 */
export const ARCHIVE_LIST_CACHE_TTL_MS = 30 * 60 * 1000;

export interface ArchiveListCacheMeta {
  fetchedAt: string;
  count: number;
}

export interface ArchiveListCacheSnapshot {
  archives: HealthArchive[];
  meta: ArchiveListCacheMeta | null;
}

let memoryArchives: HealthArchive[] | null = null;
let memoryMeta: ArchiveListCacheMeta | null = null;
const listeners = new Set<(archives: HealthArchive[]) => void>();

const publish = () => {
  listeners.forEach((listener) => listener(memoryArchives ? [...memoryArchives] : []));
};

/** 名单更新后通知各个页面，切换页面时不用再向后台整表抓取。 */
export const subscribeArchiveList = (listener: (archives: HealthArchive[]) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const parseArchives = (raw: string | null): HealthArchive[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HealthArchive[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** 同步读取：内存 → localStorage（打开管理后台时立即展示） */
export const readArchiveListCache = (): ArchiveListCacheSnapshot => {
  if (memoryArchives && memoryArchives.length > 0) {
    return { archives: memoryArchives, meta: memoryMeta };
  }

  try {
    const raw = localStorage.getItem(ARCHIVE_LIST_CACHE_KEY);
    const metaRaw = localStorage.getItem(ARCHIVE_LIST_CACHE_META_KEY);
    const archives = parseArchives(raw);
    const meta = metaRaw ? (JSON.parse(metaRaw) as ArchiveListCacheMeta) : null;
    if (archives.length) {
      memoryArchives = archives;
      memoryMeta = meta;
    }
    return { archives, meta };
  } catch {
    return { archives: [], meta: null };
  }
};

export const writeArchiveListCache = (archives: HealthArchive[]): void => {
  const meta: ArchiveListCacheMeta = {
    fetchedAt: new Date().toISOString(),
    count: archives.length,
  };
  memoryArchives = archives;
  memoryMeta = meta;
  publish();

  try {
    localStorage.setItem(ARCHIVE_LIST_CACHE_KEY, JSON.stringify(archives));
    localStorage.setItem(ARCHIVE_LIST_CACHE_META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('人员列表本地缓存写入失败（可能超出配额）', e);
  }
};

export const upsertArchiveInListCache = (archive: HealthArchive): void => {
  const current = memoryArchives ? [...memoryArchives] : readArchiveListCache().archives;
  const index = current.findIndex((item) => item.checkup_id === archive.checkup_id);
  if (index >= 0) current[index] = { ...current[index], ...archive };
  else current.push(archive);
  writeArchiveListCache(current);
};

export const invalidateArchiveListCache = (): void => {
  memoryArchives = null;
  memoryMeta = null;
  try {
    localStorage.removeItem(ARCHIVE_LIST_CACHE_KEY);
    localStorage.removeItem(ARCHIVE_LIST_CACHE_META_KEY);
  } catch {
    /* ignore */
  }
};

export const isArchiveListCacheFresh = (
  meta: ArchiveListCacheMeta | null,
  maxAgeMs = ARCHIVE_LIST_CACHE_TTL_MS
): boolean => {
  if (!meta?.fetchedAt) return false;
  const age = Date.now() - new Date(meta.fetchedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < maxAgeMs;
};

export const formatArchiveListCacheTime = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};
