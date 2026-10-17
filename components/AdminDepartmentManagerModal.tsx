import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { HealthArchive } from '../services/dataService';
import {
  collectDepartmentsFromArchives,
  extractDepartmentsFromExcelRow,
  loadAdminDepartments,
  mergeUniqueDepartments,
  parseDepartmentLines,
  saveAdminDepartments,
} from '../services/adminDepartmentCatalogService';
// @ts-ignore
import * as XLSX from 'xlsx';

interface Props {
  open: boolean;
  onClose: () => void;
  archives: HealthArchive[];
  selectedCount: number;
  onBatchAssignDepartment?: (department: string) => Promise<void>;
  onCatalogSaved?: (departments: string[]) => void;
}

export const AdminDepartmentManagerModal: React.FC<Props> = ({
  open,
  onClose,
  archives,
  selectedCount,
  onBatchAssignDepartment,
  onCatalogSaved,
}) => {
  const [draft, setDraft] = useState<string[]>(() => loadAdminDepartments());
  const [batchText, setBatchText] = useState('');
  const [assignDept, setAssignDept] = useState('');
  const [assigning, setAssigning] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const archiveDeptCount = useMemo(() => collectDepartmentsFromArchives(archives).length, [archives]);

  useEffect(() => {
    if (open) setDraft(loadAdminDepartments());
  }, [open]);

  if (!open) return null;

  const persist = (next: string[]) => {
    const merged = mergeUniqueDepartments([], next);
    setDraft(merged);
    saveAdminDepartments(merged);
    onCatalogSaved?.(merged);
  };

  const handleBatchAddText = () => {
    const extra = parseDepartmentLines(batchText);
    if (!extra.length) {
      alert('请粘贴部门名称，每行一个，或用逗号、分号分隔');
      return;
    }
    persist(mergeUniqueDepartments(draft, extra));
    setBatchText('');
    alert(`已添加 ${extra.length} 个部门名称（重复已自动合并）`);
  };

  const handleSyncFromArchives = () => {
    const fromArchives = collectDepartmentsFromArchives(archives);
    if (!fromArchives.length) {
      alert('当前档案中尚无部门信息可同步');
      return;
    }
    persist(mergeUniqueDepartments(draft, fromArchives));
    alert(`已从 ${fromArchives.length} 个现有部门名称合并到部门库`);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const names: string[] = [];
      for (const row of rows) {
        names.push(...extractDepartmentsFromExcelRow(row));
      }
      const unique = mergeUniqueDepartments([], names);
      if (!unique.length) {
        alert('未识别到部门列，请使用含「部门」「单位/部门」等表头的 Excel');
        return;
      }
      persist(mergeUniqueDepartments(draft, unique));
      alert(`已从 Excel 导入 ${unique.length} 个部门名称`);
    } catch {
      alert('Excel 读取失败，请检查文件格式');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const handleAssignSelected = async () => {
    const dept = assignDept.trim();
    if (!dept) {
      alert('请选择或输入要设置的部门名称');
      return;
    }
    if (!selectedCount) {
      alert('请先在人员列表中勾选要批量设置部门的人员');
      return;
    }
    if (!onBatchAssignDepartment) return;
    if (!confirm(`确定将选中的 ${selectedCount} 人的部门设置为「${dept}」吗？`)) return;
    setAssigning(true);
    try {
      await onBatchAssignDepartment(dept);
      if (!draft.includes(dept)) {
        persist(mergeUniqueDepartments(draft, [dept]));
      }
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">单位/部门管理</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              批量维护部门名称库，编辑档案时可下拉选择；支持从 Excel 或现有档案同步。
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl font-bold text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-bold text-slate-800 mb-2">批量添加部门名称</h4>
            <p className="text-xs text-slate-500 mb-2">每行一个，或用逗号、分号、顿号分隔</p>
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              rows={5}
              placeholder={'示例：\n校办公室\n人事处\n计算机学院\n后勤集团'}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBatchAddText}
                className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700"
              >
                添加到部门库
              </button>
              <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
              >
                从 Excel 导入
              </button>
              <button
                type="button"
                onClick={handleSyncFromArchives}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                从现有档案同步（{archiveDeptCount}）
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Excel 表头支持：部门、单位、单位/部门、院系、学院 等
            </p>
          </section>

          {selectedCount > 0 && onBatchAssignDepartment && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <h4 className="text-sm font-bold text-amber-900 mb-2">批量设置选中人员部门</h4>
              <p className="text-xs text-amber-800/80 mb-3">已选中 {selectedCount} 人</p>
              <div className="flex flex-wrap gap-2">
                <input
                  list="admin-dept-assign-list"
                  value={assignDept}
                  onChange={(e) => setAssignDept(e.target.value)}
                  placeholder="选择或输入部门名称"
                  className="min-w-[200px] flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                />
                <datalist id="admin-dept-assign-list">
                  {draft.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                <button
                  type="button"
                  disabled={assigning}
                  onClick={() => void handleAssignSelected()}
                  className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  {assigning ? '设置中…' : '应用到选中人员'}
                </button>
              </div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">部门库（{draft.length}）</h4>
              {draft.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('确定清空全部部门名称吗？不影响已建档人员的部门字段。')) persist([]);
                  }}
                  className="text-xs font-bold text-red-500 hover:underline"
                >
                  清空
                </button>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-dashed border-slate-200 p-3 flex flex-wrap gap-2">
              {draft.length === 0 ? (
                <span className="text-xs text-slate-400">暂无部门，请批量添加或从档案同步</span>
              ) : (
                draft.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {name}
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600 font-bold"
                      onClick={() => persist(draft.filter((x) => x !== name))}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-teal-600 px-6 py-2 text-sm font-bold text-white hover:bg-teal-700"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
