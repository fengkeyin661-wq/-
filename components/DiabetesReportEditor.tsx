import React, { useMemo, useState } from 'react';
import type { DiabetesAssessmentResult } from '../types';
import {
  cloneAssessmentReport,
  finalizeEditedReport,
  getScreeningFindingSectionsFromReport,
  getScreeningSummaryNote,
  linesToList,
  listToLines,
} from '../services/diabetesReportEditUtils';

interface Props {
  report: DiabetesAssessmentResult;
  saving?: boolean;
  onCancel: () => void;
  onSave: (report: DiabetesAssessmentResult) => void | Promise<void>;
}

const inputClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30';
const labelClass = 'block text-sm font-bold text-slate-800 mb-2';

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
    <h4 className="text-sm font-bold text-slate-800 border-l-4 border-teal-500 pl-2">{title}</h4>
    {children}
  </div>
);

export const DiabetesReportEditor: React.FC<Props> = ({ report, saving = false, onCancel, onSave }) => {
  const initial = useMemo(() => {
    const draft = cloneAssessmentReport(report);
    draft.screeningFindingSections = getScreeningFindingSectionsFromReport(report);
    return draft;
  }, [report]);

  const [draft, setDraft] = useState<DiabetesAssessmentResult>(initial);
  const [screeningNote, setScreeningNote] = useState(() => getScreeningSummaryNote(report));

  const updateSectionParagraph = (sectionIndex: number, paragraphIndex: number, value: string) => {
    setDraft((prev) => {
      const sections = [...(prev.screeningFindingSections || [])];
      const section = { ...sections[sectionIndex], paragraphs: [...sections[sectionIndex].paragraphs] };
      section.paragraphs[paragraphIndex] = value;
      sections[sectionIndex] = section;
      return { ...prev, screeningFindingSections: sections };
    });
  };

  const addSectionParagraph = (sectionIndex: number) => {
    setDraft((prev) => {
      const sections = [...(prev.screeningFindingSections || [])];
      const section = { ...sections[sectionIndex], paragraphs: [...sections[sectionIndex].paragraphs, ''] };
      sections[sectionIndex] = section;
      return { ...prev, screeningFindingSections: sections };
    });
  };

  const removeSectionParagraph = (sectionIndex: number, paragraphIndex: number) => {
    setDraft((prev) => {
      const sections = [...(prev.screeningFindingSections || [])];
      const section = {
        ...sections[sectionIndex],
        paragraphs: sections[sectionIndex].paragraphs.filter((_, i) => i !== paragraphIndex),
      };
      sections[sectionIndex] = section;
      return { ...prev, screeningFindingSections: sections };
    });
  };

  const handleSave = () => {
    void onSave(finalizeEditedReport(draft, screeningNote));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-sm text-amber-900">
          正在编辑评估报告。保存后打印/导出将使用修改后的内容；点击「重新生成评估报告」会覆盖手工修改。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存报告修改'}
          </button>
        </div>
      </div>

      <Block title="报告摘要">
        <label className="block">
          <span className={labelClass}>综合摘要</span>
          <textarea
            rows={3}
            value={draft.summary}
            onChange={(e) => setDraft((p) => ({ ...p, summary: e.target.value }))}
            className={inputClass}
          />
        </label>
      </Block>

      <Block title="一、本次检查风险提示">
        <label className="block">
          <span className="text-xs text-slate-600 mb-1 block">总体说明（可选）</span>
          <textarea
            rows={2}
            value={screeningNote}
            onChange={(e) => setScreeningNote(e.target.value)}
            className={inputClass}
            placeholder="如初筛已完成项目未见异常…"
          />
        </label>
        {(draft.screeningFindingSections || []).map((section, si) => (
          <div key={section.domainId} className="border border-slate-100 rounded-lg p-3 space-y-2">
            <p className="text-sm font-bold text-slate-800">{section.itemLabel}</p>
            {section.paragraphs.map((paragraph, pi) => (
              <div key={pi} className="flex gap-2">
                <textarea
                  rows={2}
                  value={paragraph}
                  onChange={(e) => updateSectionParagraph(si, pi, e.target.value)}
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeSectionParagraph(si, pi)}
                  className="text-red-600 text-xs px-2 shrink-0 self-start mt-2"
                >
                  删除
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addSectionParagraph(si)}
              className="text-teal-700 text-xs font-medium"
            >
              + 添加段落
            </button>
          </div>
        ))}
      </Block>

      <Block title="二、项目补检建议">
        {draft.missedItems.map((item, i) => (
          <div key={i} className="grid sm:grid-cols-3 gap-2 border border-slate-100 rounded-lg p-3">
            <input
              value={item.label}
              onChange={(e) => {
                const missedItems = [...draft.missedItems];
                missedItems[i] = { ...item, label: e.target.value };
                setDraft((p) => ({ ...p, missedItems }));
              }}
              placeholder="项目"
              className={inputClass}
            />
            <input
              value={item.clinicalMeaning}
              onChange={(e) => {
                const missedItems = [...draft.missedItems];
                missedItems[i] = { ...item, clinicalMeaning: e.target.value };
                setDraft((p) => ({ ...p, missedItems }));
              }}
              placeholder="临床意义"
              className={inputClass}
            />
            <input
              value={item.recommendedCycle}
              onChange={(e) => {
                const missedItems = [...draft.missedItems];
                missedItems[i] = { ...item, recommendedCycle: e.target.value };
                setDraft((p) => ({ ...p, missedItems }));
              }}
              placeholder="建议周期"
              className={inputClass}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDraft((p) => ({
              ...p,
              missedItems: [
                ...p.missedItems,
                {
                  itemId: `custom_${Date.now()}`,
                  label: '',
                  priority: 'medium',
                  clinicalMeaning: '',
                  recommendedCycle: '',
                },
              ],
            }))
          }
          className="text-teal-700 text-xs font-medium"
        >
          + 添加补检项
        </button>
      </Block>

      <Block title="三、复检建议">
        {draft.retestAdvice.map((item, i) => (
          <div key={i} className="grid sm:grid-cols-3 gap-2 border border-slate-100 rounded-lg p-3">
            <input
              value={item.label}
              onChange={(e) => {
                const retestAdvice = [...draft.retestAdvice];
                retestAdvice[i] = { ...item, label: e.target.value };
                setDraft((p) => ({ ...p, retestAdvice }));
              }}
              placeholder="项目"
              className={inputClass}
            />
            <input
              value={item.currentFinding}
              onChange={(e) => {
                const retestAdvice = [...draft.retestAdvice];
                retestAdvice[i] = { ...item, currentFinding: e.target.value };
                setDraft((p) => ({ ...p, retestAdvice }));
              }}
              placeholder="当前发现"
              className={inputClass}
            />
            <input
              value={item.advice}
              onChange={(e) => {
                const retestAdvice = [...draft.retestAdvice];
                retestAdvice[i] = { ...item, advice: e.target.value };
                setDraft((p) => ({ ...p, retestAdvice }));
              }}
              placeholder="建议"
              className={inputClass}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDraft((p) => ({
              ...p,
              retestAdvice: [
                ...p.retestAdvice,
                {
                  itemId: `custom_${Date.now()}`,
                  label: '',
                  currentFinding: '',
                  advice: '',
                  urgency: 'routine',
                },
              ],
            }))
          }
          className="text-teal-700 text-xs font-medium"
        >
          + 添加复检项
        </button>
      </Block>

      <Block title="四、膳食指导">
        <label className="block">
          <span className="text-xs text-slate-600 mb-1 block">膳食原则（每行一条）</span>
          <textarea
            rows={4}
            value={listToLines(draft.dietPlan.principles)}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                dietPlan: { ...p.dietPlan, principles: linesToList(e.target.value) },
              }))
            }
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-600 mb-1 block">烹调方法（每行一条）</span>
          <textarea
            rows={3}
            value={listToLines(draft.dietPlan.cookingTips)}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                dietPlan: { ...p.dietPlan, cookingTips: linesToList(e.target.value) },
              }))
            }
            className={inputClass}
          />
        </label>
      </Block>

      <Block title="五、运动指导">
        <textarea
          rows={3}
          value={draft.exercisePlan.summary}
          onChange={(e) =>
            setDraft((p) => ({
              ...p,
              exercisePlan: { ...p.exercisePlan, summary: e.target.value },
            }))
          }
          className={inputClass}
        />
      </Block>

      <Block title="六、并发症就医提醒">
        <textarea
          rows={4}
          value={listToLines(draft.complicationAlerts)}
          onChange={(e) => setDraft((p) => ({ ...p, complicationAlerts: linesToList(e.target.value) }))}
          className={inputClass}
          placeholder="每行一条；留空则显示默认提示"
        />
      </Block>

      <Block title="七、指南与系统建议">
        <textarea
          rows={4}
          value={listToLines(draft.guidelineNotes)}
          onChange={(e) => setDraft((p) => ({ ...p, guidelineNotes: linesToList(e.target.value) }))}
          className={inputClass}
          placeholder="每行一条"
        />
      </Block>

      <p className="text-xs text-slate-500">
        第八节「指标科普」与第九节「联系方式」为固定模板，如需调整请修改系统配置。
      </p>
    </div>
  );
};
