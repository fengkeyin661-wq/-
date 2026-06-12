import React, { useEffect, useState } from 'react';
import { updatePortalPassword } from '../../services/dataService';

interface Props {
  open: boolean;
  checkupId: string;
  onSuccess: () => void;
}

export const ForcePasswordChangeModal: React.FC<Props> = ({ open, checkupId, onSuccess }) => {
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setPwdNew('');
    setPwdConfirm('');
    setMsg('');
  }, [open, checkupId]);

  if (!open || !checkupId) return null;

  const handleSubmit = async () => {
    setMsg('');
    if (pwdNew.length < 6) {
      setMsg('新密码至少 6 位');
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setMsg('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    try {
      const res = await updatePortalPassword(checkupId, checkupId, pwdNew);
      if (res.success) {
        onSuccess();
      } else {
        setMsg(res.message || '修改失败，请重试');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/70 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-slate-200" />
        <h2 className="text-center text-xl font-black text-slate-800">请修改登录密码</h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
          您当前使用的是初始密码（体检编号），为保障账户安全，请立即设置新密码后再继续使用。
        </p>
        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600">新密码（至少 6 位）</label>
            <input
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={pwdNew}
              onChange={(e) => setPwdNew(e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">确认新密码</label>
            <input
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={pwdConfirm}
              onChange={(e) => setPwdConfirm(e.target.value)}
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit();
              }}
            />
          </div>
          {msg ? (
            <p className="text-center text-xs font-bold text-red-600">{msg}</p>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="w-full rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '确认修改'}
          </button>
        </div>
      </div>
    </div>
  );
};
