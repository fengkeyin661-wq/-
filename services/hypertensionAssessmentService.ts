import type {
  HealthRecord,
  HypertensionAssessmentResult,
  HypertensionIndicatorProfile,
  HypertensionManagementData,
  HypertensionScreeningRecord,
  MissedScreeningItem,
  RetestAdviceItem,
} from '../types';
import { RiskLevel } from '../types';
import { detectHighBloodPressureTag } from './bloodPressureTagService';
import {
  CHECKUP_ONLY_VITAL_ITEM_IDS,
  getLatestCheckupBloodPressure,
} from './latestCheckupVitalsService';
import {
  HYPERTENSION_GUIDELINE_NOTES,
  getHypertensionLifestyleGuidance,
} from './hypertensionEducationContent';
import { buildHypertensionIndicatorProfile } from './hypertensionIndicatorProfileService';
import {
  HYPERTENSION_SCREENING_CATALOG,
  HypertensionCatalogItem,
} from './hypertensionScreeningCatalog';

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
};

const hasText = (v: unknown): boolean =>
  v != null && String(v).trim().length > 0 && !/^(未查|无|正常|-+|—)$/i.test(String(v).trim());

const getByPath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce((acc: unknown, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);

export const getLatestHypertensionScreening = (
  hm: HypertensionManagementData | undefined
): HypertensionScreeningRecord | null => {
  const list = hm?.screenings || [];
  if (!list.length) return null;
  return [...list].sort((a, b) =>
    (b.screeningDate || b.registrationDate || '').localeCompare(a.screeningDate || a.registrationDate || '')
  )[0];
};

export const createEmptyHypertensionManagement = (): HypertensionManagementData => ({
  screenings: [],
});

export const createHypertensionScreeningId = (): string =>
  `hs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** 血压分层仅依据最近一次体检 checkup，不合并专项筛查诊室血压 */
const inferCohortTag = (record: HealthRecord): HypertensionManagementData['cohortTag'] | undefined => {
  const tag = detectHighBloodPressureTag(record);
  if (!tag.show) return undefined;
  if (tag.severity === 'crisis') return 'crisis';
  if (tag.severity === 'stage2') return 'stage2';
  if (tag.severity === 'stage1') return 'stage1';
  return 'stage1';
};

export const inferCohortTagFromRecord = (
  record: HealthRecord,
  _screening?: HypertensionScreeningRecord | null
): HypertensionManagementData['cohortTag'] | undefined => inferCohortTag(record);

const isItemPresent = (
  item: HypertensionCatalogItem,
  screening: HypertensionScreeningRecord | null,
  record: HealthRecord
): boolean => {
  if (CHECKUP_ONLY_VITAL_ITEM_IDS.has(item.id)) {
    return item.checkupPaths?.some((p) => hasText(getByPath(record, p))) ?? false;
  }
  if (item.screeningFields?.length && screening) {
    const ok = item.screeningFields.some((f) => {
      const v = screening[f];
      if (typeof v === 'number') return Number.isFinite(v);
      return hasText(v);
    });
    if (ok) return true;
  }
  if (item.checkupPaths?.length) {
    return item.checkupPaths.some((p) => hasText(getByPath(record, p)));
  }
  return false;
};

const buildMissedItems = (record: HealthRecord, screening: HypertensionScreeningRecord | null): MissedScreeningItem[] => {
  const missed: MissedScreeningItem[] = [];
  for (const item of HYPERTENSION_SCREENING_CATALOG) {
    if (isItemPresent(item, screening, record)) continue;
    missed.push({
      itemId: item.id,
      label: item.label,
      priority: item.priority,
      clinicalMeaning: item.clinicalMeaning,
      recommendedCycle: item.retestCycle,
    });
  }
  return missed.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
};

const buildBpFindings = (record: HealthRecord, screening: HypertensionScreeningRecord | null): string[] => {
  const findings: string[] = [];
  const bp = getLatestCheckupBloodPressure(record);
  const { sbp, dbp } = bp;
  if (sbp != null || dbp != null) {
    findings.push(`诊室血压（最近一次体检） ${sbp ?? '—'}/${dbp ?? '—'} mmHg`);
    const tag = detectHighBloodPressureTag(record);
    if (tag.show) findings.push(...tag.reasons);
  } else {
    findings.push('暂无诊室血压记录，建议补测');
  }
  if (hasText(screening?.abpmSummary)) {
    findings.push(`动态血压：${screening!.abpmSummary}`);
  }
  return findings;
};

const buildRetestFromMissed = (missed: MissedScreeningItem[]): RetestAdviceItem[] =>
  missed
    .filter((m) => m.priority === 'high' || m.priority === 'medium')
    .slice(0, 12)
    .map((m) => ({
      itemId: m.itemId,
      label: m.label,
      currentFinding: '尚未检测或档案中无记录',
      advice: `建议完善${m.label}（${m.recommendedCycle}）`,
      urgency: m.priority === 'high' ? ('soon' as const) : ('routine' as const),
    }));

const cohortLabel = (tag?: HypertensionManagementData['cohortTag']): string => {
  switch (tag) {
    case 'crisis':
      return '高血压危象/极高危';
    case 'stage2':
      return '2级高血压';
    case 'stage1':
      return '1级高血压';
    default:
      return '血压偏高人群';
  }
};

export const evaluateHypertensionScreening = (record: HealthRecord): HypertensionAssessmentResult => {
  const hm = record.hypertensionManagement || { screenings: [] };
  const latest = getLatestHypertensionScreening(hm);
  const cohortTag = hm.cohortTag || inferCohortTag(record);

  const indicatorProfile: HypertensionIndicatorProfile = buildHypertensionIndicatorProfile(record, latest, {
    linkedArchiveCheckupId: record.profile?.checkupId,
    archiveCheckupDate: record.profile?.checkupDate,
  });

  const missedItems = buildMissedItems(record, latest);
  const bpFindings = buildBpFindings(record, latest);
  const retestAdvice = buildRetestFromMissed(missedItems);

  const targetOrganAlerts: string[] = [];
  if (hasText(latest?.fundusResult) && /III|IV|出血|渗出|视乳头/i.test(String(latest!.fundusResult))) {
    targetOrganAlerts.push('眼底检查提示高血压视网膜病变可能，建议眼科专科评估');
  }
  if (hasText(latest?.brainCtResult) && /梗死|出血|腔隙/i.test(String(latest!.brainCtResult))) {
    targetOrganAlerts.push('颅脑CT提示脑血管病变，建议神经内科随访');
  }
  if (num(latest?.uacr) != null && num(latest!.uacr)! >= 30) {
    targetOrganAlerts.push('尿微量白蛋白升高，提示高血压肾损害风险');
  }

  let riskLevel = RiskLevel.GREEN;
  if (cohortTag === 'crisis' || targetOrganAlerts.length >= 2) riskLevel = RiskLevel.RED;
  else if (cohortTag === 'stage2' || missedItems.filter((m) => m.priority === 'high').length > 5) {
    riskLevel = RiskLevel.RED;
  } else if (cohortTag === 'stage1' || missedItems.length > 8) riskLevel = RiskLevel.YELLOW;

  const screeningFindings = indicatorProfile.categories.flatMap((c) =>
    c.items
      .filter((i) => i.status === 'present' && i.value)
      .map((i) => `【${i.label}】${i.value}`)
  );

  const lifestyleGuidance = getHypertensionLifestyleGuidance(riskLevel);

  return {
    riskLevel,
    summary: `${cohortLabel(cohortTag)}专项评估：已检 ${indicatorProfile.presentCount}/${indicatorProfile.totalItems} 项，${missedItems.length} 项建议补检。${bpFindings[0] || ''}`,
    bpFindings,
    screeningFindings,
    missedItems,
    retestAdvice,
    lifestyleGuidance,
    targetOrganAlerts,
    guidelineNotes: HYPERTENSION_GUIDELINE_NOTES,
    generatedAt: new Date().toISOString(),
    basedOnScreeningId: latest?.id,
    indicatorProfile,
  };
};

export const applyHypertensionScreeningToHealthRecord = (
  record: HealthRecord,
  hm: HypertensionManagementData
): HealthRecord => {
  const latest = getLatestHypertensionScreening(hm);
  if (!latest) return { ...record, hypertensionManagement: hm };

  let next: HealthRecord = { ...record, hypertensionManagement: hm };
  next.checkup = { ...next.checkup, basics: { ...next.checkup.basics } };
  next.riskModelExtras = { ...(next.riskModelExtras || {}) };

  const str = (v: unknown) => (v != null && String(v).trim() ? String(v).trim() : undefined);

  if (latest.sbp != null) next.checkup.basics.sbp = latest.sbp;
  if (latest.dbp != null) next.checkup.basics.dbp = latest.dbp;

  if (latest.fastingGlucose != null) {
    next.checkup.labBasic = {
      ...next.checkup.labBasic,
      glucose: { ...next.checkup.labBasic?.glucose, fasting: String(latest.fastingGlucose) },
    };
  }
  if (latest.hba1c != null) {
    next.checkup.labBasic = { ...next.checkup.labBasic, hba1c: str(latest.hba1c) };
  }
  if (latest.homocysteine != null) {
    next.checkup.labBasic = { ...next.checkup.labBasic, homocysteine: String(latest.homocysteine) };
  }
  if (latest.creatinine != null || latest.urea != null) {
    next.checkup.labBasic = {
      ...next.checkup.labBasic,
      renal: {
        ...next.checkup.labBasic?.renal,
        creatinine: str(latest.creatinine) ?? next.checkup.labBasic?.renal?.creatinine,
        urea: str(latest.urea) ?? next.checkup.labBasic?.renal?.urea,
      },
    };
  }
  if (latest.tc != null || latest.ldl != null) {
    next.checkup.labBasic = {
      ...next.checkup.labBasic,
      lipids: {
        ...next.checkup.labBasic?.lipids,
        tc: str(latest.tc) ?? next.checkup.labBasic?.lipids?.tc,
        tg: str(latest.tg) ?? next.checkup.labBasic?.lipids?.tg,
        ldl: str(latest.ldl) ?? next.checkup.labBasic?.lipids?.ldl,
        hdl: str(latest.hdl) ?? next.checkup.labBasic?.lipids?.hdl,
      },
    };
  }
  if (latest.ecgResult) {
    next.checkup.imagingBasic = { ...next.checkup.imagingBasic, ecg: latest.ecgResult };
  }
  if (latest.carotidUltrasound) {
    next.checkup.optional = { ...next.checkup.optional, carotidUltrasound: latest.carotidUltrasound };
  }
  if (latest.fundusResult) {
    next.checkup.optional = { ...next.checkup.optional, fundusPhoto: latest.fundusResult };
  }
  if (latest.echoResult) {
    next.checkup.optional = { ...next.checkup.optional, heartUltrasound: latest.echoResult };
  }
  if (latest.brainCtResult) {
    next.checkup.optional = { ...next.checkup.optional, ct: latest.brainCtResult };
  }

  Object.assign(next.riskModelExtras, {
    ...(latest.uacr != null ? { uacr: latest.uacr } : {}),
    ...(latest.abpmSummary ? { abpmSummary: latest.abpmSummary } : {}),
    ...(latest.holterResult ? { holterResult: latest.holterResult } : {}),
    ...(latest.potassium != null ? { potassium: latest.potassium } : {}),
    ...(latest.renin != null ? { renin: latest.renin } : {}),
    ...(latest.angiotensin != null ? { angiotensin: latest.angiotensin } : {}),
    ...(latest.aldosterone != null ? { aldosterone: latest.aldosterone } : {}),
  });

  return next;
};

export const screeningFromHealthRecord = (record: HealthRecord, source: HypertensionScreeningRecord['source'] = 'checkup_import'): HypertensionScreeningRecord | null => {
  const sbp = num(record.checkup?.basics?.sbp);
  const dbp = num(record.checkup?.basics?.dbp);
  if (sbp == null && dbp == null && !detectHighBloodPressureTag(record).show) return null;

  return {
    id: createHypertensionScreeningId(),
    screeningDate: record.profile?.checkupDate || new Date().toISOString().slice(0, 10),
    activityName: source === 'archive_auto' ? '建档自动纳入' : '年度体检关联',
    source,
    sbp,
    dbp,
    fastingGlucose: num(record.checkup?.labBasic?.glucose?.fasting),
    hba1c: record.checkup?.labBasic?.hba1c ?? record.checkup?.optional?.hba1c,
    homocysteine: num(record.checkup?.labBasic?.homocysteine ?? record.checkup?.optional?.homocysteine),
    creatinine: record.checkup?.labBasic?.renal?.creatinine,
    urea: record.checkup?.labBasic?.renal?.urea,
    uacr: record.riskModelExtras?.uacr,
    urineProtein: record.checkup?.labBasic?.urineRoutine?.protein,
    tc: record.checkup?.labBasic?.lipids?.tc,
    tg: record.checkup?.labBasic?.lipids?.tg,
    ldl: record.checkup?.labBasic?.lipids?.ldl,
    hdl: record.checkup?.labBasic?.lipids?.hdl,
    ecgResult: record.checkup?.imagingBasic?.ecg,
    carotidUltrasound: record.checkup?.optional?.carotidUltrasound,
    echoResult: record.checkup?.optional?.heartUltrasound,
    fundusResult: record.checkup?.optional?.fundusPhoto,
    brainCtResult: record.checkup?.optional?.ct,
    holterResult: record.riskModelExtras?.holterResult,
    abpmSummary: record.riskModelExtras?.abpmSummary,
    potassium: record.riskModelExtras?.potassium,
    renin: record.riskModelExtras?.renin,
    angiotensin: record.riskModelExtras?.angiotensin,
    aldosterone: record.riskModelExtras?.aldosterone,
  };
};
