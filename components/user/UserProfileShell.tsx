import React, { useState } from 'react';
import { authenticateUserByPhone, type HealthArchive } from '../../services/dataService';

interface Props {
  onLoginSuccess: (archive: HealthArchive) => void;
}

export const UserProfileShell: React.FC<Props> = ({ onLoginSuccess }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = phone.trim();
    if (!p) {
      setError('请输入预留手机号');
      return;
    }
    if (!password) {
      setError('请输入密码（默认与体检编号相同）');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const archive = await authenticateUserByPhone(p, password);
      if (archive) {
        onLoginSuccess(archive);
      } else {
        setError('未查询到可登录档案。请联系健康管家（电话、微信号或在线消息）先完成健康建档注册后再登录。');
      }
    } catch (err) {
      console.error(err);
      setError('登录失败，请稍后重试；如尚未建档，请联系健康管家（电话、微信号或在线消息）完成建档注册。');
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
            仅已完成健康建档注册的用户可登录。请使用预留手机号登录；默认密码为体检编号，登录后可在「我的」中修改密码。
          </p>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs leading-relaxed text-amber-800">
            未建档用户请先联系健康管家完成建档注册，可通过电话、微信号或在线消息联系。
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">预留手机号</label>
            <input
              type="tel"
              autoComplete="username"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="请输入预留手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">密码</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="默认密码为体检编号"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
