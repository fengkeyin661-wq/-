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
  summary: string;
  source: 'ai' | 'rule';
  slots: AnnualPlanSlot[];
  total: number;
  byHeading: Record<PlanHeading, number>;
  archive: HealthArchive;
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

export const buildRuleAnnualPlan = (person: PersonBudget): AnnualHealthPlan => {
  const lines = applyAnnualCheckupFloor(person.lines);
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
  return {
    checkupId: person.checkupId,
    name: person.name,
    department: person.department,
    riskLabel: person.riskLabel,
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

const restoreStoredPlan = (person: PersonBudget, stored: StoredAnnualPlan): AnnualHealthPlan =>
  finalizePlan(person, stored.slots, stored.summary, 'ai');

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
      const saved = stored[archive.checkup_id];
      return saved ? restoreStoredPlan(person, saved) : buildRuleAnnualPlan(person);
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
