/**
 * 高血压专项筛查 — 独立参与者存储
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  HealthRecord,
  HypertensionAssessmentResult,
  HypertensionManagementData,
  HypertensionStandaloneParticipant,
} from '../types';
import type { HealthArchive } from './dataService';
import { formatCheckupId } from './checkupIdUtils';
import {
  applyHypertensionScreeningToHealthRecord,
  createEmptyHypertensionManagement,
  createHypertensionScreeningId,
  evaluateHypertensionScreening,
  inferCohortTagFromRecord,
  screeningFromHealthRecord,
} from './hypertensionAssessmentService';
import { detectHighBloodPressureTag } from './bloodPressureTagService';

const LOCAL_KEY = 'HYPERTENSION_STANDALONE_V1';

export const resolveHypertensionParticipantKey = (input: {
  checkupId?: string;
  idCard?: string;
  phone?: string;
  name?: string;
}): string => {
  const cid = formatCheckupId(input.checkupId || '');
  if (cid) return `hck_${cid}`;
  const idCard = String(input.idCard || '').replace(/\s/g, '');
  if (idCard.length >= 15) return `hid_${idCard}`;
  const phone = String(input.phone || '').replace(/\D/g, '');
  if (phone.length >= 11) return `hph_${phone}`;
  return `hnm_${String(input.name || '未知').trim()}`;
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

export const mergeArchiveIntoHypertensionRecord = (
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
        renal: { ...ar.checkup?.labBasic?.renal, ...base.checkup?.labBasic?.renal },
        glucose: { ...ar.checkup?.labBasic?.glucose, ...base.checkup?.labBasic?.glucose },
        urineRoutine: { ...ar.checkup?.labBasic?.urineRoutine, ...base.checkup?.labBasic?.urineRoutine },
      },
      imagingBasic: { ...ar.checkup?.imagingBasic, ...base.checkup?.imagingBasic },
      optional: { ...ar.checkup?.optional, ...base.checkup?.optional },
      abnormalities: base.checkup?.abnormalities?.length ? base.checkup.abnormalities : ar.checkup?.abnormalities || [],
    },
    questionnaire: { ...emptyQuestionnaire(), ...ar.questionnaire, ...base.questionnaire },
    riskModelExtras: { ...ar.riskModelExtras, ...base.riskModelExtras },
    hypertensionManagement: base.hypertensionManagement || ar.hypertensionManagement,
  };
};

export const toHypertensionEvaluationRecord = (
  p: HypertensionStandaloneParticipant,
  archive?: HealthArchive | null
): HealthRecord => {
  const base: HealthRecord = {
    profile: {
      checkupId: p.checkupId || p.participantKey,
      name: p.name,
      gender: p.gender || '',
      age: p.age,
      department: '高血压专项筛查',
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
    hypertensionManagement: p.hypertensionManagement,
  };
  const merged = mergeArchiveIntoHypertensionRecord(base, archive);
  return applyHypertensionScreeningToHealthRecord(merged, p.hypertensionManagement);
};

export const resolveHypertensionRecordForParticipant = (
  p: HypertensionStandaloneParticipant,
  archive?: HealthArchive | null
) => toHypertensionEvaluationRecord(p, archive);

const readLocal = (): HypertensionStandaloneParticipant[] => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const compactForLocal = (p: HypertensionStandaloneParticipant): HypertensionStandaloneParticipant => {
  const { hypertensionReport: _r, ...rest } = p;
  return rest;
};

const writeLocal = (list: HypertensionStandaloneParticipant[]) => {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list.map(compactForLocal)));
};

const upsertLocal = (item: HypertensionStandaloneParticipant) => {
  const list = readLocal();
  const idx = list.findIndex((x) => x.participantKey === item.participantKey || x.id === item.id);
  writeLocal(idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [...list, item]);
};

const upsertCloud = async (item: HypertensionStandaloneParticipant) => {
  if (!isSupabaseConfigured()) return { success: true };
  const { error } = await supabase.from('hypertension_standalone_participants').upsert(
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
};

export const fetchHypertensionStandaloneParticipants = async (): Promise<HypertensionStandaloneParticipant[]> => {
  let local = readLocal();
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('hypertension_standalone_participants')
        .select('payload')
        .order('updated_at', { ascending: false });
      if (!error && data?.length) {
        const cloud = data.map((r) => r.payload as HypertensionStandaloneParticipant);
        const byKey = new Map<string, HypertensionStandaloneParticipant>();
        local.forEach((p) => byKey.set(p.participantKey, p));
        cloud.forEach((p) => {
          const existing = byKey.get(p.participantKey);
          if (!existing || (p.updatedAt || '') >= (existing.updatedAt || '')) {
            byKey.set(p.participantKey, p);
          }
        });
        local = [...byKey.values()];
        writeLocal(local);
      }
    } catch {
      /* use local */
    }
  }
  return local.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
};

