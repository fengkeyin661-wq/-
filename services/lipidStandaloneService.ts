/**
 * 血脂异常专项管理 — 独立参与者存储
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  HealthRecord,
  LipidAssessmentResult,
  LipidManagementData,
  LipidStandaloneParticipant,
} from '../types';
import type { HealthArchive } from './dataService';
import { formatCheckupId } from './checkupIdUtils';
import {
  applyLipidScreeningToHealthRecord,
  createEmptyLipidManagement,
  evaluateLipidScreening,
  inferCohortTagFromRecord,
  screeningFromHealthRecord,
} from './lipidAssessmentService';
import { detectDyslipidemiaTag } from './lipidTagService';

const LOCAL_KEY = 'LIPID_STANDALONE_V1';

export const resolveLipidParticipantKey = (input: {
  checkupId?: string;
  idCard?: string;
  phone?: string;
  name?: string;
}): string => {
  const cid = formatCheckupId(input.checkupId || '');
  if (cid) return `lck_${cid}`;
  const idCard = String(input.idCard || '').replace(/\s/g, '');
  if (idCard.length >= 15) return `lid_${idCard}`;
  const phone = String(input.phone || '').replace(/\D/g, '');
  if (phone.length >= 11) return `lph_${phone}`;
  return `lnm_${String(input.name || '未知').trim()}`;
};

const emptyQuestionnaire = (): HealthRecord['questionnaire'] => ({
  history: { diseases: [], details: {} },
  femaleHealth: {},
  familyHistory: {},
  medication: { isRegular: '否', details: {} },
  diet: { habits: [] },
  hydration: {},
  exercise: {},
  sleep: {},
  respiratory: {},
  substances: { smoking: {}, alcohol: {} },
  mental: {},
  mentalScales: {},
  needs: {},
  satisfaction: {},
});

export const mergeArchiveIntoLipidRecord = (
  base: HealthRecord,
  archive: HealthArchive | null | undefined
): HealthRecord => {
  if (!archive?.health_record) return base;
  const ar = archive.health_record;
  return {
    ...base,
    profile: {
      ...base.profile,
      checkupId: base.profile.checkupId || ar.profile?.checkupId || archive.checkup_id,
      name: base.profile.name || ar.profile?.name || archive.name,
      gender: base.profile.gender || ar.profile?.gender || archive.gender || '',
      age: base.profile.age ?? ar.profile?.age ?? archive.age,
      phone: base.profile.phone || ar.profile?.phone || archive.phone,
      checkupDate: ar.profile?.checkupDate || base.profile.checkupDate,
    },
    checkup: {
      ...ar.checkup,
      basics: { ...ar.checkup?.basics, ...base.checkup?.basics },
      labBasic: {
        ...ar.checkup?.labBasic,
        ...base.checkup?.labBasic,
        lipids: { ...ar.checkup?.labBasic?.lipids, ...base.checkup?.labBasic?.lipids },
        liver: { ...ar.checkup?.labBasic?.liver, ...base.checkup?.labBasic?.liver },
        renal: { ...ar.checkup?.labBasic?.renal, ...base.checkup?.labBasic?.renal },
        glucose: { ...ar.checkup?.labBasic?.glucose, ...base.checkup?.labBasic?.glucose },
        thyroidFunction: { ...ar.checkup?.labBasic?.thyroidFunction, ...base.checkup?.labBasic?.thyroidFunction },
        urineRoutine: { ...ar.checkup?.labBasic?.urineRoutine, ...base.checkup?.labBasic?.urineRoutine },
      },
      imagingBasic: { ...ar.checkup?.imagingBasic, ...base.checkup?.imagingBasic },
      optional: { ...ar.checkup?.optional, ...base.checkup?.optional },
      abnormalities: base.checkup?.abnormalities?.length ? base.checkup.abnormalities : ar.checkup?.abnormalities || [],
    },
    questionnaire: { ...emptyQuestionnaire(), ...ar.questionnaire, ...base.questionnaire },
    riskModelExtras: { ...ar.riskModelExtras, ...base.riskModelExtras },
    lipidManagement: base.lipidManagement || ar.lipidManagement,
  };
};

export const toLipidEvaluationRecord = (
  p: LipidStandaloneParticipant,
  archive?: HealthArchive | null
): HealthRecord => {
  const base: HealthRecord = {
    profile: {
      checkupId: p.checkupId || p.participantKey,
      name: p.name,
      gender: p.gender || '',
      age: p.age,
      department: '血脂异常专项管理',
      phone: p.phone,
    },
    checkup: {
      basics: {},
      labBasic: { liver: {}, lipids: {}, renal: {}, bloodRoutine: {}, glucose: {}, urineRoutine: {}, thyroidFunction: {} },
      imagingBasic: { ultrasound: {} },
      optional: { tumorMarkers4: {}, tumorMarkers2: {}, rheumatoid: {} },
      abnormalities: [],
    },
    questionnaire: emptyQuestionnaire(),
    lipidManagement: p.lipidManagement,
  };
  const merged = mergeArchiveIntoLipidRecord(base, archive);
  return applyLipidScreeningToHealthRecord(merged, p.lipidManagement);
};

export const resolveLipidRecordForParticipant = (p: LipidStandaloneParticipant, archive?: HealthArchive | null) =>
  toLipidEvaluationRecord(p, archive);

const readLocal = (): LipidStandaloneParticipant[] => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isQuotaError = (e: unknown): boolean =>
  e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);

const compactForLocal = (p: LipidStandaloneParticipant): LipidStandaloneParticipant => {
  const { lipidReport: _report, ...rest } = p;
  const lm = rest.lipidManagement;
  if (!lm?.screenings?.length) return rest;
  return {
    ...rest,
    lipidManagement: {
      ...lm,
      screenings: lm.screenings.map(({ rawColumns: _rc, importMeta: _im, ...s }) => s),
    },
  };
};

const writeLocal = (list: LipidStandaloneParticipant[]): void => {
  const compact = list.map(compactForLocal);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(compact));
  } catch (e) {
    if (!isQuotaError(e) || compact.length <= 1) throw e;
    const sorted = [...compact].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const keep = Math.max(1, Math.floor(sorted.length * 0.6));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sorted.slice(0, keep)));
    console.warn(`[lipidStandalone] 本地存储空间不足，已保留最近 ${keep} 条专项档案`);
  }
};

const upsertLocal = (item: LipidStandaloneParticipant): LipidStandaloneParticipant => {
  const list = readLocal();
  const idx = list.findIndex((x) => x.participantKey === item.participantKey || x.id === item.id);
  const next = idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [...list, item];
  writeLocal(next);
  return item;
};

const upsertCloud = async (item: LipidStandaloneParticipant) => {
  if (!isSupabaseConfigured()) return { success: true };
  try {
    const { error } = await supabase.from('lipid_standalone_participants').upsert(
      {
        id: item.id,
        participant_key: item.participantKey,
        checkup_id: item.checkupId || null,
        name: item.name,
        payload: item,
        updated_at: item.updatedAt,
      },
      { onConflict: 'id' }
    );
    return error ? { success: false, message: error.message } : { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
};

export const fetchLipidStandaloneParticipants = async (): Promise<LipidStandaloneParticipant[]> => {
  let local = readLocal();
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('lipid_standalone_participants')
        .select('payload')
        .order('updated_at', { ascending: false });
      if (!error && data?.length) {
        const cloud = data.map((r) => r.payload as LipidStandaloneParticipant);
        const byKey = new Map<string, LipidStandaloneParticipant>();
        local.forEach((p) => byKey.set(p.participantKey, p));
        cloud.forEach((p) => {
          const existing = byKey.get(p.participantKey);
          if (!existing || (p.updatedAt || '') >= (existing.updatedAt || '')) {
            byKey.set(p.participantKey, p);
          }
        });
        local = [...byKey.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        try {
          writeLocal(local);
        } catch {
          /* ignore local cache failure when cloud ok */
        }
      }
    } catch {
      /* use local */
    }
  }
  return local.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
};

