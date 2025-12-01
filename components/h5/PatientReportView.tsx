
import React, { useState } from 'react';
import { HealthArchive } from '../../services/dataService';

export const PatientReportView: React.FC<{ archive: HealthArchive }> = ({ archive }) => {
    const { assessment_data: data, health_record: record } = archive;
    const [activeCategory, setActiveCategory] = useState<'summary' | 'labs' | 'plan'>('summary');

    return (
        <div className="bg-slate-50 min-h-full pb-24 animate-fadeIn">
            {/* Header Tabs */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-100 px-4 py-3 flex gap-4 overflow-x-auto scrollbar-hide">
                <TabBtn active={activeCategory === 'summary'} onClick={() => setActiveCategory('summary')} label="综合评估" />
                <TabBtn active={activeCategory === 'labs'} onClick={() => setActiveCategory('labs')} label="指标解读" badge="New" />
                <TabBtn active={activeCategory === 'plan'} onClick={() => setActiveCategory('plan')} label="健康方案" />
            </div>

            <div className="p-5 space-y-6">
                
                {activeCategory === 'summary' && (
                    <>
                        {/* Critical Alert */}
                        {data.isCritical && (
                             <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm animate-pulse">
                                <div className="flex gap-4">
                                    <div className="text-3xl">🚨</div>
                                    <div>
                                        <div className="font-bold text-red-800 text-lg mb-1">重要异常提醒</div>
                                        <div className="text-sm text-red-700 leading-relaxed">{data.criticalWarning}</div>
                                    </div>
                                </div>
                             </div>
                        )}

                        {/* Summary Card */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-3 text-lg">👨🏻‍⚕️ 医生综述</h3>
                            <p className="text-slate-600 text-sm leading-7 text-justify whitespace-pre-line">
                                {data.summary}
                            </p>
                        </div>

                        {/* Risk Factors */}
                        <div>
                            <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide px-1">主要风险因素</h3>
                            <div className="grid gap-3">
                                {data.risks.red.map((r, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                                        <span className="text-lg">🔴</span>
                                        <span className="text-sm font-bold text-slate-700">{r}</span>
                                    </div>
                                ))}
                                {data.risks.yellow.map((r, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-500">
                                        <span className="text-lg">🟡</span>
                                        <span className="text-sm font-bold text-slate-700">{r}</span>
                                    </div>
                                ))}
                                {data.risks.red.length === 0 && data.risks.yellow.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-dashed">
                                        未发现明显风险因素
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* MyChart Style Visual Results */}
                {activeCategory === 'labs' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-700 leading-relaxed border border-blue-100">
                            <strong>💡 看懂报告：</strong> 下方色条代表参考范围。黑色指针代表您的数值。指针位于绿色区域表示正常，黄色/红色表示异常。
                        </div>

                        {/* Metabolic Group */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 font-bold text-slate-700">
                                代谢核心指标
                            </div>
                            <div className="divide-y divide-slate-50">
                                <VisualResultRow 
                                    label="BMI 体质指数" 
                                    value={record.checkup.basics.bmi} 
                                    unit="" 
                                    min={18.5} max={24} 
                                    warningLow={18.5} warningHigh={28}
                                    desc="反映胖瘦程度"
                                />
                                <VisualResultRow 
                                    label="收缩压 (高压)" 
                                    value={record.checkup.basics.sbp} 
                                    unit="mmHg" 
                                    min={90} max={140} 
                                    warningLow={90} warningHigh={140}
                                    desc="心脏收缩时的压力"
                                />
                                <VisualResultRow 
                                    label="舒张压 (低压)" 
                                    value={record.checkup.basics.dbp} 
                                    unit="mmHg" 
                                    min={60} max={90} 
                                    warningLow={60} warningHigh={90}
                                    desc="心脏舒张时的压力"
                                />
                                {record.checkup.labBasic.glucose?.fasting && (
                                    <VisualResultRow 
                                        label="空腹血糖" 
                                        value={parseFloat(record.checkup.labBasic.glucose.fasting)} 
                                        unit="mmol/L" 
                                        min={3.9} max={6.1} 
                                        warningLow={2.8} warningHigh={7.0}
                                        desc="筛查糖尿病的重要指标"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Lipids Group */}
                        {record.checkup.labBasic.lipids?.tc && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 font-bold text-slate-700">
                                    血脂四项
                                </div>
                                <div className="divide-y divide-slate-50">
                                    <VisualResultRow 
                                        label="总胆固醇 (TC)" 
                                        value={parseFloat(record.checkup.labBasic.lipids.tc || '0')} 
                                        unit="mmol/L" 
                                        min={0} max={5.2} 
                                        warningHigh={6.2}
                                        desc="血管堵塞风险指标"
                                    />
                                    <VisualResultRow 
                                        label="甘油三酯 (TG)" 
                                        value={parseFloat(record.checkup.labBasic.lipids.tg || '0')} 
                                        unit="mmol/L" 
                                        min={0} max={1.7} 
                                        warningHigh={2.3}
                                        desc="受饮食影响较大"
                                    />
                                    <VisualResultRow 
                                        label="低密度脂蛋白 (LDL)" 
                                        value={parseFloat(record.checkup.labBasic.lipids.ldl || '0')} 
                                        unit="mmol/L" 
                                        min={0} max={3.4} 
                                        warningHigh={4.1}
                                        desc="俗称'坏胆固醇'，重点关注"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeCategory === 'plan' && (
                    <div className="space-y-4 animate-slideInRight">
                        <PlanCard icon="🥗" title="饮食干预" items={data.managementPlan.dietary} color="bg-green-50 text-green-700" borderColor="border-green-200" />
                        <PlanCard icon="🏃" title="运动指导" items={data.managementPlan.exercise} color="bg-blue-50 text-blue-700" borderColor="border-blue-200" />
                        <PlanCard icon="💊" title="医疗建议" items={data.managementPlan.medication} color="bg-purple-50 text-purple-700" borderColor="border-purple-200" />
                        <PlanCard icon="📅" title="复查计划" items={data.managementPlan.monitoring} color="bg-orange-50 text-orange-700" borderColor="border-orange-200" />
                    </div>
                )}
            </div>
        </div>
    );
};

const TabBtn = ({ active, onClick, label, badge }: any) => (
    <button 
        onClick={onClick}
        className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
            active 
            ? 'bg-teal-600 text-white shadow-md shadow-teal-200' 
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
    >
        {label}
        {badge && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{badge}</span>}
    </button>
);

const PlanCard = ({ icon, title, items, color, borderColor }: any) => (
    <div className={`rounded-2xl border p-5 ${color.replace('text-', 'bg-').replace('50', '50/50')} ${borderColor} border-opacity-60`}>
        <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{icon}</span>
            <span className={`font-bold text-lg ${color.split(' ')[1]}`}>{title}</span>
        </div>
        <ul className="space-y-2">
            {items.map((item: string, i: number) => (
                <li key={i} className="text-sm text-slate-700 flex items-start gap-2 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-40 shrink-0"></span>
                    {item}
                </li>
            ))}
        </ul>
    </div>
);

// MyChart Style Visual Component
const VisualResultRow = ({ label, value, unit, min, max, warningLow, warningHigh, desc }: any) => {
    if (value === undefined || value === null || isNaN(value)) return null;

    // Calculate percent for pointer position
    // Scale: Let's map a visual range from (min - spread) to (max + spread)
    const rangeMin = min - (max - min) * 0.5;
    const rangeMax = max + (max - min) * 0.5;
    const totalRange = rangeMax - rangeMin;
    
    let percent = ((value - rangeMin) / totalRange) * 100;
    percent = Math.max(5, Math.min(95, percent)); // Clamp visual

    // Determine status color
    let statusColor = 'bg-green-500';
    let statusText = '正常';
    
    if (warningHigh && value > warningHigh) { statusColor = 'bg-red-500'; statusText = '偏高'; }
    else if (warningLow && value < warningLow) { statusColor = 'bg-red-500'; statusText = '偏低'; }
    else if (value > max) { statusColor = 'bg-yellow-500'; statusText = '略高'; }
    else if (value < min) { statusColor = 'bg-yellow-500'; statusText = '略低'; }

    return (
        <div className="px-5 py-4 hover:bg-slate-50 transition-colors group">
            <div className="flex justify-between items-end mb-2">
                <div>
                    <div className="font-bold text-slate-800 text-sm">{label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{desc}</div>
                </div>
                <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                         <span className={`text-xs text-white px-1.5 py-0.5 rounded font-bold ${statusColor}`}>{statusText}</span>
                         <span className="font-mono font-bold text-lg text-slate-800">{value}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">参考: {min}-{max} {unit}</div>
                </div>
            </div>
            
            {/* Visual Gauge Bar */}
            <div className="relative h-2 w-full bg-slate-200 rounded-full mt-2 overflow-hidden">
                {/* Green Zone (Normal) */}
                <div 
                    className="absolute h-full bg-green-300 opacity-50" 
                    style={{
                        left: `${((min - rangeMin) / totalRange) * 100}%`,
                        width: `${((max - min) / totalRange) * 100}%`
                    }}
                ></div>
            </div>
            {/* Pointer (Outside overflow hidden to pop) */}
            <div className="relative w-full h-2 -mt-2">
                <div 
                    className="absolute w-3 h-3 bg-slate-800 border-2 border-white rounded-full shadow top-[-2px] transition-all duration-1000"
                    style={{ left: `calc(${percent}% - 6px)` }}
                ></div>
            </div>
        </div>
    );
};
