import type { HealthArchive } from './dataService';
import { BOARD_METRIC_CODES, buildCampusHealthBoard, listDepartments } from './campusHealthBoard';
import { fetchBoardObservations, type HealthObservationRow } from './observationService';

export const EDUCATION_CLASS_SIZE = 30;

export type BudgetCategory = 'recheck' | 'further' | 'followup' | 'education';

export const BUDGET_CATEGORY_LABEL: Record<BudgetCategory, string> = {
  recheck: '复查检验',
  further: '进一步检查',
  followup: '随访咨询',
  education: '健康教育',
};

type CatalogItem = {
  code: string;
  name: string;
  unit: string;
  price: number;
  category: BudgetCategory;
};

/** 河南省服务项目目录 20261015，一档（省非三甲医疗机构）最高限额 */
const CATALOG = {
  education: { code: '130900002', name: '疾病健康教育', unit: '人次', price: 2, category: 'education' },
  consult: { code: '130900001', name: '健康咨询', unit: '次', price: 5, category: 'followup' },
  glucose: { code: '250302001', name: '葡萄糖测定', unit: '次', price: 8, category: 'recheck' },
  hba1c: { code: '250302003', name: '糖化血红蛋白测定', unit: '项', price: 22.5, category: 'recheck' },
  tc: { code: '250303001', name: '血清总胆固醇测定', unit: '项', price: 6, category: 'recheck' },
  tg: { code: '250303002', name: '血清甘油三酯测定', unit: '项', price: 6, category: 'recheck' },
  hdl: { code: '250303004', name: '血清高密度脂蛋白胆固醇测定', unit: '项', price: 10, category: 'recheck' },
  ldl: { code: '250303005', name: '血清低密度脂蛋白胆固醇测定', unit: '项', price: 9.9, category: 'recheck' },
  ua: { code: '250307005', name: '血清尿酸测定', unit: '项', price: 6.9, category: 'recheck' },
  nutrition: { code: '140100006', name: '营养状况评估与咨询', unit: '半小时', price: 20, category: 'followup' },
  alt: { code: '250305007', name: '血清丙氨酸氨基转移酶测定', unit: '项', price: 6, category: 'recheck' },
  ast: { code: '250305008', name: '血清天门冬氨酸氨基转移酶测定', unit: '项', price: 6, category: 'recheck' },
  abdomenUs: { code: '012302030010000', name: '彩色多普勒超声检查（常规）', unit: '部位', price: 75, category: 'further' },
  superficialUs: { code: '220301002', name: '浅表器官彩色多普勒超声检查', unit: '每个部位', price: 60, category: 'further' },
  ct: { code: '012301020010000', name: '计算机体层成像（CT）平扫', unit: '部位', price: 195, category: 'further' },
  carotidUs: { code: '220302003', name: '颈部血管彩色多普勒超声', unit: '次', price: 150, category: 'further' },
  ecg: { code: '012408000030000', name: '常规心电图检查费', unit: '次', price: 35, category: 'recheck' },
} as const satisfies Record<string, CatalogItem>;

const ANNUAL_CHECKUP_FLOOR: CatalogItem[] = [
  CATALOG.ecg,
  CATALOG.glucose,
  CATALOG.tc,
  CATALOG.tg,
  CATALOG.hdl,
  CATALOG.ldl,
  CATALOG.ua,
  CATALOG.alt,
  CATALOG.ast,
  CATALOG.abdomenUs,
];

export type BudgetLine = {
  code: string;
  name: string;
  unit: string;
  price: number;
  times: number;
  amount: number;
  category: BudgetCategory;
  reason: string;
};

export type PersonBudget = {
  checkupId: string;
  name: string;
  department: string;
  riskLabel: string;
  lines: BudgetLine[];
  total: number;
  archive: HealthArchive;
};

export type ServiceRollup = {
  code: string;
  name: string;
  unit: string;
  price: number;
  times: number;
  amount: number;
  category: BudgetCategory;
  classCount?: number;
};

export type HealthBudgetModel = {
  people: PersonBudget[];
  headcount: number;
  total: number;
  average: number;
  byCategory: Record<BudgetCategory, number>;
  services: ServiceRollup[];
};

const money = (value: number) => Math.round(value * 100) / 100;

const baselineTimes = (riskLabel: string) => {
  if (riskLabel === '高风险') return { education: 6, consult: 12 };
  if (riskLabel === '中风险') return { education: 4, consult: 4 };
  return { education: 2, consult: 2 };
};

const pushLine = (lines: BudgetLine[], item: CatalogItem, times: number, reason: string) => {
  if (times <= 0) return;
  const existing = lines.find((line) => line.code === item.code);
  if (!existing) {
    lines.push({
      code: item.code,
      name: item.name,
      unit: item.unit,
      price: item.price,
      times,
      amount: money(item.price * times),
      category: item.category,
      reason,
    });
    return;
  }
  if (item.code === CATALOG.superficialUs.code) {
    existing.times += times;
    existing.amount = money(existing.price * existing.times);
    existing.reason = `${existing.reason}；${reason}`;
    return;
  }
  if (times > existing.times) {
    existing.times = times;
    existing.amount = money(existing.price * existing.times);
    existing.reason = reason;
  }
};

const idSet = (ids: string[]) => new Set(ids);

