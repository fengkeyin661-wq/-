import { RiskLevel } from '../types';
import type { LipidLifestyleGuidance } from '../types';

export const LIPID_GUIDELINE_NOTES = [
  '参考《中国成人血脂异常防治指南（2016年修订版）》及《中国血脂管理指南（2023年）》核心原则。',
  'ASCVD 一级预防：低危 LDL-C<3.4；中危<2.6；高危<1.8；极高危<1.4 mmol/L（以临床危险分层为准）。',
  'TG≥5.6 mmol/L 需优先降 TG 预防急性胰腺炎，并评估继发性因素。',
  '调脂治疗首选他汀类药物；不耐受者可考虑依折麦布、PCSK9 抑制剂等（需专科评估）。',
  '生活方式干预（地中海/ DASH 饮食、减重、规律运动、戒烟限酒）是血脂管理的基石。',
];

export const LIPID_REPORT_ENCOURAGEMENT = {
  title: '致职工朋友',
  paragraphs: [
    '血脂异常是动脉粥样硬化性心血管疾病的重要危险因素，但多数情况下可通过生活方式干预和规范药物治疗得到有效控制。',
    '请遵医嘱规律服药，勿自行停药；定期复查血脂与肝功能，并与血压、血糖综合管理。',
    '如有胸痛、突发剧烈腹痛（疑胰腺炎）或肌肉疼痛无力等不适，请及时就医。',
  ],
};

export const getLipidLifestyleGuidance = (riskLevel: RiskLevel): LipidLifestyleGuidance => {
  const base: LipidLifestyleGuidance = {
    principles: [
      '控制总脂肪与饱和脂肪摄入，减少反式脂肪（糕点、油炸食品）。',
      '增加膳食纤维（全谷物、蔬菜、豆类）及优质蛋白（鱼、禽、豆制品）。',
      '维持健康体重：BMI 18.5–24，腰围男<90 cm、女<85 cm。',
      '完全戒烟，限制饮酒（TG 升高者尤应限酒）。',
    ],
    dietTips: [
      '每周至少 2 次深海鱼（富含 ω-3 脂肪酸），有助于降 TG。',
      '用橄榄油、菜籽油替代部分动物油脂；每日坚果约 10 g（无盐）。',
      '减少含糖饮料与精制碳水，有助于降低 TG。',
      '高 LDL-C 者优先减少红肉、全脂 dairy 及动物内脏。',
    ],
    exerciseTips: [
      '每周至少 150 分钟中等强度有氧运动（快走、游泳、骑车），可分次进行。',
      '结合 2–3 次抗阻训练，有助于改善血脂谱与胰岛素敏感性。',
      '运动应循序渐进；ASCVD 患者运动前需评估运动风险。',
    ],
    monitoringTips: [
      '调脂治疗启动后 4–12 周复查血脂、肝功能、肌酸激酶（有症状时）。',
      '稳定后每 6–12 个月复查血脂；TG 极高或合并糖尿病者缩短间隔。',
      '家庭自测血压；合并糖尿病者监测血糖/HbA1c。',
    ],
    medicationTips: [
      '他汀类药物一般睡前或固定时间服用，勿随意停药或减量。',
      '出现不明原因肌痛、乏力、尿色加深应及时就医并查 CK、肝功能。',
      '贝特类主要用于高 TG；与他汀联用需警惕肌病风险，需专科指导。',
      '备孕、妊娠、哺乳期调脂用药需专科重新评估。',
    ],
  };

  if (riskLevel === RiskLevel.RED) {
    base.principles.unshift('您属于 ASCVD 高危/极高危或血脂严重升高，请尽快心内科或血脂专科随访。');
    base.medicationTips.unshift('多数高危患者需启动或强化调脂药物治疗，请勿仅凭饮食控制延误治疗。');
  }

  return base;
};
