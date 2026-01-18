
import React, { useState } from 'react';
import { FollowUpRecord, RiskLevel, HealthAssessment, ScheduledFollowUp, HealthRecord, InterventionMilestone, HealthArchive } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// [FIX] Extended Props interface to match usage in App.tsx
interface Props {
  records: FollowUpRecord[];
  assessment: HealthAssessment | null;
  schedule: ScheduledFollowUp[];
  onAddRecord: (record: Omit<FollowUpRecord, 'id'>) => void;
  healthRecord?: HealthRecord | null;
  onRefresh?: () => void;
  // Added missing props
  onUpdateData?: (record: FollowUpRecord | null, newSchedule: ScheduledFollowUp[]) => void;
  allArchives?: HealthArchive[];
  onPatientChange?: (archive: HealthArchive) => void;
  currentPatientId?: string;
  isAuthenticated?: boolean;
}

export const FollowUpDashboard: React.FC<Props> = ({ 
    records, 
    assessment, 
    schedule, 
    onAddRecord, 
    healthRecord 
}) => {
  const [activeTab, setActiveTab] = useState<'track' | 'chart' | 'entry'>('track');

  // 计算干预进度
  const currentMilestoneIndex = records.length > 0 ? Math.min(records.length, (assessment?.interventionPath?.milestones?.length || 0) - 1) : 0;

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      {/* 核心看板：干预状态 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-800 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">健康干预中心</h2>
              <p className="text-slate-400 text-sm mt-1">受检人：{healthRecord?.profile.name || '请选择人员'}</p>
            </div>
            {assessment && (
              <div className="text-right">
                <div className={`px-3 py-1 rounded-full text-xs font-bold border inline-block ${
                  assessment.riskLevel === 'RED' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-green-500/20 text-green-400 border-green-500/50'
                }`}>
                  {assessment.riskLevel === 'RED' ? '重点干预对象' : '常规干预对象'}
                </div>
                <p className="text-xs text-slate-500 mt-2">干预目标：{assessment.interventionPath?.goal}</p>
              </div>
            )}
          </div>
        </div>

        {/* 里程碑进度条 */}
        {assessment?.interventionPath && (
          <div className="px-8 py-10 bg-white">
            <div className="relative flex justify-between">
              {/* 连接线 */}
              <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 -z-0"></div>
              <div className="absolute top-5 left-0 h-1 bg-teal-500 -z-0 transition-all duration-1000" style={{ width: `${(currentMilestoneIndex / (assessment.interventionPath.milestones.length - 1)) * 100}%` }}></div>

              {assessment.interventionPath.milestones.map((m, i) => (
                <div key={m.id} className="relative z-10 flex flex-col items-center w-32">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-4 transition-all ${
                    i <= currentMilestoneIndex ? 'bg-teal-50 border-teal-100 text-white' : 'bg-white border-slate-100 text-slate-300'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="mt-3 text-center">
                    <p className={`text-xs font-bold ${i <= currentMilestoneIndex ? 'text-slate-800' : 'text-slate-400'}`}>{m.title}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{m.timeframe}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 功能切换 */}
      <div className="flex gap-4">
        <button onClick={() => setActiveTab('track')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'track' ? 'bg-teal-600 text-white shadow-lg' : 'bg-white text-slate-600 border'}`}>干预路线图</button>
        <button onClick={() => setActiveTab('chart')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'chart' ? 'bg-teal-600 text-white shadow-lg' : 'bg-white text-slate-600 border'}`}>指标趋势</button>
        <button onClick={() => setActiveTab('entry')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'entry' ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-slate-600 border border-orange-200'}`}>+ 录入随访/执行情况</button>
      </div>

      {/* 干预详情视图 */}
      {activeTab === 'track' && assessment && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {assessment.interventionPath.milestones.map((m, i) => (
            <div key={m.id} className={`p-6 rounded-2xl border-2 transition-all ${i === currentMilestoneIndex ? 'bg-teal-50 border-teal-200 shadow-md ring-2 ring-teal-500/20' : 'bg-white border-slate-100 opacity-60'}`}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase text-teal-600 tracking-widest">{m.timeframe}</span>
                {i === currentMilestoneIndex && <span className="bg-teal-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">进行中</span>}
              </div>
              <h3 className="font-bold text-slate-800 mb-2">{m.title}</h3>
              <p className="text-xs text-slate-500 mb-4 font-medium">阶段目标：{m.target}</p>
              <ul className="space-y-2">
                {m.tasks.map((t, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="text-teal-500 font-bold">●</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* 指标趋势视图 */}
      {activeTab === 'chart' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-80">
          <h3 className="font-bold text-slate-800 mb-4">关键干预指标追踪</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={records.map(r => ({ date: r.date, ...r.indicators }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={12} tickMargin={10} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="sbp" name="收缩压" stroke="#f43f5e" strokeWidth={3} dot={{r:6}} />
              <Line type="monotone" dataKey="weight" name="体重" stroke="#0ea5e9" strokeWidth={3} dot={{r:6}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 录入视图 (简化版) */}
      {activeTab === 'entry' && (
        <div className="bg-white p-8 rounded-2xl border-2 border-orange-400 shadow-xl animate-slideUp">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <span>📝</span> 记录当前阶段干预反馈
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">本次测量收缩压 (mmHg)</label>
                   <input type="number" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-orange-500" placeholder="例如: 135" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">本次测量体重 (kg)</label>
                   <input type="number" className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-orange-500" placeholder="例如: 72.5" />
                </div>
             </div>
             <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">干预依从性/主诉反馈</label>
                <textarea className="w-full border rounded-xl p-3 h-32 focus:ring-2 focus:ring-orange-500" placeholder="用户反馈：饮食控制较好，但运动由于加班未达标..."></textarea>
             </div>
          </div>
          <div className="mt-8 flex justify-end">
            <button className="bg-orange-500 text-white px-10 py-3 rounded-xl font-bold shadow-lg hover:bg-orange-600 transition-all">确认存档并同步至受检者</button>
          </div>
        </div>
      )}
    </div>
  );
};
