
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

// Gamification Config
const LEVEL_XP = 100;
const XP_PER_HABIT = 10;
const STREAK_BONUS = 20;

const BADGES = [
    { id: 'first_step', icon: '🌱', name: '起步', desc: '完成第1次打卡' },
    { id: 'streak_3', icon: '🔥', name: '三日连胜', desc: '连续打卡3天' },
    { id: 'streak_7', icon: '🚀', name: '七日习惯', desc: '连续打卡7天' },
    { id: 'streak_30', icon: '👑', name: '月度王者', desc: '连续打卡30天' },
    { id: 'level_5', icon: '⭐', name: '健康达人', desc: '达到等级5' },
    { id: 'perfect_day', icon: '💯', name: '完美一天', desc: '单日完成所有打卡' },
];

export const UserHabits: React.FC<Props> = ({ assessment, userCheckupId, record, onRefresh }) => {
    const [habits, setHabits] = useState<HabitRecord[]>([]);
    const [gameData, setGameData] = useState<UserGamification>({
        totalXP: 0,
        level: 1,
        currentStreak: 0,
        lastCheckInDate: '',
        badges: []
    });
    const [isHabitsLoading, setIsHabitsLoading] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [justUnlockedBadges, setJustUnlockedBadges] = useState<string[]>([]);

    useEffect(() => {
        loadData();
    }, [userCheckupId, assessment]);

    const loadData = async () => {
        if (!userCheckupId) return;
        const archive = await findArchiveByCheckupId(userCheckupId);
        
        if (archive) {
            // Load Habits
            if (archive.habit_tracker && archive.habit_tracker.length > 0) {
                setHabits(archive.habit_tracker);
            } else if (assessment && record) {
                await initializeHabits(assessment, record);
            }

            // Load Gamification
            if (archive.gamification) {
                setGameData(archive.gamification);
            }
        }
    };

    const initializeHabits = async (ass: HealthAssessment, rec: HealthRecord) => {
        if (!userCheckupId) return;
        setIsHabitsLoading(true);
        try {
            const { habits: newHabits } = await generatePersonalizedHabits(ass, rec);
            setHabits(newHabits);
            await updateHabits(userCheckupId, newHabits); // Initial save without gamification
        } catch (e) {
            console.error(e);
        } finally {
            setIsHabitsLoading(false);
        }
    };

    const handleCheckIn = async (habitId: string) => {
        if (!userCheckupId) return;
        const today = new Date().toISOString().split('T')[0];
        let earnedXP = 0;
        let newBadges: string[] = [];
        
        // 1. Update Habit State
        const updatedHabits = habits.map(h => {
            if (h.id === habitId) {
                const isAlreadyDone = h.history.includes(today);
                if (isAlreadyDone) return h; // Prevent double check-in for XP logic for now (simplification)
                
                // Determine streak logic specific to habit
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yStr = yesterday.toISOString().split('T')[0];
                
                let newStreak = h.streak;
                if (h.history.includes(yStr)) {
                    newStreak += 1;
                } else {
                    newStreak = 1;
                }

                earnedXP += XP_PER_HABIT;
                return { ...h, history: [...h.history, today], streak: newStreak };
            }
            return h;
        });

        // 2. Update Global Gamification State
        let newGameData = { ...gameData };
        
        // Streak Logic: Check if ANY habit was done yesterday to maintain global streak
        // Simplified: If lastCheckInDate was yesterday, increment. If today, do nothing. Else reset to 1.
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];

        if (newGameData.lastCheckInDate !== today) {
            if (newGameData.lastCheckInDate === yStr) {
                newGameData.currentStreak += 1;
                earnedXP += STREAK_BONUS; // Bonus for maintaining daily streak
            } else {
                newGameData.currentStreak = 1;
            }
            newGameData.lastCheckInDate = today;
        }

        // XP & Level Logic
        const oldLevel = newGameData.level;
        newGameData.totalXP += earnedXP;
        newGameData.level = Math.floor(newGameData.totalXP / LEVEL_XP) + 1;

        if (newGameData.level > oldLevel) {
            setShowLevelUp(true);
            setTimeout(() => setShowLevelUp(false), 3000);
        }

        // Badge Logic
        const unlockBadge = (id: string) => {
            if (!newGameData.badges.includes(id)) {
                newGameData.badges.push(id);
                newBadges.push(id);
            }
        };

        if (newGameData.totalXP > 0) unlockBadge('first_step');
        if (newGameData.currentStreak >= 3) unlockBadge('streak_3');
        if (newGameData.currentStreak >= 7) unlockBadge('streak_7');
        if (newGameData.currentStreak >= 30) unlockBadge('streak_30');
        if (newGameData.level >= 5) unlockBadge('level_5');
        
        // Perfect Day Check
        const allDoneToday = updatedHabits.every(h => 
            (h.frequency === 'daily' && h.history.includes(today)) || 
            (h.frequency === 'weekly' && (h.targetDay !== new Date().getDay() || h.history.includes(today)))
        );
        if (allDoneToday) unlockBadge('perfect_day');

        if (newBadges.length > 0) {
            setJustUnlockedBadges(newBadges);
            setTimeout(() => setJustUnlockedBadges([]), 4000);
        }

        // 3. Save Everything
        setHabits(updatedHabits);
        setGameData(newGameData);
        await updateHabits(userCheckupId, updatedHabits, newGameData);
    };

    const progressToNextLevel = (gameData.totalXP % LEVEL_XP) / LEVEL_XP * 100;

    return (
        <div className="bg-slate-50 min-h-full pb-28 relative overflow-hidden">
            
            {/* Level Up Overlay */}
            {showLevelUp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl animate-bounce text-center border-4 border-yellow-400">
                        <div className="text-6xl mb-4">🆙</div>
                        <h2 className="text-3xl font-black text-yellow-600 mb-2">升级啦!</h2>
                        <p className="text-xl font-bold text-slate-700">Lv.{gameData.level}</p>
                    </div>
                </div>
            )}

            {/* Header Dashboard */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6 pb-12 rounded-b-[2.5rem] shadow-lg relative">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl border-2 border-white/30 backdrop-blur-sm">
                            🏅
                        </div>
                        <div>
                            <div className="text-xs opacity-80 font-bold uppercase tracking-wider">当前等级</div>
                            <div className="text-2xl font-black italic">Lv.{gameData.level}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-1 text-orange-300">
                            <span className="text-2xl">🔥</span>
                            <span className="text-2xl font-black">{gameData.currentStreak}</span>
                        </div>
                        <div className="text-[10px] opacity-70">连续打卡天数</div>
                    </div>
                </div>

                {/* XP Bar */}
                <div className="relative z-10">
                    <div className="flex justify-between text-xs mb-1 opacity-90 font-medium">
                        <span>XP {gameData.totalXP}</span>
                        <span>Next Lv.{gameData.level + 1}</span>
                    </div>
                    <div className="h-3 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                        <div 
                            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                            style={{ width: `${progressToNextLevel}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Habits Grid */}
            <div className="px-4 -mt-8 relative z-20">
                <div className="bg-white rounded-3xl shadow-xl p-5 border border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <span>✅</span> 今日任务
                        </h3>
                        {assessment && (
                            <button onClick={() => initializeHabits(assessment, record!)} disabled={isHabitsLoading} className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded hover:bg-slate-200 transition-colors">
                                {isHabitsLoading ? '生成中...' : '🔄 刷新目标'}
                            </button>
                        )}
                    </div>

                    {habits.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm">
                            暂无打卡习惯，请点击刷新生成
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-y-6 gap-x-4">
                            {habits.map(habit => {
                                const today = new Date().toISOString().split('T')[0];
                                const isDone = habit.history.includes(today);
                                const dayOfWeek = new Date().getDay(); 
                                const isWrongDay = habit.frequency === 'weekly' && habit.targetDay !== undefined && habit.targetDay !== dayOfWeek;

                                return (
                                    <div key={habit.id} className="flex flex-col items-center">
                                        <button 
                                            onClick={() => !isDone && !isWrongDay && handleCheckIn(habit.id)}
                                            disabled={isDone || isWrongDay}
                                            className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm transition-all duration-300 relative group ${
                                                isDone 
                                                ? `bg-gradient-to-br from-green-400 to-green-600 text-white scale-95 ring-4 ring-green-100`
                                                : isWrongDay 
                                                    ? 'bg-slate-50 border-2 border-slate-100 text-slate-300 grayscale cursor-not-allowed'
                                                    : `bg-white border-2 border-slate-100 hover:border-indigo-200 active:scale-90`
                                            }`}
                                        >
                                            <span className={`transition-transform duration-500 ${isDone ? 'rotate-[360deg] scale-110' : 'group-hover:scale-110'}`}>
                                                {isDone ? '✔️' : habit.icon}
                                            </span>
                                        </button>
                                        <span className={`text-xs font-bold mt-2 text-center truncate w-full ${isWrongDay ? 'text-slate-300' : isDone ? 'text-green-600' : 'text-slate-600'}`}>
                                            {habit.title}
                                        </span>
                                        <div className="text-[9px] text-slate-400 mt-0.5">
                                            {isWrongDay ? '非打卡日' : `连胜 ${habit.streak}`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Badges Section */}
            <div className="px-4 mt-6">
                <div className="bg-white rounded-3xl shadow-sm p-5 border border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                        <span>🏆</span> 成就勋章
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                        {BADGES.map(badge => {
                            const isUnlocked = gameData.badges.includes(badge.id);
                            const isJustUnlocked = justUnlockedBadges.includes(badge.id);
                            
                            return (
                                <div key={badge.id} className="flex flex-col items-center text-center">
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 transition-all duration-500 relative ${
                                        isUnlocked 
                                        ? 'bg-yellow-50 border-yellow-200 text-yellow-600 shadow-md' 
                                        : 'bg-slate-50 border-slate-100 text-slate-300 grayscale'
                                    } ${isJustUnlocked ? 'animate-bounce ring-4 ring-yellow-300' : ''}`}>
                                        {badge.icon}
                                        {isJustUnlocked && (
                                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold animate-ping">NEW</span>
                                        )}
                                    </div>
                                    <span className={`text-xs font-bold mt-2 ${isUnlocked ? 'text-slate-700' : 'text-slate-300'}`}>
                                        {badge.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Motivational Quote */}
            <div className="px-6 mt-8 text-center">
                <p className="text-xs text-slate-400 italic">
                    "每一个微小的习惯，都是通往健康的阶梯。"
                </p>
            </div>
        </div>
    );
};
