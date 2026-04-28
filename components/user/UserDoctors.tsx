import React, { useEffect, useMemo, useState } from 'react';
import {
  ContentItem,
  InteractionItem,
  fetchContent,
  fetchInteractions,
  isHealthManagerContent,
  readLocalContent,
  readLocalInteractions,
  saveInteraction,
} from '../../services/contentService';
import { HealthArchive } from '../../services/dataService';
import { SLOT_MAP, getNextMonthSlotsForDoctor } from '../../services/doctorScheduleUtils';
import { buildBookingDetails, resolveBookingUserId } from '../../services/bookingContact';
import { BookingContactModal } from './BookingContactModal';

interface Props {
  userId?: string;
  userName?: string;
  archive?: HealthArchive;
  /** 已登录时预填预约联系电话 */
  defaultContactPhone?: string;
  onOpenMessage?: (doctorId: string) => void;
}
const MANAGER_DEEP_LINK_KEY = 'user_manager_recommend_deeplink';
const MANAGER_DEEP_LINK_TTL_MS = 2 * 60 * 1000;

const avatar = (doctor: ContentItem) => {
  if (doctor.image && (/^https?:\/\//i.test(doctor.image) || doctor.image.startsWith('data:image'))) {
    return <img src={doctor.image} alt={doctor.title} className="h-12 w-12 rounded-xl object-cover" />;
  }
  return <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">👨‍⚕️</div>;
};

const DAY_LABEL: Record<string, string> = {
  Mon: '周一',
  Tue: '周二',
  Wed: '周三',
  Thu: '周四',
  Fri: '周五',
  Sat: '周六',
  Sun: '周日',
};

const buildWeeklyScheduleSummary = (doctor: ContentItem): string[] => {
  const weekly = (doctor.details?.weeklySchedule || {}) as Record<string, string[]>;
  const ranges = (doctor.details?.slotTimeRanges || {}) as Record<string, Record<string, { start?: string; end?: string }>>;
  const keys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return keys
    .filter((k) => (weekly[k] || []).length > 0)
    .map((k) => {
      const slots = (weekly[k] || []).map((slotId) => {
        const start = ranges[k]?.[slotId]?.start;
        const end = ranges[k]?.[slotId]?.end;
        return start && end ? `${start}-${end}` : SLOT_MAP[slotId] || slotId;
      });
      return `${DAY_LABEL[k]} ${slots.join(' / ')}`;
    });
};

export const UserDoctors: React.FC<Props> = ({ userId, userName, archive, defaultContactPhone = '', onOpenMessage }) => {
  const [doctors, setDoctors] = useState<ContentItem[]>([]);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<ContentItem | null>(null);
  const [bookingDoctor, setBookingDoctor] = useState<ContentItem | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [teamRecommendRole, setTeamRecommendRole] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<{
    target: ContentItem;
    detailsLine: string;
  } | null>(null);

  const refresh = async () => {
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
    const localDocs = readLocalContent('doctor', 'active');
    const localInters = readLocalInteractions();
    setDoctors(localDocs);
    setInteractions(localInters);
    setLoading(localDocs.length === 0);
    void refresh();
  }, [userId]);

  useEffect(() => {
    if (!doctors.length) return;
    try {
      const raw = sessionStorage.getItem(MANAGER_DEEP_LINK_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw || '{}');
      const at = Number(parsed.at || 0);
      const ttl = Number(parsed.ttlMs || MANAGER_DEEP_LINK_TTL_MS);
      if (!at || Date.now() - at > ttl) {
        sessionStorage.removeItem(MANAGER_DEEP_LINK_KEY);
        return;
      }
      if (parsed.resourceType !== 'doctor') return;
      const doc = doctors.find((d) => d.id === parsed.resourceId);
      if (!doc) return;
      setSelectedDoctor(doc);
      sessionStorage.removeItem(MANAGER_DEEP_LINK_KEY);
    } catch {
      // ignore
    }
  }, [doctors]);

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
  const hasSignedTeamMember = signedInteractions.length > 0;
  const signedDoctorIdSet = useMemo(() => new Set(signedInteractions.map((i) => i.targetId)), [signedInteractions]);

  const managerResources = useMemo(() => doctors.filter(isHealthManagerContent), [doctors]);
  const teamCards = useMemo(() => {
    const textOf = (d: ContentItem) =>
      `${d.title}${d.description || ''}${d.details?.title || ''}${d.details?.dept || ''}${(d.tags || []).join('')}`;
    const isNutrition = (d: ContentItem) => textOf(d).includes('营养');
    const isSport = (d: ContentItem) => textOf(d).includes('运动') || textOf(d).includes('康复');
    const manager = managerResources[0] || null;
    const nutrition = doctors.find((d) => !isHealthManagerContent(d) && isNutrition(d)) || null;
    const sport = doctors.find(
      (d) => !isHealthManagerContent(d) && !isNutrition(d) && isSport(d)
    ) || null;
    const clinician = doctors.find(
      (d) => !isHealthManagerContent(d) && !isNutrition(d) && !isSport(d)
    ) || null;
    return [
      { role: '健康管家', item: manager, tone: 'bg-amber-50 border-amber-200 text-amber-700' },
      { role: '营养师', item: nutrition, tone: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
      { role: '运动教练', item: sport, tone: 'bg-orange-50 border-orange-200 text-orange-700' },
      { role: '临床医生', item: clinician, tone: 'bg-blue-50 border-blue-200 text-blue-700' },
    ];
  }, [doctors, managerResources]);
  const recommendByRole = (role: string): ContentItem[] => {
    const textOf = (d: ContentItem) =>
      `${d.title}${d.description || ''}${d.details?.title || ''}${d.details?.dept || ''}${(d.tags || []).join('')}`;
    const isNutrition = (d: ContentItem) => textOf(d).includes('营养');
    const isSport = (d: ContentItem) => textOf(d).includes('运动') || textOf(d).includes('康复');
    if (role === '健康管家') {
      return managerResources.length ? managerResources : doctors.slice(0, 8);
    }
    if (role === '营养师') {
      const list = doctors.filter((d) => !isHealthManagerContent(d) && isNutrition(d));
      return list.length ? list : doctors.slice(0, 8);
    }
    if (role === '运动教练') {
      const list = doctors.filter(
        (d) => !isHealthManagerContent(d) && !isNutrition(d) && isSport(d)
      );
      return list.length ? list : doctors.slice(0, 8);
    }
    if (role === '临床医生') {
      const list = doctors.filter(
        (d) => !isHealthManagerContent(d) && !isNutrition(d) && !isSport(d)
      );
      return list.length ? list : doctors.slice(0, 8);
    }
    return doctors.slice(0, 8);
  };

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

  const slotUsage = (docId: string, slot: { displayDate: string; dayKey: string; slotId: string }) => {
    const fragment = `${slot.displayDate}${SLOT_MAP[slot.slotId]}`;
    const count = interactions.filter(
      (i) =>
        i.type === 'doctor_booking' &&
        i.targetId === docId &&
        i.status !== 'cancelled' &&
        i.details?.includes(fragment)
    ).length;
    const quota = bookingDoctor?.details?.slotQuotas?.[slot.dayKey]?.[slot.slotId] || 10;
    return { count, quota, full: count >= quota };
  };

  const defaultContactName = userName?.trim() || archive?.name?.trim() || '';
  const defaultContactPhoneDigits =
    (defaultContactPhone || archive?.phone || archive?.health_record?.profile?.phone || '')
      .replace(/\D/g, '')
      .slice(0, 11) || '';

  const submitInteraction = async (
    type: 'doctor_signing' | 'doctor_booking',
    target: ContentItem,
    details: string
  ) => {
    if (!userId) {
      alert('请先到「我的」使用体检登记手机号登录后再签约');
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

  const startBookingWithSlot = (target: ContentItem, detailsLine: string) => {
    setPendingBooking({ target, detailsLine });
    setBookingDoctor(null);
    setContactOpen(true);
  };

  const completeGuestOrUserBooking = async (name: string, phone: string) => {
    if (!pendingBooking) return;
    const { target, detailsLine } = pendingBooking;
    const uid = resolveBookingUserId(userId, phone);
    const fullDetails = buildBookingDetails(name, phone, detailsLine);
    await saveInteraction({
      id: `doctor_booking_${Date.now()}`,
      type: 'doctor_booking',
      userId: uid,
      userName: name.trim(),
      targetId: target.id,
      targetName: target.title,
      status: 'pending',
      date: new Date().toISOString().split('T')[0],
      details: fullDetails,
    });
    alert('挂号申请已提交，请保持手机畅通，健康管家可能致电确认。');
    setPendingBooking(null);
    setContactOpen(false);
    setSelectedDoctor(null);
    refresh();
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 pb-24 space-y-5">
      <div className="rounded-2xl bg-white border border-slate-100 p-4">
        <h1 className="text-xl font-black text-slate-800">医生</h1>
        <p className="text-xs text-slate-500 mt-1">签约、预约与联合干预资源；咨询统一在「消息」处理</p>
      </div>

      <section className="space-y-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-700">健康管理团队</h2>
            <span className="text-[11px] font-bold text-slate-400">联合干预</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {teamCards.map((card) => (
              <button
                type="button"
                key={card.role}
                onClick={() => {
                  if (!hasSignedTeamMember) {
                    setTeamRecommendRole(card.role);
                    return;
                  }
                  if (card.item) setSelectedDoctor(card.item);
                  else setTeamRecommendRole(card.role);
                }}
                className={`rounded-xl border p-3 text-left ${card.tone} ${card.item ? '' : 'opacity-70'}`}
              >
                <div className="text-[11px] font-black">{card.role}</div>
                <div className="mt-1 truncate text-sm font-bold text-slate-800">
                  {hasSignedTeamMember ? card.item?.title || '待匹配' : '待签约'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {hasSignedTeamMember && (
        <section className="space-y-3">
          <h2 className="text-sm font-black text-slate-700">健康管理师（主导协同）</h2>
          {managerResources.length === 0 ? (
            <div className="rounded-xl bg-white border border-slate-100 p-4 text-sm text-slate-400">
              暂无健康管理师资源，请联系医院维护医生资源标签
            </div>
          ) : (
            managerResources.map((mgr) => (
              <div key={`mgr-${mgr.id}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-3">
                {avatar(mgr)}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800">{mgr.title}</div>
                  <div className="text-xs text-slate-600">
                    {mgr.details?.dept || '健康管理中心'}
                    {mgr.details?.phone ? ` · ${mgr.details.phone}` : ''}
                  </div>
                </div>
                <button
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold ${signedDoctorIdSet.has(mgr.id) ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-teal-600 text-white'}`}
                  disabled={signedDoctorIdSet.has(mgr.id)}
                  onClick={() => submitInteraction('doctor_signing', mgr, '申请健康管理师签约')}
                >
                  {signedDoctorIdSet.has(mgr.id) ? '已签约' : '签约'}
                </button>
              </div>
            ))
          )}
        </section>
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
                去消息
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
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
              <div className="text-xs text-slate-500">
                <span className="font-bold text-slate-700">出诊地点：</span>
                {selectedDoctor.details?.clinicLocation || '暂未维护'}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700 mb-1">每周出诊时间</div>
                {buildWeeklyScheduleSummary(selectedDoctor).length > 0 ? (
                  <div className="space-y-1">
                    {buildWeeklyScheduleSummary(selectedDoctor).map((line) => (
                      <div key={line} className="text-xs text-slate-600">{line}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">请以医生后台出诊设置为准</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="rounded-xl border border-blue-200 bg-blue-50 py-3 text-sm font-bold text-blue-700"
                onClick={() => setBookingDoctor(selectedDoctor)}
              >
                预约挂号
              </button>
              <button
                className="rounded-xl bg-teal-600 py-3 text-sm font-bold text-white"
                disabled={signedDoctorIdSet.has(selectedDoctor.id)}
                onClick={() =>
                  signedDoctorIdSet.has(selectedDoctor.id)
                    ? undefined
                    : submitInteraction('doctor_signing', selectedDoctor, '申请家庭医生签约')
                }
              >
                {signedDoctorIdSet.has(selectedDoctor.id) ? '已签约' : '签约医生'}
              </button>
            </div>
          </div>
        </div>
      )}

      {teamRecommendRole && (
        <div
          className="fixed inset-0 z-[75] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setTeamRecommendRole(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">{teamRecommendRole}推荐签约对象</h3>
              <button
                type="button"
                onClick={() => setTeamRecommendRole(null)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 font-black"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-slate-500">点击列表可查看详情并发起签约。</p>
            <div className="space-y-2">
              {recommendByRole(teamRecommendRole).map((doc) => (
                <button
                  type="button"
                  key={`team-pick-${teamRecommendRole}-${doc.id}`}
                  onClick={() => {
                    setTeamRecommendRole(null);
                    setSelectedDoctor(doc);
                  }}
                  className="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center gap-3 text-left"
                >
                  {avatar(doc)}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 truncate">{doc.title}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {doc.details?.dept || '健康管理中心'} · {doc.details?.title || '健康管理服务'}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 font-bold">查看</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BookingContactModal
        open={contactOpen}
        title="填写挂号信息"
        subtitle={pendingBooking ? `预约：${pendingBooking.target.title}` : undefined}
        defaultName={defaultContactName}
        defaultPhone={defaultContactPhoneDigits}
        onCancel={() => {
          setContactOpen(false);
          setPendingBooking(null);
        }}
        onConfirm={({ name, phone }) => completeGuestOrUserBooking(name, phone)}
      />

      {bookingDoctor && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setBookingDoctor(null)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800">选择预约时段</h3>
            <p className="text-xs text-slate-500">{bookingDoctor.title}</p>
            {(() => {
              const monthSlots = getNextMonthSlotsForDoctor(bookingDoctor);
              if (!monthSlots.length) {
                return <div className="text-center text-slate-400 text-sm py-8">未来30天暂无可预约号源</div>;
              }
              return (
                <div className="grid grid-cols-1 gap-2">
                  {monthSlots.map((slot) => {
                    const { count, quota, full } = slotUsage(bookingDoctor.id, slot);
                    return (
                      <button
                        key={`${slot.dateKey}-${slot.slotId}`}
                        disabled={full}
                        className={`rounded-xl border p-3 text-sm font-bold flex items-center justify-between ${
                          full ? 'bg-slate-100 text-slate-400 border-slate-100' : 'bg-white text-slate-700 border-slate-200'
                        }`}
                        onClick={() =>
                          startBookingWithSlot(
                            bookingDoctor,
                            `预约挂号：${slot.displayDate}${SLOT_MAP[slot.slotId]}，费用: ${bookingDoctor.details?.fee || 0}元`
                          )
                        }
                      >
                        <span>{slot.displayDate} · {SLOT_MAP[slot.slotId]}</span>
                        <span>{full ? '约满' : `余${quota - count}`}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
