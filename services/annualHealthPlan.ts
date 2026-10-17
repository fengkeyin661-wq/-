import type { HealthArchive } from './dataService';
import type { AnnualPlanScheduleHint } from './geminiService';
import {
  applyAnnualCheckupFloor,
  buildHealthBudget,
  type BudgetLine,
  type PersonBudget,
} from './healthBudget';
import type { HealthObservationRow } from './observationService';

export type PlanHeading = 'checkup' | 'monitor' | 'education' | 'depth';

export const PLAN_HEADING_LABEL: Record<PlanHeading, string> = {
  checkup: '年度健康体检',
  monitor: '风险指标定期监测',
  education: '健康风险专项健康教育',
  depth: '风险进一步深度评估',
};

const CHECKUP_CODES = new Set([
  '012408000030000',
  '250302001',
  '250303001',
  '250303002',
  '250303004',
  '250303005',
  '250307005',
  '250305007',
  '250305008',
  '012302030010000',
]);

const DEPTH_CODES = new Set(['012301020010000', '220302003', '220301002']);

export type AnnualPlanSlot = {
  code: string;
  name: string;
  unit: string;
  price: number;
  month: number;
  heading: PlanHeading;
  note: string;
};

export type AnnualHealthPlan = {
  checkupId: string;
  name: string;
  department: string;
  riskLabel: string;
  age: number | null;
  ageBand: string;
  summary: string;
  source: 'ai' | 'rule';
  slots: AnnualPlanSlot[];
  total: number;
  byHeading: Record<PlanHeading, number>;
  archive: HealthArchive;
};

export const AGE_BANDS = ['不足40岁', '40–49岁', '50–59岁', '60–69岁', '70岁及以上', '年龄不详'] as const;

const personAge = (archive: HealthArchive): number | null => {
  const value = Number(archive.age ?? archive.health_record?.profile?.age);
  return Number.isFinite(value) && value >= 1 && value < 120 ? Math.round(value) : null;
};

const genderText = (archive: HealthArchive) =>
  `${archive.gender || ''}${archive.health_record?.profile?.gender || ''}`;

const isFemale = (archive: HealthArchive): boolean => /女/.test(genderText(archive));

const isMale = (archive: HealthArchive): boolean => /男/.test(genderText(archive)) && !isFemale(archive);

export const ageBandOf = (age: number | null): string => {
  if (age == null) return '年龄不详';
  if (age < 40) return '不足40岁';
  if (age < 50) return '40–49岁';
  if (age < 60) return '50–59岁';
  if (age < 70) return '60–69岁';
  return '70岁及以上';
};

const money = (value: number) => Math.round(value * 100) / 100;

const examMonth = (archive: HealthArchive): number => {
  const raw = archive.health_record?.profile?.checkupDate || '';
  const match = raw.match(/-(\d{2})-/);
  const month = match ? Number(match[1]) : 3;
  return month >= 1 && month <= 12 ? month : 3;
};

const spreadMonths = (count: number, start: number): number[] => {
  if (count <= 0) return [];
  const months: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const step = count === 1 ? 0 : Math.round((i * 11) / (count - 1));
    months.push(((start - 1 + step) % 12) + 1);
  }
  return months;
};

const headingFor = (line: BudgetLine, index: number): PlanHeading => {
  if (line.category === 'education' || line.code === '140100006') return 'education';
  if (line.code === '130900001') return 'monitor';
  if (DEPTH_CODES.has(line.code)) return 'depth';
  if (CHECKUP_CODES.has(line.code) && index === 0) return 'checkup';
  if (line.category === 'further') return 'depth';
  return 'monitor';
};

const defaultMonth = (heading: PlanHeading, index: number, count: number, anchor: number): number => {
  if (heading === 'checkup') return anchor;
  if (heading === 'depth') return ((anchor + 5) % 12) + 1;
  return spreadMonths(count, heading === 'education' ? anchor + 1 : anchor + 2)[index] || anchor;
};

