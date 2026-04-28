import React, { useState } from 'react';
import { type HealthArchive } from '../../services/dataService';
import { loginUserDualPath, registerPortalUser } from '../../services/userLoginService';
import { fetchContent, isHealthManagerContent, type ContentItem } from '../../services/contentService';

interface Props {
  onLoginSuccess: (archive: HealthArchive | null, options?: { needsArchiveBinding?: boolean }) => void;
}

export const UserProfileShell: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');
  const [showRegister, setShowRegister] = useState(false);
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
    const u = username.trim();
    if (!u) {
      setError('请输入用户名');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await loginUserDualPath(u, password);
      if (result.success) {
        if (result.archive) {
          onLoginSuccess(result.archive);
        } else {
          onLoginSuccess(null, { needsArchiveBinding: true });
        }
      } else {
        if (result.reason === 'archive_not_found') {
          setError('账号不存在，请先注册。');
        } else if (result.reason === 'invalid_password') {
          setError('密码错误。若您已修改密码，请输入新密码；若忘记密码请联系健康管家协助重置。');
        } else if (result.reason === 'permission_denied') {
          setError('系统权限配置异常（RLS 拦截），请联系管理员检查 Supabase 策略。');
        } else if (result.reason === 'auth_failed') {
          setError(result.message);
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

  const handleRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const u = registerUsername.trim();
    if (!u) {
      setRegisterMessage('请输入用户名');
      return;
    }
    if (!registerPassword) {
      setRegisterMessage('请输入密码');
      return;
    }
    if (registerPassword.length < 6) {
      setRegisterMessage('密码至少 6 位');
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setRegisterMessage('两次密码不一致');
      return;
    }
    setRegistering(true);
    setRegisterMessage('');
    try {
      const result = await registerPortalUser(u, registerPassword);
      if (!result.success) {
        setRegisterMessage(result.message);
        return;
      }
      setRegisterMessage(result.message || '注册成功');
      setUsername(u);
      setPassword(registerPassword);
      setShowRegister(false);
      setRegisterPassword('');
      setRegisterConfirmPassword('');
    } catch (err) {
      console.error(err);
      setRegisterMessage('注册失败，请稍后重试');
    } finally {
      setRegistering(false);
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
              请使用用户名和密码登录。若未建档，可先注册并浏览医疗资源；健康档案与随访功能需完成建档后使用。
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left">
            <p className="text-xs font-bold text-blue-800">登录须知</p>
            <p className="mt-1 text-xs leading-relaxed text-blue-700">
              未建档用户可先注册并登录浏览资源；如需查看健康档案或随访记录，请联系管理员完成建档。
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
            <label className="mb-1.5 block text-sm font-bold text-slate-700">用户名</label>
            <input
              type="text"
              autoComplete="username"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-slate-700">密码</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入密码"
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
          <button
            type="button"
            className="w-full rounded-xl border border-blue-200 bg-blue-50 py-3 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100"
            onClick={() => {
              setShowRegister((v) => !v);
              setRegisterMessage('');
            }}
          >
            {showRegister ? '收起注册' : '没有账号？先注册'}
          </button>
        </form>

        {showRegister && (
          <form onSubmit={handleRegister} className="mt-4 space-y-3 rounded-3xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm font-bold text-blue-900">用户注册</p>
            <p className="text-xs text-blue-700">注册后可先浏览医疗资源。健康档案/随访功能需建档后开放。</p>
            <div>
              <label className="mb-1 block text-xs font-bold text-blue-900">用户名（登录名）</label>
              <input
                type="text"
                autoComplete="username"
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入用户名"
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
                disabled={registering}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-blue-900">密码</label>
              <input
                type="password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="至少6位"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                disabled={registering}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-blue-900">确认密码</label>
              <input
                type="password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="再次输入密码"
                value={registerConfirmPassword}
                onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                disabled={registering}
              />
            </div>
            {registerMessage ? (
              <p className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700">{registerMessage}</p>
            ) : null}
            <button
              type="submit"
              disabled={registering}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {registering ? '注册中...' : '注册'}
            </button>
          </form>
        )}
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
