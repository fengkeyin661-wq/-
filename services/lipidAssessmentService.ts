import type {
  HealthRecord,
  LipidAssessmentResult,
  LipidIndicatorProfile,
  LipidManagementData,
  LipidScreeningRecord,
  MissedScreeningItem,
  RetestAdviceItem,
} from '../types';
import { RiskLevel } from '../types';
import { detectDyslipidemiaTag } from './lipidTagService';
import { LIPID_GUIDELINE_NOTES, getLipidLifestyleGuidance } from './lipidEducationContent';
import { buildLipidIndicatorProfile } from './lipidIndicatorProfileService';
import { LIPID_SCREENING_CATALOG, LipidCatalogItem } from './lipidScreeningCatalog';

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

export const getLatestLipidScreening = (lm: LipidManagementData | undefined): LipidScreeningRecord | null => {
  const list = lm?.screenings || [];
  if (!list.length) return null;
  return [...list].sort((a, b) =>
    (b.screeningDate || b.registrationDate || '').localeCompare(a.screeningDate || a.registrationDate || '')
  )[0];
};

export const createEmptyLipidManagement = (): LipidManagementData => ({ screenings: [] });

export const createLipidScreeningId = (): string =>
  `ls_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const isLipidCohort = (record: HealthRecord): boolean => detectDyslipidemiaTag(record).show;

const inferCohortTag = (
  record: HealthRecord,
  screening: LipidScreeningRecord | null
): LipidManagementData['cohortTag'] => {
  const tc = num(screening?.tc) ?? num(record.checkup?.labBasic?.lipids?.tc);
  const tg = num(screening?.tg) ?? num(record.checkup?.labBasic?.lipids?.tg);
  const ldl = num(screening?.ldl) ?? num(record.checkup?.labBasic?.lipids?.ldl);

  if ((ldl != null && ldl >= 4.9) || (tg != null && tg >= 5.6)) return 'very_high_risk';
  const highChol = (ldl != null && ldl >= 4.1) || (tc != null && tc >= 6.2);
  const highTg = tg != null && tg >= 2.3;
  if (highChol && highTg) return 'mixed';
  if (highChol) return 'hypercholesterolemia';
  if (highTg) return 'hypertriglyceridemia';

  const tag = detectDyslipidemiaTag(record);
  if (tag.severity === 'very_high_risk') return 'very_high_risk';
  if (tag.severity === 'mixed') return 'mixed';
  if (tag.severity === 'hypercholesterolemia') return 'hypercholesterolemia';
  if (tag.severity === 'hypertriglyceridemia') return 'hypertriglyceridemia';
  return 'borderline';
};

export const inferCohortTagFromRecord = inferCohortTag;

const isItemPresent = (
  item: LipidCatalogItem,
  screening: LipidScreeningRecord | null,
  record: HealthRecord
): boolean => {
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

const buildMissedItems = (record: HealthRecord, screening: LipidScreeningRecord | null): MissedScreeningItem[] => {
  const missed: MissedScreeningItem[] = [];
  for (const item of LIPID_SCREENING_CATALOG) {
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

const buildLipidFindings = (record: HealthRecord, screening: LipidScreeningRecord | null): string[] => {
  const findings: string[] = [];
  const tc = num(screening?.tc) ?? num(record.checkup?.labBasic?.lipids?.tc);
  const tg = num(screening?.tg) ?? num(record.checkup?.labBasic?.lipids?.tg);
  const ldl = num(screening?.ldl) ?? num(record.checkup?.labBasic?.lipids?.ldl);
  const hdl = num(screening?.hdl) ?? num(record.checkup?.labBasic?.lipids?.hdl);

  if (tc != null || tg != null || ldl != null || hdl != null) {
    findings.push(
      `血脂：TC ${tc ?? '—'} / TG ${tg ?? '—'} / LDL-C ${ldl ?? '—'} / HDL-C ${hdl ?? '—'} mmol/L`
    );
  } else {
    findings.push('暂无完整血脂四项，建议完善检测');
  }

  const tag = detectDyslipidemiaTag(record);
  if (tag.show) findings.push(...tag.reasons);

  if (tg != null && tg >= 5.6) {
    findings.push('⚠ TG≥5.6 mmol/L，急性胰腺炎风险增高，需尽快专科评估');
  }
  if (ldl != null && ldl >= 4.9) {
    findings.push('⚠ LDL-C≥4.9 mmol/L，建议强化调脂及遗传/继发性因素排查');
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

const cohortLabel = (tag?: LipidManagementData['cohortTag']): string => {
  switch (tag) {
    case 'very_high_risk':
      return '极高危血脂异常';
    case 'mixed':
      return '混合型血脂异常';
    case 'hypercholesterolemia':
      return '高胆固醇血症';
    case 'hypertriglyceridemia':
      return '高甘油三酯血症';
    default:
      return '血脂边缘升高/异常人群';
  }
};

export const evaluateLipidScreening = (record: HealthRecord): LipidAssessmentResult => {
  const lm = record.lipidManagement || { screenings: [] };
  const latest = getLatestLipidScreening(lm);
  const cohortTag = lm.cohortTag || inferCohortTag(record, latest);

  const indicatorProfile: LipidIndicatorProfile = buildLipidIndicatorProfile(record, latest, {
    linkedArchiveCheckupId: record.profile?.checkupId,
    archiveCheckupDate: record.profile?.checkupDate,
  });

  const missedItems = buildMissedItems(record, latest);
  const lipidFindings = buildLipidFindings(record, latest);
  const retestAdvice = buildRetestFromMissed(missedItems);

  const ascvdAlerts: string[] = [];
  const tg = num(latest?.tg) ?? num(record.checkup?.labBasic?.lipids?.tg);
  const ldl = num(latest?.ldl) ?? num(record.checkup?.labBasic?.lipids?.ldl);
  if (tg != null && tg >= 5.6) {
    ascvdAlerts.push('甘油三酯极高：优先降 TG 并排查继发性因素（酗酒、糖尿病、肾病等）');
  }
  if (hasText(latest?.carotidPlaque) || /斑块|狭窄/i.test(String(latest?.carotidUltrasound || ''))) {
    ascvdAlerts.push('颈动脉超声提示动脉粥样硬化，建议按 ASCVD 高危人群管理');
  }
  if (record.questionnaire?.familyHistory?.stroke || record.questionnaire?.familyHistory?.hypertension) {
    ascvdAlerts.push('合并心血管家族史，建议完善 ASCVD 总体风险评估');
  }

  let riskLevel = RiskLevel.GREEN;
  if (cohortTag === 'very_high_risk' || tg != null && tg >= 5.6) riskLevel = RiskLevel.RED;
  else if (cohortTag === 'mixed' || missedItems.filter((m) => m.priority === 'high').length > 5) {
    riskLevel = RiskLevel.RED;
  } else if (
    cohortTag === 'hypercholesterolemia' ||
    cohortTag === 'hypertriglyceridemia' ||
    missedItems.length > 8
  ) {
    riskLevel = RiskLevel.YELLOW;
  } else if (cohortTag === 'borderline') riskLevel = RiskLevel.YELLOW;

  const screeningFindings = indicatorProfile.categories.flatMap((c) =>
    c.items.filter((i) => i.status === 'present' && i.value).map((i) => `【${i.label}】${i.value}`)
  );

  const lifestyleGuidance = getLipidLifestyleGuidance(riskLevel);

  return {
    riskLevel,
    summary: `${cohortLabel(cohortTag)}专项评估：已检 ${indicatorProfile.presentCount}/${indicatorProfile.totalItems} 项，${missedItems.length} 项建议补检。${lipidFindings[0] || ''}`,
    lipidFindings,
    screeningFindings,
    ascvdAlerts,
    missedItems,
    retestAdvice,
    lifestyleGuidance,
    guidelineNotes: LIPID_GUIDELINE_NOTES,
    generatedAt: new Date().toISOString(),
    basedOnScreeningId: latest?.id,
    indicatorProfile,
  };
};

export const applyLipidScreeningToHealthRecord = (
  record: HealthRecord,
  lm: LipidManagementData
): HealthRecord => {
  const latest = getLatestLipidScreening(lm);
  if (!latest) return { ...record, lipidManagement: lm };

  let next: HealthRecord = { ...record, lipidManagement: lm };
  next.checkup = { ...next.checkup, basics: { ...next.checkup.basics } };
  next.riskModelExtras = { ...(next.riskModelExtras || {}) };
  const str = (v: unknown) => (v != null && String(v).trim() ? String(v).trim() : undefined);

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
  if (latest.homocysteine != null) {
    next.checkup.labBasic = { ...next.checkup.labBasic, homocysteine: String(latest.homocysteine) };
  }
  if (latest.alt != null || latest.ast != null) {
    const altVal = str(latest.alt);
    const astVal = str(latest.ast);
    next.checkup.labBasic = {
      ...next.checkup.labBasic,
      liver: {
        ...next.checkup.labBasic?.liver,
        ...(altVal ? { alt: altVal } : {}),
        ...(astVal ? { ast: astVal } : {}),
      },
    };
  }
  if (latest.fastingGlucose != null) {
    next.checkup.labBasic = {
      ...next.checkup.labBasic,
      glucose: { ...next.checkup.labBasic?.glucose, fasting: String(latest.fastingGlucose) },
    };
  }
  if (latest.hba1c != null) {
    next.checkup.labBasic = { ...next.checkup.labBasic, hba1c: str(latest.hba1c) };
  }
  if (latest.sbp != null) next.checkup.basics.sbp = latest.sbp;
  if (latest.dbp != null) next.checkup.basics.dbp = latest.dbp;
  if (latest.ecgResult) {
    next.checkup.imagingBasic = { ...next.checkup.imagingBasic, ecg: latest.ecgResult };
  }
  if (latest.carotidUltrasound) {
    next.checkup.optional = { ...next.checkup.optional, carotidUltrasound: latest.carotidUltrasound };
  }

  Object.assign(next.riskModelExtras, {
    ...(latest.nonHdl != null ? { nonHdl: latest.nonHdl } : {}),
    ...(latest.apoB != null ? { apoB: latest.apoB } : {}),
    ...(latest.lpa != null ? { lpa: latest.lpa } : {}),
    ...(latest.hsCrp != null ? { hsCrp: latest.hsCrp } : {}),
    ...(latest.uacr != null ? { uacr: latest.uacr } : {}),
  });

  return next;
};

export const screeningFromHealthRecord = (
  record: HealthRecord,
  source: LipidScreeningRecord['source'] = 'checkup_import'
): LipidScreeningRecord | null => {
  if (!detectDyslipidemiaTag(record).show) return null;

  return {
    id: createLipidScreeningId(),
    screeningDate: record.profile?.checkupDate || new Date().toISOString().slice(0, 10),
    activityName: source === 'archive_auto' ? '建档自动纳入' : '年度体检关联',
    source,
    tc: record.checkup?.labBasic?.lipids?.tc,
    tg: record.checkup?.labBasic?.lipids?.tg,
    ldl: record.checkup?.labBasic?.lipids?.ldl,
    hdl: record.checkup?.labBasic?.lipids?.hdl,
    fastingGlucose: num(record.checkup?.labBasic?.glucose?.fasting),
    hba1c: record.checkup?.labBasic?.hba1c ?? record.checkup?.optional?.hba1c,
    homocysteine: num(record.checkup?.labBasic?.homocysteine ?? record.checkup?.optional?.homocysteine),
    alt: record.checkup?.labBasic?.liver?.alt,
    ast: record.checkup?.labBasic?.liver?.ast,
    creatinine: record.checkup?.labBasic?.renal?.creatinine,
    uacr: record.riskModelExtras?.uacr,
    sbp: num(record.checkup?.basics?.sbp),
    dbp: num(record.checkup?.basics?.dbp),
    ecgResult: record.checkup?.imagingBasic?.ecg,
    carotidUltrasound: record.checkup?.optional?.carotidUltrasound,
    tsh: record.checkup?.labBasic?.thyroidFunction?.tsh,
    urineProtein: record.checkup?.labBasic?.urineRoutine?.protein,
    onLipidLowering: record.questionnaire?.medication?.details?.lipidLowering === true,
    apoB: record.riskModelExtras?.apoB,
    lpa: record.riskModelExtras?.lpa,
    hsCrp: record.riskModelExtras?.hsCrp,
    leftABI: num(record.checkup?.optional?.arteriosclerosis?.leftABI),
    rightABI: num(record.checkup?.optional?.arteriosclerosis?.rightABI),
  };
};
