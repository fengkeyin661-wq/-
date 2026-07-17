import React, { useEffect, useState } from 'react';
import {
  DEFAULT_CHECKUP_PORTAL_GUIDE,
  fetchCheckupPortalGuide,
  saveCheckupPortalGuide,
  type CheckupPortalGuide,
  type CheckupPostServiceItem,
} from '../services/checkupPortalContentService';

interface Props {
  open: boolean;
  onClose: () => void;
}

const linesToText = (lines: string[]) => lines.join('\n');
const textToLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

export const CheckupPortalGuideEditor: React.FC<Props> = ({ open, onClose }) => {
  const [draft, setDraft] = useState<CheckupPortalGuide>(DEFAULT_CHECKUP_PORTAL_GUIDE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const guide = await fetchCheckupPortalGuide();
        if (!cancelled) setDraft(guide);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const patch = (partial: Partial<CheckupPortalGuide>) =>
    setDraft((prev) => ({ ...prev, ...partial }));

  const updatePostItem = (index: number, partial: Partial<CheckupPostServiceItem>) => {
    setDraft((prev) => {
      const items = prev.postServiceItems.map((it, i) =>
        i === index ? { ...it, ...partial } : it,
      );
      return { ...prev, postServiceItems: items };
    });
  };

  const handleSave = async () => {
    const cleaned: CheckupPortalGuide = {
      ...draft,
      timeLines: draft.timeLines.map((s) => s.trim()).filter(Boolean),
      phones: draft.phones.map((s) => s.trim()).filter(Boolean),
      transportItems: draft.transportItems.map((s) => s.trim()).filter(Boolean),
      noticeItems: draft.noticeItems.map((s) => s.trim()).filter(Boolean),
      postServiceItems: draft.postServiceItems.filter((x) => x.title.trim() || x.content.trim()),
      addressContent: draft.addressContent.trim(),
      timeInfoContent: draft.timeInfoContent.trim(),
      contactFooter: draft.contactFooter.trim(),
    };
    if (!cleaned.timeLines.length || !cleaned.addressContent || !cleaned.phones.length) {
      alert('请至少填写：体检时间、体检地址、咨询电话');
      return;
    }
    if (!cleaned.noticeItems.length) {
      alert('请至少填写一条体检须知');
      return;
    }
    setSaving(true);
    try {
      const res = await saveCheckupPortalGuide(cleaned);
      if (!res.success) {
        alert(`保存失败：${res.error || '未知错误'}`);
        return;
      }
      alert(res.mode === 'cloud' ? '已保存到云端，预约站将同步更新。' : '已保存到本地（当前环境未连云端）。');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('恢复为系统默认文案？当前编辑内容将丢失。')) return;
    setDraft({
      ...DEFAULT_CHECKUP_PORTAL_GUIDE,
      timeLines: [...DEFAULT_CHECKUP_PORTAL_GUIDE.timeLines],
      phones: [...DEFAULT_CHECKUP_PORTAL_GUIDE.phones],
      transportItems: [...DEFAULT_CHECKUP_PORTAL_GUIDE.transportItems],
      noticeItems: [...DEFAULT_CHECKUP_PORTAL_GUIDE.noticeItems],
      postServiceItems: DEFAULT_CHECKUP_PORTAL_GUIDE.postServiceItems.map((x) => ({ ...x })),
    });
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-800">到检信息与体检须知</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              全局配置，展示在体检预约站首页（所有套餐共用）
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 font-bold hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
          {loading ? (
            <div className="text-center py-16 text-slate-400">加载中…</div>
          ) : (
            <>
              <section className="bg-white rounded-xl border border-emerald-100 p-4 space-y-3">
                <h4 className="text-sm font-black text-emerald-800">到检信息（首页突出展示）</h4>
                <label className="block text-xs font-bold text-slate-600">
                  体检时间（每行一条）
                  <textarea
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[96px]"
                    value={linesToText(draft.timeLines)}
                    onChange={(e) => patch({ timeLines: textToLines(e.target.value) })}
                    placeholder={'周一至周五 8:00–12:00\n下午 14:30–17:30\n采血截止时间：10:30'}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  须知弹窗·时间整段说明（可与上行略有不同）
                  <textarea
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[64px]"
                    value={draft.timeInfoContent}
                    onChange={(e) => patch({ timeInfoContent: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  地址标题
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    value={draft.addressTitle}
                    onChange={(e) => patch({ addressTitle: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  体检地址
                  <textarea
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[72px]"
                    value={draft.addressContent}
                    onChange={(e) => patch({ addressContent: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  咨询电话（每行一个，可点击拨打）
                  <textarea
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[64px]"
                    value={linesToText(draft.phones)}
                    onChange={(e) => patch({ phones: textToLines(e.target.value) })}
                    placeholder={'0371-67739261\n0371-67739538'}
                  />
                </label>
              </section>

              <section className="bg-white rounded-xl border border-amber-100 p-4 space-y-3">
                <h4 className="text-sm font-black text-amber-900">体检须知</h4>
                <label className="block text-xs font-bold text-slate-600">
                  须知标题
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    value={draft.noticeTitle}
                    onChange={(e) => patch({ noticeTitle: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  注意事项（每行一条）
                  <textarea
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[160px]"
                    value={linesToText(draft.noticeItems)}
                    onChange={(e) => patch({ noticeItems: textToLines(e.target.value) })}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  乘车路线标题
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    value={draft.transportTitle}
                    onChange={(e) => patch({ transportTitle: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  乘车路线（每行一条）
                  <textarea
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[80px]"
                    value={linesToText(draft.transportItems)}
                    onChange={(e) => patch({ transportItems: textToLines(e.target.value) })}
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  咨询电话页脚说明
                  <textarea
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[56px]"
                    value={draft.contactFooter}
                    onChange={(e) => patch({ contactFooter: e.target.value })}
                  />
                </label>
              </section>

              <section className="bg-white rounded-xl border border-teal-100 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-teal-800">检后服务</h4>
                  <button
                    type="button"
                    className="text-xs font-bold text-teal-700 px-2 py-1 rounded-lg border border-teal-200 hover:bg-teal-50"
                    onClick={() =>
                      patch({
                        postServiceItems: [
                          ...draft.postServiceItems,
                          { title: '', content: '' },
                        ],
                      })
                    }
                  >
                    + 添加条目
                  </button>
                </div>
                <label className="block text-xs font-bold text-slate-600">
                  区块标题
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    value={draft.postServiceTitle}
                    onChange={(e) => patch({ postServiceTitle: e.target.value })}
                  />
                </label>
                {draft.postServiceItems.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400">条目 {idx + 1}</span>
                      <button
                        type="button"
                        className="text-[11px] text-red-500 font-bold"
                        onClick={() =>
                          patch({
                            postServiceItems: draft.postServiceItems.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        删除
                      </button>
                    </div>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                      placeholder="标题"
                      value={item.title}
                      onChange={(e) => updatePostItem(idx, { title: e.target.value })}
                    />
                    <textarea
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white min-h-[64px]"
                      placeholder="内容"
                      value={item.content}
                      onChange={(e) => updatePostItem(idx, { content: e.target.value })}
                    />
                  </div>
                ))}
              </section>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap justify-between gap-2 bg-white">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading || saving}
            className="px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            恢复默认
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 text-slate-600"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
