
import React, { useMemo } from 'react';
import { HealthProfile, HealthAssessment, HealthRecord } from '../../types';
import { DailyHealthPlan } from '../../services/dataService';

interface Props {
  profile?: HealthProfile;
  assessment?: HealthAssessment;
  record?: HealthRecord;
  dailyPlan?: DailyHealthPlan;
  onNavigate?: (tab: string) => void;
}

export const UserHome: React.FC<Props> = ({ profile, assessment, record, dailyPlan, onNavigate }) => {
  
  // 1. 计算热量目标与当前进度 (逻辑同步自 UserDietMotion)
  const stats = useMemo(() => {
    // 目标计算
    const w = record?.checkup?.basics?.weight || 65;
    const h = record?.checkup?.basics?.height || 170;
    const age = record?.profile?.age || 40;
    const gender = record?.profile?.gender || '男';
    let bmr = (10 * w) + (6.25 * h) - (5 * age) + (gender === '女' ? -161 : 5);
    const targetCal = Math.round(bmr * 1.375);

    // 当前摄入与消耗
    const dLogs = dailyPlan?.dietLogs || [];
    const eLogs = dailyPlan?.exerciseLogs || [];
    
    const intake = dLogs.reduce((acc, item) => ({
        cal: acc.cal + (Number(item.calories) || 0),
        p: acc.p + (Number(item.protein) || 0),
        f: acc.f + (Number(item.fat) || 0),
        c: acc.c + (Number(item.carbs) || 0),
    }), { cal: 0, p: 0, f: 0, c: 0 });

    const burned = eLogs.reduce((acc, item) => acc + (Number(item.calories) || 0), 0);
    const remaining = Math.max(0, targetCal - intake.cal + burned);
    const progress = Math.min(100, ((intake.cal - burned) / targetCal) * 100);

    return { targetCal, intake, burned, remaining, progress };
  }, [record, dailyPlan]);

  const riskStyles: Record<string, any> = {
    RED: { color: 'from-red-500 to-rose-600', label: '高风险', icon: '🚨' },
    YELLOW: { color: 'from-orange-400 to-amber-500', label: '中风险', icon: '⚠️' },
    GREEN: { color: 'from-teal-500 to-emerald-600', label: '低风险', icon: '🛡️' },
  };

  const currentRisk = assessment?.riskLevel || 'GREEN';
  const style = riskStyles[currentRisk] || riskStyles.GREEN;

  return (
    <div className="p-5 space-y-6 animate-fadeIn pb-32">
      {/* 顶部个人信息 */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">你好，{profile?.name || '教职工'}</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">郑州大学医院 · 智慧健康管理</p>
        </div>
        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-50 flex items-center justify-center text-2xl">
            {profile?.gender === '女' ? '👩' : '👨'}
        </div>
      </div>

      {/* 核心卡片：风险状态 */}
      <div className={`bg-gradient-to-br ${style.color} rounded-[2.5rem] p-6 text-white shadow-xl shadow-teal-100 relative overflow-hidden`}>
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
         <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">AI 健康评估结果</div>
                    <div className="text-3xl font-black">{style.icon} {style.label}</div>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black">实时分析</div>
            </div>
            <p className="text-xs leading-relaxed opacity-95 font-medium line-clamp-2 bg-black/10 rounded-xl p-3 border border-white/10">
                {assessment?.summary || '请尽快完善体检报告解析以获得深度健康画像。'}
            </p>
         </div>
      </div>

      {/* [核心更新] 饮食运动记录模块 */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md">
         <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span className="text-lg">🥑</span> 今日记录
            </h2>
            <button 
                onClick={() => onNavigate?.('diet_motion')}
                className="text-[10px] font-black text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full hover:bg-teal-100 transition-colors"
            >
                详情/打卡 →
            </button>
         </div>
         
         <div className="p-6">
            <div className="flex items-center justify-around mb-8">
                <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{stats.intake.cal}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">已摄入</div>
                </div>

                <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                        <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={314.15} strokeDashoffset={314.15 - (314.15 * stats.progress) / 100} strokeLinecap="round" className="text-teal-500 transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-black text-slate-800">{stats.remaining}</span>
                        <span className="text-[8px] text-slate-400 font-bold uppercase">剩余热量</span>
                    </div>
                </div>

                <div className="text-center">
                    <div className="text-xl font-black text-slate-800">{stats.burned}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">已消耗</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <MacroBar label="碳水" current={stats.intake.c} target={Math.round(stats.targetCal * 0.5 / 4)} color="bg-emerald-400" />
                <MacroBar label="蛋白" current={stats.intake.p} target={Math.round(stats.targetCal * 0.2 / 4)} color="bg-sky-400" />
                <MacroBar label="脂肪" current={stats.intake.f} target={Math.round(stats.targetCal * 0.3 / 9)} color="bg-amber-400" />
            </div>
         </div>
      </div>

      {/* 体检核心指标 */}
      <div>
          <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">关键体检指标</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
             <MetricSmall label="收缩压" value={record?.checkup?.basics?.sbp} unit="mmHg" />
             <MetricSmall label="空腹血糖" value={record?.checkup?.labBasic?.glucose?.fasting} unit="mmol/L" />
          </div>
      </div>

      {/* 危急值告警 */}
      {assessment?.isCritical && (
          <div className="bg-red-50 border border-red-100 rounded-[2.2rem] p-5 flex items-center gap-4 shadow-lg shadow-red-100/30">
              <div className="text-3xl animate-pulse">🚨</div>
              <div className="flex-1">
                  <div className="text-xs font-black text-red-600 uppercase mb-1">危急值提醒</div>
                  <p className="text-[10px] text-red-800 font-bold leading-relaxed">
                    系统检测到您的核心指标存在严重异常，请尽快复查或就医。
                  </p>
              </div>
          </div>
      )}
    </div>
  );
};

const MacroBar = ({ label, current, target, color }: any) => {
    const pct = Math.min(100, (current / target) * 100);
    return (
        <div>
            <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase mb-1">
                <span>{label}</span>
                <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${color}`} style={{ width: `${pct}%` }}></div>
            </div>
        </div>
    );
};

const MetricSmall = ({ label, value, unit }: any) => (
    <div className="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center">
        <div>
            <div className="text-[9px] font-bold text-slate-400 uppercase">{label}</div>
            <div className="text-lg font-black text-slate-800">{value || '--'}<span className="text-[8px] font-normal ml-1 text-slate-300">{unit}</span></div>
        </div>
        <div className="w-1.5 h-6 bg-slate-100 rounded-full"></div>
    </div>
);
