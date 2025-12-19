
import React, { useState, useEffect, useMemo } from 'react';
import { HealthAssessment, HealthRecord, RiskLevel } from '../../types';
import { HabitRecord, UserGamification, findArchiveByCheckupId, updateHabits } from '../../services/dataService';
import { generatePersonalizedHabits } from '../../services/geminiService';
import { fetchContent, ContentItem, fetchInteractions, saveInteraction, InteractionItem } from '../../services/contentService';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    userName?: string;
    record?: HealthRecord;
    onRefresh?: () => void;
}

const LEVEL_XP = 100;
const XP_PER_HABIT = 15;
const STREAK_BONUS = 25;

const DAY_MAP: Record<string, string> = {
    'Mon': '周一', 'Tue': '周二', 'Wed': '周三', 'Thu': '周四', 'Fri': '周五', 'Sat': '周六', 'Sun': '周日'
};
const SLOT_MAP: Record<string, string> = {
    'AM': '上午', 'PM': '下午'
};

const BADGES = [
    { id: 'first_step', icon: '🌱', name: '起步', desc: '完成第1次打卡' },
    { id: 'streak_3', icon: '🔥', name: '三日连胜', desc: '连续打卡3天' },
    { id: 'streak_7', icon: '🚀', name: '七日习惯', desc: '连续打卡7天' },
    { id: 'streak_30', icon: '👑', name: '月度王者', desc: '连续打卡30天' },
    { id: 'level_5', icon: '⭐', name: '健康达人', desc: '达到等级5' },
];

const INITIAL_GAME_DATA: UserGamification = {
    totalXP: 0,
    level: 1,
    currentStreak: 0,
    lastCheckInDate: '',
    badges: []
};

const getSmartIcon = (item: ContentItem): string => {
    if (item.image && item.image.length < 5) return item.image; // Emoji
    if (item.type === 'doctor') return '👨‍⚕️';
    if (item.type === 'meal') return '🥗';
    if (item.type === 'drug') return '💊';
    if (item.type === 'event') return '🎉';
    return '✨';
};

