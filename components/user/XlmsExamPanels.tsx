import React, { useEffect, useMemo, useState } from 'react';
import type { XlmsExamResultLine, XlmsExamSnapshot } from '../../types';

interface Props {
  exams?: XlmsExamSnapshot[];
}

const groupKey = (department?: string, group?: string) => `${department || ''}||${group || ''}`;

const groupTitle = (department?: string, group?: string) => {
  const parts = [department, group].map((part) => (part || '').trim()).filter(Boolean);
  if (parts.length === 2 && parts[0] === parts[1]) return parts[0];
  return parts.join(' / ') || '其他项目';
};

const formatResult = (line: XlmsExamResultLine) => {
  const value = (line.result || '').trim();
  const unit = (line.unit || '').trim();
  if (!value) return '未填';
  if (!unit || value.includes(unit)) return value;
  return `${value} ${unit}`;
};

const isLong = (text: string) => text.length > 36 || text.includes('\n');

interface ExamGroup {
  key: string;
  department?: string;
  group?: string;
  summary: string;
  done: boolean;
  lines: XlmsExamResultLine[];
}

const buildGroups = (exam: XlmsExamSnapshot): ExamGroup[] => {
  const groups: ExamGroup[] = [];
  const index = new Map<string, ExamGroup>();
  const take = (department?: string, group?: string, done = true) => {
    const key = groupKey(department, group);
    let found = index.get(key);
    if (!found) {
      found = { key, department, group, summary: '', done, lines: [] };
      index.set(key, found);
      groups.push(found);
    }
    return found;
  };

  for (const department of exam.departments || []) {
    const card = take(department.department, department.group, department.done !== false);
    card.summary = (department.summary || '').trim();
    card.done = department.done !== false;
  }
  for (const line of exam.results || []) {
    take(line.department, line.group).lines.push(line);
  }
  return groups.filter((card) => card.lines.length > 0 || card.summary || !card.done);
};

export const XlmsExamPanels: React.FC<Props> = ({ exams }) => {
  const sorted = useMemo(
    () =>
      [...(exams || [])].sort((left, right) => {
        const byDate = (right.examDate || '').localeCompare(left.examDate || '');
        if (byDate) return byDate;
        return Number(right.tjcs || 0) - Number(left.tjcs || 0);
      }),
    [exams]
  );
  const signature = sorted.map((exam) => `${exam.examDate}|${exam.tjcs}|${exam.results?.length || 0}`).join(',');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [signature]);

  if (!sorted.length) {
    return <p className="text-sm text-slate-400">这次档案里还没有逐项体检结果。</p>;
  }

  const current = sorted[Math.min(index, sorted.length - 1)];
  const groups = buildGroups(current);
  const shown = new Set(groups.map((card) => groupTitle(card.department, card.group)));
  const unfinished = (current.unfinished || []).filter((label) => label && !shown.has(label));
  const resultCount = current.results?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">本次体检全部结果</h3>
          <p className="mt-1 text-xs text-slate-400">
            {current.examDate || '未填日期'}
            {current.tjcs != null && current.tjcs !== '' ? ` · 第 ${current.tjcs} 次` : ''}
            {` · ${resultCount} 项`}
          </p>
        </div>
        {sorted.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {sorted.map((exam, examIndex) => (
              <button
                key={`${exam.examDate}-${exam.tjcs}-${examIndex}`}
                type="button"
                aria-pressed={examIndex === Math.min(index, sorted.length - 1)}
                onClick={() => setIndex(examIndex)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  examIndex === Math.min(index, sorted.length - 1)
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {exam.examDate || `第 ${examIndex + 1} 次`}
              </button>
            ))}
          </div>
        )}
      </div>

      {(current.diagnoses || []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {current.diagnoses!.map((name, nameIndex) => (
            <span key={`${name}-${nameIndex}`} className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
              {name}
            </span>
          ))}
        </div>
      )}

      {groups.map((card) => {
        const shortLines = card.lines.filter((line) => !isLong(formatResult(line)));
        const longLines = card.lines.filter((line) => isLong(formatResult(line)));
        return (
          <section key={card.key} className="overflow-hidden rounded-xl border border-slate-100 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <h4 className="text-sm font-bold text-slate-800">{groupTitle(card.department, card.group)}</h4>
              {!card.done && <span className="text-xs font-bold text-slate-400">尚未出结果</span>}
            </div>
            <div className="space-y-3 px-4 py-3">
              {card.summary && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{card.summary}</p>
              )}
              {!card.lines.length && !card.summary && (
                <p className="text-xs text-slate-400">这项在体检软件里还没有明细。</p>
              )}
              {shortLines.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {shortLines.map((line, lineIndex) => (
                    <div key={`${line.name}-${lineIndex}`} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-[11px] text-slate-400">{line.name || '未命名项目'}</div>
                      <div className="mt-0.5 text-sm font-bold text-slate-700">{formatResult(line)}</div>
                      {line.range && <div className="mt-0.5 text-[11px] text-slate-400">参考 {line.range}</div>}
                    </div>
                  ))}
                </div>
              )}
              {longLines.map((line, lineIndex) => (
                <div key={`${line.name}-long-${lineIndex}`} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-[11px] font-bold text-slate-500">{line.name || '未命名项目'}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{formatResult(line)}</div>
                  {line.range && <div className="mt-1 text-[11px] text-slate-400">参考 {line.range}</div>}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {unfinished.length > 0 && (
        <section className="rounded-xl border border-slate-100 bg-white px-4 py-3">
          <h4 className="text-sm font-bold text-slate-800">尚未回传的项目</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {unfinished.map((label) => (
              <span key={label} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                {label}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
