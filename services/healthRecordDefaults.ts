import type { CheckupData, HealthRecord } from '../types';

/** 确保 checkup 嵌套对象存在，避免编辑 UI 访问 undefined */
export const ensureCheckupShape = (checkup: CheckupData): CheckupData => {
  const lab = checkup.labBasic || {};
  const opt = checkup.optional || {};
  const img = checkup.imagingBasic || {};

  return {
    basics: checkup.basics || {},
    bodyComposition: { ...checkup.bodyComposition },
    labBasic: {
      ck: lab.ck,
      hba1c: lab.hba1c,
      homocysteine: lab.homocysteine,
      liver: { ...lab.liver },
      lipids: { ...lab.lipids },
      renal: { ...lab.renal },
      bloodRoutine: { ...lab.bloodRoutine },
      glucose: { ...lab.glucose },
      urineRoutine: { ...lab.urineRoutine },
      thyroidFunction: { ...lab.thyroidFunction },
    },
    imagingBasic: {
      ecg: img.ecg,
      ultrasound: { ...img.ultrasound },
    },
    optional: {
      ...opt,
      tumorMarkers4: { ...opt.tumorMarkers4 },
      tumorMarkers2: { ...opt.tumorMarkers2 },
      rheumatoid: { ...opt.rheumatoid },
      arteriosclerosis: { ...opt.arteriosclerosis },
    },
    abnormalities: checkup.abnormalities || [],
  };
};

export const ensureHealthRecordShape = (record: HealthRecord): HealthRecord => ({
  ...record,
  checkup: ensureCheckupShape(record.checkup),
});
