import React, { useState } from 'react';
import type { HealthAssessment, HealthRecord } from '../../types';
import {
  DEFAULT_ARCHIVE_TREND_LABELS,
  optionalArchivePrintMetrics,
} from '../../services/archiveTrendPrintHtml';
import { buildUserHealthArchivePrintHtml } from '../../services/userArchivePrint';

interface Props {
  record: HealthRecord;
  assessment?: HealthAssessment;
  checkupId: string;
  className?: string;
}

export const UserArchivePrintButton: React.FC<Props> = ({
  record,
  assessment,
  checkupId,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const options = optionalArchivePrintMetrics();

  const toggle = (code: string) => {
    setSelected((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  };

  const handlePrint = () => {
    const printWindow = window.open(
      '',
      '_blank',
      'height=900,width=800,menubar=no,toolbar=no,location=no,status=no,titlebar=no'
    );
    if (!printWindow) {
      alert('浏览器拦截了弹窗，请允许本站弹出窗口以便打印或保存为 PDF。');
      return;
    }
    setPrinting(true);
    void (async () => {
      try {
        const html = await buildUserHealthArchivePrintHtml({
          record,
          assessment,
          checkupId,
          extraMetricCodes: selected,
        });
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        setOpen(false);
      } catch {
        printWindow.close();
        alert('生成健康档案失败，请稍后重试。');
      } finally {
        setPrinting(false);
      }
    })();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white ${className}`}
      >
        下载 / 打印
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-base font-bold text-slate-800">下载 / 打印健康档案</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                将打开打印窗口，可直接打印或保存为 PDF。默认包含
                {DEFAULT_ARCHIVE_TREND_LABELS.join('、')}
                趋势，也可勾选其他指标一并打印。
              </p>
              <p className="mt-2 text-xs font-bold leading-relaxed text-red-700">
                打印稿不含医生签名。内容仅供个人健康参考，不能作为诊断或处方。
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">可选趋势图</span>
                <button
                  type="button"
                  className="text-xs font-bold text-teal-700"
                  onClick={() =>
                    setSelected((current) =>
                      current.length === options.length ? [] : options.map((item) => item.code)
                    )
                  }
                >
                  {selected.length === options.length ? '清空' : '全选'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {options.map((item) => (
                  <label
                    key={item.code}
                    className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-2 text-xs text-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.includes(item.code)}
                      onChange={() => toggle(item.code)}
                    />
                    <span>
                      {item.label}
                      {item.unit ? <span className="text-slate-400">（{item.unit}）</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-bold text-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                disabled={printing}
                onClick={handlePrint}
                className="flex-1 rounded-lg bg-teal-600 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {printing ? '正在生成…' : '打印'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
