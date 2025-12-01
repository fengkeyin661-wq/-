
import React from 'react';
import { HealthArchive } from '../../services/dataService';
import { RiskLevel } from '../../types';

interface Props {
    archive: HealthArchive;
    onViewReport: () => void;
}

export const PatientDashboard: React.FC<Props> = ({ archive, onViewReport }) => {
    const riskLevel = archive.risk_level;
    const isHigh = riskLevel === RiskLevel.RED;
    const isMed = riskLevel === RiskLevel.YELLOW;

    const nextTask = archive.follow_up_schedule?.find(s => s.status === 'pending');
    
    // Quick extract portraits for dashboard summary
    const portraits = archive.risk_analysis?.portraits || [];
    const highRisks = portraits.filter(p => p.status === 'High');

    return (
        <div className="p-6 space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <p className="text-slate-400 text-xs font-bold mb-1">
                        {new Date().toLocaleDateString()}
                    </p>
                    <h1 className="text-2xl font-bold text-slate-800">
                        你好，{archive.name}
                    </h1>
                </div>
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-xl border-2 border-white shadow-sm">
                    {archive.gender === '女' ? '👩🏻' : '👨🏻'}
                </div>
            </div>

            {/* Risk Card */}
            <div className={`rounded-2xl p-6 text-white shadow-lg relative overflow-hidden ${
                isHigh ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-200' :
                isMed ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-200' :
                'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-teal-200'
            }`}>
                <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl">
                    {isHigh ? '🚨' : isMed ? '⚠️' : '🛡️'}
                </div>
                <div className="relative z-10">
                    <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">当前健康风险评估</p>
                    <h2 className="text-3xl font-black mb-4">
                        {isHigh ? '高风险关注' : isMed ? '中风险关注' : '低风险保持'}
                    </h2>
                    
                    <div className="bg-white/20 backdrop-blur-md rounded-lg p-3 text-sm font-medium leading-relaxed mb-4 border border-white/10">
                        {archive.assessment_data.summary.slice(0, 60)}...
                    </div>

                    <button 
                        onClick={onViewReport}
                        className="bg-white text-slate-900 px-4 py-2 rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-transform flex items-center gap-2"
                    >
                        查看详细报告 <span>→</span>
                    </button>
                </div>
            </div>

            {/* Next Checkup Task */}
            <div>
                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <span className="text-teal-600">📅</span> 下一步计划
                </h3>
                {nextTask ? (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4">
                        <div className="bg-blue-50 text-blue-600 w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 font-bold border border-blue-100">
                            <span className="text-xs uppercase">{new Date(nextTask.date).toLocaleString('default', { month: 'short' })}</span>
                            <span className="text-xl">{new Date(nextTask.date).getDate()}</span>
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 text-lg mb-1">预约复查</div>
                            <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                                建议关注: {nextTask.focusItems.join('、')}
                            </p>
                            <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-500 font-bold">
                                {Math.ceil((new Date(nextTask.date).getTime() - Date.now()) / (86400000))} 天后
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-50 p-4 rounded-xl text-center text-slate-400 text-xs py-8">
                        暂无计划任务
                    </div>
                )}
            </div>

            {/* Health Portrait Snippet */}
            {portraits.length > 0 && (
                <div>
                     <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="text-indigo-600">🧘</span> 健康画像重点
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {highRisks.length > 0 ? highRisks.map((p, i) => (
                             <div key={i} className="bg-red-50 p-4 rounded-2xl border border-red-100">
                                <div className="text-2xl mb-2">{p.icon}</div>
                                <div className="font-bold text-red-800 text-sm mb-1">{p.systemName}</div>
                                <div className="text-xs text-red-600 opacity-80">{p.keyFindings[0]}</div>
                             </div>
                        )) : (
                            <div className="col-span-2 bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-4">
                                <div className="text-3xl">🎉</div>
                                <div>
                                    <div className="font-bold text-green-800">系统状态良好</div>
                                    <div className="text-xs text-green-600">六大系统未见明显高危异常</div>
                                </div>
                            </div>
                        )}
                        {/* Fillers if not enough high risks */}
                        {highRisks.length < 2 && portraits.filter(p => p.status === 'Medium').slice(0, 2 - highRisks.length).map((p, i) => (
                            <div key={i} className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                                <div className="text-2xl mb-2">{p.icon}</div>
                                <div className="font-bold text-orange-800 text-sm mb-1">{p.systemName}</div>
                                <div className="text-xs text-orange-600 opacity-80">{p.keyFindings[0]}</div>
                             </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