export const findHypertensionStandaloneByKey = async (key: string) => {
  const list = await fetchHypertensionStandaloneParticipants();
  return list.find((p) => p.participantKey === key) || null;
};

export const findHypertensionStandaloneByCheckupId = async (checkupId: string) => {
  const cid = formatCheckupId(checkupId) || checkupId;
  const list = await fetchHypertensionStandaloneParticipants();
  return (
    list.find(
      (p) => p.checkupId === cid || p.linkedArchiveCheckupId === cid || p.participantKey === `hck_${cid}`
    ) || null
  );
};

export const saveHypertensionStandaloneParticipant = async (
  participant: HypertensionStandaloneParticipant
): Promise<{ success: boolean; message?: string }> => {
  const item = { ...participant, updatedAt: new Date().toISOString() };
  const cloud = await upsertCloud(item);
  if (!cloud.success) return { success: false, message: cloud.message };
  upsertLocal(item);
  return { success: true };
};

export const reevaluateHypertensionStandalone = async (
  participant: HypertensionStandaloneParticipant,
  archive?: HealthArchive | null
): Promise<HypertensionAssessmentResult> => {
  const record = toHypertensionEvaluationRecord(participant, archive);
  const report = evaluateHypertensionScreening(record);
  await saveHypertensionStandaloneParticipant({ ...participant, hypertensionReport: report });
  return report;
};

