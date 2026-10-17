import React, { useState } from 'react';
import type { HealthAssessment, HealthRecord } from '../../types';
import { buildHealthArchivePrintHtml } from '../../services/archiveReportPrint';

interface Props {
  record: HealthRecord;
  assessment?: HealthAssessment;
  checkupId: string;
}

export const UserArchivePrintButton: React.FC<Props> = ({ record, assessment, checkupId }) => {
  const [printing, setPrinting] = useState(false);

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
        const html = await buildHealthArchivePrintHtml({
          assessment,
          patientName: record.profile.name,
          profile: record.profile,
          checkupId,
          audience: 'user',
        });
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      } catch {
        printWindow.close();
        alert('生成健康档案失败，请稍后重试。');
      } finally {
        setPrinting(false);
      }
    })();
  };

  return (
    <button
      type="button"
      disabled={printing}
      onClick={handlePrint}
      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
    >
      {printing ? '正在生成…' : '下载 / 打印'}
    </button>
  );
};
