import React, { useEffect, useMemo, useState } from 'react';
import {
  ContentItem,
  InteractionItem,
  fetchContent,
  fetchInteractions,
  saveInteraction,
} from '../../services/contentService';
import { HealthArchive } from '../../services/dataService';

interface Props {
  userId?: string;
  userName?: string;
  archive?: HealthArchive;
  onOpenMessage?: (doctorId: string) => void;
}

const DAY_MAP: Record<string, string> = {
  Mon: '周一',
  Tue: '周二',
  Wed: '周三',
  Thu: '周四',
  Fri: '周五',
  Sat: '周六',
  Sun: '周日',
};
const SLOT_MAP: Record<string, string> = { AM: '上午', PM: '下午' };

const avatar = (doctor: ContentItem) => {
  if (doctor.image && /^https?:\/\//i.test(doctor.image)) {
    return <img src={doctor.image} alt={doctor.title} className="h-12 w-12 rounded-xl object-cover" />;
  }
  return <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">👨‍⚕️</div>;
};

export const UserDoctors: React.FC<Props> = ({ userId, userName, archive, onOpenMessage }) => {
  const [doctors, setDoctors] = useState<ContentItem[]>([]);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<ContentItem | null>(null);
  const [bookingDoctor, setBookingDoctor] = useState<ContentItem | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [docs, inters] = await Promise.all([
        fetchContent('doctor', 'active'),
        fetchInteractions(),
      ]);
      setDoctors(docs);
      setInteractions(inters);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [userId]);

  const doctorMap = useMemo(() => {
    const m = new Map<string, ContentItem>();
    doctors.forEach((d) => m.set(d.id, d));
    return m;
  }, [doctors]);

  const signedInteractions = useMemo(
    () =>
      interactions.filter(
        (i) => i.type === 'doctor_signing' && i.userId === userId && i.status === 'confirmed'
      ),
    [interactions, userId]
  );

  const bookedInteractions = useMemo(
    () =>
      interactions
        .filter(
          (i) =>
            i.type === 'doctor_booking' &&
            i.userId === userId &&
            ['pending', 'confirmed', 'completed'].includes(i.status)
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [interactions, userId]
  );

  const signedDoctors = useMemo(() => {
    return signedInteractions
      .map((i) => doctorMap.get(i.targetId))
      .filter(Boolean) as ContentItem[];
  }, [signedInteractions, doctorMap]);

  const healthManager = useMemo(() => {
    if (!archive?.health_manager_content_id) return null;
    return doctorMap.get(archive.health_manager_content_id) || null;
  }, [archive?.health_manager_content_id, doctorMap]);

  const filteredResources = useMemo(() => {
    const q = search.trim();
    if (!q) return doctors;
    return doctors.filter(
      (d) =>
        d.title.includes(q) ||
        (d.description || '').includes(q) ||
        (d.details?.dept || '').includes(q) ||
        (d.tags || []).join('').includes(q)
    );
  }, [doctors, search]);

  const slotUsage = (docId: string, dayKey: string, slotId: string) => {
    const slotText = `${DAY_MAP[dayKey]}${SLOT_MAP[slotId]}`;
    const count = interactions.filter(
      (i) =>
        i.type === 'doctor_booking' &&
        i.targetId === docId &&
        i.status !== 'cancelled' &&
        i.details?.includes(slotText)
    ).length;
    const quota = bookingDoctor?.details?.slotQuotas?.[dayKey]?.[slotId] || 10;
    return { count, quota, full: count >= quota };
  };

  const submitInteraction = async (
    type: 'doctor_signing' | 'doctor_booking',
    target: ContentItem,
    details: string
  ) => {
    if (!userId) {
      alert('请先到“我的”完成登录');
      return;
    }
    await saveInteraction({
      id: `${type}_${Date.now()}`,
      type,
      userId,
      userName: userName?.trim() || archive?.name?.trim() || '用户',
      targetId: target.id,
      targetName: target.title,
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
      details,
    });
    alert('申请已提交，请等待审核。');
    setSelectedDoctor(null);
    setBookingDoctor(null);
    refresh();
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 pb-24 space-y-5">
      <div className="rounded-2xl bg-white border border-slate-100 p-4">
        <h1 className="text-xl font-black text-slate-800">医生</h1>
        <p className="text-xs text-slate-500 mt-1">签约、预约与医院医生资源</p>
      </div>

      {healthManager && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-black text-amber-700 mb-2">我的健康管家</div>
          <div className="flex items-center gap-3">
            {avatar(healthManager)}
            <div className="flex-1">
              <div className="font-bold text-slate-800">{healthManager.title}</div>
              <div className="text-xs text-slate-600">
                {healthManager.details?.dept || '健康管理中心'}
                {healthManager.details?.phone ? ` · ${healthManager.details.phone}` : ''}
              </div>
            </div>
            <button
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold"
              onClick={() => onOpenMessage?.(healthManager.id)}
            >
              去咨询
            </button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-700">我签约的医生</h2>
        {signedDoctors.length === 0 ? (
          <div className="rounded-xl bg-white border border-slate-100 p-4 text-sm text-slate-400">
            暂无已签约医生
          </div>
        ) : (
          signedDoctors.map((doc) => (
            <div key={`sign-${doc.id}`} className="rounded-xl bg-white border border-slate-100 p-3 flex items-center gap-3">
              {avatar(doc)}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800">{doc.title}</div>
                <div className="text-xs text-slate-500">{doc.details?.dept} · {doc.details?.title}</div>
              </div>
              <button
                className="text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold"
                onClick={() => onOpenMessage?.(doc.id)}
              >
                咨询
              </button>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-700">我预约的医生</h2>
        {bookedInteractions.length === 0 ? (
          <div className="rounded-xl bg-white border border-slate-100 p-4 text-sm text-slate-400">
            暂无预约记录
          </div>
        ) : (
          bookedInteractions.map((item) => (
            <div key={item.id} className="rounded-xl bg-white border border-slate-100 p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-800">{item.targetName}</div>
                <div className="text-xs text-slate-500">{item.details || '预约挂号'}</div>
                <div className="text-xs text-slate-400 mt-1">{item.date}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded font-bold ${
                item.status === 'confirmed'
                  ? 'bg-green-100 text-green-700'
                  : item.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {item.status === 'confirmed' ? '已确认' : item.status === 'pending' ? '待审核' : '已完成'}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-700">医院医生资源</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索科室/医生名称"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
        />
        {loading ? (
          <div className="rounded-xl bg-white border border-slate-100 p-6 text-center text-slate-400">加载中...</div>
        ) : (
          filteredResources.map((doc) => (
            <div
              key={`res-${doc.id}`}
              className="rounded-xl bg-white border border-slate-100 p-3 flex items-center gap-3 cursor-pointer"
              onClick={() => setSelectedDoctor(doc)}
            >
              {avatar(doc)}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800">{doc.title}</div>
                <div className="text-xs text-slate-500">{doc.details?.dept} · {doc.details?.title}</div>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 font-bold">详情</span>
            </div>
          ))
        )}
      </section>

      {selectedDoctor && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedDoctor(null)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              {avatar(selectedDoctor)}
              <div>
                <div className="font-black text-slate-800">{selectedDoctor.title}</div>
                <div className="text-xs text-slate-500">{selectedDoctor.details?.dept} · {selectedDoctor.details?.title}</div>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{selectedDoctor.description || '暂无简介'}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="rounded-xl border border-blue-200 bg-blue-50 py-3 text-sm font-bold text-blue-700"
                onClick={() => setBookingDoctor(selectedDoctor)}
              >
                预约挂号
              </button>
              <button
                className="rounded-xl bg-teal-600 py-3 text-sm font-bold text-white"
                onClick={() =>
                  submitInteraction('doctor_signing', selectedDoctor, '申请家庭医生签约')
                }
              >
                签约医生
              </button>
            </div>
          </div>
        </div>
      )}

      {bookingDoctor && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setBookingDoctor(null)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800">选择预约时段</h3>
            <p className="text-xs text-slate-500">{bookingDoctor.title}</p>
            {Object.keys(DAY_MAP).map((dayKey) => {
              const slots = bookingDoctor.details?.weeklySchedule?.[dayKey] || [];
              if (!slots.length) return null;
              return (
                <div key={dayKey}>
                  <h4 className="text-xs font-black text-slate-500 mb-2">{DAY_MAP[dayKey]}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {slots.map((slotId: string) => {
                      const { count, quota, full } = slotUsage(bookingDoctor.id, dayKey, slotId);
                      return (
                        <button
                          key={`${dayKey}-${slotId}`}
                          disabled={full}
                          className={`rounded-xl border p-3 text-sm font-bold ${
                            full ? 'bg-slate-100 text-slate-400 border-slate-100' : 'bg-white text-slate-700 border-slate-200'
                          }`}
                          onClick={() =>
                            submitInteraction(
                              'doctor_booking',
                              bookingDoctor,
                              `预约挂号：${DAY_MAP[dayKey]}${SLOT_MAP[slotId]}，费用: ${bookingDoctor.details?.fee || 0}元`
                            )
                          }
                        >
                          {SLOT_MAP[slotId]}（{full ? '约满' : `余${quota - count}`})
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
