
import React, { useState, useEffect } from 'react';
import { HealthRecord, HealthAssessment } from '../../types';
import { DailyHealthPlan } from '../../services/dataService';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchInteractions, InteractionItem } from '../../services/contentService';

interface Props {
  record: HealthRecord;
  assessment?: HealthAssessment;
  dailyPlan?: DailyHealthPlan;
  userId: string;
  onUpdateRecord: (updatedData: any) => void;
}

export const UserProfile: React.FC<Props> = ({ record, assessment, dailyPlan, userId, onUpdateRecord }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [bookings, setBookings] = useState<InteractionItem[]>([]);
    const [editForm, setEditForm] = useState({
        height: record.checkup.basics.height || 0,
        weight: record.checkup.basics.weight || 0,
        sbp: record.checkup.basics.sbp || 0,
        dbp: record.checkup.basics.dbp || 0,
        glucose: record.checkup.labBasic.glucose?.fasting || '0'
    });

    useEffect(() => {
        const load = async () => {
            const all = await fetchInteractions();
            setBookings(all.filter(i => i.userId === userId));
        };
        load();
    }, [userId]);

    const handleSave = () => {
        const bmi = editForm.height && editForm.weight 
            ? parseFloat((editForm.weight / ((editForm.height/100) * (editForm.height/100))).toFixed(1)) 
            : 0;

        onUpdateRecord({
            basics: {
                height: Number(editForm.height),
                weight: Number(editForm.weight),
                bmi: bmi,
                sbp: Number(editForm.sbp),
                dbp: Number(editForm.dbp)
            },
            labBasic: {
                glucose: { fasting: String(editForm.glucose) }
            }
        });
        setIsEditing(false);
    };

    // Mock Trend Data (In real app, fetch history versions)
    const trendData = [
        { date: '1月', sbp: 135, glu: 5.8 }, 
        { date: '2月', sbp: 130, glu: 5.6 }, 
        { date: '3月', sbp: 128, glu: 5.5 }, 
        { date: '4月', sbp: record.checkup.basics.sbp || 125, glu: parseFloat(record.checkup.labBasic.glucose?.fasting || '5.4') }
    ];

    return (
        <div className="bg-slate-50 min-h-full pb-20">
            {/* Header / ID Card */}
            <div className="bg-teal-700 text-white p-6 pb-20 relative">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl border-2 border-white/30 backdrop-blur-sm">
                        {record.profile.gender === '女' ? '👩' : '👨'}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{record.profile.name}</h1>
                        <div className="text-xs opacity-80 mt-1 flex items-center gap-2">
                            <span className="bg-white/20 px-2 py-0.5 rounded">{record.profile.department}</span>
                            <span>{record.profile.age}岁</span>
                        </div>
                    </div>
                </div>
                <div className="absolute top-6 right-6">
                    <button onClick={() => setIsEditing(!isEditing)} className="text-white/90 hover:text-white bg-white/20 px-3 py-1 rounded text-xs font-bold">
                        {isEditing ? '取消' : '修改资料'}
                    </button>
                </div>
            </div>

            <div className="px-4 -mt-14 space-y-6">
                
                {/* 1. Health Status / Edit Card */}
                <div className="bg-white rounded-2xl shadow-lg p-5 border border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 text-sm">基本指标</h3>
                        {isEditing && (
                            <button onClick={handleSave} className="text-xs bg-teal-600 text-white px-3 py-1 rounded font-bold">保存</button>
                        )}
                    </div>
                    
                    {isEditing ? (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <label className="block text-xs text-slate-400">身高(cm)</label>
                                <input className="w-full border p-1 rounded" type="number" value={editForm.height} onChange={e => setEditForm({...editForm, height: e.target.value as any})} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400">体重(kg)</label>
                                <input className="w-full border p-1 rounded" type="number" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: e.target.value as any})} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400">收缩压</label>
                                <input className="w-full border p-1 rounded" type="number" value={editForm.sbp} onChange={e => setEditForm({...editForm, sbp: e.target.value as any})} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400">舒张压</label>
                                <input className="w-full border p-1 rounded" type="number" value={editForm.dbp} onChange={e => setEditForm({...editForm, dbp: e.target.value as any})} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400">血糖</label>
                                <input className="w-full border p-1 rounded" type="number" step="0.1" value={editForm.glucose} onChange={e => setEditForm({...editForm, glucose: e.target.value})} />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2 text-center mb-4">
                            <div className="p-2 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-400 mb-1">BMI</div>
                                <div className="font-bold text-slate-700">{record.checkup.basics.bmi || '-'}</div>
                            </div>
                            <div className="p-2 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-400 mb-1">血压</div>
                                <div className="font-bold text-slate-700">{record.checkup.basics.sbp}/{record.checkup.basics.dbp}</div>
                            </div>
                            <div className="p-2 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-400 mb-1">血糖</div>
                                <div className="font-bold text-slate-700">{record.checkup.labBasic.glucose?.fasting || '-'}</div>
                            </div>
                        </div>
                    )}

                    {/* Mini Trend */}
                    {!isEditing && (
                        <>
                            <div className="h-24 w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData}>
                                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{fontSize:'10px'}} />
                                        <Line type="monotone" dataKey="sbp" name="血压" stroke="#ef4444" strokeWidth={2} dot={{r:2}} />
                                        <Line type="monotone" dataKey="glu" name="血糖" stroke="#0ea5e9" strokeWidth={2} dot={{r:2}} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-[10px] text-center text-slate-400 mt-1">指标变化趋势</p>
                        </>
                    )}
                </div>

                {/* 2. My Daily Plan */}
                {dailyPlan && (
                    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl shadow-sm p-4 border border-indigo-100">
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                                <span>📅</span> 我的今日方案
                            </h3>
                            <span className="text-[10px] text-indigo-400">{new Date(dailyPlan.generatedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="space-y-3 text-xs">
                            <div className="bg-white p-2 rounded border border-indigo-50">
                                <span className="font-bold text-orange-600 block mb-1">饮食:</span>
                                {dailyPlan.diet.breakfast} | {dailyPlan.diet.lunch}
                            </div>
                            <div className="bg-white p-2 rounded border border-indigo-50">
                                <span className="font-bold text-blue-600 block mb-1">运动:</span>
                                {dailyPlan.exercise.morning} | {dailyPlan.exercise.evening}
                            </div>
                            <div className="text-indigo-600 italic">"{dailyPlan.tips}"</div>
                        </div>
                    </div>
                )}

                {/* 3. My Bookings / Requests */}
                <div className="bg-white p-4 rounded-xl border border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm mb-3">我的申请与预约</h3>
                    {bookings.length === 0 ? (
                        <p className="text-xs text-slate-400">暂无记录</p>
                    ) : (
                        <div className="space-y-2">
                            {bookings.map(b => (
                                <div key={b.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded">
                                    <div>
                                        <span className={`font-bold ${b.type==='signing'?'text-blue-600':b.type==='drug_order'?'text-orange-600':'text-teal-600'}`}>
                                            [{b.type==='signing'?'签约':b.type==='drug_order'?'开药':'预约'}]
                                        </span>
                                        <span className="ml-2 text-slate-700">{b.targetName}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded ${
                                        b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                        b.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {b.status === 'confirmed' ? '通过' : b.status === 'cancelled' ? '拒绝' : '审核中'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="h-6"></div>
            </div>
        </div>
    );
};
