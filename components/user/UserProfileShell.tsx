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
            未建档用户请先联系健康管家完成建档注册，建档后才可登录。
          </div>
          <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3 text-left">
            <p className="text-xs font-bold text-teal-800 mb-2">健康管家联系方式</p>
            {managers.length === 0 ? (
              <p className="text-xs text-teal-700">请联系健康管理中心获取健康管家电话与微信。</p>
            ) : (
              <div className="space-y-2">
                {managers.slice(0, 3).map((m) => (
                  <div key={m.id} className="rounded-lg bg-white/80 border border-teal-100 px-2 py-2 text-xs text-slate-700">
                    <div className="font-bold text-slate-800">{m.title}</div>
                    <div>电话：{m.details?.phone || m.details?.mobile || '未维护'}</div>
                    {m.details?.wechat_qr && (/^https?:\/\//i.test(String(m.details.wechat_qr)) || String(m.details.wechat_qr).startsWith('data:image')) && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          className="rounded border border-slate-200 bg-white p-1"
                          onClick={() => setPreviewQr(String(m.details?.wechat_qr))}
                          title="点击放大二维码"
                        >
                          <img src={String(m.details.wechat_qr)} alt="微信二维码" className="h-20 w-20 rounded object-cover" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