const INTERVAL_ITEMS = {
  bodyComp: { code: '311300013', name: '人体脂肪成分分析', unit: '次', price: 40, category: 'recheck' as const },
  ldct: { code: '012301020010000', name: '低剂量胸部CT', unit: '部位', price: 195, category: 'further' as const },
  fundus: { code: '310300058', name: '眼底照相', unit: '次', price: 22, category: 'further' as const },
  bone: { code: '012415000010000', name: '骨密度测定费', unit: '次', price: 110, category: 'further' as const },
  fobt: { code: '2501030020', name: '粪便隐血试验', unit: '项', price: 2, category: 'recheck' as const },
  gastroscopy: { code: '310902005', name: '纤维胃十二指肠镜检查', unit: '次', price: 150, category: 'further' as const },
  psa: { code: '250404005', name: '总前列腺特异性抗原测定', unit: '项', price: 17.6, category: 'recheck' as const },
  cervix: { code: '311201067', name: '宫颈癌筛查', unit: '次', price: 200, category: 'further' as const },
  breastUs: { code: '220301002', name: '乳腺超声筛查', unit: '每个部位', price: 60, category: 'further' as const },
  mammo: { code: '210102014', name: '乳腺钼靶摄片', unit: '双侧', price: 80, category: 'further' as const },
  hbsag: { code: '250403004', name: '乙型肝炎表面抗原测定', unit: '项', price: 5, category: 'recheck' as const },
  creatinine: { code: '250307002', name: '肌酐测定', unit: '项', price: 14, category: 'recheck' as const },
  afp: { code: '250404002', name: '甲胎蛋白测定', unit: '项', price: 14.7, category: 'recheck' as const },
};

const hasLine = (lines: BudgetLine[], code: string) => lines.some((line) => line.code === code);

const hasReason = (lines: BudgetLine[], text: string) => lines.some((line) => line.reason.includes(text));

const liverRiskText = (person: PersonBudget): boolean => {
  const risks = person.archive.assessment_data?.risks;
  const abnormalities = (person.archive.health_record?.checkup?.abnormalities || [])
    .map((item) => `${item.item || ''}${item.result || ''}`)
    .join(' ');
  return /乙肝|乙型肝炎|HBsAg|表面抗原阳性|肝硬化|丙肝/.test(
    `${(risks?.red || []).join(' ')} ${(risks?.yellow || []).join(' ')} ${abnormalities}`
  );
};

const annualLine = (
  item: (typeof INTERVAL_ITEMS)[keyof typeof INTERVAL_ITEMS],
  reason: string
): BudgetLine => ({
  ...item,
  times: 1,
  amount: item.price,
  reason,
});

/** 多年才做一次的项目，只把限价分摊进本年预算 */
const shareLine = (item: (typeof INTERVAL_ITEMS)[keyof typeof INTERVAL_ITEMS], everyYears: number, reason: string): BudgetLine => {
  const share = money(item.price / everyYears);
  return {
    code: item.code,
    name: item.name,
    unit: item.unit,
    price: share,
    times: 1,
    amount: share,
    category: item.category,
    reason: `${reason}。目录限价 ${item.price} 元，每 ${everyYears} 年 1 次，本年分摊 ${share} 元`,
  };
};

const intervalLines = (person: PersonBudget, lines: BudgetLine[]): BudgetLine[] => {
  const extra: BudgetLine[] = [];
  const age = personAge(person.archive);
  const female = isFemale(person.archive);
  const male = isMale(person.archive);
  if (hasReason(lines, '超重、肥胖或脂肪肝')) {
    extra.push({
      ...INTERVAL_ITEMS.bodyComp,
      times: 1,
      amount: INTERVAL_ITEMS.bodyComp.price,
      reason: '超重、肥胖或脂肪肝，每年 1 次人体成分分析',
    });
  }
  if (!hasLine(lines, INTERVAL_ITEMS.ldct.code) && age != null && age <= 74) {
    if (age >= 50) extra.push(shareLine(INTERVAL_ITEMS.ldct, 3, '50–74岁、尚无肺结节'));
    else if (age >= 40) extra.push(shareLine(INTERVAL_ITEMS.ldct, 5, '40–49岁、尚无肺结节'));
  }
  if (hasReason(lines, '糖尿病范围')) {
    extra.push({
      ...INTERVAL_ITEMS.fundus,
      times: 1,
      amount: INTERVAL_ITEMS.fundus.price,
      reason: '糖尿病范围，每年 1 次眼底照相',
    });
  } else if (age != null && age >= 40) {
    extra.push(shareLine(INTERVAL_ITEMS.fundus, age >= 60 ? 2 : 3, age >= 60 ? '60岁及以上' : '40–59岁'));
  }
  if (age != null) {
    if ((female && age >= 65) || (male && age >= 70)) {
      extra.push(shareLine(INTERVAL_ITEMS.bone, 2, female ? '女性65岁及以上' : '男性70岁及以上'));
    } else if (female && age >= 50) {
      extra.push(shareLine(INTERVAL_ITEMS.bone, 5, '女性50–64岁'));
    }
  }
  if (age != null && age >= 50 && age <= 74) {
    extra.push(annualLine(INTERVAL_ITEMS.fobt, '50–74岁结直肠癌筛查，每年 1 次粪便隐血'));
  }
  if (age != null && age >= 40 && age <= 69) {
    extra.push(shareLine(INTERVAL_ITEMS.gastroscopy, 5, '河南食管癌、胃癌相对高发，40–69岁'));
  }
  if (male && age != null && age >= 50 && age <= 74) {
    extra.push(shareLine(INTERVAL_ITEMS.psa, 2, '男性50–74岁前列腺癌筛查'));
  }
  if (female && age != null && age >= 35 && age <= 64) {
    extra.push(shareLine(INTERVAL_ITEMS.cervix, 3, '女性35–64岁宫颈癌筛查'));
  }
  const breastFollowUp = lines.some((line) => line.code === INTERVAL_ITEMS.breastUs.code && line.reason.includes('乳腺'));
  if (female && age != null && age >= 40 && age <= 69 && !breastFollowUp) {
    extra.push(shareLine(INTERVAL_ITEMS.breastUs, 2, '女性40–69岁乳腺癌超声筛查'));
  }
  if (female && age != null && age >= 45 && age <= 69) {
    extra.push(shareLine(INTERVAL_ITEMS.mammo, 2, '女性45–69岁乳腺钼靶，按双侧两张计'));
  }
  extra.push(shareLine(INTERVAL_ITEMS.hbsag, 5, '成年人乙肝筛查'));
  if (hasReason(lines, '糖尿病范围') || (age != null && age >= 60)) {
    extra.push(annualLine(INTERVAL_ITEMS.creatinine, age != null && age >= 60 ? '60岁及以上或糖尿病，每年 1 次肌酐' : '糖尿病范围，每年 1 次肌酐'));
  }
  if (liverRiskText(person)) {
    extra.push(annualLine(INTERVAL_ITEMS.afp, '乙肝、丙肝或肝硬化线索，每年 1 次甲胎蛋白'));
  }
  return extra;
};

