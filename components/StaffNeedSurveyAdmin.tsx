import React, { useEffect, useMemo, useState } from 'react';
// @ts-ignore
import * as XLSX from 'xlsx';
import { fetchNeedSurveySubmissions, type NeedSurveySubmission } from '../services/staffNeedSurveyService';
import { getNeedSurveyShareUrl, openNeedSurvey } from '../services/staffNeedSurveyCatalog';

export const StaffNeedSurveyAdmin: React.FC = () => {
  const [rows, setRows] = useState<NeedSurveySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? getNeedSurveyShareUrl() : ''), []);

  const load = async () => {
    setLoading(true);
    const data = await fetchNeedSurveySubmissions();
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = filter === 'ALL' ? rows : rows.filter((r) => r.risk_level === filter);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.risk_level] = (acc[r.risk_level] || 0) + 1;
    return acc;
  }, {});
  const prices = rows.map((r) => Number(r.price_value)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('复制手机填写链接', shareUrl);
    }
  };

  const exportXlsx = () => {
    const sheet = filtered.map((r) => ({
      编号: r.id.slice(0, 8),
      提交时间: r.created_at,
      方式: r.mode === 'interview' ? '访谈' : '自填',
      体检编号: r.checkup_id || '',
      年龄组: r.age_group || '',
      家庭类型: r.family_type || '',
      风险分层: r.risk_level,
      明确需要上门服务: r.service_priorities,
      划算价格: r.price_value ?? '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), '需求调查');
    XLSX.writeFile(wb, `教职工需求调查问卷_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">需求调查问卷</h2>
          <p className="mt-1 text-sm text-slate-500">手机填写入口已放到用户端；此处查看已提交记录。目标样本不少于 300 户。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyLink} className="rounded-lg bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800">
            {copied ? '链接已复制' : '复制手机填写链接'}
          </button>
          <button type="button" onClick={() => openNeedSurvey()} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
            预览填写页
          </button>
          <button type="button" onClick={exportXlsx} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white">
            导出 Excel
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-dashed border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
        填写链接：<span className="break-all font-mono text-xs">{shareUrl}</span>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">有效样本</p>
          <p className="mt-1 text-3xl font-black text-slate-800">{rows.length} 户</p>
          <p className="mt-1 text-xs text-slate-400">完成目标 {Math.min(100, Math.round(rows.length / 3))}%</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">需重点及专业关注</p>
          <p className="mt-1 text-3xl font-black text-slate-800">
            {(counts['重点关注'] || 0) + (counts['专业照护'] || 0) + (counts['需尽快评估'] || 0)} 户
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">划算价格中位数</p>
          <p className="mt-1 text-3xl font-black text-slate-800">{median ? `${median} 元/月` : '待形成'}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {['ALL', '普通健康管理', '重点关注', '专业照护', '需尽快评估'].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              filter === k ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'
            }`}
          >
            {k === 'ALL' ? `全部 ${rows.length}` : `${k} ${counts[k] || 0}`}
          </button>
        ))}
        <button type="button" onClick={() => void load()} className="ml-auto text-xs font-bold text-teal-700">
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="px-4 py-3">编号</th>
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">年龄</th>
              <th className="px-4 py-3">家庭</th>
              <th className="px-4 py-3">分层</th>
              <th className="px-4 py-3">上门优先</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  {loading ? '加载中…' : '暂无提交'}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs">{new Date(r.created_at).toLocaleString('zh-CN')}</td>
                  <td className="px-4 py-3">{r.age_group || '—'}</td>
                  <td className="px-4 py-3">{r.family_type || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800">{r.risk_level}</span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-500">{r.service_priorities || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
