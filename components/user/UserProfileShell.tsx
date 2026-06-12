import React, { useState } from 'react';
import { type HealthArchive } from '../../services/dataService';
import { loginUserDualPath } from '../../services/userLoginService';
import { fetchContent, isHealthManagerContent, type ContentItem } from '../../services/contentService';

interface Props {
  onLoginSuccess: (archive: HealthArchive) => void;
}

const PROFILE_SHELL_TIP =
  '尚未建档请先联系健康管家；首次登录密码为体检编号（6位数字），登录后须立即修改密码。预约挂号可在各栏目直接提交，若忘记密码请联系健康管家。';

export const UserProfileShell: React.FC<Props> = ({ onLoginSuccess }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [managerPhone, setManagerPhone] = useState('');

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const doctors = await fetchContent('doctor', 'active');
        const landline = doctors
          .filter(isHealthManagerContent)
          .map((m) => String(m.details?.phone || '').trim())
          .find(Boolean);
        if (!cancel) setManagerPhone(landline || '');
      } catch {
        if (!cancel) setManagerPhone('');
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = phone.trim();
    if (!p) {
      setError('请输入体检登记手机号');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await loginUserDualPath(p, password);
      if (result.success) {
        onLoginSuccess(result.archive);
      } else {
        if (result.reason === 'archive_not_found') {
          setError('未找到与该手机号关联的档案，请先联系健康管家完成建档。');
        } else if (result.reason === 'invalid_password') {
          setError('密码错误。若您已修改密码，请输入新密码；若忘记密码请联系健康管家协助重置。');
        } else if (result.reason === 'permission_denied') {
          setError('系统权限配置异常（RLS 拦截），请联系管理员检查 Supabase 策略。');
        } else {
          setError(`登录失败：${result.message || '查询异常，请稍后重试'}`);
        }
      }
    } catch (err) {
      console.error(err);
      setError('登录失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 pb-24">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl text-white shadow-sm">
              👤
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">个人服务登录</h1>
          </div>

          {managerPhone ? (
            <a
              href={`tel:${managerPhone.replace(/\s/g, '')}`}
              className="mt-5 block rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4 text-center transition-colors hover:bg-teal-100/80"
            >
              <p className="text-xs font-bold text-teal-700">健康管家固定电话</p>
              <p className="mt-1 text-xl font-black tracking-wide text-teal-900">{managerPhone}</p>
            </a>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center">
              <p className="text-xs font-bold text-slate-500">健康管家固定电话</p>
              <p className="mt-1 text-sm text-slate-400">暂未维护，请咨询健康管理中心</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">体检登记手机号</label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="username"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="11位手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">密码</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="初始密码为体检编号"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-bold text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '验证中...' : '登录'}
          </button>
        </form>

        <p className="mt-5 px-1 text-center text-xs leading-relaxed text-slate-500">{PROFILE_SHELL_TIP}</p>
      </div>
    </div>
  );
};