/** 建档/标签跳转：从 health_archives 关联或创建高血压专项档案 */
export const ensureHypertensionStandaloneFromArchive = async (
  archive: HealthArchive
): Promise<{ participant: HypertensionStandaloneParticipant; created: boolean }> => {
  const cid = formatCheckupId(archive.checkup_id) || archive.checkup_id;
  const existing = await findHypertensionStandaloneByCheckupId(cid);
  if (existing) {
    if (!existing.linkedArchiveCheckupId) {
      const linked = { ...existing, linkedArchiveCheckupId: cid };
      await saveHypertensionStandaloneParticipant(linked);
      return { participant: linked, created: false };
    }
    return { participant: existing, created: false };
  }

  const participantKey = resolveHypertensionParticipantKey({
    checkupId: cid,
    name: archive.name,
    phone: archive.phone,
  });
  const byKey = await findHypertensionStandaloneByKey(participantKey);
  if (byKey) {
    const linked = { ...byKey, linkedArchiveCheckupId: cid, checkupId: byKey.checkupId || cid };
    await saveHypertensionStandaloneParticipant(linked);
    return { participant: linked, created: false };
  }

  const now = new Date().toISOString();
  const hr = archive.health_record;
  const hm = createEmptyHypertensionManagement();
  const screening = screeningFromHealthRecord(hr, 'archive_auto');
  if (screening) {
    hm.screenings.push(screening);
    hm.annualCheckupLinked = true;
    hm.cohortTag = inferCohortTagFromRecord(hr, screening);
  }

  const participant: HypertensionStandaloneParticipant = {
    id: `hsp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    participantKey,
    checkupId: cid,
    name: archive.name,
    gender: archive.gender,
    age: archive.age,
    phone: archive.phone,
    hypertensionManagement: hm,
    linkedArchiveCheckupId: cid,
    createdAt: now,
    updatedAt: now,
  };

  const record = toHypertensionEvaluationRecord(participant, archive);
  participant.hypertensionReport = evaluateHypertensionScreening(record);

  const saveRes = await saveHypertensionStandaloneParticipant(participant);
  if (!saveRes.success) throw new Error(saveRes.message || '创建高血压专项档案失败');
  return { participant, created: true };
};

/** 建档保存成功后自动纳入（静默，不阻断主流程） */
export const autoEnrollHypertensionIfEligible = async (archive: HealthArchive): Promise<void> => {
  if (!detectHighBloodPressureTag(archive.health_record).show) return;
  try {
    await ensureHypertensionStandaloneFromArchive(archive);
  } catch (e) {
    console.warn('[hypertensionStandalone] auto enroll failed', e);
  }
};

export const deleteHypertensionStandaloneParticipant = async (id: string) => {
  const res = await deleteHypertensionStandaloneParticipants([id]);
  return { success: res.success, message: res.message };
};

export const deleteHypertensionStandaloneParticipants = async (
  ids: string[]
): Promise<{ success: boolean; message?: string; deleted: number }> => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) {
    return { success: false, message: '未选择要删除的档案', deleted: 0 };
  }

  const idSet = new Set(unique);
  writeLocal(readLocal().filter((p) => !idSet.has(p.id)));

  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('hypertension_standalone_participants')
      .delete()
      .in('id', unique);
    if (error) return { success: false, message: error.message, deleted: 0 };
  }

  return { success: true, deleted: unique.length };
};

export type UpsertHypertensionStandaloneInput = {
  checkupId?: string;
  name?: string;
  gender?: string;
  age?: number;
  phone?: string;
  idCard?: string;
  checkupCount?: number;
  checkStatus?: string;
  activityName?: string;
  screening: import('../types').HypertensionScreeningRecord;
};

export const upsertHypertensionStandaloneFromScreening = async (
  input: UpsertHypertensionStandaloneInput
): Promise<{ participant: HypertensionStandaloneParticipant; report: HypertensionAssessmentResult }> => {
  const participantKey = resolveHypertensionParticipantKey({
    checkupId: input.checkupId,
    idCard: input.idCard,
    phone: input.phone,
    name: input.name,
  });

  const existing = await findHypertensionStandaloneByKey(participantKey);
  const now = new Date().toISOString();
  const hm = existing?.hypertensionManagement || createEmptyHypertensionManagement();

  const screenings = [...(hm.screenings || [])];
  const dupIdx = screenings.findIndex(
    (s) =>
      s.screeningDate === input.screening.screeningDate &&
      s.activityName === input.screening.activityName
  );
  if (dupIdx >= 0) {
    screenings[dupIdx] = { ...screenings[dupIdx], ...input.screening };
  } else {
    screenings.push(input.screening);
  }

  const latestScreening = screenings[screenings.length - 1] || null;
  const participant: HypertensionStandaloneParticipant = {
    id: existing?.id || `hsp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    participantKey,
    checkupId: formatCheckupId(input.checkupId || '') || input.checkupId,
    name: input.name || existing?.name || '未命名',
    gender: input.gender ?? existing?.gender,
    age: input.age ?? existing?.age,
    phone: input.phone ?? existing?.phone,
    idCard: input.idCard ?? existing?.idCard,
    checkupCount: input.checkupCount ?? existing?.checkupCount,
    checkStatus: input.checkStatus ?? existing?.checkStatus,
    activityName: input.activityName || input.screening.activityName || '社区高血压专项筛查',
    hypertensionManagement: {
      ...hm,
      screenings,
      annualCheckupLinked: false,
    },
    linkedArchiveCheckupId: existing?.linkedArchiveCheckupId ?? null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const record = toHypertensionEvaluationRecord(participant);
  participant.hypertensionManagement.cohortTag = inferCohortTagFromRecord(
    record,
    latestScreening
  );
  const report = evaluateHypertensionScreening(record);
  participant.hypertensionReport = report;

  const saveRes = await saveHypertensionStandaloneParticipant(participant);
  if (!saveRes.success) {
    throw new Error(saveRes.message || '保存失败');
  }
  return { participant, report };
};

export type BatchHypertensionReevaluateProgress = (line: string) => void;

export const batchReevaluateHypertensionStandaloneReports = async (options?: {
  ids?: string[];
  onProgress?: BatchHypertensionReevaluateProgress;
}): Promise<{ updated: number; failed: number; logs: string[] }> => {
  const list = await fetchHypertensionStandaloneParticipants();
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
      await reevaluateHypertensionStandalone(p);
      updated++;
      log(`✓ ${label}：报告已更新`);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      log(`✗ ${label}：失败 — ${msg}`);
    }
  }

  return { updated, failed, logs };
};
