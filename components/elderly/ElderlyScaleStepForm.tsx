import React from 'react';
import type { ElderlyScaleResponses } from '../../types';
import {
  ELDERLY_CLINICAL_DISCLAIMER,
  type ElderlyDomainId,
  type ElderlyScaleId,
  type ScaleDefinition,
  getScalesForDomain,
} from '../../services/elderlyScreeningCatalog';
import {
  computeScaleTotal,
  interpretScale,
  computeMiniCogTotal,
} from '../../services/elderlyScaleScoringService';

interface Props {
  domain: ElderlyDomainId;
  responses: ElderlyScaleResponses;
  onChange: (next: ElderlyScaleResponses) => void;
}

const patchArray = (arr: number[] | undefined, idx: number, value: number, len: number): number[] => {
  const next = [...(arr || Array(len).fill(undefined))];
  while (next.length < len) next.push(undefined as unknown as number);
  next[idx] = value;
  return next;
};

const ScaleBlock: React.FC<{
  scale: ScaleDefinition;
  responses: ElderlyScaleResponses;
  onChange: (next: ElderlyScaleResponses) => void;
}> = ({ scale, responses, onChange }) => {
  const total = computeScaleTotal(scale.id, responses);
  const interp = total !== undefined ? interpretScale(scale.id, total) : null;

  const setItem = (itemIdx: number, value: number) => {
    const key = scale.id as keyof ElderlyScaleResponses;
    if (scale.id === 'miniCog') return;
    if (scale.id === 'frail') {
      const arr = [...(responses.frail || Array(5).fill(false))];
      while (arr.length < 5) arr.push(false);
      arr[itemIdx] = value === 1;
      onChange({ ...responses, frail: arr });
      return;
    }
    const current = (responses[key] as number[] | undefined) || [];
    onChange({ ...responses, [key]: patchArray(current, itemIdx, value, scale.itemCount) });
  };

  const getValue = (itemIdx: number): number | undefined => {
    if (scale.id === 'miniCog') return undefined;
    if (scale.id === 'frail') {
      const v = responses.frail?.[itemIdx];
      return v === undefined ? undefined : v ? 1 : 0;
    }
    const key = scale.id as keyof ElderlyScaleResponses;
    return (responses[key] as number[] | undefined)?.[itemIdx];
  };

  if (scale.id === 'miniCog') {
    const recall = responses.miniCog?.recall;
    const clock = responses.miniCog?.clock;
    const miniTotal = computeMiniCogTotal(responses.miniCog);
    const miniInterp = miniTotal !== undefined ? interpretScale('miniCog', miniTotal) : null;
    return (
      <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold text-slate-800">{scale.name}</h4>
          {miniInterp && (
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-teal-100 text-teal-800">
              {miniTotal} 分 · {miniInterp.label}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">{scale.clinicalMeaning}</p>
        {scale.items.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="text-sm text-slate-700">{item.label}</div>
            <div className="flex flex-wrap gap-2">
              {item.options.map((opt) => {
                const selected =
                  item.id === 'recall'
                    ? recall === opt.value
                    : clock === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...responses,
                        miniCog: {
                          ...responses.miniCog,
                          [item.id === 'recall' ? 'recall' : 'clock']: opt.value,
                        },
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                      selected
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-4 bg-slate-50/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold text-slate-800">{scale.name}</h4>
        {interp && (
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-teal-100 text-teal-800">
            {total} 分 · {interp.label}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500">{scale.clinicalMeaning}</p>
      {scale.items.map((item, idx) => (
        <div key={item.id} className="space-y-1">
          <div className="text-sm text-slate-700">
            {idx + 1}. {item.label}
          </div>
          <div className="flex flex-wrap gap-2">
            {item.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setItem(idx, opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                  getValue(idx) === opt.value
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const ElderlyScaleStepForm: React.FC<Props> = ({ domain, responses, onChange }) => {
  const scales = getScalesForDomain(domain);
  if (scales.length === 0) return null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        {ELDERLY_CLINICAL_DISCLAIMER}
      </p>
      {scales.map((scale) => (
        <ScaleBlock key={scale.id} scale={scale} responses={responses} onChange={onChange} />
      ))}
    </div>
  );
};

export const ElderlyScaleProgress: React.FC<{ scaleId: ElderlyScaleId; responses: ElderlyScaleResponses }> = ({
  scaleId,
  responses,
}) => {
  const total = computeScaleTotal(scaleId, responses);
  if (total === undefined) return null;
  const interp = interpretScale(scaleId, total);
  return (
    <span className="text-[11px] text-teal-700 font-bold">
      {interp.name} {total} 分（{interp.label}）
    </span>
  );
};
