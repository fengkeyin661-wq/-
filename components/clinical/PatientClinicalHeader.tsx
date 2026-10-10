import React, { useEffect, useRef, useState } from 'react';
import type { HealthAssessment, HealthRecord } from '../../types';
import type { HealthArchive } from '../../services/dataService';
import { HighGlucoseTag } from '../HighGlucoseTag';
import { HighBloodPressureTag } from '../HighBloodPressureTag';
import { HighLipidTag } from '../HighLipidTag';

interface Props {
  healthRecord: HealthRecord;
  assessment?: HealthAssessment | null;
  subtitle?: string;
  sticky?: boolean;
  onOpenAssessment?: () => void;
  onDelayPlan?: () => void;
  onFollowUpSms?: () => void;
  showDelayPlan?: boolean;
  showFollowUpSms?: boolean;
  onNavigateDiabetes?: (archive: HealthArchive) => void;
  onNavigateHypertension?: (archive: HealthArchive) => void;
  onNavigateLipid?: (archive: HealthArchive) => void;
  currentArchive?: HealthArchive | null;
}

export const PatientClinicalHeader: React.FC<Props> = ({
  healthRecord,
  assessment,
  subtitle,
  sticky = true,
  onOpenAssessment,
  onDelayPlan,
  onFollowUpSms,
  showDelayPlan = false,
  showFollowUpSms = false,
  onNavigateDiabetes,
  onNavigateHypertension,
  onNavigateLipid,
  currentArchive,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const profile = healthRecord.profile;
  const risk = assessment?.riskLevel;

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const hasChronicNav =
    currentArchive &&
    (onNavigateDiabetes || onNavigateHypertension || onNavigateLipid);

  return (
    <div
      className={`mb-4 rounded-xl border border-slate-200 bg-white shadow-sm ${
        sticky ? 'sticky top-0 z-30' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-slate-800 truncate">{profile.name}</h2>
            {risk && (
              <span
                className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-black uppercase ${
                  risk === 'RED'
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : risk === 'YELLOW'
                      ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                      : 'bg-green-50 text-green-600 border-green-200'
                }`}
              >
                {risk === 'RED' ? '高风险' : risk === 'YELLOW' ? '中风险' : '低风险'}
              </span>
            )}
            <HighGlucoseTag record={healthRecord} />
            <HighBloodPressureTag record={healthRecord} />
            <HighLipidTag record={healthRecord} />
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono">
            {profile.checkupId}
            {profile.gender || profile.age != null
              ? ` · ${profile.gender || ''}${profile.age != null ? ` / ${profile.age}岁` : ''}`
              : ''}
            {profile.department ? ` · ${profile.department}` : ''}
          </p>
          {profile.phone ? (
            <p className="text-xs text-slate-400 mt-0.5">电话 {profile.phone}</p>
          ) : null}
          {subtitle ? <p className="text-[11px] text-teal-700 mt-1 font-medium">{subtitle}</p> : null}
          {assessment?.isCritical && (
            <p className="mt-2 text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1 inline-block">
              危急值：{assessment.criticalWarning || '请优先处理'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenAssessment ? (
            <button
              type="button"
              onClick={onOpenAssessment}
              className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-50"
            >
              完整评估
            </button>
          ) : null}
          {showDelayPlan && onDelayPlan ? (
            <button
              type="button"
              onClick={onDelayPlan}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
            >
              延期1月
            </button>
          ) : null}
          {showFollowUpSms && onFollowUpSms ? (
            <button
              type="button"
              onClick={onFollowUpSms}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              随访短信
            </button>
          ) : null}
          {hasChronicNav ? (
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                慢性病 ▾
              </button>
              {moreOpen ? (
                <div className="absolute right-0 top-full z-40 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {onNavigateDiabetes ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
                      onClick={() => {
                        setMoreOpen(false);
                        onNavigateDiabetes(currentArchive!);
                      }}
                    >
                      糖尿病管理
                    </button>
                  ) : null}
                  {onNavigateHypertension ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
                      onClick={() => {
                        setMoreOpen(false);
                        onNavigateHypertension(currentArchive!);
                      }}
                    >
                      高血压管理
                    </button>
                  ) : null}
                  {onNavigateLipid ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-50"
                      onClick={() => {
                        setMoreOpen(false);
                        onNavigateLipid(currentArchive!);
                      }}
                    >
                      血脂管理
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
