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
    <div className="bg-slate-50 min-h-full pb-28 px-6 py-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center text-3xl text-white font-bold mx-auto mb-4 shadow-lg">
            👤
          </div>
          <h1 className="text-xl font-black text-slate-800">登录后使用个人服务</h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            登录后可查看健康档案、随访与计划，以及签约、预约等记录
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">体检编号或手机号</label>
            <input
              type="text"
              autoComplete="username"
              className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              placeholder="请输入体检编号或预留手机号"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
          </div>
          {error ? <p className="text-xs text-red-600 font-bold text-center">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '验证中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
};
