import type { DiabetesAssessmentResult, ScreeningFindingSection } from '../types';

export const getScreeningFindingSectionsFromReport = (
  report: DiabetesAssessmentResult
): ScreeningFindingSection[] => {
  if (report.screeningFindingSections?.length) {
    return report.screeningFindingSections.map((s) => ({
      ...s,
      paragraphs: [...s.paragraphs],
    }));
  }

  const grouped = new Map<string, string[]>();
  for (const line of report.screeningFindings) {
    if (line.startsWith('初筛已完成') || line.startsWith('暂无社区')) continue;
    const m = line.match(/^【([^】]+)】(.+)$/);
    if (!m) continue;
    const list = grouped.get(m[1]) ?? [];
    list.push(m[2]);
    grouped.set(m[1], list);
  }

  return [...grouped.entries()].map(([itemLabel, paragraphs], index) => ({
    domainId: `legacy-${index}`,
    itemLabel,
    status: 'done' as const,
    paragraphs,
  }));
};

export const getScreeningSummaryNote = (report: DiabetesAssessmentResult): string =>
  report.screeningFindings.find((f) => f.startsWith('初筛已完成') || f.startsWith('暂无社区')) || '';

export const cloneAssessmentReport = (report: DiabetesAssessmentResult): DiabetesAssessmentResult =>
  JSON.parse(JSON.stringify(report)) as DiabetesAssessmentResult;

export const linesToList = (text: string): string[] =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

export const listToLines = (items: string[]): string => items.join('\n');

/** 保存手工编辑后，同步 screeningFindings 等派生字段 */
export const finalizeEditedReport = (
  report: DiabetesAssessmentResult,
  screeningNote: string
): DiabetesAssessmentResult => {
  const prefixNotes = screeningNote.trim() ? [screeningNote.trim()] : [];
  const fromSections =
    report.screeningFindingSections?.flatMap((s) =>
      s.paragraphs
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `【${s.itemLabel}】${p}`)
    ) ?? [];

  return {
    ...report,
    summary: report.summary.trim(),
    screeningFindings: [...prefixNotes, ...fromSections],
    missedItems: report.missedItems.filter((m) => m.label.trim()),
    retestAdvice: report.retestAdvice.filter((r) => r.label.trim()),
    complicationAlerts: report.complicationAlerts.map((s) => s.trim()).filter(Boolean),
    guidelineNotes: report.guidelineNotes.map((s) => s.trim()).filter(Boolean),
    dietPlan: {
      ...report.dietPlan,
      principles: report.dietPlan.principles.map((s) => s.trim()).filter(Boolean),
      cookingTips: report.dietPlan.cookingTips.map((s) => s.trim()).filter(Boolean),
      eatingTips: report.dietPlan.eatingTips.map((s) => s.trim()).filter(Boolean),
    },
    exercisePlan: {
      ...report.exercisePlan,
      summary: report.exercisePlan.summary.trim(),
      precautions: report.exercisePlan.precautions.map((s) => s.trim()).filter(Boolean),
    },
  };
};
