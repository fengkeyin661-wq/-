import type { ElderlyAssessmentData, HealthRecord } from '../types';
import type { HealthArchive } from './dataService';
import { ELDERLY_ASSESSMENT_VERSION } from './elderlyScreeningCatalog';

const parseNum = (v?: string | number | null): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

export const createEmptyElderlyAssessment = (): ElderlyAssessmentData => ({
  meta: { version: ELDERLY_ASSESSMENT_VERSION, completedDomains: [] },
  scaleResponses: {},
  checkupMetrics: {},
  functionalStatus: {},
  emotion: {},
  nutrition: {},
  visionOrHearing: {},
  oralHealth: {},
  sleep: {},
  screenings: {},
  socialNetwork: {},
});

export const prefillElderlyFromHealthRecord = (
  record: HealthRecord,
  existing?: ElderlyAssessmentData | null,
): ElderlyAssessmentData => {
  const base = existing || createEmptyElderlyAssessment();
  const checkup = record.checkup || {};
  const basics = checkup.basics || {};
  const lab = checkup.labBasic || {};
  const mental = record.questionnaire?.mentalScales || {};

  const scaleResponses = { ...(base.scaleResponses || {}) };

  if (mental.phq9Detail?.length === 9 && !scaleResponses.phq9?.length) {
    scaleResponses.phq9 = [...mental.phq9Detail];
  }
  if (mental.gad7Detail?.length === 7 && !scaleResponses.gad7?.length) {
    scaleResponses.gad7 = [...mental.gad7Detail];
  }

  const egfr = parseNum(lab.renal?.creatinine)
    ? undefined
    : parseNum((record.riskModelExtras as { egfr?: number })?.egfr);

  return {
    ...base,
    meta: {
      ...base.meta,
      version: ELDERLY_ASSESSMENT_VERSION,
      assessedAt: base.meta?.assessedAt,
      completedDomains: base.meta?.completedDomains || [],
    },
    scaleResponses,
    ostaInput: {
      age: record.profile?.age,
      weightKg: parseNum(basics.weight),
      gender: record.profile?.gender,
    },
    checkupMetrics: {
      sbp: base.checkupMetrics.sbp ?? parseNum(basics.sbp),
      dbp: base.checkupMetrics.dbp ?? parseNum(basics.dbp),
      bmi: base.checkupMetrics.bmi ?? parseNum(basics.bmi),
      fastingGlucose: base.checkupMetrics.fastingGlucose ?? parseNum(lab.glucose?.fasting),
      ldl: base.checkupMetrics.ldl ?? parseNum(lab.lipids?.ldl),
      egfr: base.checkupMetrics.egfr ?? egfr,
      hgb: base.checkupMetrics.hgb ?? parseNum(lab.bloodRoutine?.hgb),
    },
    emotion: {
      ...base.emotion,
      depressionScore: base.emotion.depressionScore ?? mental.phq9Score,
      anxietyScore: base.emotion.anxietyScore ?? mental.gad7Score,
    },
  };
};

export const prefillElderlyFromArchive = (
  archive: HealthArchive | null | undefined,
  existing?: ElderlyAssessmentData | null,
): ElderlyAssessmentData => {
  if (!archive?.health_record) return existing || createEmptyElderlyAssessment();
  const fromRecord = prefillElderlyFromHealthRecord(archive.health_record, existing);
  if (archive.health_record.elderlyAssessment) {
    return {
      ...fromRecord,
      ...archive.health_record.elderlyAssessment,
      scaleResponses: {
        ...fromRecord.scaleResponses,
        ...archive.health_record.elderlyAssessment.scaleResponses,
      },
      checkupMetrics: {
        ...fromRecord.checkupMetrics,
        ...archive.health_record.elderlyAssessment.checkupMetrics,
      },
    };
  }
  return fromRecord;
};

export type PrefillHint = { field: string; label: string; value: string; source: string };

export const listPrefillHints = (archive: HealthArchive | null | undefined): PrefillHint[] => {
  if (!archive?.health_record) return [];
  const prefilled = prefillElderlyFromHealthRecord(archive.health_record);
  const hints: PrefillHint[] = [];
  const push = (field: string, label: string, value?: number | string, source = '体检/问卷') => {
    if (value === undefined || value === '') return;
    hints.push({ field, label, value: String(value), source });
  };
  push('sbp', '收缩压', prefilled.checkupMetrics.sbp);
  push('dbp', '舒张压', prefilled.checkupMetrics.dbp);
  push('bmi', 'BMI', prefilled.checkupMetrics.bmi);
  push('fastingGlucose', '空腹血糖', prefilled.checkupMetrics.fastingGlucose);
  push('ldl', 'LDL', prefilled.checkupMetrics.ldl);
  push('hgb', '血红蛋白', prefilled.checkupMetrics.hgb);
  if (prefilled.scaleResponses?.phq9?.length) push('phq9', 'PHQ-9', '已同步 9 项明细', '健康问卷');
  if (prefilled.scaleResponses?.gad7?.length) push('gad7', 'GAD-7', '已同步 7 项明细', '健康问卷');
  if (prefilled.ostaInput?.age) push('osta', 'OSTA', `年龄${prefilled.ostaInput.age} 体重${prefilled.ostaInput.weightKg || '-'}kg`, '档案');
  return hints;
};
