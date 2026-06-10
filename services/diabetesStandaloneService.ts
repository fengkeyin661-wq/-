/**
 * 糖尿病专项筛查 — 独立参与者存储（不依赖 health_archives）
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  DiabetesAssessmentResult,
  DiabetesManagementData,
  DiabetesStandaloneParticipant,
  HealthRecord,
} from '../types';
import { formatCheckupId } from './checkupIdUtils';
import {
  applyScreeningToHealthRecord,
  createEmptyDiabetesManagement,
  evaluateDiabetesScreening,
} from './diabetesAssessmentService';

const LOCAL_KEY = 'DIABETES_STANDALONE_V1';

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

export const toEvaluationHealthRecord = (p: DiabetesStandaloneParticipant): HealthRecord => {
  const base: HealthRecord = {
    profile: {
      checkupId: p.checkupId || p.participantKey,
      name: p.name,
      gender: p.gender || '',
      age: p.age,
      department: '糖尿病专项筛查',
      phone: p.phone,
    },
    checkup: {
      basics: {},
      labBasic: {
        liver: {},
        lipids: {},
        renal: {},
        bloodRoutine: {},
        glucose: {},
        urineRoutine: {},
        thyroidFunction: {},
      },
      imagingBasic: { ultrasound: {} },
      optional: { tumorMarkers4: {}, tumorMarkers2: {}, rheumatoid: {} },
      abnormalities: [],
    },
    questionnaire: emptyQuestionnaire(),
    diabetesManagement: p.diabetesManagement,
  };
  return applyScreeningToHealthRecord(base, p.diabetesManagement);
};

export const resolveParticipantKey = (input: {
  checkupId?: string;
  idCard?: string;
  phone?: string;
  name?: string;
}): string => {
  const cid = formatCheckupId(input.checkupId || '');
  if (cid) return `ck_${cid}`;
  const idCard = String(input.idCard || '').replace(/\s/g, '');
  if (idCard.length >= 15) return `id_${idCard}`;
  const phone = String(input.phone || '').replace(/\D/g, '');
  if (phone.length >= 11) return `ph_${phone}`;
  const name = String(input.name || '未知').trim();
  return `nm_${name}`;
};

const readLocal = (): DiabetesStandaloneParticipant[] => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isQuotaError = (e: unknown): boolean =>
  e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);

/** 本地仅存筛查数据，完整评估报告从云端加载或按需重新生成，避免占满浏览器配额 */
const compactForLocal = (p: DiabetesStandaloneParticipant): DiabetesStandaloneParticipant => {
  const { diabetesReport: _report, ...rest } = p;
  return rest;
};

const writeLocal = (list: DiabetesStandaloneParticipant[]): void => {
  const compact = list.map(compactForLocal);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(compact));
  } catch (e) {
    if (!isQuotaError(e) || compact.length <= 1) throw e;
    const reduced = compact.slice(0, Math.max(1, Math.floor(compact.length * 0.6)));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(reduced));
  }
};

const upsertLocal = (item: DiabetesStandaloneParticipant): DiabetesStandaloneParticipant => {
  const list = readLocal();
  const idx = list.findIndex((x) => x.participantKey === item.participantKey || x.id === item.id);
  const next = idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [...list, item];
  writeLocal(next);
  return item;
};

const upsertCloud = async (item: DiabetesStandaloneParticipant): Promise<{ success: boolean; message?: string }> => {
  if (!isSupabaseConfigured()) return { success: true };
  try {
    const { error } = await supabase.from('diabetes_standalone_participants').upsert(
      {
        id: item.id,
        participant_key: item.participantKey,
        checkup_id: item.checkupId || null,
        name: item.name,
        payload: item,
        updated_at: item.updatedAt,
      },
      { onConflict: 'participant_key' }
    );
    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
};

export const fetchStandaloneParticipants = async (): Promise<DiabetesStandaloneParticipant[]> => {
  let local = readLocal();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('diabetes_standalone_participants')
        .select('payload')
        .order('updated_at', { ascending: false });
      if (!error && data?.length) {
        const cloud = data
          .map((r) => r.payload as DiabetesStandaloneParticipant)
          .filter((p) => p && p.id);
        const map = new Map<string, DiabetesStandaloneParticipant>();
        for (const p of local) map.set(p.participantKey, p);
        for (const p of cloud) {
          const existing = map.get(p.participantKey);
          if (!existing || (p.updatedAt || '') >= (existing.updatedAt || '')) {
            map.set(p.participantKey, p);
          }
        }
        local = [...map.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        try {
          writeLocal(local);
        } catch {
          /* 云端数据可用时忽略本地缓存写入失败 */
        }
      }
    } catch {
      /* 降级本地 */
    }
  }

  return local.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
};

