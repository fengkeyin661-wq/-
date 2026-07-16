import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchContent,
  fetchInteractions,
  readLocalContent,
  readLocalInteractions,
  type ContentItem,
  type InteractionItem,
} from '../../services/contentService';
import { getPackageKind } from '../../services/userServiceCatalog';
import { BookingContactModal } from '../user/BookingContactModal';
import { CheckupPackageList } from './CheckupPackageList';
import { CheckupPackageDetail } from './CheckupPackageDetail';
import { CheckupSlotPicker } from './CheckupSlotPicker';
import { submitCheckupBooking } from './checkupBooking';
import { CheckupNoticePanel } from './CheckupNoticePanel';
import { CheckupVenueInfo } from './CheckupVenueInfo';

type CheckupView = 'home' | 'personal' | 'group';

export const CheckupApp: React.FC = () => {
  const [packages, setPackages] = useState<ContentItem[]>([]);
  const [allServices, setAllServices] = useState<ContentItem[]>([]);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CheckupView>('home');
  const [selectedPackage, setSelectedPackage] = useState<ContentItem | null>(null);
  const [slotPickerPackage, setSlotPickerPackage] = useState<ContentItem | null>(null);
  const [pendingBook, setPendingBook] = useState<{
    packageItem: ContentItem;
    timeSlot: string;
  } | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const localPkgs = readLocalContent('checkup_package', 'active');
      const localSvcs = readLocalContent('service', 'active');
      const localInts = readLocalInteractions();
      setPackages(localPkgs);
      setAllServices(localSvcs);
      setInteractions(localInts);

      const [remotePkgs, remoteSvcs, remoteInts] = await Promise.all([
        fetchContent('checkup_package', 'active'),
        fetchContent('service', 'active'),
        fetchInteractions(),
      ]);
      setPackages(remotePkgs);
      setAllServices(remoteSvcs);
      setInteractions(remoteInts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sortedPackages = useMemo(() => {
    return [...packages].sort((a, b) => {
      const ao = Number(a.details?.sortOrder ?? 9999);
      const bo = Number(b.details?.sortOrder ?? 9999);
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title, 'zh-CN');
    });
  }, [packages]);

  const personalPackages = useMemo(
    () => sortedPackages.filter((p) => getPackageKind(p) === 'personal'),
    [sortedPackages],
  );

  const groupPackages = useMemo(
    () => sortedPackages.filter((p) => getPackageKind(p) === 'group'),
    [sortedPackages],
  );

  const handleSelectPackage = (item: ContentItem) => {
    setSelectedPackage(item);
  };

  const handleCloseDetail = () => {
    setSelectedPackage(null);
  };

  const handleStartBook = () => {
    if (!selectedPackage) return;
    if (getPackageKind(selectedPackage) === 'group') return;
    setSlotPickerPackage(selectedPackage);
  };

  /** 列表「预约」：仅个人套餐进入时段选择 */
  const handleBookFromList = (item: ContentItem) => {
    if (getPackageKind(item) === 'group') return;
    setSelectedPackage(item);
    setSlotPickerPackage(item);
  };

  const handleSlotSelected = (timeSlot: string) => {
    if (!slotPickerPackage) return;
    setPendingBook({ packageItem: slotPickerPackage, timeSlot });
    setSlotPickerPackage(null);
    setContactOpen(true);
  };

  const handleConfirmBooking = async ({ name, phone }: { name: string; phone: string }) => {
    if (!pendingBook || submitting) return;
    setSubmitting(true);
    try {
      await submitCheckupBooking({
        packageItem: pendingBook.packageItem,
        timeSlot: pendingBook.timeSlot,
        contactName: name,
        contactPhone: phone,
      });
      alert('预约申请已提交，请保持手机畅通。');
      setPendingBook(null);
      setContactOpen(false);
      setSelectedPackage(null);
      await loadData();
    } catch {
      alert('预约提交失败，请稍后重试或致电体检预约咨询热线。');
    } finally {
      setSubmitting(false);
    }
  };

  const categoryTitle = view === 'personal' ? '个人体检' : view === 'group' ? '团体体检' : '';

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-slate-50 shadow-xl">
      <header className="shrink-0 z-10 border-b border-emerald-100 bg-white/95 backdrop-blur-md">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            {view !== 'home' ? (
              <button
                type="button"
                onClick={() => setView('home')}
                className="shrink-0 w-9 h-9 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200"
                aria-label="返回"
              >
                ←
              </button>
            ) : (
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                Z
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-800 tracking-tight">
                {view === 'home' ? '体检预约' : categoryTitle}
              </h1>
              <p className="text-xs text-slate-500">
                {view === 'home' ? '郑州大学医院' : '返回选择体检类型'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain scrollbar-hide [-webkit-overflow-scrolling:touch]">
        <div className="pt-4">
          <CheckupVenueInfo />
        </div>

        <CheckupNoticePanel />

        {view === 'home' ? (
          <section className="px-4 pb-6 space-y-3">
            <h2 className="text-sm font-black text-slate-700 px-1 mb-1">选择体检类型</h2>

            <button
              type="button"
              onClick={() => setView('personal')}
              className="w-full text-left rounded-2xl overflow-hidden border border-emerald-100 bg-white shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="h-28 bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 flex flex-col justify-end pb-4">
                <div className="text-white/80 text-xs font-bold mb-1">PERSONAL</div>
                <div className="text-white text-2xl font-black">个人体检</div>
              </div>
              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600 leading-snug">
                  在线选时段预约，适合个人年度体检与专项检查
                </p>
                <span className="shrink-0 text-emerald-600 font-black text-sm">查看 →</span>
              </div>
              {!loading && (
                <div className="px-5 pb-3 text-[11px] text-slate-400">
                  共 {personalPackages.length} 个套餐
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setView('group')}
              className="w-full text-left rounded-2xl overflow-hidden border border-teal-100 bg-white shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="h-28 bg-gradient-to-br from-teal-600 to-slate-800 px-5 flex flex-col justify-end pb-4">
                <div className="text-white/80 text-xs font-bold mb-1">GROUP</div>
                <div className="text-white text-2xl font-black">团体体检</div>
              </div>
              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600 leading-snug">
                  企事业单位团检方案，时间另行协商，电话专人对接
                </p>
                <span className="shrink-0 text-teal-700 font-black text-sm">查看 →</span>
              </div>
              {!loading && (
                <div className="px-5 pb-3 text-[11px] text-slate-400">
                  共 {groupPackages.length} 个套餐
                </div>
              )}
            </button>
          </section>
        ) : loading ? (
          <div className="text-center py-20">
            <div className="text-4xl animate-spin mb-4">⏳</div>
            <p className="text-slate-500 font-medium">加载套餐中…</p>
          </div>
        ) : (
          <CheckupPackageList
            packages={view === 'personal' ? personalPackages : groupPackages}
            allServices={allServices}
            onSelect={handleSelectPackage}
            onBook={handleBookFromList}
            emptyHint={
              view === 'personal' ? '暂无个人体检套餐' : '暂无团体体检套餐，请电话咨询定制方案'
            }
          />
        )}

        <footer className="px-4 py-6 text-center text-xs text-slate-400">
          {view === 'group'
            ? '团体体检请致电咨询 · 时间另行协商'
            : '访客预约 · 填写姓名与手机号即可提交，无需登录'}
        </footer>
      </main>

      {selectedPackage && (
        <CheckupPackageDetail
          packageItem={selectedPackage}
          allServices={allServices}
          onBack={handleCloseDetail}
          onBook={handleStartBook}
        />
      )}

      {slotPickerPackage && (
        <CheckupSlotPicker
          packageItem={slotPickerPackage}
          interactions={interactions}
          onSelectSlot={handleSlotSelected}
          onClose={() => setSlotPickerPackage(null)}
        />
      )}

      <BookingContactModal
        open={contactOpen}
        title="填写体检预约信息"
        subtitle={pendingBook ? `预约：${pendingBook.packageItem.title}` : undefined}
        zIndexClass="z-[110]"
        onCancel={() => {
          if (submitting) return;
          setContactOpen(false);
          setPendingBook(null);
        }}
        onConfirm={handleConfirmBooking}
      />
    </div>
  );
};
