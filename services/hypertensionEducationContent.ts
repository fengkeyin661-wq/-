import type { HypertensionLifestyleGuidance } from '../types';
import { RiskLevel } from '../types';

export const HYPERTENSION_GUIDELINE_NOTES = [
  '《中国高血压防治指南（2024年修订版）》强调生活方式干预与药物治疗并重。',
  '一般人群目标<140/90 mmHg；糖尿病、CKD、ASCVD等高危人群建议<130/80 mmHg（个体化）。',
  '家庭血压监测与动态血压有助于提高达标率并发现隐匿性高血压。',
];

export const getHypertensionLifestyleGuidance = (riskLevel: RiskLevel): HypertensionLifestyleGuidance => {
  const strict = riskLevel === RiskLevel.RED;
  return {
    principles: [
      '低盐饮食：每日食盐<5 g（约一啤酒瓶盖），减少腌制、加工食品',
      'DASH/地中海饮食模式：多蔬菜水果、全谷物、低脂乳制品，少饱和脂肪',
      '戒烟限酒：完全戒烟；男性酒精<25 g/日，女性<15 g/日',
      '体重管理：BMI 18.5–24，腰围男<90 cm、女<85 cm',
      strict
        ? '血压≥180/110 mmHg或伴靶器官急性损害：尽快就医，勿自行调整药物'
        : '规律家庭血压监测，记录早晚两次，就诊时携带记录',
    ],
    dietTips: [
      '使用限盐勺，逐步减少口味依赖',
      '增加钾摄入（香蕉、菠菜等）有助于拮抗钠的不良作用（肾功能正常者）',
      '减少外卖、酱油、味精、咸菜等高钠来源',
    ],
    exerciseTips: [
      '每周≥150分钟中等强度有氧运动（快走、游泳、骑车），可分次进行',
      '避免憋气用力（如重量训练大负荷），防止血压骤升',
      '运动前后监测血压，头晕胸闷时立即停止',
    ],
    monitoringTips: [
      '家庭血压：静坐5分钟后测量，连测2–3次取平均，记录日期时间',
      '目标：一般<135/85 mmHg（家庭）；高危人群更严格（个体化）',
      '每年复查肾功能、尿微量白蛋白、血脂、血糖、心电图/彩超',
      '疑白大衣效应或波动大者，建议24小时动态血压',
    ],
    medicationTips: [
      '遵医嘱规律服药，勿自行停药或减量',
      '常见药物：CCB、ACEI/ARB、利尿剂、β受体阻滞剂等，需个体化选择',
      'ACEI/ARB 合并 CKD/蛋白尿优先；两药不推荐常规联用',
      '难治性高血压或低钾：需排查继发性高血压（原醛、肾动脉狭窄等）',
    ],
  };
};

export const HYPERTENSION_REPORT_ENCOURAGEMENT = {
  title: '致参加高血压专项筛查的朋友',
  paragraphs: [
    '高血压常被称为“无声杀手”，早期多无明显症状，却可持续损伤心、脑、肾和眼底。',
    '本次专项筛查旨在帮您全面了解血压控制情况及靶器官是否受累，以便早干预、早保护。',
    '通过规范生活方式、家庭监测和必要药物治疗，大多数高血压可以得到良好控制。',
  ],
};