export const findStandaloneByKey = async (
  participantKey: string
): Promise<DiabetesStandaloneParticipant | null> => {
  const list = await fetchStandaloneParticipants();
  return list.find((p) => p.participantKey === participantKey) || null;
};

export const saveStandaloneParticipant = async (
  participant: DiabetesStandaloneParticipant
): Promise<{ success: boolean; message?: string }> => {
  const item = { ...participant, updatedAt: new Date().toISOString() };
  const cloud = await upsertCloud(item);
  if (!cloud.success) {
    return { success: false, message: cloud.message || '云端保存失败' };
  }
  try {
    upsertLocal(item);
  } catch (e) {
    if (isQuotaError(e)) {
      if (isSupabaseConfigured()) {
        return {
          success: true,
          message: '已保存至云端；浏览器本地缓存空间不足，列表刷新后将从云端加载完整报告。',
        };
      }
      return {
        success: false,
        message:
          '浏览器本地存储空间已满（约 5MB）。请删除部分旧档案后重试，或配置 Supabase 云端存储。',
      };
    }
    throw e;
  }
  return { success: true };
};

export const deleteStandaloneParticipant = async (
  id: string
): Promise<{ success: boolean; message?: string }> => {
  const list = readLocal().filter((p) => p.id !== id);
  writeLocal(list);
  if (isSupabaseConfigured()) {
    await supabase.from('diabetes_standalone_participants').delete().eq('id', id);
  }
  return { success: true };
};

export type UpsertStandaloneInput = {
  checkupId?: string;
  name?: string;
  gender?: string;
  age?: number;
  phone?: string;
  idCard?: string;
  checkupCount?: number;
  checkStatus?: string;
  activityName?: string;
  screening: import('../types').DiabetesScreeningRecord;
};

export const upsertStandaloneFromScreening = async (
  input: UpsertStandaloneInput
): Promise<{ participant: DiabetesStandaloneParticipant; report: DiabetesAssessmentResult }> => {
  const participantKey = resolveParticipantKey({
    checkupId: input.checkupId,
    idCard: input.idCard,
    phone: input.phone,
    name: input.name,
  });

  const existing = await findStandaloneByKey(participantKey);
  const now = new Date().toISOString();
  const dm = existing?.diabetesManagement || createEmptyDiabetesManagement();

  const screenings = [...(dm.screenings || [])];
  const dupIdx = screenings.findIndex(
    (s) =>
      s.screeningDate === input.screening.screeningDate &&
      s.activityName === input.screening.activityName
  );
  if (dupIdx >= 0) screenings[dupIdx] = { ...screenings[dupIdx], ...input.screening };
  else screenings.push(input.screening);

  const participant: DiabetesStandaloneParticipant = {
    id: existing?.id || `dsp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    participantKey,
    checkupId: formatCheckupId(input.checkupId || '') || input.checkupId,
    name: input.name || existing?.name || '未命名',
    gender: input.gender ?? existing?.gender,
    age: input.age ?? existing?.age,
    phone: input.phone ?? existing?.phone,
    idCard: input.idCard ?? existing?.idCard,
    checkupCount: input.checkupCount ?? existing?.checkupCount,
    checkStatus: input.checkStatus ?? existing?.checkStatus,
    activityName: input.activityName || input.screening.activityName || '社区糖尿病并发症筛查',
    diabetesManagement: {
      ...dm,
      screenings,
      annualCheckupLinked: false,
    },
    linkedArchiveCheckupId: existing?.linkedArchiveCheckupId ?? null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const record = toEvaluationHealthRecord(participant);
  const report = evaluateDiabetesScreening(record);
  participant.diabetesReport = report;

  const saveRes = await saveStandaloneParticipant(participant);
  if (!saveRes.success) {
    throw new Error(saveRes.message || '保存失败');
  }
  return { participant, report };
};

export const reevaluateStandalone = async (
  participant: DiabetesStandaloneParticipant
): Promise<DiabetesAssessmentResult> => {
  const record = toEvaluationHealthRecord(participant);
  const report = evaluateDiabetesScreening(record);
  await saveStandaloneParticipant({ ...participant, diabetesReport: report });
  return report;
};
