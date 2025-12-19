
import React, { useState, useEffect } from 'react';
import { HealthAssessment, HealthRecord } from '../../types';
import { HabitRecord, UserGamification, findArchiveByCheckupId, updateHabits } from '../../services/dataService';
import { generatePersonalizedHabits } from '../../services/geminiService';

interface Props {
    assessment?: HealthAssessment;
    userCheckupId?: string;
    record?: HealthRecord;
    onRefresh?: () => void;
}

const LEVEL_XP = 100;
const XP_PER_HABIT = 15;
const STREAK_BONUS = 25;

const BADGES = [
    { id: 'first_step', icon: '🌱', name: '起步', desc: '完成第1次打卡' },
    { id: 'streak_3', icon: '🔥', name: '三日连胜', desc: '连续打卡3天' },
    { id: 'streak_7', icon: '🚀', name: '七日习惯', desc: '连续打卡7天' },
    { id: 'streak_30', icon: '👑', name: '月度王者', desc: '连续打卡30天' },
    { id: 'level_5', icon: '⭐', name: '健康达人', desc: '达到等级5' },
    { id: 'perfect_day', icon: '💯', name: '完美一天', desc: '单日完成所有打卡' },
];

const INITIAL_GAME_DATA: UserGamification = {
    totalXP: 0,
    level: 1,
    currentStreak: 0,
    lastCheckInDate: '',
    badges: []
};

export const UserHabits: React.FC<Props> = ({ assessment, userCheckupId, record }) => {
    const [habits, setHabits] = useState<HabitRecord[]>([]);
    const [gameData, setGameData] = useState<UserGamification>(INITIAL_GAME_DATA);
    const [isHabitsLoading, setIsHabitsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [showBadgeModal, setShowBadgeModal] = useState(false);

    useEffect(() => {
        loadData();
    }, [userCheckupId, assessment]);

    const loadData = async () => {
        if (!userCheckupId) return;
        const archive = await findArchiveByCheckupId(userCheckupId);
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

        // Auto unlock badges
        if (newGameData.currentStreak >= 3 && !newGameData.badges.includes('streak_3')) newGameData.badges.push('streak_3');
        if (newGameData.totalXP > 0 && !newGameData.badges.includes('first_step')) newGameData.badges.push('first_step');

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
            {/* iOS Style Floating Level Up */}
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

            {/* Dashboard: iPhone 17 Premium Look */}
            <div className="px-6 pt-8 pb-12 bg-white rounded-b-[3rem] shadow-[0_10px_40px_rgba(0,0,0,0.03)]">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">打卡记录</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-slate-400">目前等级: Lv.{gameData.level}</span>
                            <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                            <span className="text-xs font-bold text-orange-500">连续 {gameData.currentStreak} 天</span>
                        </div>
                    </div>
                    {/* Badge Entry Button */}
                    <button 
                        onClick={() => setShowBadgeModal(true)}
                        className="bg-slate-900 text-white w-14 h-14 rounded-[22px] flex items-center justify-center text-2xl shadow-xl shadow-slate-200 active:scale-90 transition-transform relative"
                    >
                        🏆
                        {gameData.badges.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white font-bold">
                                {gameData.badges.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Modern Progress Bar */}
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

            {/* Habit List: 1 Item Per Row */}
            <div className="px-6 -mt-6 space-y-4">
                <div className="flex justify-between items-center mb-1 px-2">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">今日目标</h3>
                    {isHabitsLoading && <span className="text-[10px] text-teal-600 animate-pulse font-bold">同步中...</span>}
                </div>

                {habits.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-100 shadow-sm">
                        <div className="text-4xl mb-4 grayscale opacity-50">🗓️</div>
                        <p className="text-slate-400 text-sm font-medium">暂无任务，点击下方生成</p>
                        <button 
                            onClick={() => assessment && record && initializeHabits(assessment, record)}
                            className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-full text-xs font-bold"
                        >
                            智能生成计划
                        </button>
                    </div>
                ) : (
                    habits.map(habit => {
                        const today = new Date().toISOString().split('T')[0];
                        const isDone = habit.history.includes(today);
                        const dayOfWeek = new Date().getDay();
                        const isWrongDay = habit.frequency === 'weekly' && habit.targetDay !== undefined && habit.targetDay !== dayOfWeek;

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
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase ${isWrongDay ? 'bg-slate-100 text-slate-400' : 'bg-orange-50 text-orange-600'}`}>
                                                {isWrongDay ? '休整中' : `🔥 连胜 ${habit.streak} 天`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => !isDone && !isWrongDay && handleCheckIn(habit.id)}
                                    disabled={isDone || isWrongDay || isSaving}
                                    className={`px-6 py-2.5 rounded-full text-xs font-black tracking-tight transition-all ${
                                        isDone 
                                        ? 'bg-slate-100 text-slate-400 cursor-default' 
                                        : isWrongDay
                                            ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                            : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 active:bg-indigo-700'
                                    }`}
                                >
                                    {isDone ? '已完成' : isWrongDay ? '非打卡日' : '立即打卡'}
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Badge Modal: Slide up */}
            {showBadgeModal && (
                <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 backdrop-blur-md animate-fadeIn" onClick={() => setShowBadgeModal(false)}>
                    <div 
                        className="bg-white w-full max-w-md rounded-t-[3rem] p-8 animate-slideUp max-h-[80vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-black text-slate-900">成就勋章库</h3>
                            <p className="text-sm text-slate-400 font-medium mt-1">您已解锁 {gameData.badges.length} 枚荣誉</p>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            {BADGES.map(badge => {
                                const isUnlocked = gameData.badges.includes(badge.id);
                                return (
                                    <div key={badge.id} className="flex flex-col items-center text-center group">
                                        <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center text-4xl mb-3 transition-all duration-500 ${
                                            isUnlocked 
                                            ? 'bg-yellow-50 shadow-[0_10px_25px_rgba(251,191,36,0.15)] border-2 border-yellow-200 scale-100 rotate-0' 
                                            : 'bg-slate-50 grayscale opacity-30 scale-90'
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

                        <button 
                            onClick={() => setShowBadgeModal(false)}
                            className="mt-12 w-full py-4 bg-slate-900 text-white rounded-[22px] font-black text-sm active:scale-95 transition-transform"
                        >
                            我知道了
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
