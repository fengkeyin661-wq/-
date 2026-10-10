import React, { useMemo, useState } from 'react';
import {
  getFollowUpTalkScript,
  resolveFollowUpTalkScenario,
  type FollowUpTalkScenario,
} from '../services/followUpTalkScripts';
import type { FollowUpStaffCue } from '../services/followUpGuidance';

interface Props {
  /** 如「常规随访」「危急值二次回访」 */
  sourceLabel?: string | null;
  /** 强制指定场景（危急值弹窗可用） */
  scenario?: FollowUpTalkScenario;
  className?: string;
  /** 整块话术面板默认是否展开（默认收起） */
  defaultExpanded?: boolean;
  staffOpeningHint?: string;
  staffCues?: FollowUpStaffCue[];
}

/** 随访沟通话术提醒：默认收起，点击展开查看步骤内容 */
export const FollowUpTalkScriptReminder: React.FC<Props> = ({
  sourceLabel,
  scenario: scenarioProp,
  className = '',
  defaultExpanded = false,
  staffOpeningHint,
  staffCues = [],
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const script = useMemo(() => {
    const scenario = scenarioProp || resolveFollowUpTalkScenario(sourceLabel);
    return getFollowUpTalkScript(scenario);
  }, [sourceLabel, scenarioProp]);

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50/90 shadow-sm overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-amber-100/60 transition-colors"
      >
        <div className="min-w-0">
          <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
            <span aria-hidden>💬</span>
            沟通话术提醒
            <span className="text-[11px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
              {script.label}
            </span>
          </h3>
          <p className="text-xs text-amber-800/80 mt-0.5">
            电话随访时参考：开场确认 → 核对执行 → 解释指标 → 约定下一步
          </p>
        </div>
        <span className="shrink-0 text-amber-800 font-bold text-sm">
          {expanded ? '收起 ▲' : '展开 ▼'}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-amber-100/80 pt-3">
          <p className="text-[11px] text-amber-800/70">
            请结合「本次随访要点」灵活调整，勿照本宣科。
          </p>
          {staffOpeningHint ? (
            <div className="rounded-lg border border-amber-300 bg-white px-3.5 py-3">
              <div className="text-xs font-bold text-amber-900 mb-1">建议开场（可复制）</div>
              <p className="text-[13px] leading-relaxed text-slate-800">{staffOpeningHint}</p>
            </div>
          ) : null}
          {staffCues.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-white px-3.5 py-3 space-y-3">
              <div className="text-xs font-bold text-amber-900">本期逐项核对话术</div>
              {staffCues.map((cue, i) => (
                <div key={cue.focusItem} className="border-t border-amber-50 pt-2 first:border-0 first:pt-0">
                  <div className="text-sm font-bold text-slate-800">
                    <span className="text-amber-600 mr-1">{i + 1}.</span>
                    {cue.focusItem}
                  </div>
                  <p className="mt-1 text-[13px] text-slate-700">
                    <span className="font-bold text-teal-800">可问：</span>
                    {cue.askScript}
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    <span className="font-bold text-slate-600">记录：</span>
                    {cue.recordHint}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {script.sections.map((section, idx) => (
            <div
              key={section.id}
              className="rounded-lg border border-amber-100 bg-white px-3.5 py-3"
            >
              <div className="text-sm font-bold text-slate-800 mb-2">
                <span className="text-amber-600 mr-1.5">{idx + 1}.</span>
                {section.title}
              </div>
              <ul className="space-y-1.5">
                {section.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="text-[13px] leading-relaxed text-slate-700 flex gap-2"
                  >
                    <span className="shrink-0 text-amber-500 font-bold">·</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
