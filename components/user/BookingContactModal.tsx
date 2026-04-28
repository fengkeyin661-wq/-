import React, { useEffect, useState } from 'react';
import { validateChinaMobile } from '../../services/bookingContact';

export interface BookingContactPayload {
  name: string;
  phone: string;
}

interface Props {
  open: boolean;
  title?: string;
  subtitle?: string;
  defaultName?: string;
  defaultPhone?: string;
  zIndexClass?: string;
  onCancel: () => void;
  onConfirm: (payload: BookingContactPayload) => void;
}

export const BookingContactModal: React.FC<Props> = ({
  open,
  title = '填写预约信息',
  subtitle,
  defaultName = '',
  defaultPhone = '',
  zIndexClass = 'z-[80]',
  onCancel,
  onConfirm,
}) => {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setPhone(defaultPhone);
    setErr('');
  }, [open, defaultName, defaultPhone]);

  if (!open) return null;

  const submit = () => {
    const n = name.trim();
    const p = phone.trim();
    if (!n) {
      setErr('请填写姓名');
      return;
    }
    if (!validateChinaMobile(p)) {
      setErr('请填写11位有效手机号码');
      return;
    }
    setErr('');
    onConfirm({ name: n, phone: p });
  };

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-end justify-center bg-slate-900/65 backdrop-blur-sm`}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-black text-slate-800 text-center">{title}</h3>
        {subtitle ? <p className="text-center text-xs text-slate-500 mt-1 mb-4">{subtitle}</p> : <div className="mb-4" />}
        <label className="block text-xs font-bold text-slate-600 mb-1">姓名</label>
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm mb-3 outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="真实姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <label className="block text-xs font-bold text-slate-600 mb-1">联系电话</label>
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm mb-2 outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="11位手机号"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
          autoComplete="tel"
        />
        <p className="text-[11px] text-slate-400 mb-3">提交后健康管家可据此与您联系，确认预约信息。</p>
        {err ? <p className="text-sm font-bold text-red-600 mb-2">{err}</p> : null}
        <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white shadow-md"
            onClick={submit}
          >
            确认提交
          </button>
        </div>
      </div>
    </div>
  );
};
