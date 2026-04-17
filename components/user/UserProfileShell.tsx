import React, { useState } from 'react';
import { findArchiveByCheckupId, findArchiveByPhone, type HealthArchive } from '../../services/dataService';

interface Props {
  onLoginSuccess: (archive: HealthArchive) => void;
}

export const UserProfileShell: React.FC<Props> = ({ onLoginSuccess }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = input.trim();
    if (!raw) {
      setError('请输入体检编号或预留手机号');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let archive = await findArchiveByCheckupId(raw);
      if (!archive) {
        archive = await findArchiveByPhone(raw);
      }
      if (archive) {
        onLoginSuccess(archive);
      } else {
        setError('未找到档案，请核对体检编号或预留手机号');
      }
    } catch (err) {
      console.error(err);
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 px-5 py-8 pb-28">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center text-3xl text-white font-bold mx-auto mb-4 shadow-lg">
            👤
          </div>
          <h1 className="text-xl font-black text-slate-800">登录后使用个人服务</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            登录后可查看健康档案、随访与计划，以及签约、预约等记录
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">体检编号或手机号</label>
            <input
              type="text"
              autoComplete="username"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="请输入体检编号或预留手机号"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
          </div>
          {error ? <p className="text-sm text-center font-bold text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal-600 py-3.5 text-base font-bold text-white shadow-md transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? '验证中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
};
