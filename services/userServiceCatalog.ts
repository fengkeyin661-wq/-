import type { ContentItem } from './contentService';

/** 健康管理服务统一对外电话 */
export const HEALTH_MANAGEMENT_HOTLINE = '0371-67739538';
export const HEALTH_MANAGEMENT_HOTLINE_TEL = `tel:${HEALTH_MANAGEMENT_HOTLINE}`;

export type ServiceMainCategory = 'clinical' | 'checkup' | 'health_service';

export type ClinicalSubCategory = 'lab' | 'physical' | 'imaging' | 'other';
export type HealthServiceSubCategory =
  | 'tcm'
  | 'ophthalmology'
  | 'report'
  | 'consultation'
  | 'contract'
  | 'education';

export const SERVICE_MAIN_CATEGORIES: { id: ServiceMainCategory; label: string; icon: string; desc: string }[] = [
  { id: 'clinical', label: '临床检查', icon: '🔬', desc: '实验室、物理、影像等检查项目' },
  { id: 'checkup', label: '健康体检', icon: '🩺', desc: '组合体检套餐，一站式预约' },
  { id: 'health_service', label: '健康服务', icon: '💚', desc: '理疗、解读、咨询与科普活动' },
];

export const CLINICAL_SUB_CATEGORIES: { id: ClinicalSubCategory; label: string }[] = [
  { id: 'lab', label: '实验室检查' },
  { id: 'physical', label: '物理检查' },
  { id: 'imaging', label: '影像学检查' },
  { id: 'other', label: '其他检查' },
];

export const HEALTH_SERVICE_SUB_CATEGORIES: { id: HealthServiceSubCategory; label: string }[] = [
  { id: 'tcm', label: '中医理疗' },
  { id: 'ophthalmology', label: '眼科理疗' },
  { id: 'report', label: '报告解读' },
  { id: 'consultation', label: '咨询答疑' },
  { id: 'contract', label: '健康签约服务' },
  { id: 'education', label: '科普活动' },
];

const textBlob = (item: ContentItem) =>
  `${item.title} ${item.description || ''} ${(item.tags || []).join(' ')} ${item.details?.categoryL1 || ''} ${item.details?.categoryL2 || ''}`.toLowerCase();

export const isCheckupPackageItem = (item: ContentItem) =>
  item.type === 'checkup_package' || item.details?.serviceDomain === 'checkup';

export const classifyClinicalSub = (item: ContentItem): ClinicalSubCategory => {
  const explicit = item.details?.clinicalSubCategory as ClinicalSubCategory | undefined;
  if (explicit && CLINICAL_SUB_CATEGORIES.some((x) => x.id === explicit)) return explicit;

  const t = textBlob(item);
  if (/检验|化验|实验室|血常规|尿常规|生化|肿瘤标志|hbA1c|糖化/.test(t)) return 'lab';
  if (/ct|mri|核磁|超声|b超|x光|放射|影像|pet|dr/.test(t)) return 'imaging';
  if (/心电图|肺功能|体格|听诊|物理|内镜|胃镜|肠镜/.test(t)) return 'physical';
  return 'other';
};

export const classifyHealthServiceSub = (item: ContentItem): HealthServiceSubCategory => {
  const explicit = item.details?.healthServiceSubCategory as HealthServiceSubCategory | undefined;
  if (explicit && HEALTH_SERVICE_SUB_CATEGORIES.some((x) => x.id === explicit)) return explicit;

  const t = textBlob(item);
  if (/中医|理疗|针灸|推拿|拔罐/.test(t)) return 'tcm';
  if (/眼科|视力|干眼/.test(t)) return 'ophthalmology';
  if (/报告解读|解读报告|结果解读/.test(t)) return 'report';
  if (/咨询|答疑|问答|问诊/.test(t)) return 'consultation';
  if (/签约|家庭医生|健康管理签约/.test(t)) return 'contract';
  return 'consultation';
};

export const classifyServiceItem = (
  item: ContentItem,
): { domain: ServiceMainCategory; subId: string } => {
  if (isCheckupPackageItem(item)) return { domain: 'checkup', subId: 'package' };

  const domain = (item.details?.serviceDomain as ServiceMainCategory | undefined) ||
    inferServiceDomain(item);

  if (domain === 'checkup') return { domain: 'checkup', subId: 'package' };
  if (domain === 'health_service') {
    return { domain: 'health_service', subId: classifyHealthServiceSub(item) };
  }
  return { domain: 'clinical', subId: classifyClinicalSub(item) };
};

const inferServiceDomain = (item: ContentItem): ServiceMainCategory => {
  const t = textBlob(item);
  if (/套餐|体检包|健康体检|入职体检|年度体检/.test(t)) return 'checkup';
  if (/中医|理疗|眼科|解读|咨询|签约|康复|健康服务|管理方案/.test(t)) return 'health_service';
  if (item.details?.categoryL1 === '健康服务') return 'health_service';
  if (item.details?.categoryL1 === '体检') return 'checkup';
  return 'clinical';
};

export const resolveIncludedServiceTitles = (
  packageItem: ContentItem,
  allServices: ContentItem[],
): string[] => {
  const ids: string[] = packageItem.details?.includedServiceIds || [];
  if (!ids.length) return [];
  const map = new Map(allServices.map((s) => [s.id, s.title]));
  return ids.map((id) => map.get(id) || id).filter(Boolean);
};
