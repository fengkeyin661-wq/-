
import React, { useState, useEffect, useMemo } from 'react';
import { fetchContent, ContentItem, fetchInteractions, readLocalContent, readLocalInteractions, saveInteraction, InteractionItem } from '../../services/contentService';
import { ResourceCover } from './ResourceCover';
import { HealthAssessment } from '../../types';
import { SLOT_MAP, getNextMonthSlotsForService, getServiceSlotQuota } from '../../services/doctorScheduleUtils';
import { buildBookingDetails, resolveBookingUserId } from '../../services/bookingContact';
import { BookingContactModal } from './BookingContactModal';
import {
    CLINICAL_SUB_CATEGORIES,
    HEALTH_MANAGEMENT_HOTLINE,
    HEALTH_MANAGEMENT_HOTLINE_TEL,
    HEALTH_SERVICE_SUB_CATEGORIES,
    SERVICE_MAIN_CATEGORIES,
    ServiceMainCategory,
    classifyServiceItem,
    resolveIncludedServiceTitles,
} from '../../services/userServiceCatalog';

interface Props {
    userId?: string;
    userName?: string;
    defaultContactPhone?: string;
    assessment?: HealthAssessment;
}

interface EventWithStatus extends ContentItem {
    currentSignups: number;
    isSignedUp: boolean;
    signupStatus: 'open' | 'full' | 'joined' | 'pending' | 'ended';
}

type MainCategory = ServiceMainCategory;
const MANAGER_DEEP_LINK_KEY = 'user_manager_recommend_deeplink';
const MANAGER_DEEP_LINK_TTL_MS = 2 * 60 * 1000;

const getCommunityIcon = (title: string, type: string): string => {
    const t = title.toLowerCase();
    
    if (type === 'event') {
        if (t.includes('讲座') || t.includes('课')) return '🎤';
        if (t.includes('义诊') || t.includes('咨询')) return '🩺';
        if (t.includes('运动') || t.includes('跑') || t.includes('球')) return '🏆';
        if (t.includes('聚会') || t.includes('节')) return '🎉';
        if (t.includes('心理')) return '❤️';
        if (t.includes('户外')) return '🌲';
        return '✨';
    } else if (type === 'meal') {
        if (t.includes('鸡') || t.includes('肉')) return '🥩';
        if (t.includes('鱼') || t.includes('海鲜')) return '🐟';
        if (t.includes('沙拉') || t.includes('蔬')) return '🥗';
        if (t.includes('汤')) return '🍲';
        return '🍱';
    } else if (type === 'service') {
        if (t.includes('体检')) return '🩺';
        if (t.includes('康复') || t.includes('理疗')) return '💆';
        if (t.includes('心理')) return '🧠';
        return '🏥';
    } else if (type === 'circle') {
        if (t.includes('减重')) return '⚖️';
        if (t.includes('糖')) return '🩸';
        if (t.includes('运动') || t.includes('跑')) return '👟';
        if (t.includes('中医')) return '🌿';
        return '⭕';
    }
    return '✨';
};

const scoreItem = (item: ContentItem, risks: string[]) => {
    let score = 0;
    const text = (item.title + (item.tags?.join(' ') || '') + (item.description || '')).toLowerCase();
    risks.forEach(r => {
        if (text.includes(r.replace('风险',''))) score += 2;
    });
    return score + Math.random();
};

const formatEventSchedule = (details?: Record<string, any>) => {
    const recurrenceType = details?.recurrenceType;
    const recurrenceLabel = recurrenceType === 'weekly' ? '每周' : recurrenceType === 'monthly' ? '每月' : '单次';
    if (recurrenceType === 'weekly' || recurrenceType === 'monthly') {
        const firstDate = details?.date?.split?.('T')?.[0];
        const startText = firstDate ? `（首次：${firstDate}）` : '';
        return `${recurrenceLabel}${details?.recurrenceRule ? ` · ${details.recurrenceRule}` : ''}${startText}`;
    }
    return details?.date?.split?.('T')?.[0] || '待定';
};

