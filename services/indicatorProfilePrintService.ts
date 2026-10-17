/**
 * 专项筛查「分项指标档案」打印（糖尿病 / 高血压共用）
 */

const SOURCE_LABEL: Record<string, string> = {
  screening: '专项筛查',
  checkup: '健康档案',
  both: '筛查+档案',
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export interface IndicatorProfilePrintItem {
  itemId: string;
  label: string;
  status: 'present' | 'missing';
  value?: string;
  referenceRange: string;
  clinicalMeaning?: string;
  retestCycle: string;
  dataSource?: string;
  observedDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface IndicatorProfilePrintCategory {
  categoryId: string;
  label: string;
  presentCount: number;
  items: IndicatorProfilePrintItem[];
}

export interface IndicatorProfilePrintData {
  categories: IndicatorProfilePrintCategory[];
  totalItems: number;
  presentCount: number;
  missingCount: number;
  missingHighPriority: IndicatorProfilePrintItem[];
  linkedArchiveCheckupId?: string | null;
  archiveCheckupDate?: string;
  generatedAt: string;
}

export interface PrintIndicatorProfileOptions {
  moduleTitle: string;
  documentTitle?: string;
  accentColor?: string;
  patientName?: string;
  profile: IndicatorProfilePrintData;
}

const buildCategoryHtml = (categories: IndicatorProfilePrintCategory[]): string =>
  categories
    .map((cat) => {
      const rows = cat.items
        .map((item) => {
          const result =
            item.status === 'present'
              ? escapeHtml(item.value || '—')
              : '<span class="missing">未检测</span>';
          const source = item.dataSource
            ? escapeHtml(SOURCE_LABEL[item.dataSource] || item.dataSource)
            : '—';
          const date = item.observedDate
            ? `<div class="sub">${escapeHtml(item.observedDate)}</div>`
            : '';
          const highMark =
            item.status === 'missing' && item.priority === 'high'
              ? ' <span class="high">高</span>'
              : '';
          return `<tr class="${item.status === 'missing' ? 'row-missing' : ''}">
            <td>${escapeHtml(item.label)}${highMark}</td>
            <td>${result}</td>
            <td>${escapeHtml(item.referenceRange)}</td>
            <td>${source}${date}</td>
            <td>${escapeHtml(item.retestCycle)}</td>
          </tr>`;
        })
        .join('');
      return `<div class="section">
        <h3>${escapeHtml(cat.label)} <span class="muted">（${cat.presentCount}/${cat.items.length} 项已有数据）</span></h3>
        <table>
          <thead><tr><th>指标</th><th>结果</th><th>参考范围</th><th>来源</th><th>补测/复查</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join('');

export const printIndicatorProfile = (options: PrintIndicatorProfileOptions): void => {
  const printWindow = window.open('', '_blank', 'height=900,width=900');
  if (!printWindow) {
    alert('浏览器拦截了弹窗，请允许本站弹出窗口以便打印。');
    return;
  }

  const {
    moduleTitle,
    documentTitle = '分项指标档案',
    accentColor = '#0d9488',
    patientName,
    profile,
  } = options;

  const nameLine = patientName ? escapeHtml(patientName) : '参与者';
  const generated = (profile.generatedAt || new Date().toISOString()).slice(0, 10);

  const priorityHtml = profile.missingHighPriority.length
    ? `<div class="priority-box">
        <h3>优先补测提醒</h3>
        <ul>${profile.missingHighPriority
          .map(
            (item) =>
              `<li><strong>${escapeHtml(item.label)}</strong> — 建议 ${escapeHtml(item.retestCycle)}${
                item.clinicalMeaning ? `<br/><span class="muted">${escapeHtml(item.clinicalMeaning)}</span>` : ''
              }</li>`
          )
          .join('')}</ul>
      </div>`
    : '';

  const metaParts = [
    profile.linkedArchiveCheckupId
      ? `关联档案：${escapeHtml(profile.linkedArchiveCheckupId)}`
      : '',
    profile.archiveCheckupDate ? `档案体检日期：${escapeHtml(profile.archiveCheckupDate)}` : '',
    `已检 ${profile.presentCount}/${profile.totalItems} · 待补测 ${profile.missingCount}`,
  ].filter(Boolean);

  printWindow.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${escapeHtml(documentTitle)}</title>
    <style>
      body{font-family:"Microsoft YaHei",sans-serif;padding:32px 40px;font-size:14px;line-height:1.6;color:#333}
      .header{text-align:center;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:20px}
      .header p{margin:0;color:#555;font-size:13px}
      .header h1{font-size:24px;margin:8px 0 0}
      .meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-top:12px;color:#555;font-size:13px}
      .stats{margin:16px 0;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px}
      .priority-box{margin-bottom:20px;padding:14px 16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px}
      .priority-box h3{margin:0 0 8px;font-size:15px;color:#92400e}
      .priority-box ul{margin:0;padding-left:20px;color:#78350f}
      .section{margin-bottom:22px;page-break-inside:avoid}
      .section h3{font-size:15px;border-left:4px solid ${accentColor};padding-left:8px;margin:0 0 10px}
      .muted{color:#888;font-weight:normal;font-size:12px}
      .sub{font-size:11px;color:#999}
      .missing{color:#b45309;font-weight:600}
      .high{color:#dc2626;font-size:11px;font-weight:bold}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #ddd;padding:7px 8px;text-align:left;font-size:12px;vertical-align:top}
      th{background:#f8fafc;font-weight:600}
      tr.row-missing td{background:#fffbeb}
      .footer{margin-top:28px;padding-top:12px;border-top:1px solid #ddd;font-size:12px;color:#888;text-align:center}
      @media print{body{padding:20px}}
    </style></head><body>
    <div class="header">
      <p>${escapeHtml(moduleTitle)}</p>
      <h1>${escapeHtml(documentTitle)}</h1>
      <div class="meta">
        <span>姓名：${nameLine}</span>
        <span>打印日期：${new Date().toISOString().slice(0, 10)}</span>
        <span>档案生成：${generated}</span>
      </div>
    </div>
    <div class="stats">${metaParts.map((p) => `<span>${p}</span>`).join(' · ')}</div>
    ${priorityHtml}
    ${buildCategoryHtml(profile.categories)}
    <div class="footer">本档案汇总专项筛查与健康档案已有检测数据，未检测项目请参考补测/复查建议。</div>
    </body></html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 400);
};
