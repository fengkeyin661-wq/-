import React, { useMemo, useState } from 'react';
import {
  getFollowUpTalkScript,
  resolveFollowUpTalkScenario,
  type FollowUpTalkScenario,
} from '../services/followUpTalkScripts';

interface Props {
  /** 如「常规随访」「危急值二次回访」 */
  sourceLabel?: string | null;
  /** 强制指定场景（危急值弹窗可用） */
  scenario?: FollowUpTalkScenario;
  className?: string;
  /** 整块话术面板默认是否展开 */
  defaultExpanded?: boolean;
}

/** 随访沟通话术提醒：各步骤内容直接展示 */
export const FollowUpTalkScriptReminder: React.FC<Props> = ({
  sourceLabel,
  scenario: scenarioProp,
  className = '',
  defaultExpanded = true,
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