export const buildRuleAnnualPlan = (person: PersonBudget): AnnualHealthPlan => {
  const lines = [...applyAnnualCheckupFloor(person.lines), ...intervalLines(person, person.lines)];
  const anchor = examMonth(person.archive);
  const slots: AnnualPlanSlot[] = [];
  lines.forEach((line) => {
    for (let index = 0; index < line.times; index += 1) {
      const heading = headingFor(line, index);
      slots.push({
        code: line.code,
        name: line.name,
        unit: line.unit,
        price: line.price,
        month: defaultMonth(heading, index, line.times, anchor),
        heading,
        note: index === 0 ? line.reason : line.reason,
      });
    }
  });
  slots.sort((a, b) => a.month - b.month || a.heading.localeCompare(b.heading));
  return finalizePlan(person, slots, '按常规频次排入一年，尚未经模型调整月份。', 'rule');
};

const finalizePlan = (
  person: PersonBudget,
  slots: AnnualPlanSlot[],
  summary: string,
  source: 'ai' | 'rule'
): AnnualHealthPlan => {
  const byHeading: Record<PlanHeading, number> = { checkup: 0, monitor: 0, education: 0, depth: 0 };
  slots.forEach((slot) => {
    byHeading[slot.heading] = money(byHeading[slot.heading] + slot.price);
  });
  const age = personAge(person.archive);
  return {
    checkupId: person.checkupId,
    name: person.name,
    department: person.department,
    riskLabel: person.riskLabel,
    age,
    ageBand: ageBandOf(age),
    summary,
    source,
    slots,
    total: money(slots.reduce((sum, slot) => sum + slot.price, 0)),
    byHeading,
    archive: person.archive,
  };
};

export const applyScheduleHints = (plan: AnnualHealthPlan, hints: AnnualPlanScheduleHint[], summary: string): AnnualHealthPlan => {
  const pool = new Map<string, AnnualPlanScheduleHint[]>();
  hints.forEach((hint) => {
    const list = pool.get(hint.code) || [];
    list.push(hint);
    pool.set(hint.code, list);
  });
  const slots = plan.slots.map((slot) => {
    const list = pool.get(slot.code);
    const hint = list?.shift();
    if (!hint) return slot;
    return { ...slot, month: hint.month, note: hint.note || slot.note };
  });
  slots.sort((a, b) => a.month - b.month || a.name.localeCompare(b.name, 'zh'));
  return finalizePlan(
    {
      checkupId: plan.checkupId,
      name: plan.name,
      department: plan.department,
      riskLabel: plan.riskLabel,
      lines: [],
      total: 0,
      archive: plan.archive,
    },
    slots,
    summary || plan.summary,
    'ai'
  );
};

export const personBudgetById = (archives: HealthArchive[], observations: HealthObservationRow[]) => {
  const budget = buildHealthBudget(archives, observations);
  return new Map(budget.people.map((person) => [person.checkupId, person]));
};