export const UserHabits: React.FC<Props> = ({ assessment, userCheckupId, userName, record }) => {
    const [habits, setHabits] = useState<HabitRecord[]>([]);
    const [gameData, setGameData] = useState<UserGamification>(INITIAL_GAME_DATA);
    const [isHabitsLoading, setIsHabitsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [showBadgeModal, setShowBadgeModal] = useState(false);

    // Recommendation & Interaction State
    const [recommendedResources, setRecommendedResources] = useState<{item: ContentItem, reason: string}[]>([]);
    const [selectedResource, setSelectedResource] = useState<ContentItem | null>(null);
    const [allInteractions, setAllInteractions] = useState<InteractionItem[]>([]);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingDoctor, setBookingDoctor] = useState<ContentItem | null>(null);

    useEffect(() => {
        loadData();
    }, [userCheckupId, assessment]);

    const loadData = async () => {
        if (!userCheckupId) return;
        const [archive, inters] = await Promise.all([
            findArchiveByCheckupId(userCheckupId),
            fetchInteractions()
        ]);
        
        setAllInteractions(inters);

        if (archive) {
            if (archive.habit_tracker && archive.habit_tracker.length > 0) {
                setHabits(archive.habit_tracker);
            } else if (assessment && record) {
                await initializeHabits(assessment, record);
            }
            if (archive.gamification) {
                setGameData({ ...INITIAL_GAME_DATA, ...archive.gamification });
            }
        }
        loadRecommendations();
    };

    const loadRecommendations = async () => {
        if (!assessment) return;
        // 提取风险关键词
        const risks = [...assessment.risks.red, ...assessment.risks.yellow];
        const keywords = ['高血压', '糖尿病', '血脂', '尿酸', '痛风', '结节', '肥胖', '心', '肝', '胃', '睡眠', '颈椎'];
        
        const matchedKeys = keywords.filter(key => 
            risks.some(r => r.includes(key)) || assessment.summary.includes(key)
        );

        if (matchedKeys.length === 0) matchedKeys.push('健康');

        const allResources = await fetchContent();
        const matches: {item: ContentItem, reason: string}[] = [];

        // 匹配逻辑：优先匹配医疗资源，其次是膳食和活动
        allResources.forEach(res => {
            const resText = (res.title + (res.description || '') + (res.tags?.join('') || '')).toLowerCase();
            const foundKey = matchedKeys.find(key => resText.includes(key.toLowerCase()));
            
            if (foundKey) {
                // 每种类型最多推荐1个，避免重复
                if (matches.filter(m => m.item.type === res.type).length < 2) {
                    matches.push({ 
                        item: res, 
                        reason: `针对您的[${foundKey}]风险推荐` 
                    });
                }
            }
        });

        // 随机取3个展示
        setRecommendedResources(matches.sort(() => 0.5 - Math.random()).slice(0, 3));
    };

    const handleInteract = async (type: string, target: ContentItem, timeSlot?: string) => {
        if (!userCheckupId || !userName) return alert("用户信息缺失，请重新登录");
        
        let interactionType: InteractionItem['type'] = 'doctor_booking'; 
        let confirmMsg = '';
        let details = '';

        if (type === 'signing') {
            interactionType = 'doctor_signing';
            confirmMsg = `确定申请签约【${target.title}】为您的家庭医生吗？`;
            details = '申请家庭医生签约';
        } else if (type === 'booking' && target.type === 'doctor') {
            interactionType = 'doctor_booking';
            if (!timeSlot) {
                setBookingDoctor(target);
                setShowBookingModal(true);
                setSelectedResource(null);
                return;
            }
            confirmMsg = `确定预约【${target.title}】在【${timeSlot}】的门诊吗？`;
            details = `预约挂号：${timeSlot}，费率: ${target.details?.fee || 0}元`;
        } else if (type === 'drug_order') {
            interactionType = 'drug_order';
            confirmMsg = `确定申请预约药品【${target.title}】吗？`;
            details = `预约药品，规格: ${target.details?.spec}`;
        } else if (target.type === 'event') {
            interactionType = 'event_signup';
            confirmMsg = `确定报名参加【${target.title}】吗？`;
            details = `首页推荐报名`;
        } else if (target.type === 'service') {
            interactionType = 'service_booking';
            confirmMsg = `确定预约服务【${target.title}】吗？`;
            details = `服务预约：${target.details?.price || '免费'}`;
        }

        if(confirm(confirmMsg)) {
            await saveInteraction({
                id: `${interactionType}_${Date.now()}`,
                type: interactionType,
                userId: userCheckupId,
                userName: userName,
                targetId: target.id,
                targetName: target.title,
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                details: details
            });
            alert("申请已提交，请在“我的-申请记录”中查看进度。");
            setSelectedResource(null);
            setShowBookingModal(false);
            setBookingDoctor(null);
            fetchInteractions().then(setAllInteractions);
        }
    };

    const getSlotUsage = (docId: string, dayKey: string, slotId: string) => {
        const slotText = `${DAY_MAP[dayKey]}${SLOT_MAP[slotId]}`;
        const count = allInteractions.filter(i => 
            i.type === 'doctor_booking' && 
            i.targetId === docId && 
            i.status !== 'cancelled' && 
            i.details?.includes(slotText)
        ).length;
        
        const quota = bookingDoctor?.details?.slotQuotas?.[dayKey]?.[slotId] || 10;
        return { count, quota, full: count >= quota };
    };

    const initializeHabits = async (ass: HealthAssessment, rec: HealthRecord) => {
        if (!userCheckupId) return;
        setIsHabitsLoading(true);
        try {
            const { habits: newHabits } = await generatePersonalizedHabits(ass, rec);
            setHabits(newHabits);
            await updateHabits(userCheckupId, newHabits, INITIAL_GAME_DATA); 
        } catch (e) {
            console.error(e);
        } finally {
            setIsHabitsLoading(false);
        }
    };

    const handleCheckIn = async (habitId: string) => {
        if (!userCheckupId || isSaving) return;
        setIsSaving(true);
        const today = new Date().toISOString().split('T')[0];
        let earnedXP = 0;
        
        const updatedHabits = habits.map(h => {
            if (h.id === habitId) {
                if (h.history.includes(today)) return h;
                earnedXP += XP_PER_HABIT;
                return { ...h, history: [...h.history, today], streak: h.streak + 1 };
            }
            return h;
        });

        let newGameData = { ...gameData };
        if (newGameData.lastCheckInDate !== today) {
            newGameData.currentStreak += 1;
            earnedXP += STREAK_BONUS;
            newGameData.lastCheckInDate = today;
        }

        const oldLevel = newGameData.level;
        newGameData.totalXP += earnedXP;
        newGameData.level = Math.floor(newGameData.totalXP / LEVEL_XP) + 1;

        if (newGameData.level > oldLevel) {
            setShowLevelUp(true);
            setTimeout(() => setShowLevelUp(false), 3000);
        }

        setHabits(updatedHabits);
        setGameData(newGameData);

        try {
            await updateHabits(userCheckupId, updatedHabits, newGameData);
        } finally {
            setIsSaving(false);
        }
    };

    const progressToNextLevel = (gameData.totalXP % LEVEL_XP) / LEVEL_XP * 100;

    return (
        <div className="bg-slate-50 min-h-full pb-32 animate-fadeIn">
            {/* Level Up Banner */}
            {showLevelUp && (
                <div className="fixed inset-x-0 top-10 z-[100] flex justify-center px-6 pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-2xl px-6 py-4 rounded-3xl shadow-2xl border border-yellow-200 flex items-center gap-4 animate-bounce">
                        <span className="text-3xl">🎉</span>
                        <div>
                            <p className="text-xs font-black text-yellow-600 uppercase">Level Up!</p>
                            <p className="text-lg font-bold text-slate-800">您已升至第 {gameData.level} 级</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Recommendations Section */}
            {recommendedResources.length > 0 && (
                <div className="px-6 pt-6">
                    <div className="flex justify-between items-center mb-3 px-1">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">智能干预建议</h3>
                        <span className="text-[10px] bg-teal-50 text-teal-600 px-2 py-0.5 rounded-md font-bold border border-teal-100">AI 精准匹配</span>
                    </div>
                    <div className="flex overflow-x-auto gap-3 pb-3 scrollbar-hide -mx-2 px-2">
                        {recommendedResources.map((rec, idx) => (
                            <div key={idx} 
                                onClick={() => setSelectedResource(rec.item)}
                                className="flex-shrink-0 w-[260px] bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-50 flex flex-col gap-3 relative overflow-hidden group active:scale-95 transition-all cursor-pointer"
                            >
                                <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-[0.08] group-hover:scale-110 transition-transform ${
                                    rec.item.type === 'doctor' ? 'bg-blue-600' : 
                                    rec.item.type === 'meal' ? 'bg-orange-500' : 'bg-teal-500'
                                }`}></div>
                                
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl shadow-inner group-hover:rotate-12 transition-transform">
                                        {getSmartIcon(rec.item)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] font-bold text-teal-600 uppercase mb-0.5 line-clamp-1">{rec.reason}</div>
                                        <div className="font-bold text-slate-800 text-sm truncate">{rec.item.title}</div>
                                    </div>
                                </div>
                                
                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed h-[32px] px-1">
                                    {rec.item.description || rec.item.details?.dept || '针对您的风险评估，建议关注此类健康资源。'}
                                </p>
                                
                                <div className={`mt-1 w-full py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider text-center transition-colors shadow-sm ${
                                    rec.item.type === 'doctor' ? 'bg-blue-600 text-white shadow-blue-100' : 
                                    rec.item.type === 'meal' ? 'bg-orange-500 text-white shadow-orange-100' : 
                                    'bg-teal-600 text-white shadow-teal-100'
                                }`}>
                                    立即查看
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dashboard Header */}
            <div className="px-6 pt-6 pb-12 bg-white rounded-b-[3rem] shadow-[0_10px_40px_rgba(0,0,0,0.03)]">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">打卡记录</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-slate-400">目前等级: Lv.{gameData.level}</span>
                            <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                            <span className="text-xs font-bold text-orange-500">连续 {gameData.currentStreak} 天</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowBadgeModal(true)}
                        className="bg-slate-900 text-white w-14 h-14 rounded-[22px] flex items-center justify-center text-2xl shadow-xl shadow-slate-200 active:scale-90 transition-transform relative"
                    >
                        🏆
                    </button>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">XP 经验值</span>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{gameData.totalXP % LEVEL_XP} / {LEVEL_XP}</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1">
                        <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progressToNextLevel}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Habit List */}
            <div className="px-6 -mt-6 space-y-4">
                <div className="flex justify-between items-center mb-1 px-2">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">今日目标</h3>
                    {isHabitsLoading && <span className="text-[10px] text-teal-600 animate-pulse font-bold">同步中...</span>}
                </div>

                {habits.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-100 shadow-sm">
                        <div className="text-4xl mb-4 grayscale opacity-50">🗓️</div>
                        <p className="text-slate-400 text-sm font-medium">暂无任务</p>
                    </div>
                ) : (
                    habits.map(habit => {
                        const today = new Date().toISOString().split('T')[0];
                        const isDone = habit.history.includes(today);
                        return (
                            <div 
                                key={habit.id}
                                className={`group bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-center justify-between transition-all active:scale-[0.98] ${isDone ? 'opacity-80' : ''}`}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center text-2xl transition-all duration-500 ${
                                        isDone ? 'bg-green-500 text-white scale-90' : 'bg-slate-50 text-slate-800'
                                    }`}>
                                        {isDone ? '✓' : habit.icon}
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-base transition-colors ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                            {habit.title}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase bg-orange-50 text-orange-600">
                                                🔥 连胜 {habit.streak} 天
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => !isDone && handleCheckIn(habit.id)}
                                    disabled={isDone || isSaving}
                                    className={`px-6 py-2.5 rounded-full text-xs font-black tracking-tight transition-all ${
                                        isDone ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                    }`}
                                >
                                    {isDone ? '已完成' : '立即打卡'}
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Standardized Detail Modal (Synced with Medical Services) */}
            {selectedResource && (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedResource(null)}>
                    <div className="bg-white w-full max-w-md rounded-t-[3rem] p-0 animate-slideUp overflow-hidden max-h-[88vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Header Section */}
                        <div className="bg-slate-50 p-7 pb-10 text-center relative border-b border-slate-100">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 opacity-50"></div>
                            <button onClick={() => setSelectedResource(null)} className="absolute top-6 right-6 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 font-bold shadow-md active:scale-90 transition-transform">×</button>
                            
                            <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-6xl shadow-sm mx-auto mb-5 border-4 border-white">
                                {getSmartIcon(selectedResource)}
                            </div>
                            
                            <h3 className="text-2xl font-black text-slate-800 mb-2">{selectedResource.title}</h3>
                            <div className="flex items-center justify-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                    selectedResource.type === 'doctor' ? 'bg-blue-100 text-blue-700' : 
                                    selectedResource.type === 'meal' ? 'bg-orange-100 text-orange-700' : 
                                    'bg-teal-100 text-teal-700'
                                }`}>
                                    {selectedResource.type === 'doctor' ? `${selectedResource.details?.dept} · ${selectedResource.details?.title}` : 
                                     selectedResource.type === 'meal' ? '平衡膳食' : 
                                     selectedResource.type === 'drug' ? '对症药品' : '健康服务'}
                                </span>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-8 overflow-y-auto space-y-8 flex-1">
                            <div>
                                <h4 className="font-black text-slate-900 text-sm mb-3 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-teal-500 rounded-full"></span>
                                    {selectedResource.type === 'doctor' ? '专家履历与特长' : '核心建议详情'}
                                </h4>
                                <div className="text-slate-600 text-[14px] leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-50 whitespace-pre-line">
                                    {selectedResource.description || selectedResource.details?.ingredients || '暂无详细介绍，建议前往对应板块查看。'}
                                </div>
                            </div>
                            
                            {selectedResource.type === 'doctor' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-50 text-center">
                                        <div className="text-[10px] font-black text-blue-400 uppercase mb-1">出诊诊金</div>
                                        <div className="text-xl font-black text-blue-800">¥{selectedResource.details?.fee || '0'}</div>
                                    </div>
                                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-50 text-center">
                                        <div className="text-[10px] font-black text-blue-400 uppercase mb-1">所属科室</div>
                                        <div className="text-lg font-black text-blue-800 truncate">{selectedResource.details?.dept || '全科'}</div>
                                    </div>
                                </div>
                            )}

                            {selectedResource.type === 'meal' && selectedResource.details?.macros && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-orange-50/50 p-3 rounded-2xl text-center border border-orange-50">
                                        <div className="text-[9px] font-black text-orange-400 uppercase">能量</div>
                                        <div className="text-base font-black text-orange-700">{selectedResource.details.cal}</div>
                                        <div className="text-[9px] text-orange-300">kcal</div>
                                    </div>
                                    <div className="bg-blue-50/50 p-3 rounded-2xl text-center border border-blue-50">
                                        <div className="text-[9px] font-black text-blue-400 uppercase">蛋白</div>
                                        <div className="text-base font-black text-blue-700">{selectedResource.details.macros.protein}g</div>
                                    </div>
                                    <div className="bg-emerald-50/50 p-3 rounded-2xl text-center border border-emerald-50">
                                        <div className="text-[9px] font-black text-emerald-400 uppercase">膳食纤维</div>
                                        <div className="text-base font-black text-emerald-700">{selectedResource.details.macros.fiber || 0}g</div>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Footer Actions (Standardized) */}
                        <div className="p-6 pb-10 border-t border-slate-50 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
                            {selectedResource.type === 'doctor' && (
                                <div className="flex gap-4">
                                    <button onClick={() => handleInteract('booking', selectedResource)} className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-2xl font-black text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"><span>📅</span> 预约门诊</button>
                                    <button onClick={() => handleInteract('signing', selectedResource)} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-100 active:scale-95 transition-transform flex items-center justify-center gap-2"><span>✍️</span> 申请签约</button>
                                </div>
                            )}
                            {selectedResource.type === 'meal' && (
                                <button onClick={() => setSelectedResource(null)} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-orange-100 active:scale-95 transition-transform flex items-center justify-center gap-2"><span>🥗</span> 查看食谱详情</button>
                            )}
                            {selectedResource.type === 'event' && (
                                <button onClick={() => handleInteract('signup', selectedResource)} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 active:scale-95 transition-transform flex items-center justify-center gap-2"><span>✨</span> 立即报名参加</button>
                            )}
                            {selectedResource.type === 'drug' && (
                                <button onClick={() => handleInteract('drug_order', selectedResource)} className="w-full bg-teal-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-teal-100 active:scale-95 transition-transform flex items-center justify-center gap-2"><span>💊</span> 预定此药品</button>
                            )}
                            {selectedResource.type === 'service' && (
                                <button onClick={() => handleInteract('booking', selectedResource)} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-purple-100 active:scale-95 transition-transform flex items-center justify-center gap-2"><span>🏥</span> 立即预约服务</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Time Selection Modal for Recommendations (Synced) */}
            {showBookingModal && bookingDoctor && (
                <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-end justify-center backdrop-blur-sm animate-fadeIn" onClick={() => setShowBookingModal(false)}>
                    <div className="bg-white w-full max-w-md rounded-t-[3rem] p-8 animate-slideUp max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8 opacity-50"></div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-1">选择就诊时间</h3>
                        <p className="text-xs text-slate-400 text-center mb-8 uppercase tracking-widest font-bold">预约专家：{bookingDoctor.title}</p>
                        
                        <div className="flex-1 overflow-y-auto space-y-8 pb-10">
                            {Object.keys(DAY_MAP).map(dayKey => {
                                const activeSlots = bookingDoctor.details?.weeklySchedule?.[dayKey] || [];
                                if (activeSlots.length === 0) return null;
                                return (
                                    <div key={dayKey} className="animate-slideInRight">
                                        <h4 className="font-black text-[10px] text-slate-400 uppercase tracking-[0.2em] mb-4 px-1">{DAY_MAP[dayKey]}</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {activeSlots.map((slotId: string) => {
                                                const { count, quota, full } = getSlotUsage(bookingDoctor.id, dayKey, slotId);
                                                return (
                                                    <button 
                                                        key={slotId}
                                                        disabled={full}
                                                        onClick={() => handleInteract('booking', bookingDoctor, `${DAY_MAP[dayKey]}${SLOT_MAP[slotId]}`)}
                                                        className={`p-5 rounded-3xl border transition-all relative flex flex-col items-center justify-center group ${
                                                            full 
                                                            ? 'opacity-40 cursor-not-allowed border-slate-100 bg-slate-50' 
                                                            : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-300 hover:shadow-xl hover:shadow-blue-50'
                                                        }`}
                                                    >
                                                        <span className="font-black text-slate-700 text-base">{SLOT_MAP[slotId]}</span>
                                                        <span className={`text-[10px] mt-1 font-bold ${full ? 'text-red-500' : 'text-slate-400'}`}>
                                                            {full ? '约满' : `余 ${quota - count} 位`}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={() => setShowBookingModal(false)} className="w-full py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-sm active:scale-95 transition-transform mb-4">取消预约</button>
                    </div>
                </div>
            )}

            {/* Achievement Badge Modal */}
            {showBadgeModal && (
                <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 backdrop-blur-md animate-fadeIn" onClick={() => setShowBadgeModal(false)}>
                    <div className="bg-white w-full max-w-md rounded-t-[3rem] p-8 animate-slideUp" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
                        <div className="grid grid-cols-3 gap-6">
                            {BADGES.map(badge => {
                                const isUnlocked = gameData.badges.includes(badge.id);
                                return (
                                    <div key={badge.id} className="flex flex-col items-center text-center group">
                                        <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center text-4xl mb-3 transition-all duration-500 ${
                                            isUnlocked ? 'bg-yellow-50 shadow-lg border-2 border-yellow-200' : 'bg-slate-50 grayscale opacity-30'
                                        }`}>
                                            {badge.icon}
                                        </div>
                                        <span className={`text-[11px] font-black tracking-tight ${isUnlocked ? 'text-slate-800' : 'text-slate-300'}`}>
                                            {badge.name}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={() => setShowBadgeModal(false)} className="mt-12 w-full py-4 bg-slate-900 text-white rounded-[22px] font-black text-sm active:scale-95 transition-transform">我知道了</button>
                    </div>
                </div>
            )}
        </div>
    );
};
