
import React, { useState } from 'react';
import { HealthRecord, HealthAssessment, FollowUpRecord } from '../../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  record: HealthRecord;
  assessment?: HealthAssessment;
  onUpdateRecord: (updatedData: any) => void;
}

export const UserProfile: React.FC<Props> = ({ record, assessment, onUpdateRecord }) => {
    const [editMode, setEditMode] = useState(false);
    const [metrics, setMetrics] = useState({
        sbp: record.checkup.basics.sbp || 0,
        dbp: record.checkup.basics.dbp || 0,
        glucose: parseFloat(record.checkup.labBasic.glucose?.fasting || '0'),
        weight: record.checkup.basics.weight || 0,
        // Optional extended metrics
        alt: record.checkup.labBasic.liver?.ALT || '',
        creatinine: record.checkup.labBasic.renal?.creatinine || ''
    });

    const handleSave = () => {
        // Construct partial update object
        // Note: In a real app this would call the API. Here we simulate via callback
        const h = record.checkup.basics.height ? record.checkup.basics.height / 100 : 1.7;
        const newBmi = metrics.weight > 0 ? parseFloat((metrics.weight / (h * h)).toFixed(1)) : 0;

        const updated = {
            checkup: {
                ...record.checkup,
                basics: {
                    ...record.checkup.basics,
                    sbp: Number(metrics.sbp),
                    dbp: Number(metrics.dbp),
                    weight: Number(metrics.weight),
                    bmi: newBmi
                },
                labBasic: {
                    ...record.checkup.labBasic,
                    glucose: { fasting: String(metrics.glucose) },
                    liver: { ...record.checkup.labBasic.liver, ALT: metrics.alt },
                    renal: { ...record.checkup.labBasic.renal, creatinine: metrics.creatinine }
                }
            }
        };
        onUpdateRecord(updated);
        setEditMode(false);
        alert("数据已同步至云端");
    };

    // Risk Color
    const riskColor = assessment?.riskLevel === 'RED' ? 'text-red-600 bg-red-50' : 
                      assessment?.riskLevel === 'YELLOW' ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50';

    return (
        <div className="p-4 bg-slate-50 min-h-full space-y-6 animate-fadeIn">
            {/* Header Info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">{record.profile.name}</h1>
                    <p className="text-xs text-slate-500 mt-1">{record.profile.department} · {record.profile.age}岁</p>
                </div>
                <div className={`px-3 py-1 rounded-full font-bold text-sm border ${riskColor.replace('text', 'border')}`}>
                    {assessment?.riskLevel === 'RED' ? '高风险' : assessment?.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                </div>
            </div>

            {/* Core Metrics */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800">核心指标记录</h3>
                    <button 
                        onClick={() => editMode ? handleSave() : setEditMode(true)}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all ${
                            editMode ? 'bg-teal-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                        {editMode ? '💾 保存同步' : '✏️ 修改数据'}
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <MetricCard label="BMI 指数" value={record.checkup.basics.bmi || '-'} unit="" edit={false} />
                    <MetricCard 
                        label="体重" 
                        value={metrics.weight} 
                        onChange={(v) => setMetrics({...metrics, weight: v})}
                        unit="kg" edit={editMode} 
                    />
                    <MetricCard 
                        label="收缩压" 
                        value={metrics.sbp} 
                        onChange={(v) => setMetrics({...metrics, sbp: v})}
                        unit="mmHg" edit={editMode} warning={metrics.sbp >= 140}
                    />
                    <MetricCard 
                        label="舒张压" 
                        value={metrics.dbp} 
                        onChange={(v) => setMetrics({...metrics, dbp: v})}
                        unit="mmHg" edit={editMode} warning={metrics.dbp >= 90}
                    />
                    <MetricCard 
                        label="空腹血糖" 
                        value={metrics.glucose} 
                        onChange={(v) => setMetrics({...metrics, glucose: v})}
                        unit="mmol/L" edit={editMode} warning={metrics.glucose >= 6.1}
                    />
                    {/* Extended */}
                    {editMode ? (
                        <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300">
                            <p className="text-xs text-slate-400 mb-2">拓展指标 (选填)</p>
                            <div className="flex gap-2">
                                <input placeholder="谷丙转氨酶(ALT)" className="w-1/2 p-2 rounded text-xs" value={metrics.alt} onChange={e=>setMetrics({...metrics, alt: e.target.value})} />
                                <input placeholder="肌酐(Cr)" className="w-1/2 p-2 rounded text-xs" value={metrics.creatinine} onChange={e=>setMetrics({...metrics, creatinine: e.target.value})} />
                            </div>
                        </div>
                    ) : (
                        (metrics.alt || metrics.creatinine) && (
                            <div className="col-span-2 flex gap-4 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                                {metrics.alt && <span>ALT: {metrics.alt}</span>}
                                {metrics.creatinine && <span>Cr: {metrics.creatinine}</span>}
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Risk Report */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-3">健康风险评估报告</h3>
                <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 leading-relaxed mb-4">
                    {assessment?.summary || '暂无评估数据'}
                </div>
                <div className="space-y-2">
                    {assessment?.risks.red.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                            <span>⚠️</span> {r}
                        </div>
                    ))}
                    {assessment?.risks.yellow.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded-lg">
                            <span>⚡</span> {r}
                        </div>
                    ))}
                </div>
            </div>

            {/* Health Advice */}
            <div className="bg-teal-600 text-white p-5 rounded-2xl shadow-lg">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                    <span>💡</span> 医生建议
                </h3>
                <ul className="text-sm space-y-2 list-disc pl-4 opacity-90">
                    {assessment?.managementPlan.dietary.slice(0, 2).map((s, i) => <li key={`d${i}`}>{s}</li>)}
                    {assessment?.managementPlan.exercise.slice(0, 2).map((s, i) => <li key={`e${i}`}>{s}</li>)}
                    {assessment?.managementPlan.medication.slice(0, 1).map((s, i) => <li key={`m${i}`}>{s}</li>)}
                </ul>
            </div>

            {/* Follow Up */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 pb-20">
                <h3 className="font-bold text-slate-800 mb-2">随访提醒</h3>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-10 h-10 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center text-xl">📅</div>
                    <div>
                        <div className="text-xs text-slate-500">建议复查时间</div>
                        <div className="font-bold text-slate-800">{assessment?.followUpPlan.frequency || '近期'}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, unit, edit, onChange, warning }: any) => (
    <div className={`p-3 rounded-xl border ${warning ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
        <div className="text-xs text-slate-400 mb-1">{label}</div>
        <div className="flex items-baseline gap-1">
            {edit ? (
                <input 
                    type="number" 
                    className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 font-bold text-slate-800"
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                />
            ) : (
                <span className={`text-xl font-black ${warning ? 'text-red-600' : 'text-slate-800'}`}>{value}</span>
            )}
            <span className="text-xs text-slate-500">{unit}</span>
        </div>
    </div>
);
