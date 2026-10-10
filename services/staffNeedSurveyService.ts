import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  NEED_SURVEY_BATCH,
  NEED_SURVEY_VERSION,
  SURVEY_REQUIRED_IDS,
  computeNeedSurveyRisk,
  doorServicePriorities,
  missingRequiredIds,
  type NeedSurveyRiskLevel,
  type SurveyAnswers,
} from './staffNeedSurveyCatalog';

const LOCAL_KEY = 'STAFF_NEED_SURVEY_SUBMISSIONS_V1';
const DRAFT_KEY = 'zzu-need-survey-draft-self';
const DEVICE_KEY = 'zzu-survey-device';
const LAST_SUBMIT_KEY = 'zzu-need-survey-last-submitted';
const PORTAL_SESSION_KEY = 'USER_PORTAL_SESSION_V1';

export type NeedSurveySubmission = {
  id: string;
  created_at: string;
  mode: 'self' | 'interview';
  checkup_id?: string | null;
  age_group?: string | null;
  family_type?: string | null;
  risk_level: NeedSurveyRiskLevel;
  service_priorities: string;
  price_value?: number | null;
  questionnaire_version: string;
  batch: string;
  followup_status: string;
  device_token?: string | null;
  data: SurveyAnswers;
};

const newId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `sns_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const readLocal = (): NeedSurveySubmission[] => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocal = (rows: NeedSurveySubmission[]) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 400)));
  } catch {
    /* ignore quota */
  }
};

export const loadNeedSurveyDraft = (): SurveyAnswers => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const saveNeedSurveyDraft = (answers: SurveyAnswers) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
  } catch {
    /* ignore */
  }
};

export const clearNeedSurveyDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
};

export const getOrCreateSurveyDeviceToken = (): string => {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing.slice(0, 80);
    const token = newId().slice(0, 80);
    localStorage.setItem(DEVICE_KEY, token);
    return token;
  } catch {
    return newId().slice(0, 80);
  }
};

export const readPortalCheckupId = (): string => {
  try {
    const raw = localStorage.getItem(PORTAL_SESSION_KEY);
    if (!raw) return '';
    const p = JSON.parse(raw) as { checkupId?: string; expiresAt?: number };
    if (!p?.checkupId) return '';
    if (typeof p.expiresAt === 'number' && p.expiresAt <= Date.now()) return '';
    return String(p.checkupId);
  } catch {
    return '';
  }
};

const toRow = (answers: SurveyAnswers, checkupId?: string): NeedSurveySubmission => {
  const deviceToken = getOrCreateSurveyDeviceToken();
  return {
    id: newId(),
    created_at: new Date().toISOString(),
    mode: 'self',
    checkup_id: checkupId || readPortalCheckupId() || null,
    age_group: String(answers.A1 || '') || null,
    family_type: String(answers.A5 || '') || null,
    risk_level: computeNeedSurveyRisk(answers),
    service_priorities: doorServicePriorities(answers).join('、'),
    price_value: Number(answers.G6b) || null,
    questionnaire_version: NEED_SURVEY_VERSION,
    batch: NEED_SURVEY_BATCH,
    followup_status: '待评估',
    device_token: deviceToken,
    data: answers,
  };
};

export const validateNeedSurveyAnswers = (answers: SurveyAnswers): string | null => {
  if (answers.consent !== '同意参加') return '未取得知情同意';
  const missing = missingRequiredIds(answers, SURVEY_REQUIRED_IDS);
  if (missing.length) return `请补充必填项目：${missing.join('、')}`;
  const fMissing = missingRequiredIds(
    answers,
    Array.from({ length: 10 }, (_, i) => `F${i + 1}_need`)
  );
  if (fMissing.length) return '请完成本上门服务每一项的需要程度';
  return null;
};

export const submitNeedSurvey = async (
  answers: SurveyAnswers,
  checkupId?: string
): Promise<{ ok: true; row: NeedSurveySubmission } | { ok: false; message: string }> => {
  const error = validateNeedSurveyAnswers(answers);
  if (error) return { ok: false, message: error };

  const local = readLocal();
  const deviceToken = getOrCreateSurveyDeviceToken();
  const recent = local.find(
    (r) => r.device_token === deviceToken && Date.now() - new Date(r.created_at).getTime() < 10 * 60 * 1000
  );
  if (recent) return { ok: false, message: '该设备刚刚提交过问卷，请勿重复提交' };

  const row = toRow(answers, checkupId);

  if (isSupabaseConfigured()) {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: prior, error: priorErr } = await supabase
      .from('staff_need_survey_submissions')
      .select('id')
      .eq('device_token', deviceToken)
      .gt('created_at', since)
      .limit(1);
    if (priorErr && /relation|does not exist|schema cache/i.test(priorErr.message || '')) {
      // table not migrated yet — fall through to local
    } else if (priorErr) {
      return { ok: false, message: priorErr.message || '提交失败，请稍后重试' };
    } else if (prior && prior.length > 0) {
      return { ok: false, message: '该设备刚刚提交过问卷，请勿重复提交' };
    } else {
      const { error: insertErr } = await supabase.from('staff_need_survey_submissions').insert(row);
      if (insertErr && !/relation|does not exist|schema cache/i.test(insertErr.message || '')) {
        return { ok: false, message: insertErr.message || '数据暂时无法保存，请稍后重试' };
      }
    }
  }

  writeLocal([row, ...local]);
  clearNeedSurveyDraft();
  try {
    localStorage.setItem(LAST_SUBMIT_KEY, row.created_at);
  } catch {
    /* ignore */
  }
  return { ok: true, row };
};

export const fetchNeedSurveySubmissions = async (): Promise<NeedSurveySubmission[]> => {
  const local = readLocal();
  if (!isSupabaseConfigured()) return local;
  const { data, error } = await supabase
    .from('staff_need_survey_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) {
    console.warn('fetchNeedSurveySubmissions', error.message);
    return local;
  }
  const remote = (data || []) as NeedSurveySubmission[];
  const map = new Map<string, NeedSurveySubmission>();
  [...remote, ...local].forEach((row) => map.set(row.id, row));
  return [...map.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
};

export const hasLocalNeedSurveySubmitted = (): boolean => {
  try {
    return !!localStorage.getItem(LAST_SUBMIT_KEY);
  } catch {
    return false;
  }
};
