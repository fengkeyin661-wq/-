import React, { useState } from 'react';
import type { HealthRecord } from '../../types';
import { ensureHealthRecordShape } from '../../services/healthRecordDefaults';

const fmt = (v: unknown, unit?: string): string => {
  if (v == null || v === '') return '-';
  const s = String(v).trim();
  if (!s) return '-';
  return unit ? `${s}${unit}` : s;
};

const hasText = (v: unknown): boolean => v != null && String(v).trim() !== '';

const hasAny = (...vals: unknown[]): boolean => vals.some(hasText);

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-slate-800">{title}</span>
        <span className="text-xs text-slate-400">{open ? '收起' : '展开'}</span>
      </button>
      {open && <div className="border-t border-slate-100 px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
};

const Grid: React.FC<{ items: { label: string; value: string }[] }> = ({ items }) => {
  const visible = items.filter((i) => i.value !== '-');
  if (!visible.length) {
    return <p className="text-xs text-slate-400">暂无数据</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {visible.map((item) => (
        <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-[11px] text-slate-400">{item.label}</div>
          <div className="mt-0.5 text-sm font-bold text-slate-700">{item.value}</div>
        </div>
      ))}
    </div>
  );
};

const TextRows: React.FC<{ items: { label: string; value?: string }[] }> = ({ items }) => {
  const visible = items.filter((i) => hasText(i.value));
  if (!visible.length) {
    return <p className="text-xs text-slate-400">暂无数据</p>;
  }
  return (
    <div className="space-y-2">
      {visible.map((item) => (
        <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-bold text-slate-500">{item.label}</div>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.value}</div>
        </div>
      ))}
    </div>
  );
};

interface Props {
  record: HealthRecord;
}

