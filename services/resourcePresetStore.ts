/**
 * 资源运营台下拉/标签类选项模板，支持本地持久化与恢复默认。
 */

export type ResourcePresetKey =
  | 'activityTypes'
  | 'targetAudience'
  | 'enrollMethod'
  | 'depts'
  | 'docTitles'
  | 'docStatus'
  | 'drugRx'
  | 'drugInsurance'
  | 'drugStock'
  | 'dietDifficulty'
  | 'exerciseIntensity'
  | 'dietTags'
  | 'exerciseTypes'
  | 'serviceInsurance'
  | 'bookingTypes'
  | 'circleTags';

export type ResourcePresets = Record<ResourcePresetKey, string[]>;

const STORAGE_KEY = 'HEALTH_RESOURCE_PRESET_OPTIONS_V1';

function clonePresets(source: ResourcePresets): ResourcePresets {
  const o = {} as ResourcePresets;
  (Object.keys(source) as ResourcePresetKey[]).forEach((k) => {
    o[k] = [...source[k]];
  });
  return o;
}

export const DEFAULT_RESOURCE_PRESETS: ResourcePresets = {
  activityTypes: ['义诊', '健康讲座', '亲子活动', '急救培训', '慢病小组', '户外运动'],
  targetAudience: ['老年人', '孕产妇', '儿童', '高血压患者', '糖尿病患者', '全人群'],
  enrollMethod: ['线上预约', '电话报名', '现场空降'],
  depts: ['全科', '中医科', '内科', '外科', '妇科', '儿科', '口腔科', '康复科', '预防保健科'],
  docTitles: ['主任医师', '副主任医师', '主治医师', '医师', '康复师', '营养师'],
  docStatus: ['出诊中', '停诊', '休假'],
  drugRx: ['RX (处方药)', 'OTC (甲类)', 'OTC (乙类)'],
  drugInsurance: ['甲类', '乙类', '自费'],
  drugStock: ['充足', '紧张', '缺货'],
  dietDifficulty: ['初级', '中等', '较难'],
  exerciseIntensity: ['低强度', '中强度', '高强度'],
  dietTags: ['低GI', '高纤维', '低脂', '高蛋白', '适合糖友', '护心'],
  exerciseTypes: ['有氧', '力量', '柔韧性', '康复训练', '体态矫正'],
  serviceInsurance: ['甲类', '乙类', '自费'],
  bookingTypes: ['需预约', '无需预约'],
  circleTags: ['运动', '饮食', '慢病', '养生', '心理'],
};

export const RESOURCE_PRESET_META: { key: ResourcePresetKey; label: string }[] = [
  { key: 'activityTypes', label: '活动类型' },
  { key: 'targetAudience', label: '面向人群' },
  { key: 'enrollMethod', label: '报名方式' },
  { key: 'depts', label: '科室' },
  { key: 'docTitles', label: '医生职称' },
  { key: 'docStatus', label: '医生出诊状态' },
  { key: 'drugRx', label: '处方类型' },
  { key: 'drugInsurance', label: '医保类型（药品）' },
  { key: 'drugStock', label: '库存状态' },
  { key: 'dietDifficulty', label: '膳食制作难度' },
  { key: 'exerciseIntensity', label: '运动强度' },
  { key: 'dietTags', label: '健康标签（膳食）' },
  { key: 'exerciseTypes', label: '运动类型' },
  { key: 'serviceInsurance', label: '医保类型（服务）' },
  { key: 'bookingTypes', label: '预约类型' },
  { key: 'circleTags', label: '圈子类型' },
];

export function loadResourcePresets(): ResourcePresets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clonePresets(DEFAULT_RESOURCE_PRESETS);
    const parsed = JSON.parse(raw) as Partial<ResourcePresets>;
    const out = clonePresets(DEFAULT_RESOURCE_PRESETS);
    (Object.keys(DEFAULT_RESOURCE_PRESETS) as ResourcePresetKey[]).forEach((k) => {
      if (Array.isArray(parsed[k])) {
        const cleaned = parsed[k]!.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
        if (cleaned.length) out[k] = cleaned;
      }
    });
    return out;
  } catch {
    return clonePresets(DEFAULT_RESOURCE_PRESETS);
  }
}

export function saveResourcePresets(presets: ResourcePresets): void {
  const cleaned = clonePresets(DEFAULT_RESOURCE_PRESETS);
  (Object.keys(DEFAULT_RESOURCE_PRESETS) as ResourcePresetKey[]).forEach((k) => {
    const arr = presets[k]?.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) ?? [];
    cleaned[k] = arr.length ? arr : DEFAULT_RESOURCE_PRESETS[k];
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
}

export function resetResourcePresetStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