export const buildHealthBudget = (
  archives: HealthArchive[],
  observations: HealthObservationRow[]
): HealthBudgetModel => {
  const board = buildCampusHealthBoard(archives, observations);
  const assessed = idSet(board.assessed.map((person) => person.checkupId));
  const cardIds = (id: string) =>
    idSet((board.cards.find((card) => card.id === id)?.people || []).map((person) => person.checkupId));
  const flags = {
    ifg: cardIds('ifg'),
    dm: cardIds('dm'),
    lipid: cardIds('lipid'),
    ua: cardIds('ua'),
    overweight: cardIds('overweight'),
    obese: cardIds('obese'),
    fattyLiver: cardIds('fatty_liver'),
    thyroid: cardIds('thyroid_nodule'),
    lung: cardIds('lung_nodule'),
    carotid: cardIds('carotid_plaque'),
    breast: cardIds('breast_birads'),
  };

  const people = board.enrolled.map((person) => {
    const lines: BudgetLine[] = [];
    const base = baselineTimes(person.riskLabel);
    const baseReason = person.riskLabel === '未评估' ? '未评估，按低风险基础服务' : person.riskLabel;
    pushLine(lines, CATALOG.education, base.education, baseReason);
    pushLine(lines, CATALOG.consult, base.consult, baseReason);

    if (assessed.has(person.checkupId)) {
      const hit = (set: Set<string>) => set.has(person.checkupId);
      if (hit(flags.dm)) {
        pushLine(lines, CATALOG.glucose, 4, '糖尿病范围');
        pushLine(lines, CATALOG.hba1c, 2, '糖尿病范围');
      } else if (hit(flags.ifg)) {
        pushLine(lines, CATALOG.glucose, 2, '空腹血糖受损');
      }
      if (hit(flags.lipid)) {
        pushLine(lines, CATALOG.tc, 2, '血脂异常');
        pushLine(lines, CATALOG.tg, 2, '血脂异常');
        pushLine(lines, CATALOG.hdl, 2, '血脂异常');
        pushLine(lines, CATALOG.ldl, 2, '血脂异常');
      }
      if (hit(flags.ua)) pushLine(lines, CATALOG.ua, 2, '尿酸升高');
      if (hit(flags.overweight) || hit(flags.obese) || hit(flags.fattyLiver)) {
        pushLine(lines, CATALOG.nutrition, 2, '超重、肥胖或脂肪肝');
      }
      if (hit(flags.fattyLiver)) {
        pushLine(lines, CATALOG.abdomenUs, 1, '脂肪肝');
        pushLine(lines, CATALOG.alt, 1, '脂肪肝');
        pushLine(lines, CATALOG.ast, 1, '脂肪肝');
      }
      if (hit(flags.thyroid)) pushLine(lines, CATALOG.superficialUs, 1, '甲状腺结节');
      if (hit(flags.breast)) pushLine(lines, CATALOG.superficialUs, 1, '乳腺 BI-RADS 3 类及以上');
      if (hit(flags.lung)) pushLine(lines, CATALOG.ct, 1, '肺结节');
      if (hit(flags.carotid)) pushLine(lines, CATALOG.carotidUs, 1, '颈动脉斑块');
    }

    const total = money(lines.reduce((sum, line) => sum + line.amount, 0));
    return {
      checkupId: person.checkupId,
      name: person.name,
      department: person.department,
      riskLabel: person.riskLabel,
      lines,
      total,
      archive: person.archive,
    };
  });

  people.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh'));

  const byCategory: Record<BudgetCategory, number> = {
    recheck: 0,
    further: 0,
    followup: 0,
    education: 0,
  };
  const serviceMap = new Map<string, ServiceRollup>();
  people.forEach((person) => {
    person.lines.forEach((line) => {
      byCategory[line.category] = money(byCategory[line.category] + line.amount);
      const current = serviceMap.get(line.code);
      if (!current) {
        serviceMap.set(line.code, {
          code: line.code,
          name: line.name,
          unit: line.unit,
          price: line.price,
          times: line.times,
          amount: line.amount,
          category: line.category,
        });
        return;
      }
      current.times += line.times;
      current.amount = money(current.amount + line.amount);
    });
  });

  const categoryOrder: BudgetCategory[] = ['recheck', 'further', 'followup', 'education'];
  const services = [...serviceMap.values()]
    .map((service) =>
      service.category === 'education'
        ? { ...service, classCount: Math.ceil(service.times / EDUCATION_CLASS_SIZE) }
        : service
    )
    .sort(
      (a, b) =>
        categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || b.amount - a.amount
    );

  const total = money(people.reduce((sum, person) => sum + person.total, 0));
  return {
    people,
    headcount: people.length,
    total,
    average: people.length ? money(total / people.length) : 0,
    byCategory,
    services,
  };
};

export const loadHealthBudget = async (archives: HealthArchive[]): Promise<HealthBudgetModel> => {
  const observations = await fetchBoardObservations(
    archives.map((archive) => archive.checkup_id),
    [...BOARD_METRIC_CODES]
  );
  return buildHealthBudget(archives, observations);
};

/** 年度体检项目并入已有复查：没有的补 1 次，已有的不另加次数 */
export const applyAnnualCheckupFloor = (lines: BudgetLine[]): BudgetLine[] => {
  const next = lines.map((line) => ({ ...line }));
  ANNUAL_CHECKUP_FLOOR.forEach((item) => {
    const existing = next.find((line) => line.code === item.code);
    if (!existing) {
      next.push({
        code: item.code,
        name: item.name,
        unit: item.unit,
        price: item.price,
        times: 1,
        amount: money(item.price),
        category: item.category,
        reason: '年度健康体检',
      });
      return;
    }
    if (!existing.reason.includes('年度健康体检')) {
      existing.reason = `年度健康体检；${existing.reason}`;
    }
  });
  return next;
};

export const formatYuan = (value: number) =>
  value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export { listDepartments, BOARD_METRIC_CODES };
