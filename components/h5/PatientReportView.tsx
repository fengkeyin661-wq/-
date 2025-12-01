
import React from 'react';
import { HealthArchive } from '../../services/dataService';

export const PatientReportView: React.FC<{ archive: HealthArchive }> = ({ archive }) => {
    const { assessment_data: data } = archive;

    return (
        <div className="p-6 space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-slate-800">健康档案详情</h2>
            
            {/* Critical Alert */}
            {data.isCritical && (
                 <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                    <div className="text-2xl">🚨</div>
                    <div>
                        <div className="font-bold text-red-700 text-sm">重要异常提醒</div>
                        <div className="text-xs text-red-600 mt-1">{data.criticalWarning}</div>
                    </div>
                 </div>
            )}

            {/* Risk Factors */}
            <section>
                <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">风险因素</h3>
                <div className="space-y-3">
                    {data.risks.red.map((r, i) => (
                        <div key={i} className="flex items-start gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                            <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0"></span>
                            <span className="text-sm text-slate-700">{r}</span>
                        </div>
                    ))}
                    {data.risks.yellow.map((r, i) => (
                        <div key={i} className="flex items-start gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                            <span className="w-2 h-2 rounded-full bg-yellow-500 mt-2 shrink-0"></span>
                            <span className="text-sm text-slate-700">{r}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Management Plan */}
            <section>
                 <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">医生建议方案</h3>
                 
                 <div className="space-y-4">
                     <PlanCard icon="🥗" title="饮食建议" items={data.managementPlan.dietary} color="bg-green-100 text-green-700" />
                     <PlanCard icon="🏃" title="运动指导" items={data.managementPlan.exercise} color="bg-blue-100 text-blue-700" />
                     <PlanCard icon="💊" title="用药与医疗" items={data.managementPlan.medication} color="bg-purple-100 text-purple-700" />
                 </div>
            </section>
            
            <div className="h-10"></div>
        </div>
    );
};

const PlanCard = ({ icon, title, items, color }: any) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2 bg-slate-50/50">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                {icon}
            </div>
            <span className="font-bold text-slate-800">{title}</span>
        </div>
        <div className="p-4">
            <ul className="space-y-2">
                {items.map((item: string, i: number) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-slate-300 mt-0.5">•</span>
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    </div>
);
