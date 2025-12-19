
import React, { useState, useEffect } from 'react';
import { HealthProfile, HealthAssessment, HealthRecord, RiskLevel } from '../../types';
import { fetchContent, ContentItem } from '../../services/contentService';

interface Props {
  profile?: HealthProfile;
  assessment?: HealthAssessment;
  record?: HealthRecord;
  onNavigate?: (tab: string) => void;
}

export const UserHome: React.FC<Props> = ({ profile, assessment, record, onNavigate }) => {
  const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);

  // 1. 获取针对性推荐内容 (基于 AI 评估的风险点)
  useEffect(() => {
    const loadRecs = async () => {
        setLoadingRecs(true);
        try {
            const all = await fetchContent(undefined, 'active');
            
            // 安全提取风险关键词，防止 assessment 为空或结构不全
            const risks = [
                ...(assessment?.risks?.red || []),
                ...(assessment?.risks?.yellow || []),
                ...(assessment?.followUpPlan?.nextCheckItems || [])
            ].join(' ');

            if (!risks.trim()) {
                setRecommendations(all.slice(0, 4));
                return;
            }

            // 智能匹配逻辑
            const matched = all.filter(item => {
                const searchStr = ((item.title || '') + (item.description || '')).toLowerCase();
                const keywords = risks.split(/[、\s，,。]/).filter(k => k.length >= 2);
                return keywords.some(kw => searchStr.includes(kw.toLowerCase()));
            });
            
            // 补齐策略：如果匹配不足，用普通资源填充
            const finalRecs = matched.length >= 4 ? matched : [...matched, ...all.filter(a => !matched.find(m => m.id === a.id))];
            setRecommendations(finalRecs.slice(0, 5));
        } catch (err) {
            console.error("Recommendations failed to load:", err);
        } finally {
            setLoadingRecs(false);
        }
    };
    loadRecs();
  }, [assessment]);

  // 风险等级 UI 映射
  const riskStyles: Record<string, any> = {
    RED: { color: 'from-red-500 to-rose-600', label: '高风险', icon: '🚨' },
    YELLOW: { color: 'from-orange-400 to-amber-500', label: '中风险', icon: '⚠️' },
    GREEN: { color: 'from-teal-500 to-emerald-600', label: '低风险', icon: '🛡️' },
  };

  const currentRisk = assessment?.riskLevel || 'GREEN';
  const style = riskStyles[currentRisk] || riskStyles.GREEN;

  // 深度防御：多层解构保护，确保嵌套属性缺失也不崩溃
  const basics = record?.checkup?.basics || {};
  const lab = record?.checkup?.labBasic || {};

  return (
    <div className="p-5 space-y-6 animate-fadeIn pb-32">
      {/* 头部：欢迎语 */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">你好，{profile?.name || '受检者'}</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">郑州大学医院 · 检后管理看板</p>
        </div>
        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-50 flex items-center justify-center text-2xl">
            {profile?.gender === '女' ? '👩' : '👨'}
        </div>
      </div>

      {/* 核心卡片：健康风险评估 */}
      <div className={`bg-gradient-to-br ${style.color} rounded-[2.5rem] p-6 text-white shadow-xl shadow-teal-100 relative overflow-hidden`}>
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
         <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">AI 健康状态评估</div>
                    <div className="text-3xl font-black flex items-center gap-2">
                        {style.icon} {style.label}
                    </div>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight">
                    v1.0 深度学习
                </div>
            </div>
            
            <div className="bg-black/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                <p className="text-xs leading-relaxed opacity-95 font-medium line-clamp-3">
                    {assessment?.summary || '系统正在同步您的核心指标异常项。建议尽快联系签约医生完善生活史问卷，以获得更精准的 AI 评估结果。'}
                </p>
            </div>

            <div className="mt-5 flex gap-3">
                <button 
                    onClick={() => onNavigate?.('profile')}
                    className="flex-1 bg-white text-slate-900 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
                >
                    查看完整报告
                </button>
                <button 
                    onClick={() => onNavigate?.('interaction')}
                    className="px-6 bg-white/20 text-white py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider backdrop-blur-md border border-white/20 active:scale-95 transition-transform"
                >
                    咨询
                </button>
            </div>
         </div>
      </div>

      {/* 指标看板 */}
      <div>
          <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">核心体检指标对比</h2>
            <span className="text-[9px] text-slate-300">建档日期: {profile?.checkupId ? '2024' : '--'}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
             <MetricBox 
                label="BMI 指数" 
                value={basics.bmi} 
                unit="" 
                status={Number(basics.bmi) > 24 ? 'warning' : 'ok'} 
             />
             <MetricBox 
                label="收缩压" 
                value={basics.sbp} 
                unit="mmHg" 
                status={Number(basics.sbp) > 140 ? 'danger' : 'ok'} 
             />
             <MetricBox 
                label="舒张压" 
                value={basics.dbp} 
                unit="mmHg" 
                status={Number(basics.dbp) > 90 ? 'danger' : 'ok'} 
             />
             <MetricBox 
                label="空腹血糖" 
                value={lab?.glucose?.fasting} 
                unit="mmol/L" 
                status={Number(lab?.glucose?.fasting) > 6.1 ? 'warning' : 'ok'} 
             />
          </div>
      </div>

      {/* 智能推荐：核心干预模块 */}
      <div>
         <div className="flex justify-between items-center mb-4 px-1">
            <h2 className="text-lg font-black text-slate-800">今日健康干预推荐</h2>
            <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">精准匹配</span>
         </div>
         
         <div className="space-y-4">
            {loadingRecs ? (
                <div className="py-12 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-400 text-xs font-bold animate-pulse">正在为您匹配资源...</p>
                </div>
            ) : recommendations.length > 0 ? recommendations.map(item => (
                <div key={item.id} 
                    onClick={() => {
                        if (item.type === 'doctor') onNavigate?.('medical');
                        else if (item.type === 'meal' || item.type === 'exercise') onNavigate?.('diet_motion');
                        else onNavigate?.('community');
                    }}
                    className="bg-white p-4 rounded-[2.2rem] shadow-sm border border-slate-50 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer group"
                >
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl shrink-0 group-hover:scale-105 transition-transform">
                        {item.image && item.image.length < 5 ? item.image : (item.type === 'doctor' ? '👨‍⚕️' : item.type === 'meal' ? '🥗' : '✨')}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-black text-teal-600 uppercase mb-0.5">
                            {item.type === 'doctor' ? '医疗干预' : item.type === 'meal' ? '营养方案' : '运动建议'}
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm truncate">{item.title}</h4>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.description || '点击查看详情及执行建议'}</p>
                    </div>
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        <span className="text-lg">→</span>
                    </div>
                </div>
            )) : (
                <div className="text-center py-10 bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-slate-400 text-xs">
                    暂无推荐，请联系医生获取个性化方案
                </div>
            )}
         </div>
      </div>

      {/* 危急值红色告警：全屏最显眼提醒 */}
      {assessment?.isCritical && (
          <div className="bg-red-50 border border-red-100 rounded-[2.5rem] p-6 flex items-center gap-5 shadow-lg shadow-red-100/50">
              <div className="text-4xl animate-pulse">🚨</div>
              <div>
                  <div className="text-sm font-black text-red-600 uppercase mb-1">危急值/重大异常提示</div>
                  <p className="text-[11px] text-red-800 font-bold leading-relaxed">
                    系统检测到您的核心指标存在严重异常，请务必尽快前往郑州大学医院进行门诊复查。
                  </p>
              </div>
          </div>
      )}
    </div>
  );
};

// 指标卡片组件：防御 undefined 情况
const MetricBox = ({ label, value, unit, status }: any) => {
    const displayValue = (value === undefined || value === null || value === 0 || value === '0') ? '--' : value;
    return (
        <div className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm transition-all hover:shadow-md">
            <div className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">{label}</div>
            <div className={`text-2xl font-black ${status === 'danger' ? 'text-red-600' : status === 'warning' ? 'text-orange-500' : 'text-slate-800'}`}>
                {displayValue}
                {displayValue !== '--' && <span className="text-[10px] font-bold ml-1 text-slate-300">{unit}</span>}
            </div>
            <div className={`mt-2 h-1 w-8 rounded-full ${status === 'danger' ? 'bg-red-500' : status === 'warning' ? 'bg-orange-500' : 'bg-teal-500'}`}></div>
        </div>
    );
};
