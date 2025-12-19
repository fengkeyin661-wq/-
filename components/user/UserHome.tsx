
import React, { useState, useEffect, useMemo } from 'react';
import { HealthProfile, HealthAssessment, HealthRecord, RiskLevel } from '../../types';
import { fetchContent, ContentItem } from '../../services/contentService';

interface Props {
  profile: HealthProfile;
  assessment?: HealthAssessment;
  record: HealthRecord;
  onNavigate?: (tab: string) => void;
}

export const UserHome: React.FC<Props> = ({ profile, assessment, record, onNavigate }) => {
  const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);

  // 1. 获取针对性的推荐内容
  useEffect(() => {
    const loadRecs = async () => {
        setLoadingRecs(true);
        try {
            const all = await fetchContent();
            if (!assessment) {
                setRecommendations(all.slice(0, 3));
                return;
            }
            
            const risks = [...assessment.risks.red, ...assessment.risks.yellow].join(' ');
            // 简单匹配逻辑
            const matched = all.filter(item => {
                const text = (item.title + (item.description || '')).toLowerCase();
                return risks.split(/[、\s]/).some(rk => rk.length > 1 && text.includes(rk));
            });
            
            setRecommendations(matched.length > 0 ? matched.slice(0, 4) : all.slice(0, 4));
        } finally {
            setLoadingRecs(false);
        }
    };
    loadRecs();
  }, [assessment]);

  const riskColor = assessment?.riskLevel === 'RED' ? 'from-red-500 to-rose-600' : 
                    assessment?.riskLevel === 'YELLOW' ? 'from-orange-400 to-yellow-500' : 
                    'from-teal-500 to-emerald-600';

  return (
    <div className="p-5 space-y-6 animate-fadeIn pb-24">
      {/* Header */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">你好，{profile.name}</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">郑州大学医院 · 检后管理</p>
        </div>
        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl border border-slate-50">
            {profile.gender === '女' ? '👩' : '👨'}
        </div>
      </div>

      {/* Risk Hero Card */}
      <div className={`bg-gradient-to-br ${riskColor} rounded-[2.5rem] p-6 text-white shadow-xl shadow-teal-100 relative overflow-hidden`}>
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
         <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">当前健康状态等级</div>
                    <div className="text-3xl font-black">
                        {assessment?.riskLevel === 'RED' ? '高风险' : assessment?.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                    </div>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase">
                    v1.0 AI 评估
                </div>
            </div>
            <p className="text-xs leading-relaxed opacity-90 font-medium line-clamp-2">
                {assessment?.summary || '请先联系医生完成健康评估，以获取精准的健康指导。'}
            </p>
            {assessment && (
                <button 
                    onClick={() => onNavigate?.('profile')}
                    className="mt-4 bg-white text-slate-900 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
                >
                    查看完整评估报告 →
                </button>
            )}
         </div>
      </div>

      {/* Basic Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
         <MetricBox label="BMI 指数" value={record.checkup.basics.bmi} unit="" status={Number(record.checkup.basics.bmi) > 24 ? 'warning' : 'ok'} />
         <MetricBox label="收缩压" value={record.checkup.basics.sbp} unit="mmHg" status={Number(record.checkup.basics.sbp) > 140 ? 'danger' : 'ok'} />
         <MetricBox label="舒张压" value={record.checkup.basics.dbp} unit="mmHg" status={Number(record.checkup.basics.dbp) > 90 ? 'danger' : 'ok'} />
      </div>

      {/* Today's Recommendations */}
      <div>
         <div className="flex justify-between items-center mb-4 px-1">
            <h2 className="text-lg font-black text-slate-800">今日干预方案推荐</h2>
            <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">AI 智能匹配</span>
         </div>
         
         <div className="space-y-4">
            {loadingRecs ? (
                <div className="py-10 text-center text-slate-300 text-xs font-bold animate-pulse">正在匹配最适合您的健康资源...</div>
            ) : recommendations.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-4 active:scale-[0.98] transition-all">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shrink-0">
                        {item.image && item.image.length < 5 ? item.image : (item.type === 'doctor' ? '👨‍⚕️' : item.type === 'meal' ? '🥗' : '✨')}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-teal-600 uppercase mb-0.5">
                            {item.type === 'doctor' ? '专家咨询' : item.type === 'meal' ? '膳食干预' : '运动建议'}
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm truncate">{item.title}</h4>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.description || '点击查看详情及执行建议'}</p>
                    </div>
                    <button 
                        onClick={() => onNavigate?.(item.type === 'doctor' ? 'medical' : item.type === 'meal' ? 'diet_motion' : 'diet_motion')}
                        className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center text-lg shadow-md"
                    >
                        →
                    </button>
                </div>
            ))}
         </div>
      </div>

      {/* Critical Findings Warning */}
      {assessment?.isCritical && (
          <div className="bg-red-50 border border-red-100 rounded-[2rem] p-5 flex items-center gap-4">
              <div className="text-3xl animate-bounce">🚨</div>
              <div>
                  <div className="text-xs font-black text-red-600 uppercase mb-1">危急值提醒</div>
                  <p className="text-[11px] text-red-800 font-bold leading-relaxed">
                    系统检测到您有严重指标异常。请尽快联系医生或前往门诊复查。
                  </p>
              </div>
          </div>
      )}
    </div>
  );
};

const MetricBox = ({ label, value, unit, status }: any) => (
    <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm text-center">
        <div className="text-[9px] font-black text-slate-400 uppercase mb-2">{label}</div>
        <div className={`text-xl font-black ${status === 'danger' ? 'text-red-600' : status === 'warning' ? 'text-orange-500' : 'text-slate-800'}`}>
            {value || '--'}
            {unit && <span className="text-[10px] font-bold ml-0.5 opacity-50">{unit}</span>}
        </div>
    </div>
);