export const findLipidStandaloneByKey = async (key: string) => {
  const list = await fetchLipidStandaloneParticipants();
  return list.find((p) => p.participantKey === key) || null;
};

export const findLipidStandaloneByCheckupId = async (checkupId: string) => {
  const cid = formatCheckupId(checkupId) || checkupId;
  const list = await fetchLipidStandaloneParticipants();
  return (
    list.find(
      (p) => p.checkupId === cid || p.linkedArchiveCheckupId === cid || p.participantKey === `lck_${cid}`
    ) || null
  );
};

export const saveLipidStandaloneParticipant = async (
  participant: LipidStandaloneParticipant
): Promise<{ success: boolean; message?: string }> => {
  const item = { ...participant, updatedAt: new Date().toISOString() };
  const cloud = await upsertCloud(item);
  if (!cloud.success) return { success: false, message: cloud.message || '云端保存失败' };
  try {
    upsertLocal(item);
  } catch (e) {
    if (isQuotaError(e)) {
      if (isSupabaseConfigured()) {
        return { success: true, message: '已保存至云端；浏览器本地缓存空间不足，列表刷新后将从云端加载。' };
      }
      return {
        success: false,
        message: '浏览器本地存储空间已满。请删除部分旧专项档案或配置 Supabase 云端存储。',
      };
    }
    throw e;
  }
  return { success: true };
};

