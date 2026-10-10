import React, { useEffect, useRef, useState } from 'react';

const RISK_CHIPS: { id: string; label: string }[] = [
  { id: 'ALL', label: '全部' },
  { id: 'RED', label: '高风险' },
  { id: 'CRITICAL', label: '危急值' },
  { id: 'DIABETES', label: '高血糖' },
  { id: 'HYPERTENSION', label: '高血压' },
  { id: 'LIPID', label: '血脂' },
];

const ADVANCED_RISK_OPTIONS: { id: string; label: string }[] = [
  { id: 'YELLOW', label: '中风险' },
  { id: 'GREEN', label: '低风险' },
  { id: 'DIABETES_REPORT', label: '已有糖尿病评估' },
  { id: 'HYPERTENSION_REPORT', label: '已有高血压评估' },
  { id: 'LIPID_REPORT', label: '已有血脂评估' },
];

interface Props {
  searchTerm: string;
  onSearchTermChange: (v: string) => void;
  filterRisk: string;
  onFilterRiskChange: (v: string) => void;
  filterDepartment: string;
  onFilterDepartmentChange: (v: string) => void;
  departmentOptions: string[];
  pageSize: number;
  onPageSizeChange: (v: number) => void;
  filteredCount: number;
  filterSummary: string;
  cacheHint: string | null;
  isRefreshing: boolean;
  skipFilled: boolean;
  onSkipFilledChange: (v: boolean) => void;
  selectedCount: number;
  onDepartmentManage: () => void;
  onExportList: () => void;
  onRefresh: () => void;
  onBatchDelete: () => void;
  onImportQuestionnaire: () => void;
  onBatchUploadReports: () => void;
  onSmartBatch: () => void;
  onBatchFixBmi: () => void;
  onOpenSms: () => void;
  smsConfigured: boolean;
  questionnaireImportRef: React.Ref<HTMLInputElement>;
  checkUploadRef: React.Ref<HTMLInputElement>;
  onQuestionnaireFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCheckUploadFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AdminPersonnelToolbar: React.FC<Props> = ({
  searchTerm,
  onSearchTermChange,
  filterRisk,
  onFilterRiskChange,
  filterDepartment,
  onFilterDepartmentChange,
  departmentOptions,
  pageSize,
  onPageSizeChange,
  filteredCount,
  filterSummary,
  cacheHint,
  isRefreshing,
  skipFilled,
  onSkipFilledChange,
  selectedCount,
  onDepartmentManage,
  onExportList,
  onRefresh,
  onBatchDelete,
  onImportQuestionnaire,
  onBatchUploadReports,
  onSmartBatch,
  onBatchFixBmi,
  onOpenSms,
  smsConfigured,
  questionnaireImportRef,
  checkUploadRef,
  onQuestionnaireFileChange,
  onCheckUploadFileChange,
}) => {
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  const isAdvancedActive = ADVANCED_RISK_OPTIONS.some((o) => o.id === filterRisk);

  useEffect(() => {
    if (!moreActionsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(e.target as Node)) {
        setMoreActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreActionsOpen]);

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm">
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-teal-100 bg-teal-50/80 px-4 py-2 text-xs">
          <span className="font-bold text-teal-900">已选 {selectedCount} 人</span>
          <button
            type="button"
            onClick={onDepartmentManage}
            className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 font-bold text-teal-800 hover:bg-teal-50"
          >
            批量设置部门
          </button>
          <button
            type="button"
            onClick={onBatchDelete}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-bold text-red-600 hover:bg-red-50"
          >
            删除选中
          </button>
        </div>
      )}

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 max-w-md">
            <input
              type="text"
              placeholder="搜索姓名、编号、电话..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-teal-500"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
            />
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          </div>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none max-w-[180px]"
            value={filterDepartment}
            onChange={(e) => onFilterDepartmentChange(e.target.value)}
            title="按单位/部门筛选"
          >
            <option value="ALL">全部部门</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            title="每页显示人数"
          >
            <option value={10}>每页 10 人</option>
            <option value={20}>每页 20 人</option>
            <option value={50}>每页 50 人</option>
          </select>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            共 {filteredCount} 人{filterSummary}
          </span>
          {cacheHint ? (
            <span className="text-xs text-slate-400 whitespace-nowrap" title="30 分钟内再次打开将直接使用本地缓存">
              {isRefreshing ? '同步中…' : cacheHint}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {RISK_CHIPS.map((chip) => {
            const active = filterRisk === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onFilterRiskChange(chip.id)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  active
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreFiltersOpen((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-bold border transition-colors ${
                isAdvancedActive
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              更多筛选 ▾
            </button>
            {moreFiltersOpen ? (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMoreFiltersOpen(false)} aria-hidden />
                <div className="absolute left-0 top-full z-40 mt-1 min-w-[12rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {ADVANCED_RISK_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`block w-full px-3 py-2 text-left text-xs hover:bg-slate-50 ${
                        filterRisk === opt.id ? 'font-bold text-teal-700 bg-teal-50' : 'text-slate-700'
                      }`}
                      onClick={() => {
                        onFilterRiskChange(opt.id);
                        setMoreFiltersOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3">
          <label className="flex cursor-pointer select-none items-center gap-2" title="若档案中问卷已有内容，则跳过不更新">
            <input
              type="checkbox"
              checked={skipFilled}
              onChange={(e) => onSkipFilledChange(e.target.checked)}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs font-medium text-slate-600">导入问卷时跳过已完善</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={questionnaireImportRef}
              className="hidden"
              accept=".xlsx, .xls"
              onChange={onQuestionnaireFileChange}
            />
            <input
              type="file"
              ref={checkUploadRef}
              className="hidden"
              multiple
              accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
              onChange={onCheckUploadFileChange}
            />

            <button
              type="button"
              onClick={onDepartmentManage}
              className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50"
            >
              部门管理
            </button>
            <button
              type="button"
              onClick={onExportList}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              导出列表
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              title="强制从云端重新加载"
            >
              {isRefreshing ? '刷新中…' : '刷新'}
            </button>

            <div className="relative" ref={moreActionsRef}>
              <button
                type="button"
                onClick={() => setMoreActionsOpen((v) => !v)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                更多操作 ▾
              </button>
              {moreActionsOpen ? (
                <div className="absolute right-0 top-full z-40 mt-1 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      onImportQuestionnaire();
                    }}
                  >
                    导入问卷更新
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      onBatchUploadReports();
                    }}
                  >
                    批量上传历年报告
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      onSmartBatch();
                    }}
                  >
                    智能建档
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      onBatchFixBmi();
                    }}
                  >
                    BMI 修复
                  </button>
                  <button
                    type="button"
                    disabled={!smsConfigured}
                    title={smsConfigured ? '向筛选或选中人员发送短信' : '需配置短信环境变量'}
                    className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      onOpenSms();
                    }}
                  >
                    发送短信
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