export const riskLinesForPlan = (archive: HealthArchive): string[] => {
  const risks = archive.assessment_data?.risks;
  return [...(risks?.red || []), ...(risks?.yellow || [])].slice(0, 8);
};

const PLAN_STORAGE_KEY = 'HEALTH_ANNUAL_PLANS_V1';

type StoredAnnualPlan = {
  summary: string;
  slots: AnnualPlanSlot[];
  savedAt: string;
};

const readStoredPlans = (): Record<string, StoredAnnualPlan> => {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredAnnualPlan>) : {};
  } catch {
    return {};
  }
};

export const saveAnnualPlan = (plan: AnnualHealthPlan) => {
  const all = readStoredPlans();
  all[plan.checkupId] = {
    summary: plan.summary,
    slots: plan.slots,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(all));
};

const mergeSavedSchedule = (rule: AnnualHealthPlan, stored: StoredAnnualPlan): AnnualHealthPlan => {
  const pool = new Map<string, AnnualPlanSlot[]>();
  stored.slots.forEach((slot) => {
    const list = pool.get(slot.code) || [];
    list.push(slot);
    pool.set(slot.code, list);
  });
  const slots = rule.slots.map((slot) => {
    const hint = pool.get(slot.code)?.shift();
    if (!hint) return slot;
    return {
      ...slot,
      month: hint.month,
      note: slot.note.includes('本年分摊') ? slot.note : hint.note || slot.note,
    };
  });
  slots.sort((a, b) => a.month - b.month || a.name.localeCompare(b.name, 'zh'));
  return finalizePlan(
    {
      checkupId: rule.checkupId,
      name: rule.name,
      department: rule.department,
      riskLabel: rule.riskLabel,
      lines: [],
      total: 0,
      archive: rule.archive,
    },
    slots,
    stored.summary || rule.summary,
    'ai'
  );
};

export const buildDisplayedPlans = (
  archives: HealthArchive[],
  observations: HealthObservationRow[]
): AnnualHealthPlan[] => {
  const people = personBudgetById(archives, observations);
  const stored = readStoredPlans();
  return archives
    .map((archive) => {
      const person = people.get(archive.checkup_id);
      if (!person) return null;
      const rule = buildRuleAnnualPlan(person);
      const saved = stored[archive.checkup_id];
      return saved ? mergeSavedSchedule(rule, saved) : rule;
    })
    .filter((plan): plan is AnnualHealthPlan => Boolean(plan))
    .sort((a, b) => Number(b.source === 'ai') - Number(a.source === 'ai') || b.total - a.total);
};

export const summarizeAnnualPlans = (plans: AnnualHealthPlan[]) => {
  const byHeading: Record<PlanHeading, number> = { checkup: 0, monitor: 0, education: 0, depth: 0 };
  let total = 0;
  let drafted = 0;
  plans.forEach((plan) => {
    total = money(total + plan.total);
    if (plan.source === 'ai') drafted += 1;
    (Object.keys(byHeading) as PlanHeading[]).forEach((heading) => {
      byHeading[heading] = money(byHeading[heading] + plan.byHeading[heading]);
    });
  });
  return {
    headcount: plans.length,
    drafted,
    pending: plans.length - drafted,
    total,
    average: plans.length ? money(total / plans.length) : 0,
    byHeading,
  };
};

export type AgeBandSummary = {
  band: string;
  headcount: number;
  total: number;
  average: number;
  byHeading: Record<PlanHeading, number>;
};

export const summarizeByAgeBand = (plans: AnnualHealthPlan[]): AgeBandSummary[] =>
  AGE_BANDS.map((band) => {
    const group = plans.filter((plan) => plan.ageBand === band);
    const byHeading: Record<PlanHeading, number> = { checkup: 0, monitor: 0, education: 0, depth: 0 };
    let total = 0;
    group.forEach((plan) => {
      total = money(total + plan.total);
      (Object.keys(byHeading) as PlanHeading[]).forEach((heading) => {
        byHeading[heading] = money(byHeading[heading] + plan.byHeading[heading]);
      });
    });
    return {
      band,
      headcount: group.length,
      total,
      average: group.length ? money(total / group.length) : 0,
      byHeading,
    };
  }).filter((row) => row.headcount > 0);

export const scheduleInputFromPlan = (plan: AnnualHealthPlan) => {
  const grouped = new Map<string, { code: string; name: string; times: number; reason: string }>();
  plan.slots.forEach((slot) => {
    const current = grouped.get(slot.code);
    if (!current) {
      grouped.set(slot.code, { code: slot.code, name: slot.name, times: 1, reason: slot.note });
      return;
    }
    current.times += 1;
  });
  return [...grouped.values()];
};