export const UserCommunity: React.FC<Props> = ({ userId, userName, defaultContactPhone = '', assessment }) => {
    const [allEvents, setAllEvents] = useState<EventWithStatus[]>([]);
    const [allCircles, setAllCircles] = useState<ContentItem[]>([]);
    const [allServices, setAllServices] = useState<ContentItem[]>([]);
    const [allPackages, setAllPackages] = useState<ContentItem[]>([]);
    const [allInteractions, setAllInteractions] = useState<InteractionItem[]>([]);
    
    const [mainCategory, setMainCategory] = useState<MainCategory>('clinical');
    const [subCategory, setSubCategory] = useState<string>('lab');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
    const [bookingService, setBookingService] = useState<ContentItem | null>(null);
    const [serviceContactOpen, setServiceContactOpen] = useState(false);
    const [pendingServiceBook, setPendingServiceBook] = useState<{
        service: ContentItem;
        timeSlot: string;
    } | null>(null);
    const [eventContactOpen, setEventContactOpen] = useState(false);
    const [pendingEvent, setPendingEvent] = useState<ContentItem | null>(null);

    useEffect(() => {
        loadData();
    }, [userId]);

    useEffect(() => {
        if (loading) return;
        try {
            const raw = sessionStorage.getItem(MANAGER_DEEP_LINK_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw || '{}');
            const resourceId = String(parsed.resourceId || '');
            const resourceType = String(parsed.resourceType || '');
            const at = Number(parsed.at || 0);
            const ttl = Number(parsed.ttlMs || MANAGER_DEEP_LINK_TTL_MS);
            if (!at || Date.now() - at > ttl) {
                sessionStorage.removeItem(MANAGER_DEEP_LINK_KEY);
                return;
            }
            if (!resourceId) return;

            if (resourceType === 'service' || resourceType === 'checkup_package') {
                const item =
                    allServices.find((x) => x.id === resourceId) ||
                    allPackages.find((x) => x.id === resourceId);
                if (item) {
                    const cls = classifyServiceItem(item);
                    setMainCategory(cls.domain);
                    setSubCategory(cls.subId);
                    setSelectedItem(item);
                    sessionStorage.removeItem(MANAGER_DEEP_LINK_KEY);
                    return;
                }
            }
            if (resourceType === 'event' || resourceType === 'circle') {
                const pool = resourceType === 'circle' ? allCircles : allEvents;
                const item = pool.find((x) => x.id === resourceId);
                if (item) {
                    setMainCategory('health_service');
                    setSubCategory('education');
                    setSelectedItem(item);
                    sessionStorage.removeItem(MANAGER_DEEP_LINK_KEY);
                    return;
                }
            }
        } catch {
            // ignore
        }
    }, [loading, allServices, allPackages, allEvents, allCircles]);

    const applyContentToState = (
        eventsData: ContentItem[],
        circlesData: ContentItem[],
        servicesData: ContentItem[],
        packagesData: ContentItem[],
        interactions: InteractionItem[]
    ) => {
        const processedEvents: EventWithStatus[] = eventsData.map((evt) => {
            const evtSignups = interactions.filter(
                (i) => i.type === 'event_signup' && i.targetId === evt.id && i.status !== 'cancelled'
            );
            const count = evtSignups.length;
            const limit = Number(evt.details?.limit) || 100;
            const myInteraction = userId ? evtSignups.find((i) => i.userId === userId) : null;
            const isSigned = !!myInteraction;

            let status: 'open' | 'full' | 'joined' | 'pending' | 'ended' = 'open';
            if (myInteraction?.status === 'confirmed') status = 'joined';
            else if (myInteraction?.status === 'pending') status = 'pending';
            else if (count >= limit) status = 'full';
            else if (evt.details?.businessStatus === '已结束') status = 'ended';

            return { ...evt, currentSignups: count, isSignedUp: isSigned, signupStatus: status };
        });
        setAllEvents(processedEvents);
        setAllCircles(circlesData);
        setAllServices(servicesData);
        setAllPackages(packagesData);
        setAllInteractions(interactions);
    };

    const loadData = async () => {
        const le = readLocalContent('event', 'active');
        const lc = readLocalContent('circle', 'active');
        const ls = readLocalContent('service', 'active');
        const lp = readLocalContent('checkup_package', 'active');
        const li = readLocalInteractions();
        applyContentToState(le, lc, ls, lp, li);
        setLoading(!(le.length || lc.length || ls.length || lp.length));
        try {
            const [eventsData, circlesData, servicesData, packagesData, interactions] = await Promise.all([
                fetchContent('event', 'active'),
                fetchContent('circle', 'active'),
                fetchContent('service', 'active'),
                fetchContent('checkup_package', 'active'),
                fetchInteractions(),
            ]);
            applyContentToState(eventsData, circlesData, servicesData, packagesData, interactions);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const contactDefaultName = userName?.trim() || '';
    const contactDefaultPhone = defaultContactPhone.replace(/\D/g, '').slice(0, 11) || '';

    const completeEventSignup = async (name: string, phone: string) => {
        if (!pendingEvent) return;
        const evt = pendingEvent;
        const uid = resolveBookingUserId(userId, phone);
        await saveInteraction({
            id: `event_signup_${Date.now()}`,
            type: 'event_signup',
            userId: uid,
            userName: name.trim(),
            targetId: evt.id,
            targetName: evt.title,
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            details: buildBookingDetails(name, phone, '活动报名'),
        });
        alert('报名已提交，请保持手机畅通。');
        setPendingEvent(null);
        setEventContactOpen(false);
        setSelectedItem(null);
        loadData();
    };

    const handleSignup = (evt: ContentItem) => {
        setPendingEvent(evt);
        setSelectedItem(null);
        setEventContactOpen(true);
    };

    const handleJoinCircle = async (circle: ContentItem) => {
        if (!userId || !userName) return alert("请先登录");
        
        await saveInteraction({
            id: `circle_join_${Date.now()}`,
            type: 'circle_join',
            userId, userName,
            targetId: circle.id,
            targetName: circle.title,
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            details: '申请加入圈子'
        });
        alert(`申请加入【${circle.title}】已提交！`);
        setSelectedItem(null);
    };

    const completeServiceBook = async (name: string, phone: string) => {
        if (!pendingServiceBook) return;
        const { service, timeSlot } = pendingServiceBook;
        const detailsLine = `服务预约：${timeSlot}，价格: ${service.details?.price || '免费'}`;
        const uid = resolveBookingUserId(userId, phone);
        await saveInteraction({
            id: `service_booking_${Date.now()}`,
            type: 'service_booking',
            userId: uid,
            userName: name.trim(),
            targetId: service.id,
            targetName: service.title,
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            details: buildBookingDetails(name, phone, detailsLine),
        });
        alert('预约申请已提交，请保持手机畅通。');
        setPendingServiceBook(null);
        setServiceContactOpen(false);
        setSelectedItem(null);
        setBookingService(null);
        loadData();
    };

    const handleBookService = async (service: ContentItem, timeSlot?: string) => {
        if (!timeSlot) {
            setBookingService(service);
            setSelectedItem(null);
            return;
        }
        setPendingServiceBook({ service, timeSlot });
        setBookingService(null);
        setSelectedItem(null);
        setServiceContactOpen(true);
    };

    const getServiceSlotUsage = (serviceId: string, slot: { displayDate: string; dayKey: string; slotId: string }) => {
        const fragment = `${slot.displayDate}${SLOT_MAP[slot.slotId]}`;
        const count = allInteractions.filter(i =>
            i.type === 'service_booking' &&
            i.targetId === serviceId &&
            i.status !== 'cancelled' &&
            i.details?.includes(fragment)
        ).length;
        const quota = getServiceSlotQuota(bookingService?.details, slot.dayKey, slot.slotId);
        return { count, quota, full: count >= quota };
    };

    // Filter and Sort
    const risks = assessment ? [...assessment.risks.red, ...assessment.risks.yellow] : [];
    
    const filteredEvents = useMemo(() => {
        let list = allEvents;
        if (searchTerm) list = list.filter(e => e.title.includes(searchTerm));
        return list.sort((a, b) => scoreItem(b, risks) - scoreItem(a, risks));
    }, [allEvents, searchTerm, risks]);

    const clinicalServices = useMemo(() => {
        return allServices.filter((s) => classifyServiceItem(s).domain === 'clinical');
    }, [allServices]);

    const healthServices = useMemo(() => {
        return allServices.filter((s) => classifyServiceItem(s).domain === 'health_service');
    }, [allServices]);

    const filteredPackages = useMemo(() => {
        let list = allPackages;
        if (searchTerm) list = list.filter((p) => p.title.includes(searchTerm));
        return list.sort((a, b) => scoreItem(b, risks) - scoreItem(a, risks));
    }, [allPackages, searchTerm, risks]);

    const visibleClinicalItems = useMemo(() => {
        let list = clinicalServices.filter((s) => classifyServiceItem(s).subId === subCategory);
        if (searchTerm) list = list.filter((s) => s.title.includes(searchTerm));
        return list.sort((a, b) => scoreItem(b, risks) - scoreItem(a, risks));
    }, [clinicalServices, subCategory, searchTerm, risks]);

    const visibleHealthItems = useMemo(() => {
        if (subCategory === 'education') return filteredEvents;
        let list = healthServices.filter((s) => classifyServiceItem(s).subId === subCategory);
        if (searchTerm) list = list.filter((s) => s.title.includes(searchTerm));
        return list.sort((a, b) => scoreItem(b, risks) - scoreItem(a, risks));
    }, [healthServices, subCategory, filteredEvents, searchTerm, risks]);

    const subTabs = useMemo(() => {
        if (mainCategory === 'clinical') return CLINICAL_SUB_CATEGORIES;
        if (mainCategory === 'health_service') return HEALTH_SERVICE_SUB_CATEGORIES;
        return [];
    }, [mainCategory]);

    useEffect(() => {
        if (mainCategory === 'clinical' && !CLINICAL_SUB_CATEGORIES.some((x) => x.id === subCategory)) {
            setSubCategory('lab');
        }
        if (mainCategory === 'health_service' && !HEALTH_SERVICE_SUB_CATEGORIES.some((x) => x.id === subCategory)) {
            setSubCategory('tcm');
        }
    }, [mainCategory, subCategory]);

    const renderServiceCard = (svc: ContentItem) => (
        <div
            key={svc.id}
            onClick={() => setSelectedItem(svc)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 cursor-pointer active:scale-[0.98] transition-transform"
        >
            <ResourceCover
                item={svc}
                fallback={<span className="text-2xl">{getCommunityIcon(svc.title, svc.type)}</span>}
                className="h-14 w-14 shrink-0 rounded-xl bg-blue-50 text-2xl"
                imgClassName="h-full w-full object-cover rounded-xl"
            />
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 line-clamp-1 mb-1">{svc.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-2">{svc.description || '暂无简介'}</p>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-blue-600">
                        {svc.details?.price ? `¥${svc.details.price}` : '免费'}
                    </span>
                    <span className="text-xs text-slate-400">{svc.details?.categoryL2 || svc.details?.categoryL1 || '服务项目'}</span>
                </div>
                {(svc.type === 'service' || svc.type === 'checkup_package') && (
                    <div className="mt-1 text-[11px] font-semibold text-blue-600 line-clamp-1">{getServiceEarliestSlotLabel(svc)}</div>
                )}
            </div>
        </div>
    );

    const renderEventCard = (evt: EventWithStatus) => (
        <div
            key={evt.id}
            onClick={() => setSelectedItem(evt)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-pointer active:scale-[0.98] transition-transform"
        >
            <div className="flex gap-3">
                <ResourceCover
                    item={evt}
                    fallback={<span className="text-2xl">{getCommunityIcon(evt.title, 'event')}</span>}
                    className="h-12 w-12 shrink-0 rounded-xl bg-slate-50 text-2xl"
                    imgClassName="h-full w-full object-cover rounded-xl"
                />
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-slate-800 line-clamp-1">{evt.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded font-bold shrink-0 ml-2 ${
                            evt.signupStatus === 'joined' ? 'bg-green-100 text-green-700' :
                            evt.signupStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            evt.signupStatus === 'full' ? 'bg-slate-100 text-slate-500' :
                            'bg-blue-50 text-blue-600'
                        }`}>
                            {evt.signupStatus === 'joined' ? '已报名' :
                             evt.signupStatus === 'pending' ? '审核中' :
                             evt.signupStatus === 'full' ? '已满' : '报名中'}
                        </span>
                    </div>
                    <div className="text-xs text-slate-500 flex gap-3 mb-2">
                        <span>📅 {formatEventSchedule(evt.details)}</span>
                        <span>📍 {evt.details?.loc || '线上'}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    const getServiceEarliestSlotLabel = (service: ContentItem): string => {
        const slots = getNextMonthSlotsForService(service);
        for (const slot of slots) {
            const fragment = `${slot.displayDate}${SLOT_MAP[slot.slotId]}`;
            const count = allInteractions.filter(i =>
                i.type === 'service_booking' &&
                i.targetId === service.id &&
                i.status !== 'cancelled' &&
                i.details?.includes(fragment)
            ).length;
            const quota = getServiceSlotQuota(service.details, slot.dayKey, slot.slotId);
            if (count < quota) {
                const mmdd = slot.displayDate.split(' ')[0];
                return `最早可约：${mmdd} ${SLOT_MAP[slot.slotId]}`;
            }
        }
        return '当前无可预约时段';
    };

    const filteredCircles = useMemo(() => {
        let list = allCircles;
        if (searchTerm) list = list.filter(c => c.title.includes(searchTerm));
        return list;
    }, [allCircles, searchTerm]);

    return (
        <div className="min-h-full bg-slate-50 pb-28">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur-md">
                <div className="px-5 py-4">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">服务</h1>
                    <p className="text-sm text-slate-500">临床检查 · 健康体检 · 健康服务</p>
                </div>

                <div className="mx-5 mb-3 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-bold text-teal-800">健康管理服务电话</div>
                        <a href={HEALTH_MANAGEMENT_HOTLINE_TEL} className="text-lg font-black text-teal-700 tracking-wide">
                            {HEALTH_MANAGEMENT_HOTLINE}
                        </a>
                    </div>
                    <a
                        href={HEALTH_MANAGEMENT_HOTLINE_TEL}
                        className="shrink-0 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white"
                    >
                        一键拨打
                    </a>
                </div>
                
                <div className="px-5 pb-3">
                    <div className="relative">
                        <input 
                            className="w-full bg-slate-100 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                            placeholder="搜索检查、套餐、服务、活动..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                    </div>
                </div>

                <div className="px-5 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
                    {SERVICE_MAIN_CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => {
                                setMainCategory(cat.id);
                                if (cat.id === 'clinical') setSubCategory('lab');
                                if (cat.id === 'health_service') setSubCategory('tcm');
                            }}
                            className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${
                                mainCategory === cat.id
                                    ? 'bg-slate-800 text-white shadow-lg'
                                    : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                        >
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                        </button>
                    ))}
                </div>

                {subTabs.length > 0 && (
                    <div className="px-5 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                        {subTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setSubCategory(tab.id)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${
                                    subCategory === tab.id
                                        ? 'bg-teal-600 text-white border-teal-600'
                                        : 'bg-white text-slate-600 border-slate-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 space-y-6">
                {loading ? (
                    <div className="text-center py-16 text-slate-400">加载中...</div>
                ) : (
                    <>
                        {mainCategory === 'clinical' && (
                            <section>
                                <h2 className="font-bold text-slate-800 mb-1 px-1">
                                    {CLINICAL_SUB_CATEGORIES.find((x) => x.id === subCategory)?.label || '临床检查'}
                                </h2>
                                <p className="text-xs text-slate-400 mb-3 px-1">单项检查项目，可按需预约</p>
                                <div className="space-y-3">
                                    {visibleClinicalItems.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-2xl">暂无该分类检查项目</div>
                                    ) : (
                                        visibleClinicalItems.map(renderServiceCard)
                                    )}
                                </div>
                            </section>
                        )}

                        {mainCategory === 'checkup' && (
                            <section>
                                <h2 className="font-bold text-slate-800 mb-1 px-1">健康体检套餐</h2>
                                <p className="text-xs text-slate-400 mb-3 px-1">由临床检查项目组合而成，含套餐价格</p>
                                <div className="space-y-3">
                                    {filteredPackages.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-2xl">暂无体检套餐，请稍后在资源管理台维护</div>
                                    ) : (
                                        filteredPackages.map((pkg) => (
                                            <div key={pkg.id}>
                                                {renderServiceCard(pkg)}
                                                {resolveIncludedServiceTitles(pkg, allServices).length > 0 && (
                                                    <div className="mt-1 px-4 text-[11px] text-slate-500 line-clamp-2">
                                                        含：{resolveIncludedServiceTitles(pkg, allServices).join('、')}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        )}

                        {mainCategory === 'health_service' && (
                            <section>
                                <h2 className="font-bold text-slate-800 mb-1 px-1">
                                    {HEALTH_SERVICE_SUB_CATEGORIES.find((x) => x.id === subCategory)?.label || '健康服务'}
                                </h2>
                                <p className="text-xs text-slate-400 mb-3 px-1">
                                    {subCategory === 'education' ? '健康讲座、义诊与科普活动' : '理疗、解读、咨询与签约等服务'}
                                </p>
                                <div className="space-y-3">
                                    {subCategory === 'education' ? (
                                        visibleHealthItems.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-2xl">暂无科普活动</div>
                                        ) : (
                                            (visibleHealthItems as EventWithStatus[]).map(renderEventCard)
                                        )
                                    ) : visibleHealthItems.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-2xl">暂无该分类健康服务</div>
                                    ) : (
                                        (visibleHealthItems as ContentItem[]).map(renderServiceCard)
                                    )}
                                </div>
                            </section>
                        )}

                        {filteredCircles.length > 0 && (
                            <section>
                                <h2 className="font-bold text-slate-800 mb-3 px-1">加入圈子</h2>
                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                                    {filteredCircles.map(g => (
                                        <div 
                                            key={g.id} 
                                            onClick={() => setSelectedItem(g)}
                                            className="flex-shrink-0 flex flex-col items-center justify-center w-24 h-28 bg-white border border-slate-100 shadow-sm rounded-2xl cursor-pointer active:scale-95 transition-transform"
                                        >
                                            <ResourceCover
                                                item={g}
                                                fallback={<span className="text-2xl">{getCommunityIcon(g.title, 'circle')}</span>}
                                                className="mb-2 h-14 w-14 rounded-xl bg-slate-50 text-2xl"
                                                imgClassName="h-full w-full object-cover rounded-xl"
                                            />
                                            <span className="text-xs font-bold text-slate-700 text-center px-1 line-clamp-1">{g.title}</span>
                                            <span className="text-xs text-slate-400 mt-1">{g.details?.memberCount || 0} 成员</span>
                                            {g.details?.leader && <span className="text-xs text-slate-400 line-clamp-1">负责人: {g.details.leader}</span>}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>

            {/* Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedItem(null)}>
                    <div className="bg-white w-full max-w-md rounded-t-3xl p-0 animate-slideUp overflow-hidden max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-50 p-6 pb-8 text-center relative border-b border-slate-100">
                            <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 font-bold shadow-sm">×</button>
                            <div className="mx-auto mb-4 h-20 w-20">
                                <ResourceCover
                                    item={selectedItem}
                                    fallback={
                                        <span className="text-5xl">
                                            {getCommunityIcon(selectedItem.title, selectedItem.type)}
                                        </span>
                                    }
                                    className="h-full w-full rounded-2xl bg-white text-5xl shadow-sm"
                                    imgClassName="h-full w-full rounded-2xl object-cover shadow-sm"
                                />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-1">{selectedItem.title}</h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                selectedItem.type === 'event' ? 'bg-purple-100 text-purple-700' :
                                selectedItem.type === 'meal' ? 'bg-orange-100 text-orange-700' :
                                selectedItem.type === 'checkup_package' ? 'bg-emerald-100 text-emerald-700' :
                                selectedItem.type === 'service' ? 'bg-blue-100 text-blue-700' :
                                'bg-teal-100 text-teal-700'
                            }`}>
                                {selectedItem.type === 'event' ? '科普活动' :
                                 selectedItem.type === 'meal' ? '饮食食谱' :
                                 selectedItem.type === 'checkup_package' ? '体检套餐' :
                                 selectedItem.type === 'service' ? '医疗服务' : '兴趣圈子'}
                            </span>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            <div className="flex flex-wrap gap-2 justify-center">
                                {selectedItem.tags.map(t => <span key={t} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs">{t}</span>)}
                            </div>

                            {/* Event Info */}
                            {selectedItem.type === 'event' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 p-3 rounded-xl">
                                        <div className="text-xs text-slate-400 mb-1">时间</div>
                                        <div className="font-bold text-slate-800 text-sm">{formatEventSchedule(selectedItem.details)}</div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl">
                                        <div className="text-xs text-slate-400 mb-1">地点</div>
                                        <div className="font-bold text-slate-800 text-sm line-clamp-1">{selectedItem.details?.loc || '线上'}</div>
                                    </div>
                                </div>
                            )}

                            {/* Meal Nutrition */}
                            {selectedItem.type === 'meal' && selectedItem.details?.macros && (
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="bg-orange-50 p-2 rounded-xl text-center">
                                        <div className="text-xs text-orange-400">热量</div>
                                        <div className="font-bold text-orange-700 text-sm">{selectedItem.details.cal}</div>
                                    </div>
                                    <div className="bg-blue-50 p-2 rounded-xl text-center">
                                        <div className="text-xs text-blue-400">蛋白</div>
                                        <div className="font-bold text-blue-700 text-sm">{selectedItem.details.macros.protein}g</div>
                                    </div>
                                    <div className="bg-yellow-50 p-2 rounded-xl text-center">
                                        <div className="text-xs text-yellow-600">脂肪</div>
                                        <div className="font-bold text-yellow-700 text-sm">{selectedItem.details.macros.fat}g</div>
                                    </div>
                                    <div className="bg-green-50 p-2 rounded-xl text-center">
                                        <div className="text-xs text-green-400">碳水</div>
                                        <div className="font-bold text-green-700 text-sm">{selectedItem.details.macros.carbs}g</div>
                                    </div>
                                </div>
                            )}

                            {/* Service Price */}
                            {(selectedItem.type === 'service' || selectedItem.type === 'checkup_package') && (
                                <div className="bg-blue-50 p-4 rounded-xl text-center">
                                    <div className="text-xs text-blue-400 mb-1">{selectedItem.type === 'checkup_package' ? '套餐价格' : '服务价格'}</div>
                                    <div className="text-2xl font-bold text-blue-700">
                                        {selectedItem.details?.price ? `¥${selectedItem.details.price}` : '免费'}
                                    </div>
                                </div>
                            )}

                            {selectedItem.type === 'checkup_package' && resolveIncludedServiceTitles(selectedItem, allServices).length > 0 && (
                                <div className="bg-emerald-50 p-4 rounded-xl">
                                    <div className="text-xs text-emerald-600 mb-2 font-bold">套餐包含项目</div>
                                    <ul className="text-sm text-emerald-900 space-y-1 list-disc pl-4">
                                        {resolveIncludedServiceTitles(selectedItem, allServices).map((title) => (
                                            <li key={title}>{title}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {selectedItem.type === 'circle' && (
                                <div className="space-y-2">
                                    <div className="bg-slate-50 p-3 rounded-xl text-sm">
                                        <span className="text-slate-400">负责人：</span>
                                        <span className="font-bold text-slate-700">{selectedItem.details?.leader || '待补充'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl text-sm">
                                        <span className="text-slate-400">联系方式：</span>
                                        <span className="font-bold text-slate-700">{selectedItem.details?.contact || '待补充'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl text-sm">
                                        <div className="text-slate-400 mb-1">群二维码内容</div>
                                        <div className="font-bold text-slate-700 break-all">{selectedItem.details?.groupQr || '待补充'}</div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="font-bold text-slate-800 text-sm mb-2">详细介绍</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl whitespace-pre-line">
                                    {selectedItem.description || selectedItem.details?.ingredients || selectedItem.details?.content || '暂无详细介绍'}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white">
                            {selectedItem.type === 'event' && (
                                <button onClick={() => handleSignup(selectedItem)} className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all">
                                    ✍️ 立即报名
                                </button>
                            )}
                            {selectedItem.type === 'meal' && (
                                <button onClick={() => setSelectedItem(null)} className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all">
                                    🥗 收藏食谱
                                </button>
                            )}
                            {(selectedItem.type === 'service' || selectedItem.type === 'checkup_package') && (
                                <button onClick={() => handleBookService(selectedItem)} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all">
                                    📅 预约{selectedItem.type === 'checkup_package' ? '套餐' : '服务'}
                                </button>
                            )}
                            {selectedItem.type === 'circle' && (
                                <button onClick={() => handleJoinCircle(selectedItem)} className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all">
                                    ➕ 申请加入
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <BookingContactModal
                open={serviceContactOpen}
                title="填写服务预约信息"
                subtitle={pendingServiceBook ? `预约：${pendingServiceBook.service.title}` : undefined}
                defaultName={contactDefaultName}
                defaultPhone={contactDefaultPhone}
                onCancel={() => {
                    setServiceContactOpen(false);
                    setPendingServiceBook(null);
                }}
                onConfirm={({ name, phone }) => completeServiceBook(name, phone)}
            />
            <BookingContactModal
                open={eventContactOpen}
                title="填写活动报名信息"
                subtitle={pendingEvent ? `活动：${pendingEvent.title}` : undefined}
                defaultName={contactDefaultName}
                defaultPhone={contactDefaultPhone}
                onCancel={() => {
                    setEventContactOpen(false);
                    setPendingEvent(null);
                }}
                onConfirm={({ name, phone }) => completeEventSignup(name, phone)}
            />
            {bookingService && (
                <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setBookingService(null)}>
                    <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 animate-slideUp max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-1">选择服务时间</h3>
                        <p className="text-xs text-slate-400 text-center mb-6">预约服务：{bookingService.title}</p>
                        <div className="flex-1 overflow-y-auto space-y-3 pb-6">
                            {(() => {
                                const monthSlots = getNextMonthSlotsForService(bookingService);
                                if (!monthSlots.length) {
                                    return (
                                        <div className="text-center py-10">
                                            <div className="text-4xl mb-3 opacity-20">📅</div>
                                            <p className="text-sm text-slate-400">该服务暂未配置可预约时间<br/>请联系医院后续开通</p>
                                        </div>
                                    );
                                }
                                return monthSlots.map((slot) => {
                                    const { count, quota, full } = getServiceSlotUsage(bookingService.id, slot);
                                    return (
                                        <button
                                            key={`${slot.dateKey}-${slot.slotId}`}
                                            disabled={full}
                                            onClick={() => handleBookService(bookingService, `${slot.displayDate}${SLOT_MAP[slot.slotId]}`)}
                                            className={`w-full border p-4 rounded-2xl flex items-center justify-between transition-all text-left ${
                                                full
                                                    ? 'opacity-50 cursor-not-allowed border-slate-100 bg-slate-50 grayscale'
                                                    : 'border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200'
                                            }`}
                                        >
                                            <span className="font-bold text-slate-700">{slot.displayDate} · {SLOT_MAP[slot.slotId]}</span>
                                            <span className={`text-xs font-bold ${full ? 'text-red-500' : 'text-slate-400'}`}>
                                                {full ? '约满' : `余 ${quota - count} 位`}
                                            </span>
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                        <button onClick={() => setBookingService(null)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm">取消</button>
                    </div>
                </div>
            )}
        </div>
    );
};
