/**
 * 老年专项筛查 — 独立参与者存储（无需预先建档）
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { ElderlyAssessmentData, ElderlyAssessmentResult, ElderlyStandaloneParticipant, HealthRecord } from '../types';
import type { HealthArchive } from './dataService';
import { formatCheckupId } from './checkupIdUtils';
import { evaluateElderlyAssessment } from './elderlyAssessmentService';
import { createEmptyElderlyAssessment, prefillElderlyFromHealthRecord } from './elderlyAssessmentPrefillService';
import { hydrateElderlyAggregates } from './elderlyScaleScoringService';

const LOCAL_KEY = 'ELDERLY_STANDALONE_V1';

export const resolveElderlyParticipantKey = (input: {
  checkupId?: string;
  phone?: string;
  name?: string;
}): string => {
  const cid = formatCheckupId(input.checkupId || '');
  if (cid) return `eck_${cid}`;
  const phone = String(input.phone || '').replace(/\D/g, '');
  if (phone.length >= 11) return `eph_${phone}`;
  return `enm_${String(input.name || '未知').trim()}`;
};

const readLocal = (): ElderlyStandaloneParticipant[] => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeLocal = (list: ElderlyStandaloneParticipant[]) => {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
};

export const fetchElderlyStandaloneParticipants = async (): Promise<ElderlyStandaloneParticipant[]> => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('elderly_standalone_participants')
        .select('*')
        .order('updated_at', { ascending: false });
      if (!error && data) {
        const mapped = data.map((d: any) => ({
          id: d.id,
          participantKey: d.participant_key,
          checkupId: d.checkup_id,
          name: d.name,
          payload: d.payload || {},
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
        writeLocal(mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('fetch elderly standalone failed', e);
    }
  }
  return readLocal();
};

export const saveElderlyStandaloneParticipant = async (
  participant: ElderlyStandaloneParticipant,
): Promise<{ success: boolean; message?: string }> => {
  const now = new Date().toISOString();
  const row = { ...participant, updatedAt: now };
  const local = readLocal();
  const idx = local.findIndex((p) => p.id === row.id);
  if (idx >= 0) local[idx] = row;
  else local.unshift(row);
  writeLocal(local);

  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('elderly_standalone_participants').upsert({
      id: row.id,
      participant_key: row.participantKey,
      checkup_id: row.checkupId || null,
      name: row.name || null,
      payload: row.payload,
      updated_at: now,
    });
    if (error) return { success: true, message: `已存本地，云端失败：${error.message}` };
  }
  return { success: true };
};

export const deleteElderlyStandaloneParticipant = async (id: string): Promise<{ success: boolean }> => {
  writeLocal(readLocal().filter((p) => p.id !== id));
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('elderly_standalone_participants').delete().eq('id', id);
    } catch (e) {
      console.warn(e);
    }
  }
  return { success: true };
};

export const evaluateElderlyStandalone = (
  data: ElderlyAssessmentData,
): { data: ElderlyAssessmentData; result: ElderlyAssessmentResult } => {
  const hydrated = hydrateElderlyAggregates(data);
  const result = evaluateElderlyAssessment(hydrated);
  return { data: hydrated, result };
};

export const createElderlyStandaloneFromArchive = async (
  archive: HealthArchive,
): Promise<ElderlyStandaloneParticipant> => {
  const profile = archive.health_record.profile;
  const participantKey = resolveElderlyParticipantKey({
    checkupId: archive.checkup_id,
    phone: archive.phone,
    name: archive.name,
  });
  const existing = (await fetchElderlyStandaloneParticipants()).find((p) => p.participantKey === participantKey);
  if (existing) return existing;

  const data = prefillElderlyFromHealthRecord(archive.health_record, createEmptyElderlyAssessment());
  const { data: hydrated, result } = evaluateElderlyStandalone(data);
  const participant: ElderlyStandaloneParticipant = {
    id: `elderly_${Date.now()}`,
    participantKey,
    checkupId: archive.checkup_id,
    name: archive.name,
    payload: {
      ...hydrated,
      assessmentResult: result,
      profile: {
        name: profile?.name || archive.name,
        gender: profile?.gender || archive.gender,
        age: profile?.age ?? archive.age,
        department: profile?.department || archive.department,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveElderlyStandaloneParticipant(participant);
  return participant;
};

export const importElderlyStandaloneRows = async (
  rows: { name?: string; checkupId?: string; phone?: string }[],
): Promise<{ imported: number; errors: string[] }> => {
  let imported = 0;
  const errors: string[] = [];
  for (const row of rows) {
    if (!row.name && !row.checkupId) continue;
    try {
      const participantKey = resolveElderlyParticipantKey(row);
      const participant: ElderlyStandaloneParticipant = {
        id: `elderly_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        participantKey,
        checkupId: row.checkupId,
        name: row.name,
        payload: createEmptyElderlyAssessment(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveElderlyStandaloneParticipant(participant);
      imported++;
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : '导入失败');
    }
  }
  return { imported, errors };
};

export const toElderlyEvaluationRecord = (p: ElderlyStandaloneParticipant): HealthRecord => ({
  profile: {
    checkupId: p.checkupId || '',
    name: p.name || p.payload.profile?.name || '',
    gender: p.payload.profile?.gender || '',
    department: p.payload.profile?.department || '',
    age: p.payload.profile?.age,
    phone: undefined,
  },
  checkup: { basics: {}, labBasic: {}, imagingBasic: { ultrasound: {} }, optional: {}, abnormalities: [] },
  questionnaire: {
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
  },
  elderlyAssessment: p.payload,
});