export const HealthArchiveReadView: React.FC<Props> = ({ record: raw }) => {
  const record = ensureHealthRecordShape(raw);
  const c = record.checkup;
  const bc = c.bodyComposition || {};
  const lab = c.labBasic;
  const img = c.imagingBasic;
  const opt = c.optional;
  const art = opt.arteriosclerosis || {};
  const bodyFatRate = bc.bodyFatRate ?? record.riskModelExtras?.bodyFatRate;
  const hba1c = lab.hba1c ?? opt.hba1c;
  const homocysteine = lab.homocysteine ?? opt.homocysteine;

  const showBasics = hasAny(
    c.basics.height,
    c.basics.weight,
    c.basics.bmi,
    c.basics.sbp,
    c.basics.dbp,
    c.basics.waist,
    bodyFatRate
  );

  const showBodyComp = hasAny(
    bodyFatRate,
    bc.bodyFatMass,
    bc.leanBodyMass,
    bc.skeletalMuscleMass,
    bc.muscleMass,
    bc.visceralFatArea,
    bc.visceralFatLevel,
    bc.waistHipRatio,
    bc.inbodyScore,
    bc.obesityDegree,
    bc.bmr,
    bc.targetWeight
  );

  const showLab =
    hasAny(lab.ck, lab.hba1c, lab.homocysteine, lab.glucose?.fasting) ||
    hasAny(...Object.values(lab.bloodRoutine || {})) ||
    hasAny(...Object.values(lab.urineRoutine || {})) ||
    hasAny(...Object.values(lab.lipids || {})) ||
    hasAny(...Object.values(lab.renal || {})) ||
    hasAny(...Object.values(lab.liver || {})) ||
    hasAny(...Object.values(lab.thyroidFunction || {}));

  const showImaging =
    hasText(img.ecg) ||
    hasAny(...Object.values(img.ultrasound || {})) ||
    hasText(opt.carotidUltrasound) ||
    hasText(opt.heartUltrasound) ||
    hasText(opt.ct) ||
    hasText(opt.mammography) ||
    hasText(opt.tcd) ||
    hasText(opt.fundusPhoto);

  const showVascular = hasAny(
    art.abi,
    art.leftABI,
    art.rightABI,
    art.pwv,
    art.leftBaPWV,
    art.rightBaPWV,
    art.cfPWV,
    art.grade,
    art.conclusion,
    art.risk
  );

  const showOptional =
    showVascular ||
    hasText(opt.tct) ||
    hasText(opt.hpv) ||
    hasText(opt.boneDensity) ||
    hasAny(...Object.values(opt.tumorMarkers4 || {})) ||
    hasAny(...Object.values(opt.tumorMarkers2 || {}));

  if (!showBasics && !showBodyComp && !showLab && !showImaging && !showOptional) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-400">
        暂无详细体检指标，请联系健康管家完善档案。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showBasics && (
        <Section title="基础体征" defaultOpen>
          <Grid
            items={[
              { label: '身高', value: fmt(c.basics.height, ' cm') },
              { label: '体重', value: fmt(c.basics.weight, ' kg') },
              { label: 'BMI', value: fmt(c.basics.bmi) },
              { label: '血压', value: c.basics.sbp && c.basics.dbp ? `${c.basics.sbp}/${c.basics.dbp} mmHg` : '-' },
              { label: '腰围', value: fmt(c.basics.waist, ' cm') },
              { label: '体脂率', value: fmt(bodyFatRate, '%') },
            ]}
          />
        </Section>
      )}

      {showBodyComp && (
        <Section title="人体成分分析">
          <Grid
            items={[
              { label: '体脂率', value: fmt(bodyFatRate, '%') },
              { label: '体脂肪量', value: fmt(bc.bodyFatMass, ' kg') },
              { label: '去脂体重', value: fmt(bc.leanBodyMass, ' kg') },
              { label: '骨骼肌质量', value: fmt(bc.skeletalMuscleMass, ' kg') },
              { label: '肌肉量', value: fmt(bc.muscleMass, ' kg') },
              { label: '内脏脂肪面积', value: fmt(bc.visceralFatArea, ' cm²') },
              { label: '内脏脂肪等级', value: fmt(bc.visceralFatLevel, ' 级') },
              { label: '腰臀比', value: fmt(bc.waistHipRatio) },
              { label: 'InBody评分', value: fmt(bc.inbodyScore, ' 分') },
              { label: '肥胖度', value: fmt(bc.obesityDegree, '%') },
              { label: '基础代谢', value: fmt(bc.bmr, ' kcal') },
              { label: '目标体重', value: fmt(bc.targetWeight, ' kg') },
            ]}
          />
        </Section>
      )}

      {showLab && (
        <Section title="实验室检查">
          <div className="space-y-4">
            <Grid
              items={[
                { label: '空腹血糖', value: fmt(lab.glucose?.fasting, ' mmol/L') },
                { label: '糖化血红蛋白', value: fmt(hba1c, '%') },
                { label: '同型半胱氨酸', value: fmt(homocysteine, ' μmol/L') },
                { label: '肌酸激酶', value: fmt(lab.ck) },
                { label: '总胆固醇', value: fmt(lab.lipids?.tc, ' mmol/L') },
                { label: '甘油三酯', value: fmt(lab.lipids?.tg, ' mmol/L') },
                { label: 'LDL-C', value: fmt(lab.lipids?.ldl, ' mmol/L') },
                { label: 'HDL-C', value: fmt(lab.lipids?.hdl, ' mmol/L') },
                { label: '血肌酐', value: fmt(lab.renal?.creatinine, ' μmol/L') },
                { label: '尿素', value: fmt(lab.renal?.urea) },
                { label: '尿酸', value: fmt(lab.renal?.ua) },
              ]}
            />
            <div>
              <p className="mb-2 text-xs font-bold text-slate-500">血常规</p>
              <Grid
                items={[
                  { label: '白细胞', value: fmt(lab.bloodRoutine?.wbc) },
                  { label: '红细胞', value: fmt(lab.bloodRoutine?.rbc) },
                  { label: '血红蛋白', value: fmt(lab.bloodRoutine?.hgb, ' g/L') },
                  { label: '血小板', value: fmt(lab.bloodRoutine?.plt) },
                  { label: '中性粒细胞', value: fmt(lab.bloodRoutine?.neut) },
                ]}
              />
              {hasText(lab.bloodRoutine?.summary) && (
                <p className="mt-2 text-xs text-slate-600">小结：{lab.bloodRoutine?.summary}</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-bold text-slate-500">尿常规</p>
              <Grid
                items={[
                  { label: '尿蛋白', value: fmt(lab.urineRoutine?.protein) },
                  { label: '尿糖', value: fmt(lab.urineRoutine?.glucose) },
                  { label: '尿潜血', value: fmt(lab.urineRoutine?.blood) },
                ]}
              />
              {hasText(lab.urineRoutine?.summary) && (
                <p className="mt-2 text-xs text-slate-600">小结：{lab.urineRoutine?.summary}</p>
              )}
            </div>
          </div>
        </Section>
      )}

      {showImaging && (
        <Section title="影像与功能检查">
          <TextRows
            items={[
              { label: '心电图', value: img.ecg },
              { label: '甲状腺彩超', value: img.ultrasound?.thyroid },
              { label: '腹部彩超', value: img.ultrasound?.abdomen },
              { label: '乳腺彩超', value: img.ultrasound?.breast },
              { label: '子宫附件彩超', value: img.ultrasound?.uterusAdnexa },
              { label: '前列腺彩超', value: img.ultrasound?.prostate },
              { label: '颈动脉彩超', value: opt.carotidUltrasound },
              { label: '心脏彩超', value: opt.heartUltrasound },
              { label: 'CT', value: opt.ct },
              { label: '乳腺钼靶', value: opt.mammography },
              { label: '颅内多普勒(TCD)', value: opt.tcd },
              { label: '眼底照相', value: opt.fundusPhoto },
            ]}
          />
        </Section>
      )}

      {showOptional && (
        <Section title="自选与专项检测">
          <div className="space-y-4">
            {showVascular && (
              <div>
                <p className="mb-2 text-xs font-bold text-slate-500">动脉硬化检测</p>
                <Grid
                  items={[
                    { label: 'ABI', value: fmt(art.abi) },
                    { label: '左ABI', value: fmt(art.leftABI) },
                    { label: '右ABI', value: fmt(art.rightABI) },
                    { label: 'PWV', value: fmt(art.pwv, ' cm/s') },
                    { label: '左baPWV', value: fmt(art.leftBaPWV) },
                    { label: '右baPWV', value: fmt(art.rightBaPWV) },
                    { label: '分级', value: fmt(art.grade) },
                  ]}
                />
                <TextRows
                  items={[
                    { label: '结论', value: art.conclusion },
                    { label: '风险提示', value: art.risk },
                    { label: '特别提示', value: art.specialNote },
                  ]}
                />
              </div>
            )}
            <TextRows
              items={[
                { label: 'TCT', value: opt.tct },
                { label: 'HPV', value: opt.hpv },
                { label: '骨密度', value: opt.boneDensity },
              ]}
            />
          </div>
        </Section>
      )}
    </div>
  );
};