export const reevaluateLipidStandalone = async (
  participant: LipidStandaloneParticipant,
  archive?: HealthArchive | null
): Promise<LipidAssessmentResult> => {
  const record = toLipidEvaluationRecord(participant, archive);
  const report = evaluateLipidScreening(record);
  await saveLipidStandaloneParticipant({ ...participant, lipidReport: report });
  return report;
};

export const ensureLipidStandaloneFromArchive = async (
  archive: HealthArchive
): Promise<{ participant: LipidStandaloneParticipant; created: boolean }> => {
  const cid = formatCheckupId(archive.checkup_id) || archive.checkup_id;
  const existing = await findLipidStandaloneByCheckupId(cid);
  if (existing) {
    if (!existing.linkedArchiveCheckupId) {
      const linked = { ...existing, linkedArchiveCheckupId: cid };
      await saveLipidStandaloneParticipant(linked);
      return { participant: linked, created: false };
    }
    return { participant: existing, created: false };
  }

  const participantKey = resolveLipidParticipantKey({ checkupId: cid, name: archive.name, phone: archive.phone });
  const byKey = await findLipidStandaloneByKey(participantKey);
  if (byKey) {
    const linked = { ...byKey, linkedArchiveCheckupId: cid, checkupId: byKey.checkupId || cid };
    await saveLipidStandaloneParticipant(linked);
    return { participant: linked, created: false };
  }

  const now = new Date().toISOString();
  const hm = createEmptyLipidManagement();
  const screening = screeningFromHealthRecord(archive.health_record, 'archive_auto');
  if (screening) {
    hm.screenings.push(screening);
    hm.annualCheckupLinked = true;
    const tag = inferCohortTagFromRecord(archive.health_record, screening);
    if (tag) hm.cohortTag = tag;
  }

  const participant: LipidStandaloneParticipant = {
    id: `lsp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    participantKey,
    checkupId: cid,
    name: archive.name,
    gender: archive.gender,
    age: archive.age,
    phone: archive.phone,
    lipidManagement: hm,
    linkedArchiveCheckupId: cid,
    createdAt: now,
    updatedAt: now,
  };

  const record = toLipidEvaluationRecord(participant, archive);
  participant.lipidReport = evaluateLipidScreening(record);

  const saveRes = await saveLipidStandaloneParticipant(participant);
  if (!saveRes.success) throw new Error(saveRes.message || '创建血脂专项档案失败');
  return { participant, created: true };
};

export const deleteLipidStandaloneParticipant = async (id: string) => {
  const res = await deleteLipidStandaloneParticipants([id]);
  return { success: res.success, message: res.message };
};

export const deleteLipidStandaloneParticipants = async (
  ids: string[]
): Promise<{ success: boolean; message?: string; deleted: number }> => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return { success: false, message: '未选择要删除的档案', deleted: 0 };

  const idSet = new Set(unique);
  try {
    writeLocal(readLocal().filter((p) => !idSet.has(p.id)));
  } catch (e) {
    if (!isQuotaError(e)) throw e;
  }

  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('lipid_standalone_participants').delete().in('id', unique);
    if (error) return { success: false, message: error.message, deleted: 0 };
  }
  return { success: true, deleted: unique.length };
};

export type UpsertLipidStandaloneInput = {
  checkupId?: string;
  name?: string;
  gender?: string;
  age?: number;
  phone?: string;
  idCard?: string;
  checkupCount?: number;
  checkStatus?: string;
  activityName?: string;
  screening: import('../types').LipidScreeningRecord;
};

export const upsertLipidStandaloneFromScreening = async (
  input: UpsertLipidStandaloneInput
): Promise<{ participant: LipidStandaloneParticipant; report: LipidAssessmentResult }> => {
  const participantKey = resolveLipidParticipantKey({
    checkupId: input.checkupId,
    idCard: input.idCard,
    phone: input.phone,
    name: input.name,
  });

  const existing = await findLipidStandaloneByKey(participantKey);
  const now = new Date().toISOString();
  const lm = existing?.lipidManagement || createEmptyLipidManagement();
  const screenings = [...(lm.screenings || [])];
  const dupIdx = screenings.findIndex(
    (s) => s.screeningDate === input.screening.screeningDate && s.activityName === input.screening.activityName
  );
  if (dupIdx >= 0) screenings[dupIdx] = { ...screenings[dupIdx], ...input.screening };
  else screenings.push(input.screening);

  const latestScreening = screenings[screenings.length - 1] || null;
  const participant: LipidStandaloneParticipant = {
    id: existing?.id || `lsp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    participantKey,
    checkupId: formatCheckupId(input.checkupId || '') || input.checkupId,
    name: input.name || existing?.name || '未命名',
    gender: input.gender ?? existing?.gender,
    age: input.age ?? existing?.age,
    phone: input.phone ?? existing?.phone,
    idCard: input.idCard ?? existing?.idCard,
    checkupCount: input.checkupCount ?? existing?.checkupCount,
    checkStatus: input.checkStatus ?? existing?.checkStatus,
    activityName: input.activityName || input.screening.activityName || '社区血脂异常专项筛查',
    lipidManagement: { ...lm, screenings, annualCheckupLinked: false },
    linkedArchiveCheckupId: existing?.linkedArchiveCheckupId ?? null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const record = toLipidEvaluationRecord(participant);
  const tag = inferCohortTagFromRecord(record, latestScreening);
  if (tag) participant.lipidManagement.cohortTag = tag;
  const report = evaluateLipidScreening(record);
  participant.lipidReport = report;

  const saveRes = await saveLipidStandaloneParticipant(participant);
  if (!saveRes.success) throw new Error(saveRes.message || '保存失败');
  return { participant, report };
};

export const batchReevaluateLipidStandaloneReports = async (options?: {
  ids?: string[];
  onProgress?: (line: string) => void;
}): Promise<{ updated: number; failed: number; logs: string[] }> => {
  const list = await fetchLipidStandaloneParticipants();
  const idSet = options?.ids?.length ? new Set(options.ids) : null;
  const targets = idSet ? list.filter((p) => idSet.has(p.id)) : list;
  const logs: string[] = [];
  const log = (line: string) => {
    logs.push(line);
    options?.onProgress?.(line);
  };
  let updated = 0;
  let failed = 0;
  for (const p of targets) {
    const label = p.name || p.checkupId || p.id;
    try {
      await reevaluateLipidStandalone(p);
      updated++;
      log(`✓ ${label}：报告已更新`);
    } catch (e) {
      failed++;
      log(`✗ ${label}：失败 — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { updated, failed, logs };
};
