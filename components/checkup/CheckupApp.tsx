import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchContent,
  fetchInteractions,
  readLocalContent,
  readLocalInteractions,
  type ContentItem,
  type InteractionItem,
} from '../../services/contentService';
import {
  HEALTH_MANAGEMENT_HOTLINE,
  HEALTH_MANAGEMENT_HOTLINE_TEL,
} from '../../services/userServiceCatalog';
import { BookingContactModal } from '../user/BookingContactModal';
import { CheckupPackageList } from './CheckupPackageList';
import { CheckupPackageDetail } from './CheckupPackageDetail';
import { CheckupSlotPicker } from './CheckupSlotPicker';
import { submitCheckupBooking } from './checkupBooking';

type View = 'list' | 'detail';

export const CheckupApp: React.FC = () => {
  const [packages, setPackages] = useState<ContentItem[]>([]);
  const [allServices, setAllServices] = useState<ContentItem[]>([]);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
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

  const handleSelectPackage = (item: ContentItem) => {
    setSelectedPackage(item);
    setView('detail');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedPackage(null);
  };

  const handleStartBook = () => {
    if (!selectedPackage) return;
    setSlotPickerPackage(selectedPackage);
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
      setView('list');
      setSelectedPackage(null);
      await loadData();
    } catch {
      alert('预约提交失败，请稍后重试或致电健康管理热线。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto shadow-xl">
      {view === 'list' && (
        <>
          <header className="sticky top-0 z-10 border-b border-emerald-100 bg-white/95 backdrop-blur-md">
            <div className="px-5 py-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                  Z
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-800 tracking-tight">体检预约</h1>
                  <p className="text-xs text-slate-500">郑州大学医院</p>
                </div>
              </div>
            </div>
            <div className="mx-4 mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-emerald-800">健康管理服务电话</div>
                <a
                  href={HEALTH_MANAGEMENT_HOTLINE_TEL}
                  className="text-lg font-black text-emerald-700 tracking-wide"
                >
                  {HEALTH_MANAGEMENT_HOTLINE}
                </a>
              </div>
              <a
                href={HEALTH_MANAGEMENT_HOTLINE_TEL}
                className="shrink-0 bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg"
              >
                拨打
              </a>
            </div>
          </header>

          {loading ? (
            <div className="text-center py-20">
              <div className="text-4xl animate-spin mb-4">⏳</div>
              <p className="text-slate-500 font-medium">加载套餐中…</p>
            </div>
          ) : (
            <CheckupPackageList
              packages={sortedPackages}
              interactions={interactions}
              onSelect={handleSelectPackage}
            />
          )}

          <footer className="px-4 py-6 text-center text-xs text-slate-400">
            访客预约 · 填写姓名与手机号即可提交，无需登录
          </footer>
        </>
      )}

      {view === 'detail' && selectedPackage && (
        <CheckupPackageDetail
          packageItem={selectedPackage}
          allServices={allServices}
          onBack={handleBackToList}
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
