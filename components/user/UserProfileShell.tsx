import React, { useState } from 'react';
import { type HealthArchive } from '../../services/dataService';
import { loginUserDualPath } from '../../services/userLoginService';
import { fetchContent, isHealthManagerContent, type ContentItem } from '../../services/contentService';

interface Props {
  onLoginSuccess: (archive: HealthArchive) => void;
}

export const UserProfileShell: React.FC<Props> = ({ onLoginSuccess }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [managers, setManagers] = useState<ContentItem[]>([]);
  const [previewQr, setPreviewQr] = useState<string | null>(null);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const doctors = await fetchContent('doctor', 'active');
        const rows = doctors.filter(isHealthManagerContent);
        if (!cancel) setManagers(rows);
      } catch {
        if (!cancel) setManagers([]);
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
      const result = await loginUserDualPath(p, password);
      if (result.success) {
        onLoginSuccess(result.archive);
      } else {
        if (result.reason === 'archive_not_found') {
          setError('未查询到可登录档案。请联系健康管家（电话、微信号或在线消息）先完成健康建档注册后再登录。');
        } else if (result.reason === 'invalid_password') {
          setError('密码错误。若您已修改密码，请输入新密码；若忘记密码请联系健康管家协助重置。');
        } else if (result.reason === 'permission_denied') {
          setError('系统权限配置异常（RLS 拦截），请联系管理员检查 Supabase 策略。');
        } else if (result.reason === 'auth_failed') {
          setError(result.message);
        } else if (result.reason === 'auth_archive_missing') {
          setError('登录成功但未找到健康档案，请联系健康管家核对建档信息。');
        } else {
          setError(`登录失败：${result.message || '查询异常，请稍后重试'}`);
        }
      }
    } catch (err) {
      console.error(err);
      setError('登录失败，请稍后重试；如尚未建档，请联系健康管家（电话、微信号或在线消息）完成建档注册。');
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
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              请使用建档时预留的手机号登录。默认密码为体检编号，登录后可在「我的 - 账户与安全」中修改。
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left">
            <p className="text-xs font-bold text-blue-800">登录须知</p>
            <p className="mt-1 text-xs leading-relaxed text-blue-700">
              未完成健康建档注册的用户暂无法登录，请先联系健康管家完成建档。
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
            <p className="mb-3 text-xs font-black tracking-wide text-slate-700">健康管家联系方式</p>
            {managers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-600">
                请联系健康管理中心获取健康管家电话与微信。
              </p>
            ) : (
              <div className="space-y-3">
                {managers.slice(0, 3).map((m) => (
                  <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                    <div className="font-black text-slate-800">{m.title}</div>
                    <div className="mt-1 text-slate-600">电话：{m.details?.phone || m.details?.mobile || '未维护'}</div>
                    {m.details?.wechat_qr && (/^https?:\/\//i.test(String(m.details.wechat_qr)) || String(m.details.wechat_qr).startsWith('data:image')) && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">微信二维码（点击放大）</span>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 transition-colors hover:bg-slate-50"
                          onClick={() => setPreviewQr(String(m.details?.wechat_qr))}
                          title="点击放大二维码"
                        >
                          <img src={String(m.details.wechat_qr)} alt="微信二维码" className="h-16 w-16 rounded object-cover" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">预留手机号</label>
            <input
              type="tel"
              autoComplete="username"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入预留手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">密码</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="默认密码为体检编号"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <p className="mt-1.5 text-[11px] text-slate-400">若您已修改密码，请输入新密码登录。</p>
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
      </div>
      {previewQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setPreviewQr(null)}
        >
          <div className="rounded-xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={previewQr} alt="微信二维码预览" className="max-h-[80vh] max-w-[80vw] rounded" />
          </div>
        </div>
      )}
    </div>
  );
};
